import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FramebufferManager } from './framebufferManager';
import type { FramebufferConfig } from './framebufferManager';

// Mock WebGL2RenderingContext
class MockWebGL2RenderingContext {
  TEXTURE_2D = 0x0de1;
  RGBA = 0x1908;
  RGBA16F = 0x881a;
  UNSIGNED_BYTE = 0x1401;
  HALF_FLOAT = 0x140b;
  LINEAR = 0x2601;
  CLAMP_TO_EDGE = 0x812f;
  TEXTURE_MIN_FILTER = 0x2801;
  TEXTURE_MAG_FILTER = 0x2800;
  TEXTURE_WRAP_S = 0x2802;
  TEXTURE_WRAP_T = 0x2803;
  FRAMEBUFFER = 0x8d40;
  COLOR_ATTACHMENT0 = 0x8ce0;
  FRAMEBUFFER_COMPLETE = 0x8cd5;
  FRAMEBUFFER_INCOMPLETE_ATTACHMENT = 0x8cd6;
  FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT = 0x8cd7;
  FRAMEBUFFER_INCOMPLETE_DIMENSIONS = 0x8cd9;
  FRAMEBUFFER_UNSUPPORTED = 0x8cdd;

  private textureCounter = 0;
  private framebufferCounter = 0;
  private textures = new Set<WebGLTexture>();
  private framebuffers = new Set<WebGLFramebuffer>();

  createTexture(): WebGLTexture | null {
    const texture = { id: ++this.textureCounter } as WebGLTexture;
    this.textures.add(texture);
    return texture;
  }

  deleteTexture(texture: WebGLTexture | null): void {
    if (texture) {
      this.textures.delete(texture);
    }
  }

  createFramebuffer(): WebGLFramebuffer | null {
    const framebuffer = { id: ++this.framebufferCounter } as WebGLFramebuffer;
    this.framebuffers.add(framebuffer);
    return framebuffer;
  }

  deleteFramebuffer(framebuffer: WebGLFramebuffer | null): void {
    if (framebuffer) {
      this.framebuffers.delete(framebuffer);
    }
  }

  bindTexture(_target: number, _texture: WebGLTexture | null): void {
    // Mock implementation
  }

  bindFramebuffer(_target: number, _framebuffer: WebGLFramebuffer | null): void {
    // Mock implementation
  }

  texParameteri(_target: number, _pname: number, _param: number): void {
    // Mock implementation
  }

  texImage2D(
    _target: number,
    _level: number,
    _internalformat: number,
    _width: number,
    _height: number,
    _border: number,
    _format: number,
    _type: number,
    _pixels: ArrayBufferView | null
  ): void {
    // Mock implementation
  }

  framebufferTexture2D(
    _target: number,
    _attachment: number,
    _textarget: number,
    _texture: WebGLTexture | null,
    _level: number
  ): void {
    // Mock implementation
  }

  checkFramebufferStatus(_target: number): number {
    return this.FRAMEBUFFER_COMPLETE;
  }

  getExtension(name: string): unknown {
    if (name === 'EXT_color_buffer_float') {
      return {}; // Return non-null to indicate support
    }
    return null;
  }

  getTextureCount(): number {
    return this.textures.size;
  }

  getFramebufferCount(): number {
    return this.framebuffers.size;
  }
}

describe('FramebufferManager', () => {
  let gl: MockWebGL2RenderingContext;
  let manager: FramebufferManager;

  beforeEach(() => {
    gl = new MockWebGL2RenderingContext();
    manager = new FramebufferManager(gl as unknown as WebGL2RenderingContext);
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('createFramebuffer', () => {
    it('should create a framebuffer with RGBA8 texture', () => {
      const config: FramebufferConfig = {
        width: 512,
        height: 512,
        format: 'rgba8',
      };

      const result = manager.createFramebuffer(config);

      expect(result.framebuffer).toBeDefined();
      expect(result.texture).toBeDefined();
      expect(gl.getFramebufferCount()).toBe(1);
      expect(gl.getTextureCount()).toBe(1);
    });

    it('should create a framebuffer with RGBA16F texture when supported', () => {
      const config: FramebufferConfig = {
        width: 512,
        height: 512,
        format: 'rgba16f',
      };

      const result = manager.createFramebuffer(config);

      expect(result.framebuffer).toBeDefined();
      expect(result.texture).toBeDefined();
    });
  });

  describe('getFramebuffer (pooling)', () => {
    it('should create a new framebuffer when pool is empty', () => {
      const config: FramebufferConfig = {
        width: 512,
        height: 512,
      };

      const result = manager.getFramebuffer(config);

      expect(result.framebuffer).toBeDefined();
      expect(result.texture).toBeDefined();
      expect(gl.getFramebufferCount()).toBe(1);
    });

    it('should reuse framebuffer from pool with matching dimensions', () => {
      const config: FramebufferConfig = {
        width: 512,
        height: 512,
      };

      // Get first framebuffer
      const result1 = manager.getFramebuffer(config);
      const fb1 = result1.framebuffer;

      // Release it back to pool
      manager.releaseFramebuffer(fb1);

      // Get another with same dimensions
      const result2 = manager.getFramebuffer(config);

      // Should reuse the same framebuffer
      expect(result2.framebuffer).toBe(fb1);
      expect(gl.getFramebufferCount()).toBe(1); // Still only 1 framebuffer
    });

    it('should create new framebuffer when dimensions do not match', () => {
      const config1: FramebufferConfig = {
        width: 512,
        height: 512,
      };

      const config2: FramebufferConfig = {
        width: 1024,
        height: 1024,
      };

      const result1 = manager.getFramebuffer(config1);
      manager.releaseFramebuffer(result1.framebuffer);

      const result2 = manager.getFramebuffer(config2);

      // Should create a new framebuffer
      expect(result2.framebuffer).not.toBe(result1.framebuffer);
      expect(gl.getFramebufferCount()).toBe(2);
    });
  });

  describe('releaseFramebuffer', () => {
    it('should mark framebuffer as available in pool', () => {
      const config: FramebufferConfig = {
        width: 512,
        height: 512,
      };

      const result = manager.getFramebuffer(config);
      const stats1 = manager.getPoolStats();
      expect(stats1.inUse).toBe(1);
      expect(stats1.available).toBe(0);

      manager.releaseFramebuffer(result.framebuffer);
      const stats2 = manager.getPoolStats();
      expect(stats2.inUse).toBe(0);
      expect(stats2.available).toBe(1);
    });
  });

  describe('getPoolStats', () => {
    it('should return correct pool statistics', () => {
      const stats = manager.getPoolStats();

      expect(stats).toHaveProperty('totalEntries');
      expect(stats).toHaveProperty('inUse');
      expect(stats).toHaveProperty('available');
      expect(stats).toHaveProperty('supportsFloat16');
      expect(stats.supportsFloat16).toBe(true); // Mock supports it
    });
  });

  describe('dispose', () => {
    it('should clean up all resources', () => {
      const config: FramebufferConfig = {
        width: 512,
        height: 512,
      };

      manager.getFramebuffer(config);
      manager.getFramebuffer(config);

      manager.dispose();

      expect(gl.getFramebufferCount()).toBe(0);
      expect(gl.getTextureCount()).toBe(0);
    });
  });
});
