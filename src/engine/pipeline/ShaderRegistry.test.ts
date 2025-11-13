import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShaderRegistry } from './ShaderRegistry';

// Mock WebGL2RenderingContext
class MockWebGL2RenderingContext {
  VERTEX_SHADER = 0x8b31;
  FRAGMENT_SHADER = 0x8b30;
  COMPILE_STATUS = 0x8b81;
  LINK_STATUS = 0x8b82;

  private shaderCounter = 0;
  private programCounter = 0;

  createShader(_type: number): WebGLShader | null {
    return { id: ++this.shaderCounter } as WebGLShader;
  }

  deleteShader(_shader: WebGLShader): void {
    // Mock implementation
  }

  shaderSource(_shader: WebGLShader, _source: string): void {
    // Mock implementation
  }

  compileShader(_shader: WebGLShader): void {
    // Mock implementation
  }

  getShaderParameter(_shader: WebGLShader, _pname: number): any {
    return true; // Always succeed
  }

  getShaderInfoLog(_shader: WebGLShader): string | null {
    return null;
  }

  createProgram(): WebGLProgram | null {
    return { id: ++this.programCounter } as WebGLProgram;
  }

  deleteProgram(_program: WebGLProgram): void {
    // Mock implementation
  }

  attachShader(_program: WebGLProgram, _shader: WebGLShader): void {
    // Mock implementation
  }

  linkProgram(_program: WebGLProgram): void {
    // Mock implementation
  }

  getProgramParameter(_program: WebGLProgram, _pname: number): any {
    return true; // Always succeed
  }

  getProgramInfoLog(_program: WebGLProgram): string | null {
    return null;
  }

  getUniformLocation(_program: WebGLProgram, name: string): WebGLUniformLocation | null {
    return { name } as WebGLUniformLocation;
  }

  getAttribLocation(_program: WebGLProgram, _name: string): number {
    return 0;
  }

  useProgram(_program: WebGLProgram | null): void {
    // Mock implementation
  }

  get canvas() {
    return {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  }
}

describe('ShaderRegistry', () => {
  let gl: MockWebGL2RenderingContext;
  let registry: ShaderRegistry;

  const simpleVertexShader = `#version 300 es
    in vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const simpleFragmentShader = `#version 300 es
    precision highp float;
    out vec4 fragColor;
    void main() {
      fragColor = vec4(1.0);
    }
  `;

  beforeEach(() => {
    gl = new MockWebGL2RenderingContext() as any;
    registry = new ShaderRegistry(gl as any, {
      enableValidation: true,
      enableCaching: true,
      logErrors: false,
    });
  });

  it('should create a shader registry', () => {
    expect(registry).toBeDefined();
  });

  it('should register a shader program', () => {
    registry.registerProgram(
      'test',
      simpleVertexShader,
      simpleFragmentShader,
      [],
      ['a_position']
    );

    expect(registry.hasProgram('test')).toBe(true);
  });

  it('should get a registered program', () => {
    registry.registerProgram(
      'test',
      simpleVertexShader,
      simpleFragmentShader,
      [],
      ['a_position']
    );

    const program = registry.getProgram('test');
    expect(program).toBeDefined();
    expect(program?.program).toBeDefined();
  });

  it('should cache compiled shaders', () => {
    registry.registerProgram('test1', simpleVertexShader, simpleFragmentShader);
    registry.registerProgram('test2', simpleVertexShader, simpleFragmentShader);

    const stats = registry.getCacheStats();
    expect(stats.programs).toBe(2);
    expect(stats.cachedShaders).toBeGreaterThan(0);
  });

  it('should get uniform location', () => {
    registry.registerProgram(
      'test',
      simpleVertexShader,
      simpleFragmentShader,
      ['u_test'],
      []
    );

    const location = registry.getUniformLocation('test', 'u_test');
    expect(location).toBeDefined();
  });

  it('should get attribute location', () => {
    registry.registerProgram(
      'test',
      simpleVertexShader,
      simpleFragmentShader,
      [],
      ['a_position']
    );

    const location = registry.getAttributeLocation('test', 'a_position');
    expect(location).toBeDefined();
  });

  it('should delete a program', () => {
    registry.registerProgram('test', simpleVertexShader, simpleFragmentShader);
    expect(registry.hasProgram('test')).toBe(true);

    registry.deleteProgram('test');
    expect(registry.hasProgram('test')).toBe(false);
  });

  it('should get all program names', () => {
    registry.registerProgram('test1', simpleVertexShader, simpleFragmentShader);
    registry.registerProgram('test2', simpleVertexShader, simpleFragmentShader);

    const names = registry.getProgramNames();
    expect(names).toContain('test1');
    expect(names).toContain('test2');
    expect(names.length).toBe(2);
  });
});
