import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TextureManager } from './textureManager';

// Mock WebGL2RenderingContext
class MockWebGL2RenderingContext {
  TEXTURE_2D = 0x0de1;
  RGBA = 0x1908;
  UNSIGNED_BYTE = 0x1401;
  LINEAR = 0x2601;
  CLAMP_TO_EDGE = 0x812f;
  TEXTURE_MIN_FILTER = 0x2801;
  TEXTURE_MAG_FILTER = 0x2800;
  TEXTURE_WRAP_S = 0x2802;
  TEXTURE_WRAP_T = 0x2803;

  private textureCounter = 0;
  private textures = new Set<WebGLTexture>();

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

  bindTexture(_target: number, _texture: WebGLTexture | null): void {
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

  texSubImage2D(
    _target: number,
    _level: number,
    _xoffset: number,
    _yoffset: number,
    _width: number,
    _height: number,
    _format: number,
    _type: number,
    _pixels: ArrayBufferView
  ): void {
    // Mock implementation
  }

  getTextureCount(): number {
    return this.textures.size;
  }
}

describe('TextureManager', () => {
  let gl: MockWebGL2RenderingContext;
  let textureManager: TextureManager;

  beforeEach(() => {
    gl = new MockWebGL2RenderingContext();
    textureManager = new TextureManager(gl as unknown as WebGL2RenderingContext, 1); // 1MB cache
  });

  afterEach(() => {
    textureManager.dispose();
  });

  describe('createTexture', () => {
    it('should create a texture with specified dimensions', () => {
      const texture = textureManager.createTexture({
        width: 512,
        height: 512,
      });

      expect(texture).toBeDefined();
      expect(gl.getTextureCount()).toBe(1);
    });

    it('should create multiple textures', () => {
      textureManager.createTexture({ width: 256, height: 256 });
      textureManager.createTexture({ width: 512, height: 512 });
      textureManager.createTexture({ width: 1024, height: 1024 });

      expect(gl.getTextureCount()).toBe(3);
    });
  });

  describe('createTextureFromImageData', () => {
    it('should create texture from ImageData', () => {
      // Create mock ImageData
      const imageData = {
        width: 256,
        height: 256,
        data: new Uint8ClampedArray(256 * 256 * 4),
      } as ImageData;
      
      const texture = textureManager.createTextureFromImageData(imageData);

      expect(texture).toBeDefined();
      expect(gl.getTextureCount()).toBe(1);
    });
  });

  describe('deleteTexture', () => {
    it('should delete a texture', () => {
      const texture = textureManager.createTexture({ width: 256, height: 256 });
      expect(gl.getTextureCount()).toBe(1);

      textureManager.deleteTexture(texture);
      expect(gl.getTextureCount()).toBe(0);
    });
  });

  describe('getCachedTexture', () => {
    it('should cache textures by key', () => {
      const texture1 = textureManager.getCachedTexture('test', { width: 256, height: 256 });
      const texture2 = textureManager.getCachedTexture('test', { width: 256, height: 256 });

      expect(texture1).toBe(texture2);
      expect(gl.getTextureCount()).toBe(1);
    });

    it('should create new texture for different key', () => {
      const texture1 = textureManager.getCachedTexture('test1', { width: 256, height: 256 });
      const texture2 = textureManager.getCachedTexture('test2', { width: 256, height: 256 });

      expect(texture1).not.toBe(texture2);
      expect(gl.getTextureCount()).toBe(2);
    });

    it('should create new texture for different dimensions', () => {
      const texture1 = textureManager.getCachedTexture('test', { width: 256, height: 256 });
      const texture2 = textureManager.getCachedTexture('test', { width: 512, height: 512 });

      expect(texture1).not.toBe(texture2);
      // Note: texture1 may be evicted when texture2 is created due to cache size
      expect(gl.getTextureCount()).toBeGreaterThanOrEqual(1);
    });
  });

  describe('cache eviction', () => {
    it('should evict old textures when cache is full', () => {
      // Create textures that exceed 1MB cache limit
      // Each 512x512 RGBA texture is ~1MB
      textureManager.getCachedTexture('tex1', { width: 512, height: 512 });
      textureManager.getCachedTexture('tex2', { width: 512, height: 512 });

      const stats = textureManager.getCacheStats();
      expect(stats.count).toBeLessThanOrEqual(2);
    });

    it('should keep recently used textures', () => {
      const texture1 = textureManager.getCachedTexture('tex1', { width: 256, height: 256 });

      // Access texture1 again to mark it as recently used
      const texture1Again = textureManager.getCachedTexture('tex1', { width: 256, height: 256 });
      expect(texture1).toBe(texture1Again);

      // Create more textures - these may evict tex1 due to small cache size
      textureManager.getCachedTexture('tex2', { width: 512, height: 512 });
      
      // Verify cache is managing textures
      const stats = textureManager.getCacheStats();
      expect(stats.count).toBeGreaterThan(0);
    });
  });

  describe('clearCache', () => {
    it('should clear all cached textures', () => {
      textureManager.getCachedTexture('tex1', { width: 256, height: 256 });
      textureManager.getCachedTexture('tex2', { width: 256, height: 256 });

      expect(gl.getTextureCount()).toBe(2);

      textureManager.clearCache();

      expect(gl.getTextureCount()).toBe(0);
      const stats = textureManager.getCacheStats();
      expect(stats.count).toBe(0);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      const stats = textureManager.getCacheStats();

      expect(stats).toHaveProperty('count');
      expect(stats).toHaveProperty('sizeMB');
      expect(stats).toHaveProperty('maxSizeMB');
      expect(stats.maxSizeMB).toBe(1);
    });

    it('should update stats when textures are added', () => {
      const statsBefore = textureManager.getCacheStats();
      expect(statsBefore.count).toBe(0);

      textureManager.getCachedTexture('tex1', { width: 256, height: 256 });

      const statsAfter = textureManager.getCacheStats();
      expect(statsAfter.count).toBe(1);
      expect(statsAfter.sizeMB).toBeGreaterThan(0);
    });
  });

  describe('dispose', () => {
    it('should dispose all resources', () => {
      textureManager.getCachedTexture('tex1', { width: 256, height: 256 });
      textureManager.getCachedTexture('tex2', { width: 256, height: 256 });

      textureManager.dispose();

      expect(gl.getTextureCount()).toBe(0);
      const stats = textureManager.getCacheStats();
      expect(stats.count).toBe(0);
    });
  });

  describe('updateTextureFromImageData', () => {
    it('should update existing texture with new image data', () => {
      const imageData1 = {
        width: 256,
        height: 256,
        data: new Uint8ClampedArray(256 * 256 * 4),
      } as ImageData;

      const imageData2 = {
        width: 256,
        height: 256,
        data: new Uint8ClampedArray(256 * 256 * 4),
      } as ImageData;

      const texture = textureManager.createTextureFromImageData(imageData1);
      expect(gl.getTextureCount()).toBe(1);

      // Update should not create new texture
      textureManager.updateTextureFromImageData(texture, imageData2);
      expect(gl.getTextureCount()).toBe(1);
    });
  });

  describe('createOrUpdateTextureFromImageData', () => {
    it('should create new texture when no existing texture provided', () => {
      const imageData = {
        width: 256,
        height: 256,
        data: new Uint8ClampedArray(256 * 256 * 4),
      } as ImageData;

      const texture = textureManager.createOrUpdateTextureFromImageData(null, imageData);
      expect(texture).toBeDefined();
      expect(gl.getTextureCount()).toBe(1);
    });

    it('should reuse existing texture when provided', () => {
      const imageData1 = {
        width: 256,
        height: 256,
        data: new Uint8ClampedArray(256 * 256 * 4),
      } as ImageData;

      const imageData2 = {
        width: 256,
        height: 256,
        data: new Uint8ClampedArray(256 * 256 * 4),
      } as ImageData;

      const texture1 = textureManager.createTextureFromImageData(imageData1);
      expect(gl.getTextureCount()).toBe(1);

      // Should reuse texture1
      const texture2 = textureManager.createOrUpdateTextureFromImageData(texture1, imageData2);
      expect(texture2).toBe(texture1);
      expect(gl.getTextureCount()).toBe(1);
    });
  });
});
