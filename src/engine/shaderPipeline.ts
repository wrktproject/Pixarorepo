/**
 * Shader Pipeline Orchestrator
 * Manages multi-pass rendering with shader chaining and dirty flagging
 */

import { WebGLContextManager } from './webglContext';
import { TextureManager } from './textureManager';
import { FramebufferManager } from './framebufferManager';
import { ShaderCompiler } from './shaderUtils';
import type { ShaderProgram } from './shaderUtils';
import { RenderScheduler } from './renderScheduler';
import type { PerformanceStats } from './renderScheduler';
import { PerformanceProfiler } from './performanceProfiler';
import type { PerformanceProfile } from './performanceProfiler';
import {
  baseVertexShader,
  baseFragmentShader,
  createQuadGeometry,
  setupQuadAttributes,
  renderQuad,
} from './shaders/base';
import { tonalVertexShader, tonalFragmentShader, applyTonalUniforms } from './shaders/tonal';
import { colorVertexShader, colorFragmentShader, applyColorUniforms } from './shaders/color';
import { hslVertexShader, hslFragmentShader, applyHSLUniforms } from './shaders/hsl';
import { detailVertexShader, detailFragmentShader, applyDetailUniforms } from './shaders/detail';
import {
  effectsVertexShader,
  effectsFragmentShader,
  applyEffectsUniforms,
} from './shaders/effects';
import {
  geometricVertexShader,
  geometricFragmentShader,
  applyGeometricUniforms,
} from './shaders/geometric';
import {
  outputVertexShader,
  outputFragmentShader,
  applyOutputUniforms,
} from './shaders/output';
import { ClarityPipeline } from './clarityPipeline';
import type { AdjustmentState } from '../types/adjustments';
import { downscaleImageData } from '../utils/imageDownscaling';

interface PipelineConfig {
  maxPreviewSize: number;
  enableToneMapping: boolean;
  toneMappingMode: 'reinhard' | 'aces';
  enablePerformanceMonitoring: boolean;
  qualityMode: 'preview' | 'export'; // Preview uses downscaling, export uses full resolution
  enableRenderScheduler: boolean; // Use RenderScheduler for optimized rendering (Requirement 13.1, 13.2, 13.3)
  targetFPS: number; // Target frame rate for render scheduler (Requirement 13.1)
  minFPS: number; // Minimum FPS before frame skipping (Requirement 13.3, 13.4)
}

interface ShaderPass {
  name: string;
  program: ShaderProgram | null; // null for multi-pass effects like clarity
  isDirty: boolean;
}

interface PerformanceMetrics {
  lastFrameTime: number;
  averageFrameTime: number;
  frameCount: number;
  passTimings: Map<string, number>;
}

export class ShaderPipeline {
  private textureManager: TextureManager;
  private framebufferManager: FramebufferManager;
  private shaderCompiler: ShaderCompiler;
  private renderScheduler: RenderScheduler;
  private profiler: PerformanceProfiler;
  private gl: WebGL2RenderingContext;

  private config: PipelineConfig;
  private quadGeometry: ReturnType<typeof createQuadGeometry> | null = null;

  // Shader programs
  private baseProgram: ShaderProgram | null = null;
  private geometricProgram: ShaderProgram | null = null;
  private tonalProgram: ShaderProgram | null = null;
  private colorProgram: ShaderProgram | null = null;
  private hslProgram: ShaderProgram | null = null;
  private detailProgram: ShaderProgram | null = null;
  private effectsProgram: ShaderProgram | null = null;
  private outputProgram: ShaderProgram | null = null;

  // Multi-pass pipelines
  private clarityPipeline: ClarityPipeline | null = null;

  // Shader passes
  private passes: ShaderPass[] = [];

  // Textures and framebuffers
  private sourceTexture: WebGLTexture | null = null;
  private intermediateTextures: WebGLTexture[] = [];
  private framebuffers: WebGLFramebuffer[] = [];

  // Current state
  private currentAdjustments: AdjustmentState | null = null;
  private imageWidth = 0;
  private imageHeight = 0;
  private previewWidth = 0;
  private previewHeight = 0;

  // Performance monitoring
  private performanceMetrics: PerformanceMetrics = {
    lastFrameTime: 0,
    averageFrameTime: 0,
    frameCount: 0,
    passTimings: new Map(),
  };
  private renderStartTime = 0;

  constructor(
    contextManager: WebGLContextManager,
    config: Partial<PipelineConfig> = {}
  ) {
    this.gl = contextManager.getContext();
    this.textureManager = new TextureManager(this.gl);
    this.framebufferManager = new FramebufferManager(this.gl);
    this.shaderCompiler = new ShaderCompiler(this.gl);

    this.config = {
      maxPreviewSize: config.maxPreviewSize ?? 2048,
      enableToneMapping: config.enableToneMapping ?? false,
      toneMappingMode: config.toneMappingMode ?? 'reinhard',
      enablePerformanceMonitoring: config.enablePerformanceMonitoring ?? true,
      qualityMode: config.qualityMode ?? 'preview',
      enableRenderScheduler: config.enableRenderScheduler ?? true,
      targetFPS: config.targetFPS ?? 60,
      minFPS: config.minFPS ?? 30,
    };

    // Initialize render scheduler (Requirement 13.1, 13.2, 13.3, 13.4)
    this.renderScheduler = new RenderScheduler({
      targetFPS: this.config.targetFPS,
      minFPS: this.config.minFPS,
      batchDelay: 16, // ~1 frame at 60fps for batching slider changes
      enableFrameSkipping: true,
      enablePerformanceMonitoring: this.config.enablePerformanceMonitoring,
    });

    // Initialize performance profiler (Requirement 17)
    this.profiler = new PerformanceProfiler({
      enabled: this.config.enablePerformanceMonitoring,
      sampleSize: 60,
      logInterval: 5000,
      enableDetailedProfiling: true,
    });
    this.profiler.setTargetFPS(this.config.targetFPS);

    // Connect profiler to managers
    this.textureManager.setProfilerCallback((bytes, duration, wasReused) => {
      this.profiler.recordTextureUpload(bytes, duration, wasReused);
    });

    this.framebufferManager.setProfilerCallbacks({
      onPoolHit: () => this.profiler.recordFramebufferPoolHit(),
      onPoolMiss: () => this.profiler.recordFramebufferPoolMiss(),
      onCreate: () => this.profiler.recordFramebufferCreated(),
      onDelete: () => this.profiler.recordFramebufferDeleted(),
    });

    this.initialize();
  }

  private initialize(): void {
    // Create quad geometry
    this.quadGeometry = createQuadGeometry(this.gl);

    // Compile all shaders (Requirement 13.5: upfront compilation for caching)
    this.compileShaders();

    // Initialize clarity pipeline
    this.clarityPipeline = new ClarityPipeline(this.gl, this.framebufferManager);

    // Set up render scheduler callback (Requirement 13.1)
    this.renderScheduler.setRenderCallback(() => {
      this.executeRender();
    });

    // Mark all passes as dirty initially
    this.markAllDirty();
  }

  private compileShaders(): void {
    // Requirement 13.5: Optimize shader compilation and caching
    // ShaderCompiler already implements caching, but we ensure all shaders
    // are compiled upfront during initialization to avoid runtime compilation delays

    // Base shader
    this.baseProgram = this.shaderCompiler.createProgram(
      baseVertexShader,
      baseFragmentShader,
      ['u_texture'],
      ['a_position', 'a_texCoord']
    );

    // Geometric shader (crop and rotation)
    this.geometricProgram = this.shaderCompiler.createProgram(
      geometricVertexShader,
      geometricFragmentShader,
      ['u_texture', 'u_imageSize', 'u_cropBounds', 'u_rotationAngle', 'u_hasCrop'],
      ['a_position', 'a_texCoord']
    );

    // Tonal shader
    this.tonalProgram = this.shaderCompiler.createProgram(
      tonalVertexShader,
      tonalFragmentShader,
      [
        'u_texture',
        'u_exposure',
        'u_contrast',
        'u_highlights',
        'u_shadows',
        'u_whites',
        'u_blacks',
      ],
      ['a_position', 'a_texCoord']
    );

    // Color shader
    this.colorProgram = this.shaderCompiler.createProgram(
      colorVertexShader,
      colorFragmentShader,
      ['u_texture', 'u_temperature', 'u_tint', 'u_vibrance', 'u_saturation'],
      ['a_position', 'a_texCoord']
    );

    // HSL shader
    this.hslProgram = this.shaderCompiler.createProgram(
      hslVertexShader,
      hslFragmentShader,
      [
        'u_texture',
        'u_red',
        'u_orange',
        'u_yellow',
        'u_green',
        'u_aqua',
        'u_blue',
        'u_purple',
        'u_magenta',
      ],
      ['a_position', 'a_texCoord']
    );

    // Detail shader (clarity removed - now handled by ClarityPipeline)
    this.detailProgram = this.shaderCompiler.createProgram(
      detailVertexShader,
      detailFragmentShader,
      [
        'u_texture',
        'u_texelSize',
        'u_sharpening',
        'u_noiseReductionLuma',
        'u_noiseReductionColor',
      ],
      ['a_position', 'a_texCoord']
    );

    // Effects shader
    this.effectsProgram = this.shaderCompiler.createProgram(
      effectsVertexShader,
      effectsFragmentShader,
      [
        'u_texture',
        'u_vignetteAmount',
        'u_vignetteMidpoint',
        'u_vignetteFeather',
        'u_grainAmount',
        'u_grainSize',
        'u_time',
      ],
      ['a_position', 'a_texCoord']
    );

    // Output shader (tone mapping and sRGB conversion)
    this.outputProgram = this.shaderCompiler.createProgram(
      outputVertexShader,
      outputFragmentShader,
      ['u_texture', 'u_enableToneMapping', 'u_toneMappingMode'],
      ['a_position', 'a_texCoord']
    );

    // Initialize passes (geometric first to apply crop/rotation before other adjustments)
    // Clarity is handled separately as a multi-pass effect
    // Output is the final pass that applies tone mapping and converts to sRGB
    this.passes = [
      { name: 'base', program: this.baseProgram, isDirty: true },
      { name: 'geometric', program: this.geometricProgram, isDirty: true },
      { name: 'tonal', program: this.tonalProgram, isDirty: true },
      { name: 'color', program: this.colorProgram, isDirty: true },
      { name: 'hsl', program: this.hslProgram, isDirty: true },
      { name: 'clarity', program: null, isDirty: true }, // Multi-pass effect
      { name: 'detail', program: this.detailProgram, isDirty: true },
      { name: 'effects', program: this.effectsProgram, isDirty: true },
      { name: 'output', program: this.outputProgram, isDirty: true },
    ];
  }

  /**
   * Load an image into the pipeline
   * Optimizes texture uploads by reusing existing texture when possible (Requirement 8.4)
   * Requirement 14.5: Minimizes color space conversions
   * - Input: sRGB ImageData (8-bit) -> Linear RGB (float) in base shader
   * - Processing: All operations in linear RGB space
   * - Output: Linear RGB -> sRGB in output shader
   */
  public loadImage(imageData: ImageData): void {
    this.imageWidth = imageData.width;
    this.imageHeight = imageData.height;

    // Calculate preview dimensions
    this.calculatePreviewSize();

    // Downscale if needed
    const scaledImageData = this.downscaleImageData(imageData);

    // Create or update source texture (optimized for reuse)
    // Requirement 14.5: Input texture stays in sRGB, conversion happens in shader
    this.sourceTexture = this.textureManager.createOrUpdateTextureFromImageData(
      this.sourceTexture,
      scaledImageData
    );

    // Create intermediate textures and framebuffers
    // Requirement 14.1: Uses 16-bit float textures for quality preservation
    this.createIntermediateResources();

    // Mark all passes as dirty
    this.markAllDirty();
  }

  /**
   * Calculate preview size maintaining aspect ratio
   * In export mode, uses full resolution (Requirement 8.5)
   */
  private calculatePreviewSize(): void {
    // In export mode, use full resolution (Requirement 8.5, 14.3)
    if (this.config.qualityMode === 'export') {
      this.previewWidth = this.imageWidth;
      this.previewHeight = this.imageHeight;
      return;
    }

    // In preview mode, downscale to maxPreviewSize (Requirement 8.4)
    const maxSize = this.config.maxPreviewSize;

    if (this.imageWidth <= maxSize && this.imageHeight <= maxSize) {
      this.previewWidth = this.imageWidth;
      this.previewHeight = this.imageHeight;
      return;
    }

    const aspectRatio = this.imageWidth / this.imageHeight;

    if (this.imageWidth > this.imageHeight) {
      this.previewWidth = maxSize;
      this.previewHeight = Math.round(maxSize / aspectRatio);
    } else {
      this.previewHeight = maxSize;
      this.previewWidth = Math.round(maxSize * aspectRatio);
    }
  }

  /**
   * Downscale image data for preview
   * In export mode, returns original image data (Requirement 8.5, 14.3)
   */
  private downscaleImageData(imageData: ImageData): ImageData {
    // In export mode, use full resolution without downscaling
    if (this.config.qualityMode === 'export') {
      return imageData;
    }

    // In preview mode, downscale if needed
    if (
      imageData.width === this.previewWidth &&
      imageData.height === this.previewHeight
    ) {
      return imageData;
    }

    const result = downscaleImageData(imageData, {
      maxSize: this.config.maxPreviewSize,
      quality: 'high',
    });

    return result.imageData;
  }

  /**
   * Create intermediate textures and framebuffers for multi-pass rendering
   * Requirement 14.1: Use 16-bit float textures for all processing
   */
  private createIntermediateResources(): void {
    // Clean up existing resources
    this.intermediateTextures.forEach((tex) => this.textureManager.deleteTexture(tex));
    this.framebuffers.forEach((fb) => this.framebufferManager.deleteFramebuffer(fb));
    this.intermediateTextures = [];
    this.framebuffers = [];

    // Determine texture format based on quality mode
    // Requirement 14.1: Use 16-bit float textures for export quality
    const textureFormat = this.config.qualityMode === 'export' ? 'rgba16f' : 'rgba16f';

    // Create resources for each pass (except the last one which renders to canvas)
    for (let i = 0; i < this.passes.length - 1; i++) {
      const { framebuffer, texture } = this.framebufferManager.createFramebuffer({
        width: this.previewWidth,
        height: this.previewHeight,
        format: textureFormat, // Requirement 14.1: Use 16-bit float for quality preservation
      });

      this.framebuffers.push(framebuffer);
      this.intermediateTextures.push(texture);
    }
  }

  /**
   * Apply adjustments and render
   * Requirement 13.1: Uses requestAnimationFrame-based render loop via RenderScheduler
   * Requirement 13.2: Batches multiple slider changes into single render
   */
  public render(adjustments: AdjustmentState): void {
    if (!this.sourceTexture || !this.quadGeometry) {
      throw new Error('Pipeline not initialized with image');
    }

    // Check which passes need to be updated BEFORE storing new adjustments
    this.updateDirtyFlags(adjustments);

    // Store adjustments for the actual render
    this.currentAdjustments = adjustments;

    // Use render scheduler for optimized rendering if enabled
    // Requirement 13.1, 13.2: requestAnimationFrame-based with batching
    if (this.config.enableRenderScheduler) {
      this.renderScheduler.scheduleRender();
      return;
    }

    // Fallback to immediate render if scheduler is disabled
    this.executeRender();
  }

  /**
   * Execute the actual render (called by render scheduler or directly)
   * Requirement 13.3: Frame skipping handled by RenderScheduler
   * Requirement 13.4: Performance monitoring for FPS tracking
   * Requirement 17: Performance profiling
   */
  private executeRender(): void {
    if (!this.sourceTexture || !this.quadGeometry || !this.currentAdjustments) {
      return;
    }

    // Start performance monitoring
    if (this.config.enablePerformanceMonitoring) {
      this.renderStartTime = performance.now();
    }

    // Start frame profiling
    const frameStartTime = this.profiler.startFrame();

    const adjustments = this.currentAdjustments;

    // Set viewport - use preview dimensions for intermediate passes, canvas dimensions for final output
    const canvasWidth = this.gl.canvas.width;
    const canvasHeight = this.gl.canvas.height;

    let inputTexture = this.sourceTexture;

    // Execute each pass
    for (let i = 0; i < this.passes.length; i++) {
      const pass = this.passes[i];

      // Start pass timing
      const passStartTime = this.config.enablePerformanceMonitoring ? performance.now() : 0;
      const passProfileStartTime = this.profiler.startPass(pass.name);

      // Skip if not dirty (optimization)
      if (!pass.isDirty && i > 0) {
        inputTexture = this.intermediateTextures[i - 1];
        this.profiler.endPass(pass.name, passProfileStartTime, true);
        continue;
      }

      // Handle clarity as a special multi-pass effect
      if (pass.name === 'clarity') {
        if (!this.clarityPipeline) {
          throw new Error('Clarity pipeline not initialized');
        }

        // Bind output framebuffer (null for last pass to render to canvas)
        const outputFramebuffer = i < this.passes.length - 1 ? this.framebuffers[i] : null;

        // Apply clarity using the multi-pass pipeline
        this.clarityPipeline.applyClarity(
          inputTexture,
          outputFramebuffer,
          this.previewWidth,
          this.previewHeight,
          adjustments.clarity,
          this.quadGeometry.vao,
          this.quadGeometry.positionBuffer,
          this.quadGeometry.texCoordBuffer
        );

        // Update input texture for next pass
        if (i < this.passes.length - 1) {
          inputTexture = this.intermediateTextures[i];
        }

        // Record pass timing
        if (this.config.enablePerformanceMonitoring) {
          const passEndTime = performance.now();
          this.performanceMetrics.passTimings.set(pass.name, passEndTime - passStartTime);
        }

        // End pass profiling
        this.profiler.endPass(pass.name, passProfileStartTime, false);

        // Mark pass as clean
        pass.isDirty = false;
        continue;
      }

      // Regular shader pass
      if (!pass.program) {
        throw new Error(`Shader program not initialized for pass: ${pass.name}`);
      }

      // Bind framebuffer (null for last pass to render to canvas)
      const framebuffer = i < this.passes.length - 1 ? this.framebuffers[i] : null;
      this.framebufferManager.bindFramebuffer(framebuffer);

      // Set viewport based on output target
      if (framebuffer) {
        // Intermediate pass - use preview dimensions
        this.gl.viewport(0, 0, this.previewWidth, this.previewHeight);
      } else {
        // Final pass to canvas - use canvas dimensions
        this.gl.viewport(0, 0, canvasWidth, canvasHeight);
      }

      // Use shader program
      this.gl.useProgram(pass.program.program);

      // Setup quad attributes
      const posLocation = pass.program.attributes.get('a_position') ?? 0;
      const texCoordLocation = pass.program.attributes.get('a_texCoord') ?? 0;

      setupQuadAttributes(
        this.gl,
        this.quadGeometry.vao,
        this.quadGeometry.positionBuffer,
        this.quadGeometry.texCoordBuffer,
        posLocation,
        texCoordLocation
      );

      // Bind input texture
      this.gl.activeTexture(this.gl.TEXTURE0);
      this.gl.bindTexture(this.gl.TEXTURE_2D, inputTexture);
      const textureLocation = pass.program.uniforms.get('u_texture');
      if (textureLocation) {
        this.gl.uniform1i(textureLocation, 0);
      }

      // Apply pass-specific uniforms
      this.applyPassUniforms(pass, adjustments);

      // Render
      renderQuad(this.gl, this.quadGeometry.vao);

      // Update input texture for next pass
      if (i < this.passes.length - 1) {
        inputTexture = this.intermediateTextures[i];
      }

      // Record pass timing
      if (this.config.enablePerformanceMonitoring) {
        const passEndTime = performance.now();
        this.performanceMetrics.passTimings.set(pass.name, passEndTime - passStartTime);
      }

      // End pass profiling
      this.profiler.endPass(pass.name, passProfileStartTime, false);

      // Mark pass as clean
      pass.isDirty = false;
    }

    // Unbind
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    this.framebufferManager.bindFramebuffer(null);

    // Update performance metrics
    if (this.config.enablePerformanceMonitoring) {
      this.updatePerformanceMetrics();
    }

    // End frame profiling
    this.profiler.endFrame(frameStartTime);

    // Update GPU memory usage
    const gpuMemory = this.textureManager.getGPUMemoryUsage();
    this.profiler.updateGPUMemoryUsage(gpuMemory.estimatedMB * 1024 * 1024);
  }

  /**
   * Apply uniforms for a specific pass
   */
  private applyPassUniforms(pass: ShaderPass, adjustments: AdjustmentState): void {
    // Skip if program is null (multi-pass effects handle their own uniforms)
    if (!pass.program) {
      return;
    }

    switch (pass.name) {
      case 'geometric':
        applyGeometricUniforms(this.gl, pass.program.uniforms, {
          imageSize: { width: this.previewWidth, height: this.previewHeight },
          cropBounds: adjustments.crop,
          rotationAngle: adjustments.straighten,
        });
        break;

      case 'tonal':
        applyTonalUniforms(this.gl, pass.program.uniforms, {
          exposure: adjustments.exposure,
          contrast: adjustments.contrast,
          highlights: adjustments.highlights,
          shadows: adjustments.shadows,
          whites: adjustments.whites,
          blacks: adjustments.blacks,
        });
        break;

      case 'color':
        applyColorUniforms(this.gl, pass.program.uniforms, {
          temperature: adjustments.temperature,
          tint: adjustments.tint,
          vibrance: adjustments.vibrance,
          saturation: adjustments.saturation,
        });
        break;

      case 'hsl':
        applyHSLUniforms(this.gl, pass.program.uniforms, adjustments.hsl);
        break;

      case 'detail':
        applyDetailUniforms(this.gl, pass.program.uniforms, {
          sharpening: adjustments.sharpening,
          noiseReductionLuma: adjustments.noiseReductionLuma,
          noiseReductionColor: adjustments.noiseReductionColor,
          texelSize: { width: this.previewWidth, height: this.previewHeight },
        });
        break;

      case 'effects':
        applyEffectsUniforms(
          this.gl,
          pass.program.uniforms,
          {
            vignette: adjustments.vignette,
            grain: adjustments.grain,
          },
          Date.now() / 1000
        );
        break;

      case 'output':
        applyOutputUniforms(this.gl, pass.program.uniforms, {
          enableToneMapping: this.config.enableToneMapping,
          toneMappingMode: this.config.toneMappingMode,
        });
        break;
    }
  }

  /**
   * Update dirty flags based on changed adjustments
   */
  private updateDirtyFlags(adjustments: AdjustmentState): void {
    if (!this.currentAdjustments) {
      this.markAllDirty();
      return;
    }

    const prev = this.currentAdjustments;

    // Check geometric adjustments
    if (
      JSON.stringify(prev.crop) !== JSON.stringify(adjustments.crop) ||
      prev.straighten !== adjustments.straighten
    ) {
      this.markPassDirty('geometric');
    }

    // Check tonal adjustments
    if (
      prev.exposure !== adjustments.exposure ||
      prev.contrast !== adjustments.contrast ||
      prev.highlights !== adjustments.highlights ||
      prev.shadows !== adjustments.shadows ||
      prev.whites !== adjustments.whites ||
      prev.blacks !== adjustments.blacks
    ) {
      this.markPassDirty('tonal');
    }

    // Check color adjustments
    if (
      prev.temperature !== adjustments.temperature ||
      prev.tint !== adjustments.tint ||
      prev.vibrance !== adjustments.vibrance ||
      prev.saturation !== adjustments.saturation
    ) {
      this.markPassDirty('color');
    }

    // Check HSL adjustments
    if (JSON.stringify(prev.hsl) !== JSON.stringify(adjustments.hsl)) {
      this.markPassDirty('hsl');
    }

    // Check clarity adjustment (separate pass)
    if (prev.clarity !== adjustments.clarity) {
      this.markPassDirty('clarity');
    }

    // Check detail adjustments
    if (
      prev.sharpening !== adjustments.sharpening ||
      prev.noiseReductionLuma !== adjustments.noiseReductionLuma ||
      prev.noiseReductionColor !== adjustments.noiseReductionColor
    ) {
      this.markPassDirty('detail');
    }

    // Check effects
    if (
      JSON.stringify(prev.vignette) !== JSON.stringify(adjustments.vignette) ||
      JSON.stringify(prev.grain) !== JSON.stringify(adjustments.grain)
    ) {
      this.markPassDirty('effects');
    }
  }

  /**
   * Mark a specific pass and all subsequent passes as dirty
   */
  private markPassDirty(passName: string): void {
    let found = false;
    for (const pass of this.passes) {
      if (pass.name === passName) {
        found = true;
      }
      if (found) {
        pass.isDirty = true;
      }
    }
  }

  /**
   * Mark all passes as dirty
   */
  private markAllDirty(): void {
    this.passes.forEach((pass) => (pass.isDirty = true));
  }

  /**
   * Update performance metrics after a render
   */
  private updatePerformanceMetrics(): void {
    const frameTime = performance.now() - this.renderStartTime;
    this.performanceMetrics.lastFrameTime = frameTime;
    this.performanceMetrics.frameCount++;

    // Calculate rolling average (last 60 frames)
    const alpha = Math.min(1.0 / this.performanceMetrics.frameCount, 1.0 / 60);
    this.performanceMetrics.averageFrameTime =
      this.performanceMetrics.averageFrameTime * (1 - alpha) + frameTime * alpha;
  }

  /**
   * Get current preview dimensions
   */
  public getPreviewDimensions(): { width: number; height: number } {
    return { width: this.previewWidth, height: this.previewHeight };
  }

  /**
   * Get original image dimensions
   */
  public getImageDimensions(): { width: number; height: number } {
    return { width: this.imageWidth, height: this.imageHeight };
  }

  /**
   * Get performance metrics
   * Requirement 13.4: Performance indicator for low FPS
   */
  public getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Get render scheduler performance stats
   * Requirement 13.4: Performance indicator for low FPS
   */
  public getRenderSchedulerStats(): PerformanceStats {
    return this.renderScheduler.getPerformanceStats();
  }

  /**
   * Get current FPS from render scheduler
   * Requirement 13.4: Performance indicator for low FPS
   */
  public getFPS(): number {
    if (this.config.enableRenderScheduler) {
      return this.renderScheduler.getCurrentFPS();
    }

    // Fallback to legacy calculation
    if (this.performanceMetrics.averageFrameTime === 0) {
      return 0;
    }
    return 1000 / this.performanceMetrics.averageFrameTime;
  }

  /**
   * Check if performance is currently low
   * Requirement 13.4: Performance indicator for low FPS
   */
  public isLowPerformance(): boolean {
    if (this.config.enableRenderScheduler) {
      return this.renderScheduler.isLowPerformance();
    }
    return this.getFPS() < this.config.minFPS;
  }

  /**
   * Enable or disable tone mapping
   */
  public setToneMappingEnabled(enabled: boolean): void {
    if (this.config.enableToneMapping !== enabled) {
      this.config.enableToneMapping = enabled;
      this.markPassDirty('output');
    }
  }

  /**
   * Set tone mapping mode
   */
  public setToneMappingMode(mode: 'reinhard' | 'aces'): void {
    if (this.config.toneMappingMode !== mode) {
      this.config.toneMappingMode = mode;
      this.markPassDirty('output');
    }
  }

  /**
   * Enable or disable performance monitoring
   * Requirement 13.4: Performance indicator for low FPS
   */
  public setPerformanceMonitoringEnabled(enabled: boolean): void {
    this.config.enablePerformanceMonitoring = enabled;
    this.renderScheduler.setPerformanceMonitoringEnabled(enabled);
    this.profiler.setEnabled(enabled);

    if (!enabled) {
      // Reset metrics when disabled
      this.performanceMetrics = {
        lastFrameTime: 0,
        averageFrameTime: 0,
        frameCount: 0,
        passTimings: new Map(),
      };
    }
  }

  /**
   * Get comprehensive performance profile
   * Requirement 17: Performance profiling and optimization
   */
  public getPerformanceProfile(): PerformanceProfile {
    return this.profiler.getProfile();
  }

  /**
   * Get performance recommendations
   * Requirement 17: Performance profiling and optimization
   */
  public getPerformanceRecommendations(): string[] {
    return this.profiler.getRecommendations();
  }

  /**
   * Export performance profile as JSON
   * Requirement 17: Performance profiling and optimization
   */
  public exportPerformanceProfile(): string {
    return this.profiler.exportProfile();
  }

  /**
   * Reset performance statistics
   * Requirement 17: Performance profiling and optimization
   */
  public resetPerformanceStats(): void {
    this.profiler.reset();
    this.renderScheduler.resetStats();
  }

  /**
   * Enable or disable render scheduler
   * Requirement 13.1, 13.2, 13.3: Control optimized rendering
   */
  public setRenderSchedulerEnabled(enabled: boolean): void {
    this.config.enableRenderScheduler = enabled;
    if (!enabled) {
      this.renderScheduler.cancelPendingRender();
    }
  }

  /**
   * Enable or disable frame skipping
   * Requirement 13.3: Frame skipping if rendering is slow
   */
  public setFrameSkippingEnabled(enabled: boolean): void {
    this.renderScheduler.setFrameSkippingEnabled(enabled);
  }

  /**
   * Set quality mode (preview or export)
   * Preview mode uses downscaling for performance (Requirement 8.4)
   * Export mode uses full resolution for quality (Requirement 8.5, 14.3)
   */
  public setQualityMode(mode: 'preview' | 'export'): void {
    if (this.config.qualityMode !== mode) {
      this.config.qualityMode = mode;
      // Note: Caller should reload image after changing quality mode
      // to apply the new resolution settings
    }
  }

  /**
   * Get current quality mode
   */
  public getQualityMode(): 'preview' | 'export' {
    return this.config.qualityMode;
  }

  /**
   * Check if currently using downscaled preview
   */
  public isUsingDownscaledPreview(): boolean {
    return (
      this.config.qualityMode === 'preview' &&
      (this.previewWidth < this.imageWidth || this.previewHeight < this.imageHeight)
    );
  }

  /**
   * Render to an offscreen canvas at full resolution for export
   * Returns ImageData that can be encoded to various formats
   * Uses full resolution without downscaling (Requirement 8.5, 14.3)
   */
  public async renderToImageData(
    imageData: ImageData,
    adjustments: AdjustmentState
  ): Promise<ImageData> {
    // Save current state
    const previousQualityMode = this.config.qualityMode;
    const previousImageWidth = this.imageWidth;
    const previousImageHeight = this.imageHeight;
    const previousSourceTexture = this.sourceTexture;

    try {
      // Switch to export mode for full resolution
      this.config.qualityMode = 'export';

      // Load image at full resolution
      this.loadImage(imageData);

      // Create offscreen canvas for rendering
      const canvas = new OffscreenCanvas(this.previewWidth, this.previewHeight);
      const gl = canvas.getContext('webgl2', {
        antialias: false,
        preserveDrawingBuffer: true,
      });

      if (!gl) {
        throw new Error('Failed to create offscreen WebGL context');
      }

      // Temporarily replace GL context
      const originalGl = this.gl;
      (this as any).gl = gl;

      // Render with adjustments
      this.render(adjustments);

      // Read pixels from canvas
      const pixels = new Uint8ClampedArray(this.previewWidth * this.previewHeight * 4);
      gl.readPixels(
        0,
        0,
        this.previewWidth,
        this.previewHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels
      );

      // Restore original GL context
      (this as any).gl = originalGl;

      // Create ImageData from pixels
      const resultImageData = new ImageData(pixels, this.previewWidth, this.previewHeight);

      return resultImageData;
    } finally {
      // Restore previous state
      this.config.qualityMode = previousQualityMode;
      this.imageWidth = previousImageWidth;
      this.imageHeight = previousImageHeight;
      this.sourceTexture = previousSourceTexture;

      // Recalculate preview size and recreate resources
      this.calculatePreviewSize();
      this.createIntermediateResources();
      this.markAllDirty();
    }
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    // Dispose render scheduler
    this.renderScheduler.dispose();

    // Dispose profiler
    this.profiler.dispose();

    // Delete textures
    if (this.sourceTexture) {
      this.textureManager.deleteTexture(this.sourceTexture);
    }
    this.intermediateTextures.forEach((tex) => this.textureManager.deleteTexture(tex));

    // Delete framebuffers
    this.framebuffers.forEach((fb) => this.framebufferManager.deleteFramebuffer(fb));

    // Delete shader programs
    if (this.baseProgram) this.shaderCompiler.deleteProgram(this.baseProgram.program);
    if (this.geometricProgram) this.shaderCompiler.deleteProgram(this.geometricProgram.program);
    if (this.tonalProgram) this.shaderCompiler.deleteProgram(this.tonalProgram.program);
    if (this.colorProgram) this.shaderCompiler.deleteProgram(this.colorProgram.program);
    if (this.hslProgram) this.shaderCompiler.deleteProgram(this.hslProgram.program);
    if (this.detailProgram) this.shaderCompiler.deleteProgram(this.detailProgram.program);
    if (this.effectsProgram) this.shaderCompiler.deleteProgram(this.effectsProgram.program);
    if (this.outputProgram) this.shaderCompiler.deleteProgram(this.outputProgram.program);

    // Dispose clarity pipeline
    if (this.clarityPipeline) {
      this.clarityPipeline.dispose();
    }

    // Dispose managers
    this.textureManager.dispose();
    this.framebufferManager.dispose();
  }
}
