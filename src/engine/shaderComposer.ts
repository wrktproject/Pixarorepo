/**
 * Shader Composition System
 * 
 * Provides a modular shader system with include/import functionality.
 * Allows shaders to be composed from reusable library modules.
 * 
 * Features:
 * - Automatic dependency resolution
 * - Include directive processing (#include "module")
 * - Caching for performance
 * - Circular dependency detection
 * - Consistent naming conventions
 * 
 * @module shaderComposer
 * @version 1.0.0
 * 
 * Requirements: 15.1, 15.2, 15.3, 15.4
 */

import colorSpaceUtilsGLSL from './shaders/lib/colorSpaceUtils.glsl?raw';
import mathUtilsGLSL from './shaders/lib/mathUtils.glsl?raw';
import toneMappingUtilsGLSL from './shaders/lib/toneMappingUtils.glsl?raw';
import blurUtilsGLSL from './shaders/lib/blurUtils.glsl?raw';

/**
 * Shader library module definition
 */
export interface ShaderModule {
  name: string;
  source: string;
  dependencies: string[];
  version: string;
  description: string;
}

/**
 * Shader composition options
 */
export interface CompositionOptions {
  /** Enable caching of composed shaders */
  enableCache?: boolean;
  /** Validate shader syntax (basic checks) */
  validate?: boolean;
  /** Add debug comments to output */
  debug?: boolean;
  /** Custom include path resolver */
  includeResolver?: (name: string) => string | null;
}

/**
 * Shader Composer
 * 
 * Manages shader composition with include/import system.
 * Requirement 15.2: Implement shader include/import system
 */
export class ShaderComposer {
  private modules: Map<string, ShaderModule> = new Map();
  private composedCache: Map<string, string> = new Map();
  private options: Required<CompositionOptions>;

  constructor(options: CompositionOptions = {}) {
    this.options = {
      enableCache: options.enableCache ?? true,
      validate: options.validate ?? true,
      debug: options.debug ?? false,
      includeResolver: options.includeResolver ?? (() => null),
    };

    // Register built-in library modules
    // Requirement 15.1: Organize shaders into modular files
    this.registerBuiltInModules();
  }

  /**
   * Register built-in shader library modules
   * Requirement 15.1: Organize shaders into modular files
   * @private
   */
  private registerBuiltInModules(): void {
    this.registerModule({
      name: 'colorSpaceUtils',
      source: colorSpaceUtilsGLSL,
      dependencies: [],
      version: '1.0.0',
      description: 'Color space conversion utilities (sRGB, linear, HSL)',
    });

    this.registerModule({
      name: 'mathUtils',
      source: mathUtilsGLSL,
      dependencies: [],
      version: '1.0.0',
      description: 'Mathematical utilities for curves, masking, and interpolation',
    });

    this.registerModule({
      name: 'toneMappingUtils',
      source: toneMappingUtilsGLSL,
      dependencies: [],
      version: '1.0.0',
      description: 'Tone mapping algorithms (Reinhard, ACES, Uncharted 2)',
    });

    this.registerModule({
      name: 'blurUtils',
      source: blurUtilsGLSL,
      dependencies: [],
      version: '1.0.0',
      description: 'Blur algorithms (Gaussian, box, bilateral)',
    });
  }

  /**
   * Register a shader module
   * Requirement 15.1: Organize shaders into modular files
   * 
   * @param module - Module definition
   */
  public registerModule(module: ShaderModule): void {
    if (this.modules.has(module.name)) {
      console.warn(`Shader module "${module.name}" is already registered. Overwriting.`);
    }
    this.modules.set(module.name, module);
    
    // Clear cache when modules change
    if (this.options.enableCache) {
      this.composedCache.clear();
    }
  }

  /**
   * Get a registered module
   * 
   * @param name - Module name
   * @returns Module definition or undefined
   */
  public getModule(name: string): ShaderModule | undefined {
    return this.modules.get(name);
  }

  /**
   * List all registered modules
   * 
   * @returns Array of module names
   */
  public listModules(): string[] {
    return Array.from(this.modules.keys());
  }

  /**
   * Compose shader source with includes
   * Requirement 15.2: Implement shader include/import system
   * 
   * Processes #include directives and resolves dependencies.
   * 
   * @param source - Shader source code with #include directives
   * @param visited - Set of already included modules (for circular dependency detection)
   * @returns Composed shader source
   * @throws Error if circular dependency detected or module not found
   */
  public compose(source: string, visited: Set<string> = new Set()): string {
    // Check cache first
    if (this.options.enableCache) {
      const cached = this.composedCache.get(source);
      if (cached) {
        return cached;
      }
    }

    // Process includes
    const includeRegex = /#include\s+["<]([^">]+)[">]/g;
    let composed = source;
    const includes: string[] = [];

    // Find all includes
    let match;
    while ((match = includeRegex.exec(source)) !== null) {
      const moduleName = match[1];
      includes.push(moduleName);
    }

    // Resolve and insert includes
    for (const moduleName of includes) {
      // Check for circular dependencies
      if (visited.has(moduleName)) {
        throw new Error(
          `Circular dependency detected: ${Array.from(visited).join(' -> ')} -> ${moduleName}`
        );
      }

      // Get module
      const module = this.modules.get(moduleName);
      if (!module) {
        // Try custom resolver
        const customSource = this.options.includeResolver(moduleName);
        if (customSource) {
          composed = composed.replace(
            new RegExp(`#include\\s+["<]${moduleName}[">]`, 'g'),
            customSource
          );
          continue;
        }
        
        throw new Error(`Shader module "${moduleName}" not found`);
      }

      // Recursively compose module (handle nested includes)
      const newVisited = new Set(visited);
      newVisited.add(moduleName);
      const moduleSource = this.compose(module.source, newVisited);

      // Add debug comments if enabled
      let replacement = moduleSource;
      if (this.options.debug) {
        replacement = `
// ============================================================================
// BEGIN INCLUDE: ${moduleName} (v${module.version})
// ${module.description}
// ============================================================================

${moduleSource}

// ============================================================================
// END INCLUDE: ${moduleName}
// ============================================================================
`;
      }

      // Replace include directive with module source
      composed = composed.replace(
        new RegExp(`#include\\s+["<]${moduleName}[">]`, 'g'),
        replacement
      );
    }

    // Validate if enabled
    if (this.options.validate) {
      this.validateShaderSource(composed);
    }

    // Cache result
    if (this.options.enableCache) {
      this.composedCache.set(source, composed);
    }

    return composed;
  }

  /**
   * Basic shader source validation
   * Requirement 15.4: Add inline documentation for each shader
   * 
   * @param source - Shader source to validate
   * @throws Error if validation fails
   * @private
   */
  private validateShaderSource(source: string): void {
    // Check for unresolved includes
    const unresolvedIncludes = source.match(/#include\s+["<]([^">]+)[">]/g);
    if (unresolvedIncludes) {
      throw new Error(
        `Unresolved includes found: ${unresolvedIncludes.join(', ')}`
      );
    }

    // Check for basic syntax issues
    const openBraces = (source.match(/{/g) || []).length;
    const closeBraces = (source.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      console.warn(
        `Mismatched braces: ${openBraces} open, ${closeBraces} close`
      );
    }
  }

  /**
   * Create a complete shader with standard includes
   * Requirement 15.2: Implement shader include/import system
   * 
   * Convenience method that adds common includes to a shader.
   * 
   * @param fragmentSource - Fragment shader source
   * @param includes - Array of module names to include
   * @returns Composed shader source
   */
  public createShader(fragmentSource: string, includes: string[] = []): string {
    // Build include directives
    const includeDirectives = includes.map(name => `#include "${name}"`).join('\n');
    
    // Combine with shader source
    const fullSource = `${includeDirectives}\n\n${fragmentSource}`;
    
    return this.compose(fullSource);
  }

  /**
   * Clear composition cache
   */
  public clearCache(): void {
    this.composedCache.clear();
  }

  /**
   * Get cache statistics
   * 
   * @returns Cache statistics
   */
  public getCacheStats(): { modules: number; cached: number } {
    return {
      modules: this.modules.size,
      cached: this.composedCache.size,
    };
  }

  /**
   * Export module information for debugging
   * 
   * @returns Module information
   */
  public getModuleInfo(): Array<{
    name: string;
    version: string;
    description: string;
    dependencies: string[];
  }> {
    return Array.from(this.modules.values()).map(module => ({
      name: module.name,
      version: module.version,
      description: module.description,
      dependencies: module.dependencies,
    }));
  }
}

/**
 * Global shader composer instance
 * Requirement 15.2: Implement shader include/import system
 */
export const shaderComposer = new ShaderComposer({
  enableCache: true,
  validate: true,
  debug: false,
});

/**
 * Convenience function to compose shader with includes
 * Requirement 15.2: Implement shader include/import system
 * 
 * @param source - Shader source with #include directives
 * @returns Composed shader source
 */
export function composeShader(source: string): string {
  return shaderComposer.compose(source);
}

/**
 * Convenience function to create shader with standard includes
 * Requirement 15.2: Implement shader include/import system
 * 
 * @param fragmentSource - Fragment shader source
 * @param includes - Module names to include
 * @returns Composed shader source
 */
export function createShaderWithIncludes(
  fragmentSource: string,
  includes: string[]
): string {
  return shaderComposer.createShader(fragmentSource, includes);
}
