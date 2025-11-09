/**
 * Shader Utilities
 * Handles shader compilation, linking, and error handling
 */

export interface ShaderProgram {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation>;
  attributes: Map<string, number>;
}

export class ShaderCompiler {
  private gl: WebGL2RenderingContext;
  private programCache: Map<string, ShaderProgram> = new Map();
  private shaderCache: Map<string, WebGLShader> = new Map();

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  /**
   * Generate cache key for shader
   */
  private getShaderCacheKey(source: string, type: number): string {
    const typeStr = type === this.gl.VERTEX_SHADER ? 'vertex' : 'fragment';
    // Use a simple hash of the source for the key
    let hash = 0;
    for (let i = 0; i < source.length; i++) {
      const char = source.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `${typeStr}_${hash}`;
  }

  /**
   * Compile a shader from source with caching
   * Requirement 10.1: Detect shader compilation failures and log errors
   */
  public compileShader(source: string, type: number): WebGLShader {
    // Check cache first
    const cacheKey = this.getShaderCacheKey(source, type);
    const cached = this.shaderCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const shader = this.gl.createShader(type);
    if (!shader) {
      const error = new Error('Failed to create shader object');
      console.error('Shader creation failed:', error);
      throw error;
    }

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    // Check compilation status
    // Requirement 10.1: Detect shader compilation failures and log errors
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      const typeStr = type === this.gl.VERTEX_SHADER ? 'vertex' : 'fragment';
      const errorMsg = info || 'Unknown shader compilation error';
      
      // Detailed error logging
      console.error(`${typeStr} shader compilation failed:`, errorMsg);
      console.error('Shader source:');
      console.error(this.formatShaderSource(source));
      
      // Parse error line if available
      const lineMatch = errorMsg.match(/ERROR: \d+:(\d+):/);
      if (lineMatch) {
        const errorLine = parseInt(lineMatch[1], 10);
        console.error(`Error at line ${errorLine}:`, this.getSourceLine(source, errorLine));
      }
      
      throw new Error(`${typeStr} shader compilation failed: ${errorMsg}`);
    }

    // Cache the compiled shader
    this.shaderCache.set(cacheKey, shader);

    return shader;
  }

  /**
   * Format shader source with line numbers for debugging
   */
  private formatShaderSource(source: string): string {
    const lines = source.split('\n');
    return lines.map((line, index) => `${(index + 1).toString().padStart(4, ' ')}: ${line}`).join('\n');
  }

  /**
   * Get a specific line from shader source
   */
  private getSourceLine(source: string, lineNumber: number): string {
    const lines = source.split('\n');
    if (lineNumber > 0 && lineNumber <= lines.length) {
      return lines[lineNumber - 1];
    }
    return '';
  }

  /**
   * Link vertex and fragment shaders into a program
   * Requirement 10.1: Detect shader compilation failures and log errors
   */
  public linkProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram {
    const program = this.gl.createProgram();
    if (!program) {
      const error = new Error('Failed to create shader program object');
      console.error('Program creation failed:', error);
      throw error;
    }

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    // Check linking status
    // Requirement 10.1: Detect shader compilation failures and log errors
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const info = this.gl.getProgramInfoLog(program);
      this.gl.deleteProgram(program);
      
      // Detailed error logging
      console.error('Shader program linking failed:', info || 'Unknown linking error');
      
      throw new Error(`Shader program linking failed: ${info || 'Unknown error'}`);
    }

    return program;
  }

  /**
   * Generate cache key for program
   */
  private getProgramCacheKey(
    vertexSource: string,
    fragmentSource: string,
    uniformNames: string[],
    attributeNames: string[]
  ): string {
    const vKey = this.getShaderCacheKey(vertexSource, this.gl.VERTEX_SHADER);
    const fKey = this.getShaderCacheKey(fragmentSource, this.gl.FRAGMENT_SHADER);
    const uKey = uniformNames.sort().join(',');
    const aKey = attributeNames.sort().join(',');
    return `${vKey}_${fKey}_${uKey}_${aKey}`;
  }

  /**
   * Create a complete shader program from source strings with caching
   */
  public createProgram(
    vertexSource: string,
    fragmentSource: string,
    uniformNames: string[] = [],
    attributeNames: string[] = []
  ): ShaderProgram {
    // Check cache first
    const cacheKey = this.getProgramCacheKey(
      vertexSource,
      fragmentSource,
      uniformNames,
      attributeNames
    );
    const cached = this.programCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const vertexShader = this.compileShader(vertexSource, this.gl.VERTEX_SHADER);
      const fragmentShader = this.compileShader(fragmentSource, this.gl.FRAGMENT_SHADER);
      const program = this.linkProgram(vertexShader, fragmentShader);

      // Note: We don't delete shaders here since they're cached
      // They will be cleaned up when the cache is cleared

      // Get uniform locations
      const uniforms = new Map<string, WebGLUniformLocation>();
      for (const name of uniformNames) {
        const location = this.gl.getUniformLocation(program, name);
        if (location) {
          uniforms.set(name, location);
        } else {
          console.warn(`Uniform "${name}" not found in shader program`);
        }
      }

      // Get attribute locations
      const attributes = new Map<string, number>();
      for (const name of attributeNames) {
        const location = this.gl.getAttribLocation(program, name);
        if (location !== -1) {
          attributes.set(name, location);
        } else {
          console.warn(`Attribute "${name}" not found in shader program`);
        }
      }

      const shaderProgram = { program, uniforms, attributes };

      // Cache the program
      this.programCache.set(cacheKey, shaderProgram);

      return shaderProgram;
    } catch (error) {
      console.error('Shader program creation failed:', error);
      throw error;
    }
  }

  /**
   * Delete a shader program
   */
  public deleteProgram(program: WebGLProgram): void {
    // Remove from cache
    for (const [key, cached] of this.programCache.entries()) {
      if (cached.program === program) {
        this.programCache.delete(key);
        break;
      }
    }
    this.gl.deleteProgram(program);
  }

  /**
   * Clear all caches and delete cached resources
   */
  public clearCache(): void {
    // Delete all cached programs
    for (const cached of this.programCache.values()) {
      this.gl.deleteProgram(cached.program);
    }
    this.programCache.clear();

    // Delete all cached shaders
    for (const shader of this.shaderCache.values()) {
      this.gl.deleteShader(shader);
    }
    this.shaderCache.clear();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { programs: number; shaders: number } {
    return {
      programs: this.programCache.size,
      shaders: this.shaderCache.size,
    };
  }

  /**
   * Validate a shader program
   */
  public validateProgram(program: WebGLProgram): boolean {
    this.gl.validateProgram(program);
    const valid = this.gl.getProgramParameter(program, this.gl.VALIDATE_STATUS);
    
    if (!valid) {
      const info = this.gl.getProgramInfoLog(program);
      console.error(`Shader program validation failed: ${info}`);
    }
    
    return valid;
  }
}
