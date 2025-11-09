/**
 * Clarity Pipeline
 * Orchestrates two-pass Gaussian blur and clarity composite for high-quality clarity effect
 * 
 * Pipeline flow:
 * 1. Render original image to framebuffer
 * 2. Apply horizontal Gaussian blur
 * 3. Apply vertical Gaussian blur
 * 4. Composite blurred with original using high-pass filter
 */

import { FramebufferManager } from './framebufferManager';
import { ShaderCompiler } from './shaderUtils';
import type { ShaderProgram } from './shaderUtils';
import {
  gaussianBlurVertexShader,
  gaussianBlurFragmentShader,
  applyGaussianBlurUniforms,
  createHorizontalBlurParams,
  createVerticalBlurParams,
} from './shaders/gaussianBlur';
import {
  clarityCompositeVertexShader,
  clarityCompositeFragmentShader,
  applyClarityCompositeUniforms,
} from './shaders/clarityComposite';
import { setupQuadAttributes, renderQuad } from './shaders/base';

export interface ClarityPipelineConfig {
  blurRadius: number; // Blur radius in pixels (default: 5.0 for good clarity effect)
}

export class ClarityPipeline {
  private gl: WebGL2RenderingContext;
  private framebufferManager: FramebufferManager;
  private shaderCompiler: ShaderCompiler;

  private blurProgram: ShaderProgram | null = null;
  private compositeProgram: ShaderProgram | null = null;

  private horizontalBlurFB: WebGLFramebuffer | null = null;
  private horizontalBlurTexture: WebGLTexture | null = null;
  private verticalBlurFB: WebGLFramebuffer | null = null;
  private verticalBlurTexture: WebGLTexture | null = null;

  private config: ClarityPipelineConfig;
  private currentWidth = 0;
  private currentHeight = 0;

  constructor(
    gl: WebGL2RenderingContext,
    framebufferManager: FramebufferManager,
    config: Partial<ClarityPipelineConfig> = {}
  ) {
    this.gl = gl;
    this.framebufferManager = framebufferManager;
    this.shaderCompiler = new ShaderCompiler(gl);

    this.config = {
      blurRadius: config.blurRadius ?? 5.0,
    };

    this.initialize();
  }

  private initialize(): void {
    // Compile blur shader
    this.blurProgram = this.shaderCompiler.createProgram(
      gaussianBlurVertexShader,
      gaussianBlurFragmentShader,
      ['u_texture', 'u_direction', 'u_radius'],
      ['a_position', 'a_texCoord']
    );

    // Compile composite shader
    this.compositeProgram = this.shaderCompiler.createProgram(
      clarityCompositeVertexShader,
      clarityCompositeFragmentShader,
      ['u_original', 'u_blurred', 'u_clarity'],
      ['a_position', 'a_texCoord']
    );
  }

  /**
   * Apply clarity effect using two-pass Gaussian blur
   * 
   * @param inputTexture - Original image texture
   * @param outputFramebuffer - Target framebuffer (null for canvas)
   * @param width - Image width
   * @param height - Image height
   * @param clarity - Clarity amount (-100 to +100)
   * @param quadVAO - Quad VAO for rendering
   * @param positionBuffer - Position buffer
   * @param texCoordBuffer - Texture coordinate buffer
   */
  public applyClarity(
    inputTexture: WebGLTexture,
    outputFramebuffer: WebGLFramebuffer | null,
    width: number,
    height: number,
    clarity: number,
    quadVAO: WebGLVertexArrayObject,
    positionBuffer: WebGLBuffer,
    texCoordBuffer: WebGLBuffer
  ): void {
    // Skip if clarity is near zero (optimization)
    if (Math.abs(clarity) < 0.01) {
      // Just copy input to output
      this.copyTexture(
        inputTexture,
        outputFramebuffer,
        width,
        height,
        quadVAO,
        positionBuffer,
        texCoordBuffer
      );
      return;
    }

    // Create or reuse framebuffers if dimensions changed
    if (width !== this.currentWidth || height !== this.currentHeight) {
      this.createFramebuffers(width, height);
      this.currentWidth = width;
      this.currentHeight = height;
    }

    if (!this.blurProgram || !this.compositeProgram) {
      throw new Error('Clarity pipeline not initialized');
    }

    if (!this.horizontalBlurFB || !this.verticalBlurFB) {
      throw new Error('Clarity framebuffers not created');
    }

    // Pass 1: Horizontal Gaussian blur
    this.framebufferManager.bindFramebuffer(this.horizontalBlurFB);
    this.gl.viewport(0, 0, width, height);
    this.gl.useProgram(this.blurProgram.program);

    const blurPosLocation = this.blurProgram.attributes.get('a_position') ?? 0;
    const blurTexCoordLocation = this.blurProgram.attributes.get('a_texCoord') ?? 0;

    setupQuadAttributes(
      this.gl,
      quadVAO,
      positionBuffer,
      texCoordBuffer,
      blurPosLocation,
      blurTexCoordLocation
    );

    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, inputTexture);
    const blurTextureLocation = this.blurProgram.uniforms.get('u_texture');
    if (blurTextureLocation) {
      this.gl.uniform1i(blurTextureLocation, 0);
    }

    applyGaussianBlurUniforms(
      this.gl,
      this.blurProgram.uniforms,
      createHorizontalBlurParams(this.config.blurRadius)
    );

    renderQuad(this.gl, quadVAO);

    // Pass 2: Vertical Gaussian blur
    this.framebufferManager.bindFramebuffer(this.verticalBlurFB);
    this.gl.viewport(0, 0, width, height);

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.horizontalBlurTexture!);

    applyGaussianBlurUniforms(
      this.gl,
      this.blurProgram.uniforms,
      createVerticalBlurParams(this.config.blurRadius)
    );

    renderQuad(this.gl, quadVAO);

    // Pass 3: Composite original with blurred
    this.framebufferManager.bindFramebuffer(outputFramebuffer);
    this.gl.viewport(0, 0, width, height);
    this.gl.useProgram(this.compositeProgram.program);

    const compositePosLocation = this.compositeProgram.attributes.get('a_position') ?? 0;
    const compositeTexCoordLocation = this.compositeProgram.attributes.get('a_texCoord') ?? 0;

    setupQuadAttributes(
      this.gl,
      quadVAO,
      positionBuffer,
      texCoordBuffer,
      compositePosLocation,
      compositeTexCoordLocation
    );

    // Bind original texture to texture unit 0
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, inputTexture);
    const originalLocation = this.compositeProgram.uniforms.get('u_original');
    if (originalLocation) {
      this.gl.uniform1i(originalLocation, 0);
    }

    // Bind blurred texture to texture unit 1
    this.gl.activeTexture(this.gl.TEXTURE1);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.verticalBlurTexture!);
    const blurredLocation = this.compositeProgram.uniforms.get('u_blurred');
    if (blurredLocation) {
      this.gl.uniform1i(blurredLocation, 1);
    }

    // Apply clarity amount
    applyClarityCompositeUniforms(this.gl, this.compositeProgram.uniforms, { clarity });

    renderQuad(this.gl, quadVAO);

    // Cleanup
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    this.gl.activeTexture(this.gl.TEXTURE1);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
  }

  /**
   * Copy texture to output (used when clarity is disabled)
   */
  private copyTexture(
    inputTexture: WebGLTexture,
    outputFramebuffer: WebGLFramebuffer | null,
    width: number,
    height: number,
    quadVAO: WebGLVertexArrayObject,
    positionBuffer: WebGLBuffer,
    texCoordBuffer: WebGLBuffer
  ): void {
    if (!this.compositeProgram) return;

    this.framebufferManager.bindFramebuffer(outputFramebuffer);
    this.gl.viewport(0, 0, width, height);
    this.gl.useProgram(this.compositeProgram.program);

    const posLocation = this.compositeProgram.attributes.get('a_position') ?? 0;
    const texCoordLocation = this.compositeProgram.attributes.get('a_texCoord') ?? 0;

    setupQuadAttributes(
      this.gl,
      quadVAO,
      positionBuffer,
      texCoordBuffer,
      posLocation,
      texCoordLocation
    );

    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, inputTexture);
    const originalLocation = this.compositeProgram.uniforms.get('u_original');
    if (originalLocation) {
      this.gl.uniform1i(originalLocation, 0);
    }

    // Use same texture for blurred (no effect)
    this.gl.activeTexture(this.gl.TEXTURE1);
    this.gl.bindTexture(this.gl.TEXTURE_2D, inputTexture);
    const blurredLocation = this.compositeProgram.uniforms.get('u_blurred');
    if (blurredLocation) {
      this.gl.uniform1i(blurredLocation, 1);
    }

    // Set clarity to 0
    applyClarityCompositeUniforms(this.gl, this.compositeProgram.uniforms, { clarity: 0 });

    renderQuad(this.gl, quadVAO);

    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
  }

  /**
   * Create framebuffers for blur passes
   */
  private createFramebuffers(width: number, height: number): void {
    // Release old framebuffers if they exist
    if (this.horizontalBlurFB) {
      this.framebufferManager.releaseFramebuffer(this.horizontalBlurFB);
    }
    if (this.verticalBlurFB) {
      this.framebufferManager.releaseFramebuffer(this.verticalBlurFB);
    }

    // Create horizontal blur framebuffer
    const horizontalResult = this.framebufferManager.getFramebuffer({
      width,
      height,
      format: 'rgba16f',
    });
    this.horizontalBlurFB = horizontalResult.framebuffer;
    this.horizontalBlurTexture = horizontalResult.texture;

    // Create vertical blur framebuffer
    const verticalResult = this.framebufferManager.getFramebuffer({
      width,
      height,
      format: 'rgba16f',
    });
    this.verticalBlurFB = verticalResult.framebuffer;
    this.verticalBlurTexture = verticalResult.texture;
  }

  /**
   * Update blur radius
   */
  public setBlurRadius(radius: number): void {
    this.config.blurRadius = radius;
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    if (this.horizontalBlurFB) {
      this.framebufferManager.releaseFramebuffer(this.horizontalBlurFB);
    }
    if (this.verticalBlurFB) {
      this.framebufferManager.releaseFramebuffer(this.verticalBlurFB);
    }

    if (this.blurProgram) {
      this.shaderCompiler.deleteProgram(this.blurProgram.program);
    }
    if (this.compositeProgram) {
      this.shaderCompiler.deleteProgram(this.compositeProgram.program);
    }
  }
}
