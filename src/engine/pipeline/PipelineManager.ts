/**
 * Pipeline Manager
 * Orchestrates the shader processing pipeline with module management and state tracking
 * Coordinates ShaderRegistry, TexturePool, and PipelineDebugger
 */

import { ShaderRegistry } from './ShaderRegistry';
import type { ShaderSource } from './ShaderRegistry';
import { TexturePool } from './TexturePool';
import { PipelineDebugger } from './PipelineDebugger';

export interface PipelineModule {
  name: string;
  enabled: boolean;
  shader: ShaderSource;
  uniforms: string[];
  attributes: string[];
  dependencies?: string[];
}

export interface PipelineState {
  modules: Map<string, PipelineModule>;
  dirtyModules: Set<string>;
  executionOrder: string[];
  cachedOutputs: Map<string, WebGLTexture>;
  moduleHashes: Map<string, string>;
}

export interface PipelineConfig {
  enableDebugger?: boolean;
  enableProfiling?: boolean;
  maxTexturePoolSize?: number;
  maxMemoryMB?: number;
}

export interface RenderContext {
  inputTexture: WebGLTexture;
  outputFramebuffer: WebGLFramebuffer | null;
  width: number;
  height: number;
  uniforms?: Record<string, any>;
}

/**
 * PipelineManager orchestrates the shader processing pipeline
 */
export class PipelineManager {
  private gl: WebGL2RenderingContext;
  private shaderRegistry: ShaderRegistry;
  private texturePool: TexturePool;
  private debugger: PipelineDebugger;
  private state: PipelineState;
  private config: Required<PipelineConfig>;

  // Quad geometry for full-screen passes
  private quadVAO: WebGLVertexArrayObject | null = null;
  private quadPositionBuffer: WebGLBuffer | null = null;
  private quadTexCoordBuffer: WebGLBuffer | null = null;

  constructor(gl: WebGL2RenderingContext, config: PipelineConfig = {}) {
    this.gl = gl;
    this.config = {
      enableDebugger: config.enableDebugger ?? true,
      enableProfiling: config.enableProfiling ?? true,
      maxTexturePoolSize: config.maxTexturePoolSize ?? 50,
      maxMemoryMB: config.maxMemoryMB ?? 512,
    };

    // Initialize subsystems
    this.shaderRegistry = new ShaderRegistry(gl, {
      enableValidation: true,
      enableCaching: true,
      logErrors: true,
    });

    this.texturePool = new TexturePool(gl, {
      maxPoolSize: this.config.maxTexturePoolSize,
      maxMemoryMB: this.config.maxMemoryMB,
      enableAutoCleanup: true,
    });

    this.debugger = new PipelineDebugger(gl, {
      enableProfiling: this.config.enableProfiling,
      enableVisualization: this.config.enableDebugger,
      captureIntermediates: false,
    });

    // Initialize state
    this.state = {
      modules: new Map(),
      dirtyModules: new Set(),
      executionOrder: [],
      cachedOutputs: new Map(),
      moduleHashes: new Map(),
    };

    // Initialize quad geometry
    this.initializeQuadGeometry();
  }

  /**
   * Initialize full-screen quad geometry
   */
  private initializeQuadGeometry(): void {
    // Create VAO
    this.quadVAO = this.gl.createVertexArray();
    if (!this.quadVAO) {
      throw new Error('Failed to create quad VAO');
    }

    this.gl.bindVertexArray(this.quadVAO);

    // Position buffer (full-screen quad)
    const positions = new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
       1.0,  1.0,
    ]);

    this.quadPositionBuffer = this.gl.createBuffer();
    if (!this.quadPositionBuffer) {
      throw new Error('Failed to create position buffer');
    }

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadPositionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);

    // Texture coordinate buffer
    const texCoords = new Float32Array([
      0.0, 0.0,
      1.0, 0.0,
      0.0, 1.0,
      1.0, 1.0,
    ]);

    this.quadTexCoordBuffer = this.gl.createBuffer();
    if (!this.quadTexCoordBuffer) {
      throw new Error('Failed to create texcoord buffer');
    }

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadTexCoordBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, texCoords, this.gl.STATIC_DRAW);

    this.gl.bindVertexArray(null);
  }

  /**
   * Setup quad attributes for rendering
   */
  private setupQuadAttributes(positionLocation: number, texCoordLocation: number): void {
    if (!this.quadVAO || !this.quadPositionBuffer || !this.quadTexCoordBuffer) {
      throw new Error('Quad geometry not initialized');
    }

    this.gl.bindVertexArray(this.quadVAO);

    // Position attribute
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadPositionBuffer);
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);

    // Texture coordinate attribute
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadTexCoordBuffer);
    this.gl.enableVertexAttribArray(texCoordLocation);
    this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 0, 0);
  }

  /**
   * Render full-screen quad
   */
  private renderQuad(): void {
    if (!this.quadVAO) {
      throw new Error('Quad geometry not initialized');
    }

    this.gl.bindVertexArray(this.quadVAO);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    this.gl.bindVertexArray(null);

    if (this.config.enableDebugger) {
      this.debugger.recordDrawCall();
    }
  }

  /**
   * Register a pipeline module
   */
  public registerModule(module: PipelineModule): void {
    // Register shader with shader registry
    this.shaderRegistry.registerProgram(
      module.name,
      module.shader.vertex,
      module.shader.fragment,
      module.uniforms,
      module.attributes
    );

    // Store module in state
    this.state.modules.set(module.name, module);

    // Mark as dirty
    this.state.dirtyModules.add(module.name);

    // Recompute execution order
    this.computeExecutionOrder();
  }

  /**
   * Compute execution order based on dependencies
   */
  private computeExecutionOrder(): void {
    const modules = Array.from(this.state.modules.values());
    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (moduleName: string): void => {
      if (visited.has(moduleName)) {
        return;
      }

      if (visiting.has(moduleName)) {
        throw new Error(`Circular dependency detected: ${moduleName}`);
      }

      visiting.add(moduleName);

      const module = this.state.modules.get(moduleName);
      if (module && module.dependencies) {
        for (const dep of module.dependencies) {
          visit(dep);
        }
      }

      visiting.delete(moduleName);
      visited.add(moduleName);
      order.push(moduleName);
    };

    // Visit all modules
    for (const module of modules) {
      if (!visited.has(module.name)) {
        visit(module.name);
      }
    }

    this.state.executionOrder = order;
  }

  /**
   * Enable or disable a module
   */
  public setModuleEnabled(moduleName: string, enabled: boolean): void {
    const module = this.state.modules.get(moduleName);
    if (!module) {
      throw new Error(`Module "${moduleName}" not found`);
    }

    if (module.enabled !== enabled) {
      module.enabled = enabled;
      this.markModuleDirty(moduleName);
    }
  }

  /**
   * Mark a module as dirty (needs re-execution)
   */
  public markModuleDirty(moduleName: string): void {
    this.state.dirtyModules.add(moduleName);

    // Invalidate cached output
    const cachedOutput = this.state.cachedOutputs.get(moduleName);
    if (cachedOutput) {
      this.texturePool.release(cachedOutput);
      this.state.cachedOutputs.delete(moduleName);
    }

    // Mark all dependent modules as dirty
    for (const [name, module] of this.state.modules.entries()) {
      if (module.dependencies && module.dependencies.includes(moduleName)) {
        this.state.dirtyModules.add(name);
        
        // Invalidate dependent cached outputs
        const depCachedOutput = this.state.cachedOutputs.get(name);
        if (depCachedOutput) {
          this.texturePool.release(depCachedOutput);
          this.state.cachedOutputs.delete(name);
        }
      }
    }
  }

  /**
   * Compute hash of module parameters for caching
   */
  private computeModuleHash(moduleName: string, uniforms?: Record<string, any>): string {
    if (!uniforms) {
      return moduleName;
    }

    // Create a simple hash from uniform values
    const uniformKeys = Object.keys(uniforms).sort();
    const uniformValues = uniformKeys.map((key) => {
      const value = uniforms[key];
      if (Array.isArray(value)) {
        return value.join(',');
      }
      return String(value);
    });

    return `${moduleName}:${uniformValues.join('|')}`;
  }

  /**
   * Check if module output can be reused from cache
   */
  private canReuseCache(moduleName: string, uniforms?: Record<string, any>): boolean {
    // Module must not be dirty
    if (this.state.dirtyModules.has(moduleName)) {
      return false;
    }

    // Must have cached output
    if (!this.state.cachedOutputs.has(moduleName)) {
      return false;
    }

    // Check if parameters have changed
    const currentHash = this.computeModuleHash(moduleName, uniforms);
    const cachedHash = this.state.moduleHashes.get(moduleName);

    return currentHash === cachedHash;
  }

  /**
   * Cache module output
   */
  private cacheModuleOutput(moduleName: string, texture: WebGLTexture, uniforms?: Record<string, any>): void {
    this.state.cachedOutputs.set(moduleName, texture);
    const hash = this.computeModuleHash(moduleName, uniforms);
    this.state.moduleHashes.set(moduleName, hash);
  }

  /**
   * Get cached module output
   */
  private getCachedOutput(moduleName: string): WebGLTexture | undefined {
    return this.state.cachedOutputs.get(moduleName);
  }

  /**
   * Clear all cached outputs
   */
  public clearCache(): void {
    for (const texture of this.state.cachedOutputs.values()) {
      this.texturePool.release(texture);
    }
    this.state.cachedOutputs.clear();
    this.state.moduleHashes.clear();
  }

  /**
   * Optimize pipeline by combining compatible operations
   * This is a placeholder for future shader fusion optimization
   */
  public optimizePipeline(): void {
    // Future: Analyze pipeline and combine compatible shader passes
    // For now, just ensure execution order is optimal
    this.computeExecutionOrder();
  }

  /**
   * Execute a single module
   */
  private executeModule(
    moduleName: string,
    inputTexture: WebGLTexture,
    outputFramebuffer: WebGLFramebuffer | null,
    width: number,
    height: number,
    uniforms?: Record<string, any>
  ): void {
    const module = this.state.modules.get(moduleName);
    if (!module || !module.enabled) {
      return;
    }

    // Start pass profiling
    const passStartTime = this.debugger.startPass(moduleName);

    // Use shader program
    this.shaderRegistry.useProgram(moduleName);

    // Bind framebuffer
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, outputFramebuffer);
    this.gl.viewport(0, 0, width, height);

    // Setup attributes
    const posLocation = this.shaderRegistry.getAttributeLocation(moduleName, 'a_position');
    const texCoordLocation = this.shaderRegistry.getAttributeLocation(moduleName, 'a_texCoord');
    this.setupQuadAttributes(posLocation, texCoordLocation);

    // Bind input texture
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, inputTexture);

    const textureLocation = this.shaderRegistry.getUniformLocation(moduleName, 'u_texture');
    if (textureLocation) {
      this.gl.uniform1i(textureLocation, 0);
    }

    // Set uniforms
    if (uniforms) {
      for (const [name, value] of Object.entries(uniforms)) {
        const location = this.shaderRegistry.getUniformLocation(moduleName, name);
        if (location) {
          this.setUniform(location, value);
        }
      }
    }

    // Render
    this.renderQuad();

    // Cleanup
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

    // End pass profiling
    this.debugger.endPass(moduleName, passStartTime);

    // Mark module as clean
    this.state.dirtyModules.delete(moduleName);
  }

  /**
   * Set a uniform value
   */
  private setUniform(location: WebGLUniformLocation, value: any): void {
    if (typeof value === 'number') {
      this.gl.uniform1f(location, value);
    } else if (Array.isArray(value)) {
      switch (value.length) {
        case 2:
          this.gl.uniform2fv(location, value);
          break;
        case 3:
          this.gl.uniform3fv(location, value);
          break;
        case 4:
          this.gl.uniform4fv(location, value);
          break;
        case 9:
          this.gl.uniformMatrix3fv(location, false, value);
          break;
        case 16:
          this.gl.uniformMatrix4fv(location, false, value);
          break;
        default:
          console.warn(`Unsupported uniform array length: ${value.length}`);
      }
    } else if (typeof value === 'boolean') {
      this.gl.uniform1i(location, value ? 1 : 0);
    }
  }

  /**
   * Execute the pipeline
   */
  public execute(context: RenderContext): void {
    // Start frame profiling
    const frameStartTime = this.debugger.startFrame();

    let currentTexture = context.inputTexture;
    const intermediateTextures: WebGLTexture[] = [];

    try {
      // Execute modules in order
      for (let i = 0; i < this.state.executionOrder.length; i++) {
        const moduleName = this.state.executionOrder[i];
        const module = this.state.modules.get(moduleName);

        if (!module || !module.enabled) {
          // Skip disabled modules
          continue;
        }

        // Check if we can reuse cached output
        if (this.canReuseCache(moduleName, context.uniforms)) {
          const cachedOutput = this.getCachedOutput(moduleName);
          if (cachedOutput) {
            currentTexture = cachedOutput;
            continue;
          }
        }

        // Determine output target
        const isLastModule = i === this.state.executionOrder.length - 1;
        const outputFramebuffer = isLastModule ? context.outputFramebuffer : null;

        // Create intermediate texture if needed
        let outputTexture: WebGLTexture | null = null;
        if (!isLastModule) {
          outputTexture = this.texturePool.acquire({
            width: context.width,
            height: context.height,
            format: 'rgba16f',
          });
          intermediateTextures[i] = outputTexture;

          // Create framebuffer for intermediate texture
          const framebuffer = this.gl.createFramebuffer();
          if (!framebuffer) {
            throw new Error('Failed to create framebuffer');
          }

          this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
          this.gl.framebufferTexture2D(
            this.gl.FRAMEBUFFER,
            this.gl.COLOR_ATTACHMENT0,
            this.gl.TEXTURE_2D,
            outputTexture,
            0
          );

          // Execute module
          this.executeModule(
            moduleName,
            currentTexture,
            framebuffer,
            context.width,
            context.height,
            context.uniforms
          );

          this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
          this.gl.deleteFramebuffer(framebuffer);

          // Cache the output for future use
          this.cacheModuleOutput(moduleName, outputTexture, context.uniforms);

          currentTexture = outputTexture;
        } else {
          // Last module renders to output framebuffer
          this.executeModule(
            moduleName,
            currentTexture,
            outputFramebuffer,
            context.width,
            context.height,
            context.uniforms
          );
        }
      }
    } finally {
      // Release intermediate textures back to pool (but not cached ones)
      for (const texture of intermediateTextures) {
        if (texture && !Array.from(this.state.cachedOutputs.values()).includes(texture)) {
          this.texturePool.release(texture);
        }
      }

      // End frame profiling
      this.debugger.endFrame(frameStartTime);
    }
  }

  /**
   * Get module by name
   */
  public getModule(name: string): PipelineModule | undefined {
    return this.state.modules.get(name);
  }

  /**
   * Get all module names
   */
  public getModuleNames(): string[] {
    return Array.from(this.state.modules.keys());
  }

  /**
   * Get execution order
   */
  public getExecutionOrder(): string[] {
    return [...this.state.executionOrder];
  }

  /**
   * Get shader registry
   */
  public getShaderRegistry(): ShaderRegistry {
    return this.shaderRegistry;
  }

  /**
   * Get texture pool
   */
  public getTexturePool(): TexturePool {
    return this.texturePool;
  }

  /**
   * Get debugger
   */
  public getDebugger(): PipelineDebugger {
    return this.debugger;
  }

  /**
   * Get pipeline statistics
   */
  public getStats(): {
    modules: number;
    enabledModules: number;
    dirtyModules: number;
    texturePool: ReturnType<TexturePool['getStats']>;
    shaderCache: ReturnType<ShaderRegistry['getCacheStats']>;
    performance: ReturnType<PipelineDebugger['getPerformanceSummary']>;
  } {
    const enabledModules = Array.from(this.state.modules.values()).filter((m) => m.enabled).length;

    return {
      modules: this.state.modules.size,
      enabledModules,
      dirtyModules: this.state.dirtyModules.size,
      texturePool: this.texturePool.getStats(),
      shaderCache: this.shaderRegistry.getCacheStats(),
      performance: this.debugger.getPerformanceSummary(),
    };
  }

  /**
   * Generate performance report
   */
  public generatePerformanceReport(): string {
    return this.debugger.generateReport();
  }

  /**
   * Enable or disable profiling
   */
  public setProfilingEnabled(enabled: boolean): void {
    this.config.enableProfiling = enabled;
    this.debugger.setProfilingEnabled(enabled);
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    // Clear cached outputs
    this.clearCache();

    // Dispose subsystems
    this.shaderRegistry.dispose();
    this.texturePool.dispose();
    this.debugger.dispose();

    // Delete quad geometry
    if (this.quadVAO) {
      this.gl.deleteVertexArray(this.quadVAO);
      this.quadVAO = null;
    }
    if (this.quadPositionBuffer) {
      this.gl.deleteBuffer(this.quadPositionBuffer);
      this.quadPositionBuffer = null;
    }
    if (this.quadTexCoordBuffer) {
      this.gl.deleteBuffer(this.quadTexCoordBuffer);
      this.quadTexCoordBuffer = null;
    }

    // Clear state
    this.state.modules.clear();
    this.state.dirtyModules.clear();
    this.state.executionOrder = [];
    this.state.cachedOutputs.clear();
    this.state.moduleHashes.clear();
  }
}
