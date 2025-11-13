/**
 * Darktable-Inspired Pipeline
 * Integrates all Darktable-inspired modules into a unified scene-referred workflow
 * Implements scene-referred processing order with module dependency checking
 */

import { PipelineManager, type PipelineModule, type RenderContext } from './pipeline/PipelineManager';
import type { AdjustmentState } from '../types/adjustments';

// Import shader sources
import { whiteBalanceVertexShader, whiteBalanceFragmentShader } from './shaders/whitebalance';
import { exposureVertexShader, exposureFragmentShader } from './shaders/exposure';
import { filmicVertexShader, filmicFragmentShader } from './shaders/filmicrgb';
import { sigmoidVertexShader, sigmoidFragmentShader } from './shaders/sigmoid';
import { colorBalanceRGBVertexShader, colorBalanceRGBFragmentShader } from './shaders/colorbalancergb';
import { saturationVertexShader, saturationFragmentShader } from './shaders/saturation';
import { guidedFilterVertexShader, guidedFilterFragmentShader } from './shaders/guidedfilter';
import { localLaplacianVertexShader, localLaplacianFragmentShader } from './shaders/locallaplacian';
import { gamutMappingVertexShader, gamutMappingFragmentShader } from './shaders/gamutmapping';
import { createOutputShader } from './shaders/output';

/**
 * Scene-referred workflow order (following Darktable's architecture):
 * 1. Input Transform: sRGB → Linear RGB
 * 2. White Balance (Chromatic Adaptation)
 * 3. Exposure Compensation
 * 4. Tone Mapping (Filmic or Sigmoid)
 * 5. Color Balance RGB (Color Grading)
 * 6. Saturation/Vibrance
 * 7. Local Contrast (Local Laplacian)
 * 8. Detail Enhancement (Guided Filter)
 * 9. Gamut Mapping
 * 10. Output Transform: Linear RGB → sRGB
 */

export interface DarktablePipelineConfig {
  enableDebugger?: boolean;
  enableProfiling?: boolean;
  maxTexturePoolSize?: number;
  maxMemoryMB?: number;
}

export class DarktablePipeline {
  private pipelineManager: PipelineManager;
  private width = 0;
  private height = 0;

  // Module enable states (cached for dependency checking)
  private moduleStates: Map<string, boolean> = new Map();

  constructor(gl: WebGL2RenderingContext, config: DarktablePipelineConfig = {}) {
    this.pipelineManager = new PipelineManager(gl, {
      enableDebugger: config.enableDebugger ?? true,
      enableProfiling: config.enableProfiling ?? true,
      maxTexturePoolSize: config.maxTexturePoolSize ?? 50,
      maxMemoryMB: config.maxMemoryMB ?? 512,
    });

    this.registerAllModules();
  }

  /**
   * Register all Darktable-inspired modules in the correct order
   */
  private registerAllModules(): void {
    // 1. Input Transform (sRGB → Linear RGB)
    this.registerModule({
      name: 'input',
      enabled: true,
      shader: this.createInputShader(),
      uniforms: ['u_texture'],
      attributes: ['a_position', 'a_texCoord'],
    });

    // 2. White Balance (Chromatic Adaptation)
    this.registerModule({
      name: 'whiteBalance',
      enabled: false,
      shader: {
        vertex: whiteBalanceVertexShader,
        fragment: whiteBalanceFragmentShader,
      },
      uniforms: [
        'u_texture',
        'u_temperature',
        'u_tint',
        'u_sourceWhite',
        'u_targetWhite',
      ],
      attributes: ['a_position', 'a_texCoord'],
      dependencies: ['input'],
    });

    // 3. Exposure Compensation
    this.registerModule({
      name: 'exposure',
      enabled: false,
      shader: {
        vertex: exposureVertexShader,
        fragment: exposureFragmentShader,
      },
      uniforms: [
        'u_texture',
        'u_exposure',
        'u_blackPoint',
        'u_highlightReconstruction',
        'u_reconstructionThreshold',
      ],
      attributes: ['a_position', 'a_texCoord'],
      dependencies: ['whiteBalance'],
    });

    // 4a. Filmic Tone Mapping
    this.registerModule({
      name: 'filmic',
      enabled: false,
      shader: {
        vertex: filmicVertexShader,
        fragment: filmicFragmentShader,
      },
      uniforms: [
        'u_texture',
        'u_whitePoint',
        'u_blackPoint',
        'u_latitude',
        'u_balance',
        'u_shadowsContrast',
        'u_highlightsContrast',
      ],
      attributes: ['a_position', 'a_texCoord'],
      dependencies: ['exposure'],
    });

    // 4b. Sigmoid Tone Mapping (alternative to Filmic)
    this.registerModule({
      name: 'sigmoid',
      enabled: false,
      shader: {
        vertex: sigmoidVertexShader,
        fragment: sigmoidFragmentShader,
      },
      uniforms: [
        'u_texture',
        'u_contrast',
        'u_skew',
        'u_middleGrey',
      ],
      attributes: ['a_position', 'a_texCoord'],
      dependencies: ['exposure'],
    });

    // 5. Color Balance RGB (Color Grading)
    this.registerModule({
      name: 'colorBalanceRGB',
      enabled: false,
      shader: {
        vertex: colorBalanceRGBVertexShader,
        fragment: colorBalanceRGBFragmentShader,
      },
      uniforms: [
        'u_texture',
        'u_shadows',
        'u_midtones',
        'u_highlights',
        'u_global',
        'u_shadowsWeight',
        'u_highlightsWeight',
        'u_maskGreyFulcrum',
        'u_contrast',
        'u_contrastFulcrum',
        'u_vibrance',
      ],
      attributes: ['a_position', 'a_texCoord'],
      dependencies: ['filmic', 'sigmoid'], // Depends on tone mapping
    });

    // 6. Saturation/Vibrance
    this.registerModule({
      name: 'saturation',
      enabled: false,
      shader: {
        vertex: saturationVertexShader,
        fragment: saturationFragmentShader,
      },
      uniforms: [
        'u_texture',
        'u_saturation',
        'u_vibrance',
        'u_skinToneProtection',
        'u_skinProtectionStrength',
      ],
      attributes: ['a_position', 'a_texCoord'],
      dependencies: ['colorBalanceRGB'],
    });

    // 7. Local Contrast (Local Laplacian)
    this.registerModule({
      name: 'localLaplacian',
      enabled: false,
      shader: {
        vertex: localLaplacianVertexShader,
        fragment: localLaplacianFragmentShader,
      },
      uniforms: [
        'u_texture',
        'u_detail',
        'u_coarse',
        'u_strength',
        'u_texelSize',
      ],
      attributes: ['a_position', 'a_texCoord'],
      dependencies: ['saturation'],
    });

    // 8. Detail Enhancement (Guided Filter)
    this.registerModule({
      name: 'guidedFilter',
      enabled: false,
      shader: {
        vertex: guidedFilterVertexShader,
        fragment: guidedFilterFragmentShader,
      },
      uniforms: [
        'u_texture',
        'u_radius',
        'u_epsilon',
        'u_strength',
        'u_texelSize',
      ],
      attributes: ['a_position', 'a_texCoord'],
      dependencies: ['localLaplacian'],
    });

    // 9. Gamut Mapping
    this.registerModule({
      name: 'gamutMapping',
      enabled: false,
      shader: {
        vertex: gamutMappingVertexShader,
        fragment: gamutMappingFragmentShader,
      },
      uniforms: [
        'u_texture',
        'u_targetGamut',
        'u_mappingMethod',
        'u_compressionAmount',
      ],
      attributes: ['a_position', 'a_texCoord'],
      dependencies: ['guidedFilter'],
    });

    // 10. Output Transform (Linear RGB → sRGB)
    this.registerModule({
      name: 'output',
      enabled: true,
      shader: createOutputShader(),
      uniforms: ['u_texture'],
      attributes: ['a_position', 'a_texCoord'],
      dependencies: ['gamutMapping'],
    });
  }

  /**
   * Register a module with the pipeline manager
   */
  private registerModule(module: PipelineModule): void {
    this.pipelineManager.registerModule(module);
    this.moduleStates.set(module.name, module.enabled);
  }

  /**
   * Create input shader (sRGB → Linear RGB)
   */
  private createInputShader() {
    const vertexShader = `#version 300 es
      in vec2 a_position;
      in vec2 a_texCoord;
      out vec2 v_texCoord;

      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;

    const fragmentShader = `#version 300 es
      precision highp float;

      in vec2 v_texCoord;
      out vec4 fragColor;

      uniform sampler2D u_texture;

      // sRGB to Linear RGB conversion
      vec3 srgbToLinear(vec3 srgb) {
        vec3 linear;
        for (int i = 0; i < 3; i++) {
          if (srgb[i] <= 0.04045) {
            linear[i] = srgb[i] / 12.92;
          } else {
            linear[i] = pow((srgb[i] + 0.055) / 1.055, 2.4);
          }
        }
        return linear;
      }

      void main() {
        vec4 color = texture(u_texture, v_texCoord);
        vec3 linear = srgbToLinear(color.rgb);
        fragColor = vec4(linear, color.a);
      }
    `;

    return { vertex: vertexShader, fragment: fragmentShader };
  }

  /**
   * Update module enable/disable state with dependency checking
   */
  public setModuleEnabled(moduleName: string, enabled: boolean): void {
    // Check if module exists
    const module = this.pipelineManager.getModule(moduleName);
    if (!module) {
      console.warn(`Module "${moduleName}" not found`);
      return;
    }

    // Update module state
    this.pipelineManager.setModuleEnabled(moduleName, enabled);
    this.moduleStates.set(moduleName, enabled);

    // Handle mutual exclusivity for tone mapping
    if (moduleName === 'filmic' && enabled) {
      this.pipelineManager.setModuleEnabled('sigmoid', false);
      this.moduleStates.set('sigmoid', false);
    } else if (moduleName === 'sigmoid' && enabled) {
      this.pipelineManager.setModuleEnabled('filmic', false);
      this.moduleStates.set('filmic', false);
    }
  }

  /**
   * Check if a module is enabled
   */
  public isModuleEnabled(moduleName: string): boolean {
    return this.moduleStates.get(moduleName) ?? false;
  }

  /**
   * Update module parameters and mark as dirty
   */
  public updateModuleParams(moduleName: string): void {
    this.pipelineManager.markModuleDirty(moduleName);
  }

  /**
   * Apply adjustments from Redux state
   */
  public applyAdjustments(adjustments: AdjustmentState): Record<string, any> {
    const uniforms: Record<string, any> = {};

    // White Balance
    if (adjustments.whiteBalanceModule.enabled) {
      this.setModuleEnabled('whiteBalance', true);
      uniforms.u_temperature = adjustments.whiteBalanceModule.temperature;
      uniforms.u_tint = adjustments.whiteBalanceModule.tint;
    } else {
      this.setModuleEnabled('whiteBalance', false);
    }

    // Exposure
    if (adjustments.exposureModule.enabled) {
      this.setModuleEnabled('exposure', true);
      uniforms.u_exposure = adjustments.exposureModule.exposure;
      uniforms.u_blackPoint = adjustments.exposureModule.blackPoint;
      uniforms.u_highlightReconstruction = adjustments.exposureModule.highlightReconstruction ? 1 : 0;
      uniforms.u_reconstructionThreshold = adjustments.exposureModule.reconstructionThreshold;
    } else {
      this.setModuleEnabled('exposure', false);
    }

    // Filmic Tone Mapping
    if (adjustments.filmic.enabled) {
      this.setModuleEnabled('filmic', true);
      uniforms.u_whitePoint = adjustments.filmic.whitePoint;
      uniforms.u_blackPoint = adjustments.filmic.blackPoint;
      uniforms.u_latitude = adjustments.filmic.latitude;
      uniforms.u_balance = adjustments.filmic.balance;
      uniforms.u_shadowsContrast = this.contrastTypeToValue(adjustments.filmic.shadowsContrast);
      uniforms.u_highlightsContrast = this.contrastTypeToValue(adjustments.filmic.highlightsContrast);
    } else {
      this.setModuleEnabled('filmic', false);
    }

    // Sigmoid Tone Mapping
    if (adjustments.sigmoid.enabled) {
      this.setModuleEnabled('sigmoid', true);
      uniforms.u_contrast = adjustments.sigmoid.contrast;
      uniforms.u_skew = adjustments.sigmoid.skew;
      uniforms.u_middleGrey = adjustments.sigmoid.middleGrey;
    } else {
      this.setModuleEnabled('sigmoid', false);
    }

    // Color Balance RGB
    if (adjustments.colorBalanceRGB.enabled) {
      this.setModuleEnabled('colorBalanceRGB', true);
      uniforms.u_shadows = [
        adjustments.colorBalanceRGB.shadows.luminance,
        adjustments.colorBalanceRGB.shadows.chroma,
        adjustments.colorBalanceRGB.shadows.hue,
      ];
      uniforms.u_midtones = [
        adjustments.colorBalanceRGB.midtones.luminance,
        adjustments.colorBalanceRGB.midtones.chroma,
        adjustments.colorBalanceRGB.midtones.hue,
      ];
      uniforms.u_highlights = [
        adjustments.colorBalanceRGB.highlights.luminance,
        adjustments.colorBalanceRGB.highlights.chroma,
        adjustments.colorBalanceRGB.highlights.hue,
      ];
      uniforms.u_global = [
        adjustments.colorBalanceRGB.global.luminance,
        adjustments.colorBalanceRGB.global.chroma,
        adjustments.colorBalanceRGB.global.hue,
      ];
      uniforms.u_shadowsWeight = adjustments.colorBalanceRGB.shadowsWeight;
      uniforms.u_highlightsWeight = adjustments.colorBalanceRGB.highlightsWeight;
      uniforms.u_maskGreyFulcrum = adjustments.colorBalanceRGB.maskGreyFulcrum;
      uniforms.u_contrast = adjustments.colorBalanceRGB.contrast;
      uniforms.u_contrastFulcrum = adjustments.colorBalanceRGB.contrastFulcrum;
      uniforms.u_vibrance = adjustments.colorBalanceRGB.vibrance;
    } else {
      this.setModuleEnabled('colorBalanceRGB', false);
    }

    // Saturation
    if (adjustments.saturationModule.enabled) {
      this.setModuleEnabled('saturation', true);
      uniforms.u_saturation = adjustments.saturationModule.saturation;
      uniforms.u_vibrance = adjustments.saturationModule.vibrance;
      uniforms.u_skinToneProtection = adjustments.saturationModule.skinToneProtection ? 1 : 0;
      uniforms.u_skinProtectionStrength = adjustments.saturationModule.skinProtectionStrength;
    } else {
      this.setModuleEnabled('saturation', false);
    }

    // Local Laplacian
    if (adjustments.localLaplacian.enabled) {
      this.setModuleEnabled('localLaplacian', true);
      uniforms.u_detail = adjustments.localLaplacian.detail;
      uniforms.u_coarse = adjustments.localLaplacian.coarse;
      uniforms.u_strength = adjustments.localLaplacian.strength;
      uniforms.u_texelSize = [1.0 / this.width, 1.0 / this.height];
    } else {
      this.setModuleEnabled('localLaplacian', false);
    }

    // Guided Filter
    if (adjustments.guidedFilter.enabled) {
      this.setModuleEnabled('guidedFilter', true);
      uniforms.u_radius = adjustments.guidedFilter.radius;
      uniforms.u_epsilon = adjustments.guidedFilter.epsilon;
      uniforms.u_strength = adjustments.guidedFilter.strength;
      uniforms.u_texelSize = [1.0 / this.width, 1.0 / this.height];
    } else {
      this.setModuleEnabled('guidedFilter', false);
    }

    // Gamut Mapping
    if (adjustments.gamutMapping.enabled) {
      this.setModuleEnabled('gamutMapping', true);
      uniforms.u_targetGamut = this.gamutToValue(adjustments.gamutMapping.targetGamut);
      uniforms.u_mappingMethod = this.mappingMethodToValue(adjustments.gamutMapping.mappingMethod);
      uniforms.u_compressionAmount = adjustments.gamutMapping.compressionAmount;
    } else {
      this.setModuleEnabled('gamutMapping', false);
    }

    return uniforms;
  }

  /**
   * Convert contrast type to numeric value
   */
  private contrastTypeToValue(type: 'hard' | 'soft' | 'safe'): number {
    switch (type) {
      case 'hard': return 0;
      case 'soft': return 1;
      case 'safe': return 2;
      default: return 1;
    }
  }

  /**
   * Convert gamut to numeric value
   */
  private gamutToValue(gamut: 'sRGB' | 'Display P3' | 'Rec2020'): number {
    switch (gamut) {
      case 'sRGB': return 0;
      case 'Display P3': return 1;
      case 'Rec2020': return 2;
      default: return 0;
    }
  }

  /**
   * Convert mapping method to numeric value
   */
  private mappingMethodToValue(method: 'perceptual' | 'saturation' | 'relative'): number {
    switch (method) {
      case 'perceptual': return 0;
      case 'saturation': return 1;
      case 'relative': return 2;
      default: return 0;
    }
  }

  /**
   * Execute the pipeline
   */
  public execute(
    inputTexture: WebGLTexture,
    outputFramebuffer: WebGLFramebuffer | null,
    width: number,
    height: number,
    adjustments: AdjustmentState
  ): void {
    this.width = width;
    this.height = height;

    // Apply adjustments and get uniforms
    const uniforms = this.applyAdjustments(adjustments);

    // Execute pipeline
    const context: RenderContext = {
      inputTexture,
      outputFramebuffer,
      width,
      height,
      uniforms,
    };

    this.pipelineManager.execute(context);
  }

  /**
   * Get pipeline statistics
   */
  public getStats() {
    return this.pipelineManager.getStats();
  }

  /**
   * Get execution order
   */
  public getExecutionOrder(): string[] {
    return this.pipelineManager.getExecutionOrder();
  }

  /**
   * Get all module names
   */
  public getModuleNames(): string[] {
    return this.pipelineManager.getModuleNames();
  }

  /**
   * Generate performance report
   */
  public generatePerformanceReport(): string {
    return this.pipelineManager.generatePerformanceReport();
  }

  /**
   * Enable or disable profiling
   */
  public setProfilingEnabled(enabled: boolean): void {
    this.pipelineManager.setProfilingEnabled(enabled);
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    this.pipelineManager.dispose();
  }
}
