/**
 * Export Renderer
 * High-quality WebGL-based renderer for export
 * Requirements 14.1, 14.2, 14.3, 14.4, 14.5
 */

import { WebGLContextManager } from './webglContext';
import { ShaderPipeline } from './shaderPipeline';
import type { AdjustmentState } from '../types/adjustments';
import { ShaderCompiler } from './shaderUtils';
import type { ShaderProgram } from './shaderUtils';
import { ditheringVertexShader, ditheringFragmentShader, applyDitheringUniforms } from './ditheringShader';
import { createQuadGeometry, setupQuadAttributes, renderQuad } from './shaders/base';

export interface ExportRenderConfig {
  enableDithering: boolean; // Requirement 14.3: Add dithering when converting to 8-bit
  ditherStrength: number; // 0.0 to 1.0
  preserveColorSpace: boolean; // Requirement 14.5: Minimize color space conversions
}

export class ExportRenderer {
  private contextManager: WebGLContextManager | null = null;
  private pipeline: ShaderPipeline | null = null;
  private canvas: OffscreenCanvas | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private shaderCompiler: ShaderCompiler | null = null;
  private ditheringProgram: ShaderProgram | null = null;
  private quadGeometry: ReturnType<typeof createQuadGeometry> | null = null;

  /**
   * Render image at full resolution with all adjustments applied
   * Requirements:
   * - 14.1: Use 16-bit float textures for all processing
   * - 14.2: Render at full resolution during export
   * - 14.3: Add dithering when converting to 8-bit
   * - 14.4: Preserve dynamic range of RAW images
   * - 14.5: Minimize color space conversions
   */
  public async renderToImageData(
    imageData: ImageData,
    adjustments: AdjustmentState,
    config: Partial<ExportRenderConfig> = {}
  ): Promise<ImageData> {
    const fullConfig: ExportRenderConfig = {
      enableDithering: config.enableDithering ?? true,
      ditherStrength: config.ditherStrength ?? 0.5,
      preserveColorSpace: config.preserveColorSpace ?? true,
    };

    try {
      // Create offscreen canvas at full resolution (Requirement 14.2)
      this.canvas = new OffscreenCanvas(imageData.width, imageData.height);
      
      // Get WebGL2 context with high precision
      const gl = this.canvas.getContext('webgl2', {
        antialias: false,
        preserveDrawingBuffer: true,
        premultipliedAlpha: false,
        alpha: false,
        // Request high precision for better quality (Requirement 14.1, 14.4)
        powerPreference: 'high-performance',
      });

      if (!gl) {
        throw new Error('Failed to create WebGL2 context for export');
      }

      this.gl = gl;

      // Create context manager with canvas config
      this.contextManager = new WebGLContextManager({
        canvas: this.canvas as HTMLCanvasElement | OffscreenCanvas,
      });

      // Create shader pipeline in export mode (full resolution, no downscaling)
      // Requirement 14.1: Uses 16-bit float textures internally
      // Requirement 14.2: Renders at full resolution
      this.pipeline = new ShaderPipeline(this.contextManager, {
        qualityMode: 'export', // Full resolution, no downscaling
        maxPreviewSize: Math.max(imageData.width, imageData.height),
        enableToneMapping: true,
        toneMappingMode: 'aces', // Higher quality tone mapping for export
        enablePerformanceMonitoring: false, // Not needed for export
        enableRenderScheduler: false, // Render immediately for export
      });

      // Load image at full resolution
      this.pipeline.loadImage(imageData);

      // Render with adjustments
      // Requirement 14.4: Preserves dynamic range through 16-bit float pipeline
      // Requirement 14.5: Minimizes color space conversions (only at input/output)
      this.pipeline.render(adjustments);

      // Wait for render to complete
      await this.waitForRender();

      // Apply dithering if enabled (Requirement 14.3)
      if (fullConfig.enableDithering) {
        await this.applyDithering(fullConfig.ditherStrength);
      }

      // Read pixels from canvas
      const pixels = new Uint8ClampedArray(imageData.width * imageData.height * 4);
      gl.readPixels(
        0,
        0,
        imageData.width,
        imageData.height,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels
      );

      // Flip vertically (WebGL has origin at bottom-left)
      const flippedPixels = this.flipImageVertically(pixels, imageData.width, imageData.height);

      // Create ImageData from pixels
      // Need to create a new Uint8ClampedArray to satisfy TypeScript
      const resultPixels = new Uint8ClampedArray(flippedPixels);
      return new ImageData(resultPixels, imageData.width, imageData.height);
    } finally {
      // Clean up resources
      this.dispose();
    }
  }

  /**
   * Wait for render to complete
   */
  private async waitForRender(): Promise<void> {
    if (!this.gl) return;

    // Use fence sync to wait for GPU to finish
    const sync = this.gl.fenceSync(this.gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!sync) {
      // Fallback: just flush and wait a bit
      this.gl.flush();
      await new Promise(resolve => setTimeout(resolve, 100));
      return;
    }

    // Wait for sync with timeout
    const timeout = 5000; // 5 seconds
    const startTime = Date.now();

    while (true) {
      const status = this.gl.clientWaitSync(sync, 0, 0);
      
      if (status === this.gl.ALREADY_SIGNALED || status === this.gl.CONDITION_SATISFIED) {
        this.gl.deleteSync(sync);
        return;
      }

      if (status === this.gl.WAIT_FAILED) {
        this.gl.deleteSync(sync);
        throw new Error('GPU sync wait failed');
      }

      if (Date.now() - startTime > timeout) {
        this.gl.deleteSync(sync);
        throw new Error('GPU sync timeout');
      }

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Apply dithering pass to reduce banding when converting to 8-bit
   * Requirement 14.3: Add dithering when converting to 8-bit
   */
  private async applyDithering(ditherStrength: number): Promise<void> {
    if (!this.gl || !this.canvas) {
      throw new Error('WebGL context not initialized');
    }

    // Initialize dithering shader if needed
    if (!this.ditheringProgram) {
      this.shaderCompiler = new ShaderCompiler(this.gl);
      this.ditheringProgram = this.shaderCompiler.createProgram(
        ditheringVertexShader,
        ditheringFragmentShader,
        ['u_texture', 'u_resolution', 'u_ditherStrength'],
        ['a_position', 'a_texCoord']
      );
      this.quadGeometry = createQuadGeometry(this.gl);
    }

    // Read current canvas content to texture
    const texture = this.gl.createTexture();
    if (!texture) {
      throw new Error('Failed to create texture for dithering');
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.canvas.width,
      this.canvas.height,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      null
    );

    // Copy canvas to texture
    this.gl.copyTexImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      0,
      0,
      this.canvas.width,
      this.canvas.height,
      0
    );

    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

    // Render with dithering
    this.gl.useProgram(this.ditheringProgram.program);

    // Setup quad attributes
    const posLocation = this.ditheringProgram.attributes.get('a_position') ?? 0;
    const texCoordLocation = this.ditheringProgram.attributes.get('a_texCoord') ?? 0;

    setupQuadAttributes(
      this.gl,
      this.quadGeometry!.vao,
      this.quadGeometry!.positionBuffer,
      this.quadGeometry!.texCoordBuffer,
      posLocation,
      texCoordLocation
    );

    // Bind texture
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    const textureLocation = this.ditheringProgram.uniforms.get('u_texture');
    if (textureLocation) {
      this.gl.uniform1i(textureLocation, 0);
    }

    // Apply uniforms
    applyDitheringUniforms(this.gl, this.ditheringProgram.uniforms, {
      resolution: { width: this.canvas.width, height: this.canvas.height },
      ditherStrength,
    });

    // Render
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    renderQuad(this.gl, this.quadGeometry!.vao);

    // Clean up
    this.gl.deleteTexture(texture);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
  }

  /**
   * Flip image vertically (WebGL has origin at bottom-left, ImageData at top-left)
   */
  private flipImageVertically(
    pixels: Uint8ClampedArray,
    width: number,
    height: number
  ): Uint8ClampedArray {
    const flipped = new Uint8ClampedArray(pixels.length);
    const rowSize = width * 4;

    for (let y = 0; y < height; y++) {
      const sourceRow = (height - 1 - y) * rowSize;
      const destRow = y * rowSize;
      flipped.set(pixels.subarray(sourceRow, sourceRow + rowSize), destRow);
    }

    return flipped;
  }

  /**
   * Dispose all resources
   */
  private dispose(): void {
    if (this.pipeline) {
      this.pipeline.dispose();
      this.pipeline = null;
    }

    if (this.ditheringProgram && this.shaderCompiler) {
      this.shaderCompiler.deleteProgram(this.ditheringProgram.program);
      this.ditheringProgram = null;
    }

    if (this.shaderCompiler) {
      this.shaderCompiler = null;
    }

    if (this.quadGeometry && this.gl) {
      this.gl.deleteVertexArray(this.quadGeometry.vao);
      this.gl.deleteBuffer(this.quadGeometry.positionBuffer);
      this.gl.deleteBuffer(this.quadGeometry.texCoordBuffer);
      this.quadGeometry = null;
    }

    if (this.contextManager) {
      this.contextManager.dispose();
      this.contextManager = null;
    }

    this.gl = null;
    this.canvas = null;
  }
}
