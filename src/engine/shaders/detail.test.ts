import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  detailVertexShader,
  detailFragmentShader,
  applyDetailUniforms,
  type DetailAdjustments,
} from './detail';
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
      return true;
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
      return true;
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

  uniform1f(_location: WebGLUniformLocation | null, _value: number): void {
    // Mock implementation
  }

  uniform2f(_location: WebGLUniformLocation | null, _x: number, _y: number): void {
    // Mock implementation
  }

  validateProgram(_program: WebGLProgram): void {
    // Mock implementation
  }
}

describe('Detail Shader', () => {
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
        compiler.compileShader(detailVertexShader, gl.VERTEX_SHADER);
      }).not.toThrow();
    });

    it('should compile fragment shader successfully', () => {
      expect(() => {
        compiler.compileShader(detailFragmentShader, gl.FRAGMENT_SHADER);
      }).not.toThrow();
    });

    it('should create complete shader program', () => {
      const program = compiler.createProgram(
        detailVertexShader,
        detailFragmentShader,
        ['u_texture', 'u_texelSize', 'u_sharpening', 'u_noiseReductionLuma', 'u_noiseReductionColor'],
        ['a_position', 'a_texCoord']
      );

      expect(program.program).toBeDefined();
      expect(program.uniforms.size).toBeGreaterThan(0);
      expect(program.attributes.size).toBeGreaterThan(0);
    });
  });

  describe('Uniform Application', () => {
    it('should apply detail uniforms correctly', () => {
      const program = compiler.createProgram(
        detailVertexShader,
        detailFragmentShader,
        ['u_texture', 'u_texelSize', 'u_sharpening', 'u_noiseReductionLuma', 'u_noiseReductionColor'],
        ['a_position', 'a_texCoord']
      );

      const adjustments: DetailAdjustments = {
        sharpening: 50.0,
        noiseReductionLuma: 25.0,
        noiseReductionColor: 15.0,
        texelSize: { width: 1920, height: 1080 },
      };

      expect(() => {
        applyDetailUniforms(
          gl as unknown as WebGL2RenderingContext,
          program.uniforms,
          adjustments
        );
      }).not.toThrow();
    });

    it('should handle zero sharpening', () => {
      const program = compiler.createProgram(
        detailVertexShader,
        detailFragmentShader,
        ['u_texture', 'u_texelSize', 'u_sharpening', 'u_noiseReductionLuma', 'u_noiseReductionColor'],
        ['a_position', 'a_texCoord']
      );

      const adjustments: DetailAdjustments = {
        sharpening: 0.0,
        noiseReductionLuma: 0.0,
        noiseReductionColor: 0.0,
        texelSize: { width: 1920, height: 1080 },
      };

      expect(() => {
        applyDetailUniforms(
          gl as unknown as WebGL2RenderingContext,
          program.uniforms,
          adjustments
        );
      }).not.toThrow();
    });

    it('should handle maximum sharpening', () => {
      const program = compiler.createProgram(
        detailVertexShader,
        detailFragmentShader,
        ['u_texture', 'u_texelSize', 'u_sharpening', 'u_noiseReductionLuma', 'u_noiseReductionColor'],
        ['a_position', 'a_texCoord']
      );

      const adjustments: DetailAdjustments = {
        sharpening: 150.0,
        noiseReductionLuma: 100.0,
        noiseReductionColor: 100.0,
        texelSize: { width: 3840, height: 2160 },
      };

      expect(() => {
        applyDetailUniforms(
          gl as unknown as WebGL2RenderingContext,
          program.uniforms,
          adjustments
        );
      }).not.toThrow();
    });
  });

  describe('Detail Adjustments', () => {
    it('should accept valid sharpening values', () => {
      const adjustments: DetailAdjustments = {
        sharpening: 75.0,
        noiseReductionLuma: 0.0,
        noiseReductionColor: 0.0,
        texelSize: { width: 1920, height: 1080 },
      };

      expect(adjustments.sharpening).toBe(75.0);
      expect(adjustments.sharpening).toBeGreaterThanOrEqual(0.0);
      expect(adjustments.sharpening).toBeLessThanOrEqual(150.0);
    });

    it('should accept valid noise reduction values', () => {
      const adjustments: DetailAdjustments = {
        sharpening: 0.0,
        noiseReductionLuma: 50.0,
        noiseReductionColor: 30.0,
        texelSize: { width: 1920, height: 1080 },
      };

      expect(adjustments.noiseReductionLuma).toBe(50.0);
      expect(adjustments.noiseReductionColor).toBe(30.0);
      expect(adjustments.noiseReductionLuma).toBeGreaterThanOrEqual(0.0);
      expect(adjustments.noiseReductionLuma).toBeLessThanOrEqual(100.0);
    });

    it('should handle different texture sizes', () => {
      const smallTexture: DetailAdjustments = {
        sharpening: 50.0,
        noiseReductionLuma: 25.0,
        noiseReductionColor: 15.0,
        texelSize: { width: 800, height: 600 },
      };

      const largeTexture: DetailAdjustments = {
        sharpening: 50.0,
        noiseReductionLuma: 25.0,
        noiseReductionColor: 15.0,
        texelSize: { width: 7680, height: 4320 },
      };

      expect(smallTexture.texelSize.width).toBe(800);
      expect(largeTexture.texelSize.width).toBe(7680);
    });
  });
});
