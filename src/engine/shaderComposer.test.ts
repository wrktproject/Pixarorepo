/**
 * Shader Composer Tests
 * 
 * Tests for the shader composition system including:
 * - Module registration
 * - Include directive processing
 * - Dependency resolution
 * - Circular dependency detection
 * - Caching behavior
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ShaderComposer, type ShaderModule } from './shaderComposer';

describe('ShaderComposer', () => {
  let composer: ShaderComposer;

  beforeEach(() => {
    composer = new ShaderComposer({ enableCache: false });
  });

  describe('Module Registration', () => {
    it('should register a module', () => {
      const module: ShaderModule = {
        name: 'testModule',
        source: 'float testFunction() { return 1.0; }',
        dependencies: [],
        version: '1.0.0',
        description: 'Test module',
      };

      composer.registerModule(module);
      const retrieved = composer.getModule('testModule');

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('testModule');
    });

    it('should list all registered modules', () => {
      const modules = composer.listModules();
      
      // Should include built-in modules
      expect(modules).toContain('colorSpaceUtils');
      expect(modules).toContain('mathUtils');
      expect(modules).toContain('toneMappingUtils');
      expect(modules).toContain('blurUtils');
    });

    it('should overwrite existing module with warning', () => {
      const module1: ShaderModule = {
        name: 'test',
        source: 'float v1() { return 1.0; }',
        dependencies: [],
        version: '1.0.0',
        description: 'Version 1',
      };

      const module2: ShaderModule = {
        name: 'test',
        source: 'float v2() { return 2.0; }',
        dependencies: [],
        version: '2.0.0',
        description: 'Version 2',
      };

      composer.registerModule(module1);
      composer.registerModule(module2);

      const retrieved = composer.getModule('test');
      expect(retrieved?.version).toBe('2.0.0');
    });
  });

  describe('Include Processing', () => {
    it('should process simple include directive', () => {
      const module: ShaderModule = {
        name: 'simple',
        source: 'float getValue() { return 42.0; }',
        dependencies: [],
        version: '1.0.0',
        description: 'Simple module',
      };

      composer.registerModule(module);

      const shader = `
        #include "simple"
        void main() {
          float x = getValue();
        }
      `;

      const composed = composer.compose(shader);
      expect(composed).toContain('float getValue() { return 42.0; }');
      expect(composed).not.toContain('#include');
    });

    it('should process multiple includes', () => {
      const module1: ShaderModule = {
        name: 'module1',
        source: 'float func1() { return 1.0; }',
        dependencies: [],
        version: '1.0.0',
        description: 'Module 1',
      };

      const module2: ShaderModule = {
        name: 'module2',
        source: 'float func2() { return 2.0; }',
        dependencies: [],
        version: '1.0.0',
        description: 'Module 2',
      };

      composer.registerModule(module1);
      composer.registerModule(module2);

      const shader = `
        #include "module1"
        #include "module2"
        void main() {
          float x = func1() + func2();
        }
      `;

      const composed = composer.compose(shader);
      expect(composed).toContain('func1');
      expect(composed).toContain('func2');
    });

    it('should handle nested includes', () => {
      const base: ShaderModule = {
        name: 'base',
        source: 'float baseFunc() { return 1.0; }',
        dependencies: [],
        version: '1.0.0',
        description: 'Base module',
      };

      const derived: ShaderModule = {
        name: 'derived',
        source: `
          #include "base"
          float derivedFunc() { return baseFunc() * 2.0; }
        `,
        dependencies: ['base'],
        version: '1.0.0',
        description: 'Derived module',
      };

      composer.registerModule(base);
      composer.registerModule(derived);

      const shader = `
        #include "derived"
        void main() {
          float x = derivedFunc();
        }
      `;

      const composed = composer.compose(shader);
      expect(composed).toContain('baseFunc');
      expect(composed).toContain('derivedFunc');
    });

    it('should support angle bracket includes', () => {
      const module: ShaderModule = {
        name: 'test',
        source: 'float test() { return 1.0; }',
        dependencies: [],
        version: '1.0.0',
        description: 'Test',
      };

      composer.registerModule(module);

      const shader = '#include <test>';
      const composed = composer.compose(shader);
      
      expect(composed).toContain('float test()');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for missing module', () => {
      const shader = '#include "nonexistent"';
      
      expect(() => composer.compose(shader)).toThrow('not found');
    });

    it('should detect circular dependencies', () => {
      const module1: ShaderModule = {
        name: 'circular1',
        source: '#include "circular2"\nfloat func1() { return 1.0; }',
        dependencies: ['circular2'],
        version: '1.0.0',
        description: 'Circular 1',
      };

      const module2: ShaderModule = {
        name: 'circular2',
        source: '#include "circular1"\nfloat func2() { return 2.0; }',
        dependencies: ['circular1'],
        version: '1.0.0',
        description: 'Circular 2',
      };

      composer.registerModule(module1);
      composer.registerModule(module2);

      const shader = '#include "circular1"';
      
      expect(() => composer.compose(shader)).toThrow('Circular dependency');
    });

    it('should validate composed shader', () => {
      const composerWithValidation = new ShaderComposer({ validate: true });
      
      const shader = `
        void main() {
          float x = 1.0;
          #include "unresolved"
        }
      `;

      expect(() => composerWithValidation.compose(shader)).toThrow();
    });
  });

  describe('Caching', () => {
    it('should cache composed shaders', () => {
      const composerWithCache = new ShaderComposer({ enableCache: true });
      
      const module: ShaderModule = {
        name: 'cached',
        source: 'float getValue() { return 1.0; }',
        dependencies: [],
        version: '1.0.0',
        description: 'Cached module',
      };

      composerWithCache.registerModule(module);

      const shader = '#include "cached"';
      
      const result1 = composerWithCache.compose(shader);
      const result2 = composerWithCache.compose(shader);

      expect(result1).toBe(result2);
      
      const stats = composerWithCache.getCacheStats();
      expect(stats.cached).toBeGreaterThan(0);
    });

    it('should clear cache', () => {
      const composerWithCache = new ShaderComposer({ enableCache: true });
      
      const shader = 'void main() {}';
      composerWithCache.compose(shader);

      let stats = composerWithCache.getCacheStats();
      expect(stats.cached).toBeGreaterThan(0);

      composerWithCache.clearCache();
      
      stats = composerWithCache.getCacheStats();
      expect(stats.cached).toBe(0);
    });
  });

  describe('Debug Mode', () => {
    it('should add debug comments when enabled', () => {
      const composerWithDebug = new ShaderComposer({ debug: true });
      
      const module: ShaderModule = {
        name: 'debug',
        source: 'float test() { return 1.0; }',
        dependencies: [],
        version: '1.0.0',
        description: 'Debug test',
      };

      composerWithDebug.registerModule(module);

      const shader = '#include "debug"';
      const composed = composerWithDebug.compose(shader);

      expect(composed).toContain('BEGIN INCLUDE: debug');
      expect(composed).toContain('END INCLUDE: debug');
      expect(composed).toContain('v1.0.0');
    });
  });

  describe('Convenience Methods', () => {
    it('should create shader with includes', () => {
      const fragmentSource = `
        void main() {
          vec3 color = sRGBToLinear(vec3(1.0));
        }
      `;

      const composed = composer.createShader(fragmentSource, ['colorSpaceUtils']);
      
      expect(composed).toContain('sRGBToLinear');
      expect(composed).toContain('void main()');
    });

    it('should get module info', () => {
      const info = composer.getModuleInfo();
      
      expect(info.length).toBeGreaterThan(0);
      expect(info[0]).toHaveProperty('name');
      expect(info[0]).toHaveProperty('version');
      expect(info[0]).toHaveProperty('description');
      expect(info[0]).toHaveProperty('dependencies');
    });
  });

  describe('Built-in Modules', () => {
    it('should have colorSpaceUtils module', () => {
      const module = composer.getModule('colorSpaceUtils');
      
      expect(module).toBeDefined();
      expect(module?.source).toContain('sRGBToLinear');
      expect(module?.source).toContain('rgbToHSL');
    });

    it('should have mathUtils module', () => {
      const module = composer.getModule('mathUtils');
      
      expect(module).toBeDefined();
      expect(module?.source).toContain('smoothCurve');
      expect(module?.source).toContain('lerp');
    });

    it('should have toneMappingUtils module', () => {
      const module = composer.getModule('toneMappingUtils');
      
      expect(module).toBeDefined();
      expect(module?.source).toContain('reinhardToneMap');
      expect(module?.source).toContain('acesToneMap');
    });

    it('should have blurUtils module', () => {
      const module = composer.getModule('blurUtils');
      
      expect(module).toBeDefined();
      expect(module?.source).toContain('gaussianBlur');
      expect(module?.source).toContain('bilateralFilter');
    });
  });

  describe('Custom Include Resolver', () => {
    it('should use custom resolver for unknown modules', () => {
      const customComposer = new ShaderComposer({
        includeResolver: (name: string) => {
          if (name === 'custom') {
            return 'float customFunc() { return 99.0; }';
          }
          return null;
        },
      });

      const shader = '#include "custom"';
      const composed = customComposer.compose(shader);

      expect(composed).toContain('customFunc');
    });
  });
});
