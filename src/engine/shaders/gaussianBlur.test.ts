import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  gaussianBlurVertexShader,
  gaussianBlurFragmentShader,
  applyGaussianBlurUniforms,
  createHorizontalBlurParams,
  createVerticalBlurParams,
  type GaussianBlurParams,
} from './gaussianBlur';
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

describe('GaussianBlur Shader', () => {
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
        compiler.compileShader(gaussianBlurVertexShader, gl.VERTEX_SHADER);
      }).not.toThrow();
    });

    it('should compile fragment shader successfully', () => {
      expect(() => {
        compiler.compileShader(gaussianBlurFragmentShader, gl.FRAGMENT_SHADER);
      }).not.toThrow();
    });

    it('should create complete shader program', () => {
      const program = compiler.createProgram(
        gaussianBlurVertexShader,
        gaussianBlurFragmentShader,
        ['u_texture', 'u_direction', 'u_radius'],
        ['a_position', 'a_texCoord']
      );

      expect(program.program).toBeDefined();
      expect(program.uniforms.size).toBeGreaterThan(0);
      expect(program.attributes.size).toBeGreaterThan(0);
    });
  });

  describe('Uniform Application', () => {
    it('should apply horizontal blur uniforms correctly', () => {
      const program = compiler.createProgram(
        gaussianBlurVertexShader,
        gaussianBlurFragmentShader,
        ['u_texture', 'u_direction', 'u_radius'],
        ['a_position', 'a_texCoord']
      );

      const params = createHorizontalBlurParams(2.0);

      expect(() => {
        applyGaussianBlurUniforms(
          gl as unknown as WebGL2RenderingContext,
          program.uniforms,
          params
        );
      }).not.toThrow();
    });

    it('should apply vertical blur uniforms correctly', () => {
      const program = compiler.createProgram(
        gaussianBlurVertexShader,
        gaussianBlurFragmentShader,
        ['u_texture', 'u_direction', 'u_radius'],
        ['a_position', 'a_texCoord']
      );

      const params = createVerticalBlurParams(1.5);

      expect(() => {
        applyGaussianBlurUniforms(
          gl as unknown as WebGL2RenderingContext,
          program.uniforms,
          params
        );
      }).not.toThrow();
    });
  });

  describe('Helper Functions', () => {
    it('should create horizontal blur parameters', () => {
      const params = createHorizontalBlurParams(3.0);

      expect(params.direction).toEqual([1, 0]);
      expect(params.radius).toBe(3.0);
    });

    it('should create vertical blur parameters', () => {
      const params = createVerticalBlurParams(2.5);

      expect(params.direction).toEqual([0, 1]);
      expect(params.radius).toBe(2.5);
    });

    it('should use default radius when not specified', () => {
      const hParams = createHorizontalBlurParams();
      const vParams = createVerticalBlurParams();

      expect(hParams.radius).toBe(1.0);
      expect(vParams.radius).toBe(1.0);
    });
  });

  describe('Blur Parameters', () => {
    it('should accept custom blur parameters', () => {
      const params: GaussianBlurParams = {
        direction: [1, 0],
        radius: 5.0,
      };

      expect(params.direction).toEqual([1, 0]);
      expect(params.radius).toBe(5.0);
    });

    it('should support diagonal blur directions', () => {
      const params: GaussianBlurParams = {
        direction: [0.707, 0.707], // 45 degrees
        radius: 2.0,
      };

      expect(params.direction[0]).toBeCloseTo(0.707, 2);
      expect(params.direction[1]).toBeCloseTo(0.707, 2);
    });
  });
});
