/**
 * Shader Registry
 * Advanced shader compilation system with validation, error reporting, caching, and context recovery
 * Implements requirements for shader compilation, error handling, and WebGL context loss recovery
 */

export interface ShaderSource {
  vertex: string;
  fragment: string;
}

export interface ShaderProgramInfo {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation>;
  attributes: Map<string, number>;
  vertexShader: WebGLShader;
  fragmentShader: WebGLShader;
  source: ShaderSource;
}

export interface CompilationError {
  type: 'vertex' | 'fragment' | 'link';
  message: string;
  line?: number;
  source?: string;
}

export interface ShaderRegistryConfig {
  enableValidation?: boolean;
  enableCaching?: boolean;
  logErrors?: boolean;
}

/**
 * ShaderRegistry manages WebGL shader programs with advanced features:
 * - Shader source validation
 * - Detailed error reporting with line numbers
 * - Automatic shader caching
 * - WebGL context loss recovery
 */
export class ShaderRegistry {
  private gl: WebGL2RenderingContext;
  private programs: Map<string, ShaderProgramInfo> = new Map();
  private shaderCache: Map<string, WebGLShader> = new Map();
  private config: Required<ShaderRegistryConfig>;
  private contextLostHandler: (() => void) | null = null;
  private contextRestoredHandler: (() => void) | null = null;

  constructor(gl: WebGL2RenderingContext, config: ShaderRegistryConfig = {}) {
    this.gl = gl;
    this.config = {
      enableValidation: config.enableValidation ?? true,
      enableCaching: config.enableCaching ?? true,
      logErrors: config.logErrors ?? true,
    };

    this.setupContextLossHandlers();
  }

  /**
   * Setup handlers for WebGL context loss and restoration
   */
  private setupContextLossHandlers(): void {
    const canvas = this.gl.canvas;
    
    // Check if OffscreenCanvas is available and if canvas is an instance
    if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
      return; // OffscreenCanvas doesn't support context loss events
    }
    
    // Check if canvas supports addEventListener (might be null in tests)
    if (!canvas || typeof canvas.addEventListener !== 'function') {
      return;
    }

    this.contextLostHandler = () => {
      if (this.config.logErrors) {
        console.warn('WebGL context lost - shader programs will need recompilation');
      }
    };

    this.contextRestoredHandler = () => {
      if (this.config.logErrors) {
        console.log('WebGL context restored - recompiling shaders');
      }
      this.recompileAllShaders();
    };

    canvas.addEventListener('webglcontextlost', this.contextLostHandler as EventListener);
    canvas.addEventListener('webglcontextrestored', this.contextRestoredHandler as EventListener);
  }

  /**
   * Validate shader source for common issues
   */
  private validateShaderSource(source: string, type: 'vertex' | 'fragment'): string[] {
    if (!this.config.enableValidation) {
      return [];
    }

    const warnings: string[] = [];

    // Check for version directive
    if (!source.includes('#version')) {
      warnings.push('Missing #version directive');
    }

    // Check for precision qualifiers in fragment shaders
    if (type === 'fragment' && !source.includes('precision')) {
      warnings.push('Missing precision qualifier in fragment shader');
    }

    // Check for common typos
    if (source.includes('sampler2d')) {
      warnings.push('Found "sampler2d" - should be "sampler2D" (capital D)');
    }

    // Check for missing semicolons (basic check)
    const lines = source.split('\n');
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (
        trimmed.length > 0 &&
        !trimmed.startsWith('//') &&
        !trimmed.startsWith('#') &&
        !trimmed.startsWith('}') &&
        !trimmed.endsWith(';') &&
        !trimmed.endsWith('{') &&
        !trimmed.endsWith('}')
      ) {
        // This is a heuristic and may have false positives
        if (
          !trimmed.includes('if') &&
          !trimmed.includes('for') &&
          !trimmed.includes('while') &&
          !trimmed.includes('else')
        ) {
          warnings.push(`Line ${index + 1}: Possible missing semicolon`);
        }
      }
    });

    return warnings;
  }

  /**
   * Format shader source with line numbers for error reporting
   */
  private formatShaderSource(source: string): string {
    const lines = source.split('\n');
    return lines
      .map((line, index) => `${(index + 1).toString().padStart(4, ' ')}: ${line}`)
      .join('\n');
  }

  /**
   * Extract error line number from WebGL error message
   */
  private extractErrorLine(errorMessage: string): number | undefined {
    // Try different error message formats
    const patterns = [
      /ERROR: \d+:(\d+):/,  // NVIDIA/AMD format
      /ERROR: (\d+):/,       // Some drivers
      /\((\d+)\)/,           // Alternative format
    ];

    for (const pattern of patterns) {
      const match = errorMessage.match(pattern);
      if (match) {
        return parseInt(match[1], 10);
      }
    }

    return undefined;
  }

  /**
   * Get context around an error line
   */
  private getErrorContext(source: string, errorLine: number, contextLines: number = 2): string {
    const lines = source.split('\n');
    const start = Math.max(0, errorLine - contextLines - 1);
    const end = Math.min(lines.length, errorLine + contextLines);

    let context = '';
    for (let i = start; i < end; i++) {
      const lineNum = i + 1;
      const marker = lineNum === errorLine ? '>>> ' : '    ';
      context += `${marker}${lineNum.toString().padStart(4, ' ')}: ${lines[i]}\n`;
    }

    return context;
  }

  /**
   * Compile a shader with detailed error reporting
   */
  private compileShader(source: string, type: number): WebGLShader {
    const typeStr = type === this.gl.VERTEX_SHADER ? 'vertex' : 'fragment';

    // Validate source
    const warnings = this.validateShaderSource(source, typeStr);
    if (warnings.length > 0 && this.config.logErrors) {
      console.warn(`Shader validation warnings (${typeStr}):`, warnings);
    }

    // Check cache
    if (this.config.enableCaching) {
      const cacheKey = `${typeStr}_${this.hashString(source)}`;
      const cached = this.shaderCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Create and compile shader
    const shader = this.gl.createShader(type);
    if (!shader) {
      throw new Error(`Failed to create ${typeStr} shader object`);
    }

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    // Check compilation status
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const errorMessage = this.gl.getShaderInfoLog(shader) || 'Unknown compilation error';
      this.gl.deleteShader(shader);

      // Extract error details
      const errorLine = this.extractErrorLine(errorMessage);
      const error: CompilationError = {
        type: typeStr,
        message: errorMessage,
        line: errorLine,
        source: errorLine ? this.getErrorContext(source, errorLine) : undefined,
      };

      // Log detailed error
      if (this.config.logErrors) {
        console.error(`\n${'='.repeat(80)}`);
        console.error(`${typeStr.toUpperCase()} SHADER COMPILATION FAILED`);
        console.error(`${'='.repeat(80)}`);
        console.error(`Error: ${errorMessage}`);
        if (error.line) {
          console.error(`\nError at line ${error.line}:`);
          console.error(error.source);
        } else {
          console.error('\nFull shader source:');
          console.error(this.formatShaderSource(source));
        }
        console.error(`${'='.repeat(80)}\n`);
      }

      throw new Error(`${typeStr} shader compilation failed: ${errorMessage}`);
    }

    // Cache the compiled shader
    if (this.config.enableCaching) {
      const cacheKey = `${typeStr}_${this.hashString(source)}`;
      this.shaderCache.set(cacheKey, shader);
    }

    return shader;
  }

  /**
   * Link shaders into a program with error reporting
   */
  private linkProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram {
    const program = this.gl.createProgram();
    if (!program) {
      throw new Error('Failed to create shader program object');
    }

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    // Check linking status
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const errorMessage = this.gl.getProgramInfoLog(program) || 'Unknown linking error';
      this.gl.deleteProgram(program);

      if (this.config.logErrors) {
        console.error(`\n${'='.repeat(80)}`);
        console.error('SHADER PROGRAM LINKING FAILED');
        console.error(`${'='.repeat(80)}`);
        console.error(`Error: ${errorMessage}`);
        console.error(`${'='.repeat(80)}\n`);
      }

      throw new Error(`Shader program linking failed: ${errorMessage}`);
    }

    return program;
  }

  /**
   * Simple string hash function for caching
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Register a new shader program
   */
  public registerProgram(
    name: string,
    vertexSource: string,
    fragmentSource: string,
    uniformNames: string[] = [],
    attributeNames: string[] = []
  ): void {
    // Check if already registered
    if (this.programs.has(name)) {
      if (this.config.logErrors) {
        console.warn(`Shader program "${name}" is already registered. Replacing.`);
      }
      this.deleteProgram(name);
    }

    try {
      // Compile shaders
      const vertexShader = this.compileShader(vertexSource, this.gl.VERTEX_SHADER);
      const fragmentShader = this.compileShader(fragmentSource, this.gl.FRAGMENT_SHADER);

      // Link program
      const program = this.linkProgram(vertexShader, fragmentShader);

      // Get uniform locations
      const uniforms = new Map<string, WebGLUniformLocation>();
      for (const uniformName of uniformNames) {
        const location = this.gl.getUniformLocation(program, uniformName);
        if (location) {
          uniforms.set(uniformName, location);
        } else if (this.config.logErrors) {
          console.warn(`Uniform "${uniformName}" not found in program "${name}"`);
        }
      }

      // Get attribute locations
      const attributes = new Map<string, number>();
      for (const attributeName of attributeNames) {
        const location = this.gl.getAttribLocation(program, attributeName);
        if (location !== -1) {
          attributes.set(attributeName, location);
        } else if (this.config.logErrors) {
          console.warn(`Attribute "${attributeName}" not found in program "${name}"`);
        }
      }

      // Store program info
      this.programs.set(name, {
        program,
        uniforms,
        attributes,
        vertexShader,
        fragmentShader,
        source: { vertex: vertexSource, fragment: fragmentSource },
      });
    } catch (error) {
      if (this.config.logErrors) {
        console.error(`Failed to register shader program "${name}":`, error);
      }
      throw error;
    }
  }

  /**
   * Get a registered shader program
   */
  public getProgram(name: string): ShaderProgramInfo | undefined {
    return this.programs.get(name);
  }

  /**
   * Use a shader program
   */
  public useProgram(name: string): void {
    const programInfo = this.programs.get(name);
    if (!programInfo) {
      throw new Error(`Shader program "${name}" not found`);
    }
    this.gl.useProgram(programInfo.program);
  }

  /**
   * Get uniform location
   */
  public getUniformLocation(programName: string, uniformName: string): WebGLUniformLocation | null {
    const programInfo = this.programs.get(programName);
    if (!programInfo) {
      throw new Error(`Shader program "${programName}" not found`);
    }
    return programInfo.uniforms.get(uniformName) || null;
  }

  /**
   * Get attribute location
   */
  public getAttributeLocation(programName: string, attributeName: string): number {
    const programInfo = this.programs.get(programName);
    if (!programInfo) {
      throw new Error(`Shader program "${programName}" not found`);
    }
    return programInfo.attributes.get(attributeName) ?? -1;
  }

  /**
   * Delete a shader program
   */
  public deleteProgram(name: string): void {
    const programInfo = this.programs.get(name);
    if (programInfo) {
      this.gl.deleteProgram(programInfo.program);
      // Note: We don't delete cached shaders as they may be used by other programs
      this.programs.delete(name);
    }
  }

  /**
   * Recompile all registered shader programs (for context recovery)
   */
  private recompileAllShaders(): void {
    const programsToRecompile = Array.from(this.programs.entries());

    // Clear existing programs and cache
    this.programs.clear();
    this.shaderCache.clear();

    // Recompile each program
    for (const [name, info] of programsToRecompile) {
      try {
        const uniformNames = Array.from(info.uniforms.keys());
        const attributeNames = Array.from(info.attributes.keys());
        this.registerProgram(
          name,
          info.source.vertex,
          info.source.fragment,
          uniformNames,
          attributeNames
        );
      } catch (error) {
        if (this.config.logErrors) {
          console.error(`Failed to recompile shader program "${name}":`, error);
        }
      }
    }
  }

  /**
   * Get all registered program names
   */
  public getProgramNames(): string[] {
    return Array.from(this.programs.keys());
  }

  /**
   * Check if a program is registered
   */
  public hasProgram(name: string): boolean {
    return this.programs.has(name);
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    programs: number;
    cachedShaders: number;
  } {
    return {
      programs: this.programs.size,
      cachedShaders: this.shaderCache.size,
    };
  }

  /**
   * Clear shader cache
   */
  public clearCache(): void {
    for (const shader of this.shaderCache.values()) {
      this.gl.deleteShader(shader);
    }
    this.shaderCache.clear();
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    // Remove event listeners
    const canvas = this.gl.canvas;
    if (!(canvas instanceof OffscreenCanvas)) {
      if (this.contextLostHandler) {
        canvas.removeEventListener('webglcontextlost', this.contextLostHandler as EventListener);
      }
      if (this.contextRestoredHandler) {
        canvas.removeEventListener('webglcontextrestored', this.contextRestoredHandler as EventListener);
      }
    }

    // Delete all programs
    for (const programInfo of this.programs.values()) {
      this.gl.deleteProgram(programInfo.program);
    }
    this.programs.clear();

    // Clear cache
    this.clearCache();
  }
}
