/**
 * Tests for Output Shader with Tone Mapping
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  outputVertexShader,
  outputFragmentShader,
  applyOutputUniforms,
  type OutputSettings,
} from './output';
import { ShaderCompiler } from '../shaderUtils';

// Mock WebGL2RenderingContext for shader compilation tests
class MockWebGL2RenderingContext {
  VERTEX_SHADER = 0x8b31;
  FRAGMENT_SHADER = 0x8b30;
  COMPILE_STATUS = 0x8b81;
  LINK_STATUS = 0x8b82;

  private shaderCounter = 0;
  private programCounter = 0;
  private shaders = new Map<WebGLShader, { source: string; type: number }>();
  private programs = new Set<WebGLProgram>();
  private uniformLocations = new Map<string, WebGLUniformLocation>();

  createShader(type: number): WebGLShader | null {
    const shader = { id: ++this.shaderCounter } as WebGLShader;
    this.shaders.set(shader, { source: '', type });
    return shader;
  }

  deleteShader(shader: WebGLShader | null): void {
    if (shader) {
      this.shaders.delete(shader);
    }
  }

  shaderSource(shader: WebGLShader, source: string): void {
    const shaderData = this.shaders.get(shader);
    if (shaderData) {
      shaderData.source = source;
    }
  }

  compileShader(_shader: WebGLShader): void {
    // Mock successful compilation
  }

  getShaderParameter(_shader: WebGLShader, pname: number): boolean {
    if (pname === this.COMPILE_STATUS) {
      return true; // Always succeed
    }
    return false;
  }

  getShaderInfoLog(_shader: WebGLShader): string | null {
    return null;
  }

  createProgram(): WebGLProgram | null {
    const program = { id: ++this.programCounter } as WebGLProgram;
    this.programs.add(program);
    return program;
  }

  deleteProgram(program: WebGLProgram | null): void {
    if (program) {
      this.programs.delete(program);
    }
  }

  attachShader(_program: WebGLProgram, _shader: WebGLShader): void {
    // Mock implementation
  }

  linkProgram(_program: WebGLProgram): void {
    // Mock successful linking
  }

  getProgramParameter(_program: WebGLProgram, pname: number): boolean {
    if (pname === this.LINK_STATUS) {
      return true; // Always succeed
    }
    return false;
  }

  getProgramInfoLog(_program: WebGLProgram): string | null {
    return null;
  }

  getUniformLocation(_program: WebGLProgram, name: string): WebGLUniformLocation | null {
    if (!this.uniformLocations.has(name)) {
      this.uniformLocations.set(name, { id: name } as WebGLUniformLocation);
    }
    return this.uniformLocations.get(name) || null;
  }

  getAttribLocation(_program: WebGLProgram, _name: string): number {
    return 0;
  }

  uniform1i(_location: WebGLUniformLocation | null, _value: number): void {
    // Mock implementation
  }

  validateProgram(_program: WebGLProgram): void {
    // Mock implementation
  }
}

describe('Output Shader', () => {
  let gl: MockWebGL2RenderingContext;
  let compiler: ShaderCompiler;

  beforeEach(() => {
    gl = new MockWebGL2RenderingContext();
    compiler = new ShaderCompiler(gl as unknown as WebGL2RenderingContext);
  });

  afterEach(() => {
    compiler.clearCache();
  });

  describe('Shader Compilation', () => {
    it('should compile vertex shader successfully', () => {
      expect(() => {
        compiler.compileShader(outputVertexShader, gl.VERTEX_SHADER);
      }).not.toThrow();
    });

    it('should compile fragment shader successfully', () => {
      expect(() => {
        compiler.compileShader(outputFragmentShader, gl.FRAGMENT_SHADER);
      }).not.toThrow();
    });

    it('should create complete shader program', () => {
      const program = compiler.createProgram(
        outputVertexShader,
        outputFragmentShader,
        ['u_texture', 'u_enableToneMapping', 'u_toneMappingMode'],
        ['a_position', 'a_texCoord']
      );

      expect(program.program).toBeDefined();
      expect(program.uniforms.size).toBeGreaterThan(0);
      expect(program.attributes.size).toBeGreaterThan(0);
    });
  });

  describe('Uniform Application', () => {
    it('should apply output uniforms with tone mapping disabled', () => {
      const program = compiler.createProgram(
        outputVertexShader,
        outputFragmentShader,
        ['u_texture', 'u_enableToneMapping', 'u_toneMappingMode'],
        ['a_position', 'a_texCoord']
      );

      const settings: OutputSettings = {
        enableToneMapping: false,
        toneMappingMode: 'reinhard',
      };

      expect(() => {
        applyOutputUniforms(
          gl as unknown as WebGL2RenderingContext,
          program.uniforms,
          settings
        );
      }).not.toThrow();
    });

    it('should apply output uniforms with Reinhard tone mapping', () => {
      const program = compiler.createProgram(
        outputVertexShader,
        outputFragmentShader,
        ['u_texture', 'u_enableToneMapping', 'u_toneMappingMode'],
        ['a_position', 'a_texCoord']
      );

      const settings: OutputSettings = {
        enableToneMapping: true,
        toneMappingMode: 'reinhard',
      };

      expect(() => {
        applyOutputUniforms(
          gl as unknown as WebGL2RenderingContext,
          program.uniforms,
          settings
        );
      }).not.toThrow();
    });

    it('should apply output uniforms with ACES tone mapping', () => {
      const program = compiler.createProgram(
        outputVertexShader,
        outputFragmentShader,
        ['u_texture', 'u_enableToneMapping', 'u_toneMappingMode'],
        ['a_position', 'a_texCoord']
      );

      const settings: OutputSettings = {
        enableToneMapping: true,
        toneMappingMode: 'aces',
      };

      expect(() => {
        applyOutputUniforms(
          gl as unknown as WebGL2RenderingContext,
          program.uniforms,
          settings
        );
      }).not.toThrow();
    });

    it('should handle missing uniform locations gracefully', () => {
      const emptyUniforms = new Map<string, WebGLUniformLocation>();

      const settings: OutputSettings = {
        enableToneMapping: true,
        toneMappingMode: 'aces',
      };

      expect(() => {
        applyOutputUniforms(
          gl as unknown as WebGL2RenderingContext,
          emptyUniforms,
          settings
        );
      }).not.toThrow();
    });
  });

  describe('Output Settings', () => {
    it('should support Reinhard tone mapping mode', () => {
      const settings: OutputSettings = {
        enableToneMapping: true,
        toneMappingMode: 'reinhard',
      };

      expect(settings.toneMappingMode).toBe('reinhard');
      expect(settings.enableToneMapping).toBe(true);
    });

    it('should support ACES tone mapping mode', () => {
      const settings: OutputSettings = {
        enableToneMapping: true,
        toneMappingMode: 'aces',
      };

      expect(settings.toneMappingMode).toBe('aces');
      expect(settings.enableToneMapping).toBe(true);
    });

    it('should allow disabling tone mapping', () => {
      const settings: OutputSettings = {
        enableToneMapping: false,
        toneMappingMode: 'reinhard',
      };

      expect(settings.enableToneMapping).toBe(false);
    });
  });
});
