/**
 * Lens Blur Pipeline
 * Orchestrates depth-based layered blur rendering for realistic lens blur
 * 
 * Pipeline flow:
 * 1. Upload depth map to GPU
 * 2. Preprocess depth with bilateral filter (edge-aware smoothing)
 * 3. Generate layer masks for each depth layer
 * 4. Apply variable-radius blur to each layer
 * 5. Composite all layers with depth-aware blending
 */

import { FramebufferManager } from './framebufferManager';
import { ShaderCompiler } from './shaderUtils';
import type { ShaderProgram } from './shaderUtils';
import { createQuadGeometry, setupQuadAttributes, renderQuad } from './shaders/base';
import {
  lensBlurVertexShader,
  // Depth preprocessing disabled
  // depthBilateralFragmentShader,
  // depthDilateFragmentShader,
  layerMaskFragmentShader,
  variableBlurFragmentShader,
  depthCompositeFragmentShader,
  focusVisualizationFragmentShader,
  calculateLayerBlurRadius,
  getLayerDepthCenters,
} from './shaders/lensBlur';
import type { LensBlurParams } from './shaders/lensBlur';

export interface LensBlurPipelineConfig {
  numLayers: number;        // Number of depth layers (default: 8)
  maxBlurRadius: number;    // Maximum blur radius in pixels
}

/**
 * LensBlurPipeline - Manages the multi-pass depth-based blur rendering
 */
export class LensBlurPipeline {
  private gl: WebGL2RenderingContext;
  private framebufferManager: FramebufferManager;
  private shaderCompiler: ShaderCompiler;

  // Shader programs
  // Depth preprocessing disabled - using raw depth
  // private depthBilateralProgram: ShaderProgram | null = null;
  // private depthDilateProgram: ShaderProgram | null = null;
  private layerMaskProgram: ShaderProgram | null = null;
  private blurProgram: ShaderProgram | null = null;
  private compositeProgram: ShaderProgram | null = null;
  private visualizationProgram: ShaderProgram | null = null;

  // Framebuffers and textures
  private depthTexture: WebGLTexture | null = null;
  // Depth preprocessing disabled
  // private processedDepthTexture: WebGLTexture | null = null;
  // private processedDepthFB: WebGLFramebuffer | null = null;
  // private dilatedDepthTexture: WebGLTexture | null = null;
  // private dilatedDepthFB: WebGLFramebuffer | null = null;

  // Layer buffers
  private layerMaskTextures: WebGLTexture[] = [];
  private layerMaskFBs: WebGLFramebuffer[] = [];
  private blurredLayerTextures: WebGLTexture[] = [];
  private blurredLayerFBs: WebGLFramebuffer[] = [];
  private tempBlurTexture: WebGLTexture | null = null;
  private tempBlurFB: WebGLFramebuffer | null = null;

  // Quad geometry
  private quadVAO: WebGLVertexArrayObject | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;

  // Configuration
  private config: LensBlurPipelineConfig;
  private currentWidth = 0;
  private currentHeight = 0;
  private isInitialized = false;

  constructor(
    gl: WebGL2RenderingContext,
    framebufferManager: FramebufferManager,
    config: Partial<LensBlurPipelineConfig> = {}
  ) {
    this.gl = gl;
    this.framebufferManager = framebufferManager;
    this.shaderCompiler = new ShaderCompiler(gl);

    this.config = {
      numLayers: config.numLayers ?? 4,  // Reduced from 8 for better GPU memory management
      maxBlurRadius: config.maxBlurRadius ?? 60,
    };
  }

  /**
   * Initialize all shader programs and geometry
   */
  public initialize(): void {
    if (this.isInitialized) return;

    try {
      this.initializeShaders();
      this.initializeQuad();
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize LensBlurPipeline:', error);
      throw error;
    }
  }

  private initializeShaders(): void {
    // Depth preprocessing disabled - using raw depth texture
    // this.depthBilateralProgram = this.shaderCompiler.createProgram(
    //   lensBlurVertexShader,
    //   depthBilateralFragmentShader,
    //   ['u_depth', 'u_guide', 'u_resolution', 'u_spatialSigma', 'u_rangeSigma'],
    //   ['a_position', 'a_texCoord']
    // );
    // this.depthDilateProgram = this.shaderCompiler.createProgram(
    //   lensBlurVertexShader,
    //   depthDilateFragmentShader,
    //   ['u_depth', 'u_resolution', 'u_dilateRadius'],
    //   ['a_position', 'a_texCoord']
    // );

    // Layer mask generation
    this.layerMaskProgram = this.shaderCompiler.createProgram(
      lensBlurVertexShader,
      layerMaskFragmentShader,
      ['u_depth', 'u_layerIndex', 'u_numLayers', 'u_transitionWidth'],
      ['a_position', 'a_texCoord']
    );

    // Variable blur
    this.blurProgram = this.shaderCompiler.createProgram(
      lensBlurVertexShader,
      variableBlurFragmentShader,
      ['u_texture', 'u_mask', 'u_direction', 'u_radius', 'u_resolution'],
      ['a_position', 'a_texCoord']
    );

    // Depth composite
    this.compositeProgram = this.shaderCompiler.createProgram(
      lensBlurVertexShader,
      depthCompositeFragmentShader,
      [
        'u_original', 'u_depth',
        'u_blurredLayer0', 'u_blurredLayer1', 'u_blurredLayer2', 'u_blurredLayer3',
        'u_blurredLayer4', 'u_blurredLayer5', 'u_blurredLayer6', 'u_blurredLayer7',
        'u_layerDepths', 'u_sigmaDepth', 'u_focusDepth', 'u_focusRange',
        'u_amount', 'u_edgeProtect', 'u_numLayers'
      ],
      ['a_position', 'a_texCoord']
    );

    // Focus visualization
    this.visualizationProgram = this.shaderCompiler.createProgram(
      lensBlurVertexShader,
      focusVisualizationFragmentShader,
      ['u_texture', 'u_depth', 'u_focusDepth', 'u_focusRange', 'u_showDepth', 'u_showFocus'],
      ['a_position', 'a_texCoord']
    );
  }

  private initializeQuad(): void {
    const geometry = createQuadGeometry(this.gl);
    this.quadVAO = geometry.vao;
    this.positionBuffer = geometry.positionBuffer;
    this.texCoordBuffer = geometry.texCoordBuffer;
  }

  /**
   * Create or resize framebuffers for the given dimensions
   */
  private ensureFramebuffers(width: number, height: number): void {
    if (width === this.currentWidth && height === this.currentHeight) {
      return;
    }

    this.cleanupFramebuffers();

    // Depth preprocessing disabled - using raw depth
    // this.createFramebufferWithTexture(width, height, (fb, tex) => {
    //   this.processedDepthFB = fb;
    //   this.processedDepthTexture = tex;
    // });
    // this.createFramebufferWithTexture(width, height, (fb, tex) => {
    //   this.dilatedDepthFB = fb;
    //   this.dilatedDepthTexture = tex;
    // });

    // Create temp blur framebuffer
    this.createFramebufferWithTexture(width, height, (fb, tex) => {
      this.tempBlurFB = fb;
      this.tempBlurTexture = tex;
    });

    // Create layer mask and blurred layer framebuffers
    for (let i = 0; i < this.config.numLayers; i++) {
      // Layer mask (single channel is fine, but using RGBA for compatibility)
      this.createFramebufferWithTexture(width, height, (fb, tex) => {
        this.layerMaskFBs.push(fb);
        this.layerMaskTextures.push(tex);
      });

      // Blurred layer
      this.createFramebufferWithTexture(width, height, (fb, tex) => {
        this.blurredLayerFBs.push(fb);
        this.blurredLayerTextures.push(tex);
      });
    }

    this.currentWidth = width;
    this.currentHeight = height;
  }

  private createFramebufferWithTexture(
    width: number,
    height: number,
    callback: (fb: WebGLFramebuffer, tex: WebGLTexture) => void
  ): void {
    const gl = this.gl;

    const texture = gl.createTexture();
    if (!texture) throw new Error('Failed to create texture');

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) throw new Error('Failed to create framebuffer');

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Framebuffer not complete: ${status}`);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    callback(framebuffer, texture);
  }

  private cleanupFramebuffers(): void {
    const gl = this.gl;

    // Skip if context is lost
    if (gl.isContextLost()) {
      this.layerMaskFBs = [];
      this.layerMaskTextures = [];
      this.blurredLayerFBs = [];
      this.blurredLayerTextures = [];
      this.tempBlurFB = null;
      this.tempBlurTexture = null;
      return;
    }

    // Depth preprocessing disabled
    // if (this.processedDepthFB) gl.deleteFramebuffer(this.processedDepthFB);
    // if (this.processedDepthTexture) gl.deleteTexture(this.processedDepthTexture);
    // if (this.dilatedDepthFB) gl.deleteFramebuffer(this.dilatedDepthFB);
    // if (this.dilatedDepthTexture) gl.deleteTexture(this.dilatedDepthTexture);
    if (this.tempBlurFB) gl.deleteFramebuffer(this.tempBlurFB);
    if (this.tempBlurTexture) gl.deleteTexture(this.tempBlurTexture);

    for (const fb of this.layerMaskFBs) gl.deleteFramebuffer(fb);
    for (const tex of this.layerMaskTextures) gl.deleteTexture(tex);
    for (const fb of this.blurredLayerFBs) gl.deleteFramebuffer(fb);
    for (const tex of this.blurredLayerTextures) gl.deleteTexture(tex);

    this.layerMaskFBs = [];
    this.layerMaskTextures = [];
    this.blurredLayerFBs = [];
    this.blurredLayerTextures = [];

    // Depth preprocessing disabled
    // this.processedDepthFB = null;
    // this.processedDepthTexture = null;
    // this.dilatedDepthFB = null;
    // this.dilatedDepthTexture = null;
    this.tempBlurFB = null;
    this.tempBlurTexture = null;
  }

  /**
   * Upload depth map to GPU texture
   */
  public uploadDepthMap(depthData: Float32Array, width: number, height: number): void {
    const gl = this.gl;

    // Debug: check depth data range
    let minDepth = Infinity, maxDepth = -Infinity;
    for (let i = 0; i < depthData.length; i++) {
      minDepth = Math.min(minDepth, depthData[i]);
      maxDepth = Math.max(maxDepth, depthData[i]);
    }
    console.log('📷 GPU Upload - Depth range:', minDepth.toFixed(3), 'to', maxDepth.toFixed(3));
    console.log('📷 GPU Upload - Depth dimensions:', width, 'x', height);

    if (this.depthTexture) {
      gl.deleteTexture(this.depthTexture);
    }

    this.depthTexture = gl.createTexture();
    if (!this.depthTexture) throw new Error('Failed to create depth texture');

    gl.bindTexture(gl.TEXTURE_2D, this.depthTexture);

    // Upload as R32F (single channel float)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R32F,
      width,
      height,
      0,
      gl.RED,
      gl.FLOAT,
      depthData
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  /**
   * Apply lens blur to the input texture
   */
  public applyLensBlur(
    inputTexture: WebGLTexture,
    outputFramebuffer: WebGLFramebuffer | null,
    width: number,
    height: number,
    params: LensBlurParams
  ): void {
    // Check if WebGL context is lost
    if (this.gl.isContextLost()) {
      console.warn('WebGL context lost, skipping lens blur');
      return;
    }

    if (!this.isInitialized) {
      this.initialize();
    }

    if (!this.depthTexture) {
      console.warn('No depth map available for lens blur');
      return;
    }

    if (!params.enabled || params.amount < 0.01) {
      // Just copy input to output
      this.copyTexture(inputTexture, outputFramebuffer, width, height);
      return;
    }

    this.ensureFramebuffers(width, height);

    // Skip preprocessing for now - use raw depth directly
    // The bilateral filter can destroy depth variation with wrong parameters
    // Step 1: (Skipped) Preprocess depth with bilateral filter
    // this.preprocessDepth(inputTexture, width, height);

    // Step 2: Generate layer masks
    this.generateLayerMasks(params, width, height);

    // Step 3: Blur each layer
    this.blurLayers(inputTexture, params, width, height);

    // Step 4: Composite all layers
    this.compositeResult(inputTexture, outputFramebuffer, params, width, height);
  }

  /* Depth preprocessing disabled - using raw depth directly gives better results
  private preprocessDepth(guideTexture: WebGLTexture, width: number, height: number): void {
    ... code removed for cleaner builds ...
  }
  */

  private generateLayerMasks(params: LensBlurParams, width: number, height: number): void {
    const gl = this.gl;
    
    if (!this.layerMaskProgram || !this.quadVAO || !this.positionBuffer || !this.texCoordBuffer) return;

    gl.useProgram(this.layerMaskProgram.program);

    const posLoc = this.layerMaskProgram.attributes.get('a_position') ?? 0;
    const texCoordLoc = this.layerMaskProgram.attributes.get('a_texCoord') ?? 0;
    setupQuadAttributes(gl, this.quadVAO, this.positionBuffer, this.texCoordBuffer, posLoc, texCoordLoc);

    // Use raw depth texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.depthTexture);
    const depthLoc = this.layerMaskProgram.uniforms.get('u_depth');
    if (depthLoc) gl.uniform1i(depthLoc, 0);

    const numLayersLoc = this.layerMaskProgram.uniforms.get('u_numLayers');
    if (numLayersLoc) gl.uniform1f(numLayersLoc, params.numLayers);

    const transitionLoc = this.layerMaskProgram.uniforms.get('u_transitionWidth');
    if (transitionLoc) gl.uniform1f(transitionLoc, params.transitionWidth);

    for (let i = 0; i < params.numLayers && i < this.layerMaskFBs.length; i++) {
      this.framebufferManager.bindFramebuffer(this.layerMaskFBs[i]);
      gl.viewport(0, 0, width, height);

      const layerIndexLoc = this.layerMaskProgram.uniforms.get('u_layerIndex');
      if (layerIndexLoc) gl.uniform1f(layerIndexLoc, i);

      renderQuad(gl, this.quadVAO);
    }
  }

  private blurLayers(
    inputTexture: WebGLTexture,
    params: LensBlurParams,
    width: number,
    height: number
  ): void {
    const gl = this.gl;
    
    if (!this.blurProgram || !this.quadVAO || !this.positionBuffer || 
        !this.texCoordBuffer || !this.tempBlurFB || !this.tempBlurTexture) return;

    gl.useProgram(this.blurProgram.program);

    const posLoc = this.blurProgram.attributes.get('a_position') ?? 0;
    const texCoordLoc = this.blurProgram.attributes.get('a_texCoord') ?? 0;
    setupQuadAttributes(gl, this.quadVAO, this.positionBuffer, this.texCoordBuffer, posLoc, texCoordLoc);

    const resLoc = this.blurProgram.uniforms.get('u_resolution');
    if (resLoc) gl.uniform2f(resLoc, width, height);

    for (let i = 0; i < params.numLayers && i < this.blurredLayerFBs.length; i++) {
      const blurRadius = calculateLayerBlurRadius(
        i,
        params.numLayers,
        params.focusDepth,
        params.focusRange,
        params.maxBlur,
        params.amount
      );

      // Skip blur if radius is very small
      if (blurRadius < 0.5) {
        // Copy input to layer
        this.framebufferManager.bindFramebuffer(this.blurredLayerFBs[i]);
        gl.viewport(0, 0, width, height);
        this.copyTextureToCurrentFB(inputTexture);
        continue;
      }

      // Horizontal blur: input -> temp
      this.framebufferManager.bindFramebuffer(this.tempBlurFB);
      gl.viewport(0, 0, width, height);
      gl.useProgram(this.blurProgram.program);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, inputTexture);
      const texLoc = this.blurProgram.uniforms.get('u_texture');
      if (texLoc) gl.uniform1i(texLoc, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.layerMaskTextures[i]);
      const maskLoc = this.blurProgram.uniforms.get('u_mask');
      if (maskLoc) gl.uniform1i(maskLoc, 1);

      const dirLoc = this.blurProgram.uniforms.get('u_direction');
      if (dirLoc) gl.uniform2f(dirLoc, 1.0, 0.0); // Horizontal

      const radiusLoc = this.blurProgram.uniforms.get('u_radius');
      if (radiusLoc) gl.uniform1f(radiusLoc, blurRadius);

      renderQuad(gl, this.quadVAO);

      // Vertical blur: temp -> layer output
      this.framebufferManager.bindFramebuffer(this.blurredLayerFBs[i]);
      gl.viewport(0, 0, width, height);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tempBlurTexture);

      if (dirLoc) gl.uniform2f(dirLoc, 0.0, 1.0); // Vertical

      renderQuad(gl, this.quadVAO);
    }
  }

  private compositeResult(
    inputTexture: WebGLTexture,
    outputFramebuffer: WebGLFramebuffer | null,
    params: LensBlurParams,
    width: number,
    height: number
  ): void {
    const gl = this.gl;
    
    if (!this.compositeProgram || !this.quadVAO || !this.positionBuffer || !this.texCoordBuffer) return;

    this.framebufferManager.bindFramebuffer(outputFramebuffer);
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.compositeProgram.program);

    const posLoc = this.compositeProgram.attributes.get('a_position') ?? 0;
    const texCoordLoc = this.compositeProgram.attributes.get('a_texCoord') ?? 0;
    setupQuadAttributes(gl, this.quadVAO, this.positionBuffer, this.texCoordBuffer, posLoc, texCoordLoc);

    // Bind original texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inputTexture);
    const origLoc = this.compositeProgram.uniforms.get('u_original');
    if (origLoc) gl.uniform1i(origLoc, 0);

    // Bind depth texture - use raw depth directly for better results
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.depthTexture);
    const depthLoc = this.compositeProgram.uniforms.get('u_depth');
    if (depthLoc) gl.uniform1i(depthLoc, 1);

    // Bind blurred layers
    for (let i = 0; i < 8; i++) {
      gl.activeTexture(gl.TEXTURE2 + i);
      if (i < this.blurredLayerTextures.length) {
        gl.bindTexture(gl.TEXTURE_2D, this.blurredLayerTextures[i]);
      } else {
        gl.bindTexture(gl.TEXTURE_2D, inputTexture);
      }
      const layerLoc = this.compositeProgram.uniforms.get(`u_blurredLayer${i}`);
      if (layerLoc) gl.uniform1i(layerLoc, 2 + i);
    }

    // Set layer depths
    const layerDepths = getLayerDepthCenters(params.numLayers);
    const layerDepthsLoc = this.compositeProgram.uniforms.get('u_layerDepths');
    if (layerDepthsLoc) {
      // Pad to 8 elements
      while (layerDepths.length < 8) layerDepths.push(1.0);
      gl.uniform1fv(layerDepthsLoc, layerDepths);
    }

    // Set other uniforms
    const sigmaLoc = this.compositeProgram.uniforms.get('u_sigmaDepth');
    if (sigmaLoc) gl.uniform1f(sigmaLoc, 0.1);

    const focusDepthLoc = this.compositeProgram.uniforms.get('u_focusDepth');
    if (focusDepthLoc) gl.uniform1f(focusDepthLoc, params.focusDepth);

    const focusRangeLoc = this.compositeProgram.uniforms.get('u_focusRange');
    if (focusRangeLoc) gl.uniform1f(focusRangeLoc, params.focusRange);

    const amountLoc = this.compositeProgram.uniforms.get('u_amount');
    if (amountLoc) gl.uniform1f(amountLoc, params.amount);

    const edgeLoc = this.compositeProgram.uniforms.get('u_edgeProtect');
    if (edgeLoc) gl.uniform1f(edgeLoc, params.edgeProtect);

    const numLayersLoc = this.compositeProgram.uniforms.get('u_numLayers');
    if (numLayersLoc) gl.uniform1i(numLayersLoc, params.numLayers);

    renderQuad(gl, this.quadVAO);
  }

  /**
   * Render focus visualization overlay
   */
  public renderFocusVisualization(
    inputTexture: WebGLTexture,
    outputFramebuffer: WebGLFramebuffer | null,
    width: number,
    height: number,
    params: LensBlurParams
  ): void {
    // Check if WebGL context is lost
    if (this.gl.isContextLost()) {
      console.warn('WebGL context lost, skipping focus visualization');
      return;
    }

    if (!this.isInitialized) {
      this.initialize();
    }

    const gl = this.gl;
    
    if (!this.visualizationProgram || !this.quadVAO || !this.positionBuffer || !this.texCoordBuffer) return;

    this.framebufferManager.bindFramebuffer(outputFramebuffer);
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.visualizationProgram.program);

    const posLoc = this.visualizationProgram.attributes.get('a_position') ?? 0;
    const texCoordLoc = this.visualizationProgram.attributes.get('a_texCoord') ?? 0;
    setupQuadAttributes(gl, this.quadVAO, this.positionBuffer, this.texCoordBuffer, posLoc, texCoordLoc);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inputTexture);
    const texLoc = this.visualizationProgram.uniforms.get('u_texture');
    if (texLoc) gl.uniform1i(texLoc, 0);

    // Use raw depth texture for visualization
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.depthTexture);
    const depthLoc = this.visualizationProgram.uniforms.get('u_depth');
    if (depthLoc) gl.uniform1i(depthLoc, 1);

    const focusDepthLoc = this.visualizationProgram.uniforms.get('u_focusDepth');
    if (focusDepthLoc) gl.uniform1f(focusDepthLoc, params.focusDepth);

    const focusRangeLoc = this.visualizationProgram.uniforms.get('u_focusRange');
    if (focusRangeLoc) gl.uniform1f(focusRangeLoc, params.focusRange);

    const showDepthLoc = this.visualizationProgram.uniforms.get('u_showDepth');
    if (showDepthLoc) gl.uniform1i(showDepthLoc, params.showDepth ? 1 : 0);

    const showFocusLoc = this.visualizationProgram.uniforms.get('u_showFocus');
    if (showFocusLoc) gl.uniform1i(showFocusLoc, params.showFocus ? 1 : 0);

    renderQuad(gl, this.quadVAO);
  }

  private copyTexture(
    inputTexture: WebGLTexture,
    outputFramebuffer: WebGLFramebuffer | null,
    width: number,
    height: number
  ): void {
    const gl = this.gl;
    
    this.framebufferManager.bindFramebuffer(outputFramebuffer);
    gl.viewport(0, 0, width, height);
    this.copyTextureToCurrentFB(inputTexture);
  }

  private copyTextureToCurrentFB(inputTexture: WebGLTexture): void {
    const gl = this.gl;

    // Use a simple blit or draw - for now, just use the depth bilateral program with no filtering
    // This is a bit wasteful but works
    if (this.visualizationProgram && this.quadVAO && this.positionBuffer && this.texCoordBuffer) {
      gl.useProgram(this.visualizationProgram.program);

      const posLoc = this.visualizationProgram.attributes.get('a_position') ?? 0;
      const texCoordLoc = this.visualizationProgram.attributes.get('a_texCoord') ?? 0;
      setupQuadAttributes(gl, this.quadVAO, this.positionBuffer, this.texCoordBuffer, posLoc, texCoordLoc);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, inputTexture);
      const texLoc = this.visualizationProgram.uniforms.get('u_texture');
      if (texLoc) gl.uniform1i(texLoc, 0);

      // Set depth to same texture (doesn't matter, won't be used)
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, inputTexture);
      const depthLoc = this.visualizationProgram.uniforms.get('u_depth');
      if (depthLoc) gl.uniform1i(depthLoc, 1);

      const showDepthLoc = this.visualizationProgram.uniforms.get('u_showDepth');
      if (showDepthLoc) gl.uniform1i(showDepthLoc, 0);

      const showFocusLoc = this.visualizationProgram.uniforms.get('u_showFocus');
      if (showFocusLoc) gl.uniform1i(showFocusLoc, 0);

      renderQuad(gl, this.quadVAO);
    }
  }

  /**
   * Check if depth map is available
   */
  public hasDepthMap(): boolean {
    return this.depthTexture !== null;
  }

  /**
   * Get depth at a specific point (normalized coordinates 0-1)
   */
  public getDepthAtPoint(x: number, y: number, width: number, height: number): number | null {
    if (!this.depthTexture) return null;

    const gl = this.gl;
    
    // Create a small framebuffer to read the depth
    const fb = gl.createFramebuffer();
    if (!fb) return null;

    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    
    // Use raw depth texture (preprocessing disabled)
    const depthToRead = this.depthTexture;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, depthToRead, 0);

    const pixelX = Math.floor(x * width);
    const pixelY = Math.floor((1 - y) * height); // Flip Y

    const pixels = new Float32Array(4);
    gl.readPixels(pixelX, pixelY, 1, 1, gl.RGBA, gl.FLOAT, pixels);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);

    return pixels[0];
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    const gl = this.gl;

    // Skip cleanup if context is lost - resources are already gone
    if (gl.isContextLost()) {
      console.warn('WebGL context lost, skipping lens blur pipeline disposal');
      this.depthTexture = null;
      this.quadVAO = null;
      this.positionBuffer = null;
      this.texCoordBuffer = null;
      this.isInitialized = false;
      return;
    }

    this.cleanupFramebuffers();

    if (this.depthTexture) gl.deleteTexture(this.depthTexture);
    if (this.quadVAO) gl.deleteVertexArray(this.quadVAO);
    if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);
    if (this.texCoordBuffer) gl.deleteBuffer(this.texCoordBuffer);

    this.shaderCompiler.clearCache();

    this.depthTexture = null;
    this.quadVAO = null;
    this.positionBuffer = null;
    this.texCoordBuffer = null;
    this.isInitialized = false;
  }
}
