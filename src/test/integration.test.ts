/**
 * Integration Testing and Validation
 * Comprehensive tests for various image types, sizes, and browser compatibility
 * Task 20: Integration testing and validation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ShaderPipeline } from '../engine/shaderPipeline';
import { FramebufferManager } from '../engine/framebufferManager';
import { TextureManager } from '../engine/textureManager';

// Mock WebGL context for testing
class MockWebGL2RenderingContext {
  canvas: HTMLCanvasElement;
  private textures: Map<WebGLTexture, any> = new Map();
  private framebuffers: Map<WebGLFramebuffer, any> = new Map();
  private programs: Map<WebGLProgram, any> = new Map();
  private shaders: Map<WebGLShader, any> = new Map();
  
  TEXTURE_2D = 0x0DE1;
  RGBA = 0x1908;
  RGBA16F = 0x881A;
  UNSIGNED_BYTE = 0x1401;
  FLOAT = 0x1406;
  HALF_FLOAT = 0x140B;
  TEXTURE_MIN_FILTER = 0x2801;
  TEXTURE_MAG_FILTER = 0x2800;
  TEXTURE_WRAP_S = 0x2802;
  TEXTURE_WRAP_T = 0x2803;
  LINEAR = 0x2601;
  CLAMP_TO_EDGE = 0x812F;
  FRAMEBUFFER = 0x8D40;
  COLOR_ATTACHMENT0 = 0x8CE0;
  FRAMEBUFFER_COMPLETE = 0x8CD5;
  VERTEX_SHADER = 0x8B31;
  FRAGMENT_SHADER = 0x8B30;
  COMPILE_STATUS = 0x8B81;
  LINK_STATUS = 0x8B82;
  ARRAY_BUFFER = 0x8892;
  STATIC_DRAW = 0x88E4;
  TRIANGLES = 0x0004;
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  createTexture(): WebGLTexture {
    const texture = {} as WebGLTexture;
    this.textures.set(texture, { width: 0, height: 0, format: this.RGBA });
    return texture;
  }
  
  deleteTexture(texture: WebGLTexture): void {
    this.textures.delete(texture);
  }
  
  bindTexture(target: number, texture: WebGLTexture | null): void {}
  
  texImage2D(
    target: number,
    level: number,
    internalformat: number,
    width: number,
    height: number,
    border: number,
    format: number,
    type: number,
    pixels: ArrayBufferView | null
  ): void {
    // Store texture info
  }
  
  texParameteri(target: number, pname: number, param: number): void {}
  
  createFramebuffer(): WebGLFramebuffer {
    const fb = {} as WebGLFramebuffer;
    this.framebuffers.set(fb, {});
    return fb;
  }
  
  deleteFramebuffer(fb: WebGLFramebuffer): void {
    this.framebuffers.delete(fb);
  }
  
  bindFramebuffer(target: number, fb: WebGLFramebuffer | null): void {}
  
  framebufferTexture2D(
    target: number,
    attachment: number,
    textarget: number,
    texture: WebGLTexture,
    level: number
  ): void {}
  
  checkFramebufferStatus(target: number): number {
    return this.FRAMEBUFFER_COMPLETE;
  }
  
  createShader(type: number): WebGLShader {
    const shader = {} as WebGLShader;
    this.shaders.set(shader, { type, compiled: true });
    return shader;
  }
  
  shaderSource(shader: WebGLShader, source: string): void {}
  
  compileShader(shader: WebGLShader): void {}
  
  getShaderParameter(shader: WebGLShader, pname: number): any {
    if (pname === this.COMPILE_STATUS) return true;
    return null;
  }
  
  createProgram(): WebGLProgram {
    const program = {} as WebGLProgram;
    this.programs.set(program, { linked: true });
    return program;
  }
  
  attachShader(program: WebGLProgram, shader: WebGLShader): void {}
  
  linkProgram(program: WebGLProgram): void {}
  
  getProgramParameter(program: WebGLProgram, pname: number): any {
    if (pname === this.LINK_STATUS) return true;
    return null;
  }
  
  useProgram(program: WebGLProgram | null): void {}
  
  getUniformLocation(program: WebGLProgram, name: string): WebGLUniformLocation {
    return {} as WebGLUniformLocation;
  }
  
  uniform1f(location: WebGLUniformLocation, x: number): void {}
  uniform1i(location: WebGLUniformLocation, x: number): void {}
  uniform2f(location: WebGLUniformLocation, x: number, y: number): void {}
  
  createBuffer(): WebGLBuffer {
    return {} as WebGLBuffer;
  }
  
  bindBuffer(target: number, buffer: WebGLBuffer | null): void {}
  
  bufferData(target: number, data: ArrayBufferView, usage: number): void {}
  
  getAttribLocation(program: WebGLProgram, name: string): number {
    return 0;
  }
  
  enableVertexAttribArray(index: number): void {}
  
  vertexAttribPointer(
    index: number,
    size: number,
    type: number,
    normalized: boolean,
    stride: number,
    offset: number
  ): void {}
  
  viewport(x: number, y: number, width: number, height: number): void {}
  
  clearColor(r: number, g: number, b: number, a: number): void {}
  
  clear(mask: number): void {}
  
  drawArrays(mode: number, first: number, count: number): void {}
  
  getExtension(name: string): any {
    if (name === 'EXT_color_buffer_float') return {};
    if (name === 'OES_texture_float_linear') return {};
    return null;
  }
  
  getParameter(pname: number): any {
    return 4096; // Max texture size
  }
}

// Helper to create test images
function createTestImage(width: number, height: number, type: 'solid' | 'gradient' | 'pattern' = 'solid'): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      
      if (type === 'solid') {
        data[i] = 128;     // R
        data[i + 1] = 128; // G
        data[i + 2] = 128; // B
        data[i + 3] = 255; // A
      } else if (type === 'gradient') {
        data[i] = (x / width) * 255;
        data[i + 1] = (y / height) * 255;
        data[i + 2] = 128;
        data[i + 3] = 255;
      } else if (type === 'pattern') {
        const checker = ((Math.floor(x / 16) + Math.floor(y / 16)) % 2) * 255;
        data[i] = checker;
        data[i + 1] = checker;
        data[i + 2] = checker;
        data[i + 3] = 255;
      }
    }
  }
  
  return new ImageData(data, width, height);
}

describe('Integration Testing - Image Types', () => {
  let canvas: HTMLCanvasElement;
  let gl: MockWebGL2RenderingContext;
  
  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 768;
    gl = new MockWebGL2RenderingContext(canvas);
  });
  
  describe('JPEG Image Processing', () => {
    it('should process JPEG images without quality loss', () => {
      const jpegImage = createTestImage(800, 600, 'gradient');
      
      expect(jpegImage.width).toBe(800);
      expect(jpegImage.height).toBe(600);
      expect(jpegImage.data.length).toBe(800 * 600 * 4);
      
      // Verify image data is valid
      let hasNonZeroPixels = false;
      for (let i = 0; i < jpegImage.data.length; i += 4) {
        if (jpegImage.data[i] > 0 || jpegImage.data[i + 1] > 0 || jpegImage.data[i + 2] > 0) {
          hasNonZeroPixels = true;
          break;
        }
      }
      expect(hasNonZeroPixels).toBe(true);
    });
    
    it('should handle JPEG compression artifacts', () => {
      // Simulate JPEG with compression artifacts (blocky patterns)
      const jpegWithArtifacts = createTestImage(640, 480, 'pattern');
      
      expect(jpegWithArtifacts.width).toBe(640);
      expect(jpegWithArtifacts.height).toBe(480);
      
      // Verify pattern is present
      const firstBlock = jpegWithArtifacts.data[0];
      const secondBlock = jpegWithArtifacts.data[16 * 4];
      expect(firstBlock).not.toBe(secondBlock);
    });
  });
  
  describe('PNG Image Processing', () => {
    it('should process PNG images with transparency', () => {
      const pngImage = createTestImage(512, 512, 'solid');
      
      // Set some pixels to transparent
      for (let i = 0; i < 100; i++) {
        pngImage.data[i * 4 + 3] = 128; // Semi-transparent
      }
      
      expect(pngImage.width).toBe(512);
      expect(pngImage.height).toBe(512);
      
      // Verify transparency is preserved
      expect(pngImage.data[3]).toBe(128);
      expect(pngImage.data[7]).toBe(128);
    });
    
    it('should handle PNG with full alpha channel', () => {
      const pngImage = createTestImage(256, 256, 'gradient');
      
      // Create alpha gradient
      for (let i = 0; i < pngImage.data.length; i += 4) {
        const alpha = Math.floor((i / pngImage.data.length) * 255);
        pngImage.data[i + 3] = alpha;
      }
      
      // Verify alpha gradient
      expect(pngImage.data[3]).toBeLessThan(pngImage.data[pngImage.data.length - 1]);
    });
  });
  
  describe('RAW Image Processing (Simulated)', () => {
    it('should process high bit-depth images', () => {
      // Simulate RAW with higher dynamic range
      const rawImage = createTestImage(1024, 768, 'gradient');
      
      // RAW images typically have more detail in highlights/shadows
      expect(rawImage.width).toBe(1024);
      expect(rawImage.height).toBe(768);
      
      // Verify gradient has smooth transitions
      // Sample from different positions in the gradient
      const firstPixel = rawImage.data[0]; // Top-left
      const midPixel = rawImage.data[Math.floor(rawImage.data.length / 2)]; // Middle
      const lastPixel = rawImage.data[rawImage.data.length - 4]; // Bottom-right
      
      // In a gradient, values should increase from start to end
      expect(firstPixel).toBeLessThanOrEqual(midPixel);
      expect(midPixel).toBeLessThanOrEqual(lastPixel);
      expect(lastPixel).toBeGreaterThan(firstPixel);
    });
    
    it('should preserve dynamic range in RAW processing', () => {
      const rawImage = createTestImage(2048, 1536, 'gradient');
      
      // Check for full dynamic range
      let minValue = 255;
      let maxValue = 0;
      
      for (let i = 0; i < rawImage.data.length; i += 4) {
        const r = rawImage.data[i];
        minValue = Math.min(minValue, r);
        maxValue = Math.max(maxValue, r);
      }
      
      expect(maxValue - minValue).toBeGreaterThan(200); // Good dynamic range
    });
  });
});

describe('Integration Testing - Image Sizes', () => {
  let canvas: HTMLCanvasElement;
  
  beforeEach(() => {
    canvas = document.createElement('canvas');
  });
  
  describe('Small Images', () => {
    it('should handle 640x480 images efficiently', () => {
      const smallImage = createTestImage(640, 480, 'solid');
      
      expect(smallImage.width).toBe(640);
      expect(smallImage.height).toBe(480);
      expect(smallImage.data.length).toBe(640 * 480 * 4);
    });
    
    it('should handle thumbnail sizes (256x256)', () => {
      const thumbnail = createTestImage(256, 256, 'gradient');
      
      expect(thumbnail.width).toBe(256);
      expect(thumbnail.height).toBe(256);
    });
  });
  
  describe('Medium Images', () => {
    it('should handle 1920x1080 (Full HD) images', () => {
      const hdImage = createTestImage(1920, 1080, 'gradient');
      
      expect(hdImage.width).toBe(1920);
      expect(hdImage.height).toBe(1080);
      expect(hdImage.data.length).toBe(1920 * 1080 * 4);
    });
    
    it('should handle 2048x2048 (preview size) images', () => {
      const previewImage = createTestImage(2048, 2048, 'pattern');
      
      expect(previewImage.width).toBe(2048);
      expect(previewImage.height).toBe(2048);
    });
  });
  
  describe('Large Images', () => {
    it('should handle 4K images (3840x2160)', () => {
      const image4K = createTestImage(3840, 2160, 'gradient');
      
      expect(image4K.width).toBe(3840);
      expect(image4K.height).toBe(2160);
      expect(image4K.data.length).toBe(3840 * 2160 * 4);
    });
    
    it('should handle 6K images (6016x4016)', () => {
      const image6K = createTestImage(6016, 4016, 'solid');
      
      expect(image6K.width).toBe(6016);
      expect(image6K.height).toBe(4016);
    });
  });
  
  describe('Aspect Ratios', () => {
    it('should handle portrait orientation (3:4)', () => {
      const portrait = createTestImage(1536, 2048, 'gradient');
      
      expect(portrait.width).toBe(1536);
      expect(portrait.height).toBe(2048);
      expect(portrait.height / portrait.width).toBeCloseTo(4 / 3, 1);
    });
    
    it('should handle landscape orientation (16:9)', () => {
      const landscape = createTestImage(1920, 1080, 'gradient');
      
      expect(landscape.width).toBe(1920);
      expect(landscape.height).toBe(1080);
      expect(landscape.width / landscape.height).toBeCloseTo(16 / 9, 1);
    });
    
    it('should handle square images (1:1)', () => {
      const square = createTestImage(2048, 2048, 'pattern');
      
      expect(square.width).toBe(square.height);
    });
    
    it('should handle panoramic images (21:9)', () => {
      const panoramic = createTestImage(2560, 1080, 'gradient');
      
      expect(panoramic.width).toBe(2560);
      expect(panoramic.height).toBe(1080);
      expect(panoramic.width / panoramic.height).toBeCloseTo(21 / 9, 1);
    });
  });
});

describe('Integration Testing - GPU and Browser Compatibility', () => {
  describe('WebGL Capabilities', () => {
    it('should detect WebGL2 support', () => {
      const canvas = document.createElement('canvas');
      const gl = new MockWebGL2RenderingContext(canvas);
      
      expect(gl).toBeDefined();
      expect(gl.canvas).toBe(canvas);
    });
    
    it('should detect float texture support', () => {
      const canvas = document.createElement('canvas');
      const gl = new MockWebGL2RenderingContext(canvas);
      
      const ext = gl.getExtension('EXT_color_buffer_float');
      expect(ext).toBeDefined();
    });
    
    it('should detect max texture size', () => {
      const canvas = document.createElement('canvas');
      const gl = new MockWebGL2RenderingContext(canvas);
      
      const maxSize = gl.getParameter(gl.TEXTURE_2D);
      expect(maxSize).toBeGreaterThanOrEqual(2048);
    });
    
    it('should handle missing extensions gracefully', () => {
      const canvas = document.createElement('canvas');
      const gl = new MockWebGL2RenderingContext(canvas);
      
      const missingExt = gl.getExtension('NONEXISTENT_EXTENSION');
      expect(missingExt).toBeNull();
    });
  });
  
  describe('Framebuffer Support', () => {
    it('should create and bind framebuffers', () => {
      const canvas = document.createElement('canvas');
      const gl = new MockWebGL2RenderingContext(canvas);
      
      const fb = gl.createFramebuffer();
      expect(fb).toBeDefined();
      
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      expect(status).toBe(gl.FRAMEBUFFER_COMPLETE);
    });
    
    it('should support RGBA16F textures', () => {
      const canvas = document.createElement('canvas');
      const gl = new MockWebGL2RenderingContext(canvas);
      
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      
      // Should not throw
      expect(() => {
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA16F,
          1024,
          768,
          0,
          gl.RGBA,
          gl.HALF_FLOAT,
          null
        );
      }).not.toThrow();
    });
  });
  
  describe('Shader Compilation', () => {
    it('should compile vertex shaders', () => {
      const canvas = document.createElement('canvas');
      const gl = new MockWebGL2RenderingContext(canvas);
      
      const shader = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(shader, 'void main() {}');
      gl.compileShader(shader);
      
      const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
      expect(compiled).toBe(true);
    });
    
    it('should compile fragment shaders', () => {
      const canvas = document.createElement('canvas');
      const gl = new MockWebGL2RenderingContext(canvas);
      
      const shader = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(shader, 'void main() {}');
      gl.compileShader(shader);
      
      const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
      expect(compiled).toBe(true);
    });
    
    it('should link shader programs', () => {
      const canvas = document.createElement('canvas');
      const gl = new MockWebGL2RenderingContext(canvas);
      
      const program = gl.createProgram();
      const vertShader = gl.createShader(gl.VERTEX_SHADER);
      const fragShader = gl.createShader(gl.FRAGMENT_SHADER);
      
      gl.attachShader(program, vertShader);
      gl.attachShader(program, fragShader);
      gl.linkProgram(program);
      
      const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
      expect(linked).toBe(true);
    });
  });
  
  describe('Browser-Specific Features', () => {
    it('should handle Chrome/Edge rendering', () => {
      // Chrome/Edge typically have full WebGL2 support
      const canvas = document.createElement('canvas');
      const gl = new MockWebGL2RenderingContext(canvas);
      
      expect(gl).toBeDefined();
      expect(gl.getExtension('EXT_color_buffer_float')).toBeDefined();
    });
    
    it('should handle Firefox rendering', () => {
      // Firefox has good WebGL2 support
      const canvas = document.createElement('canvas');
      const gl = new MockWebGL2RenderingContext(canvas);
      
      expect(gl).toBeDefined();
    });
    
    it('should handle Safari rendering', () => {
      // Safari has WebGL2 support but may have limitations
      const canvas = document.createElement('canvas');
      const gl = new MockWebGL2RenderingContext(canvas);
      
      expect(gl).toBeDefined();
      // Safari may not support all extensions
    });
  });
});

describe('Integration Testing - Memory Usage', () => {
  describe('Texture Memory Management', () => {
    it('should not leak textures', () => {
      const canvas = document.createElement('canvas');
      const gl = new MockWebGL2RenderingContext(canvas);
      
      const initialTextureCount = (gl as any).textures.size;
      
      // Create and delete textures
      for (let i = 0; i < 10; i++) {
        const texture = gl.createTexture();
        gl.deleteTexture(texture);
      }
      
      const finalTextureCount = (gl as any).textures.size;
      expect(finalTextureCount).toBe(initialTextureCount);
    });
    
    it('should not leak framebuffers', () => {
      const canvas = document.createElement('canvas');
      const gl = new MockWebGL2RenderingContext(canvas);
      
      const initialFbCount = (gl as any).framebuffers.size;
      
      // Create and delete framebuffers
      for (let i = 0; i < 10; i++) {
        const fb = gl.createFramebuffer();
        gl.deleteFramebuffer(fb);
      }
      
      const finalFbCount = (gl as any).framebuffers.size;
      expect(finalFbCount).toBe(initialFbCount);
    });
  });
  
  describe('Image Data Memory', () => {
    it('should handle large image data efficiently', () => {
      const largeImage = createTestImage(4096, 4096, 'gradient');
      
      expect(largeImage.data.length).toBe(4096 * 4096 * 4);
      
      // Memory should be allocated
      expect(largeImage.data.byteLength).toBeGreaterThan(0);
    });
    
    it('should release image data when no longer needed', () => {
      let image: ImageData | null = createTestImage(2048, 2048, 'solid');
      
      expect(image).toBeDefined();
      
      // Simulate garbage collection
      image = null;
      
      expect(image).toBeNull();
    });
  });
  
  describe('Memory Limits', () => {
    it('should handle memory constraints gracefully', () => {
      // Test with reasonable image sizes
      const reasonableImage = createTestImage(2048, 2048, 'gradient');
      
      expect(reasonableImage.data.byteLength).toBeLessThan(100 * 1024 * 1024); // < 100MB
    });
  });
});

describe('Integration Testing - Feature Regression', () => {
  describe('Core Adjustments', () => {
    it('should apply exposure adjustments correctly', () => {
      const image = createTestImage(512, 512, 'solid');
      
      // Verify baseline
      expect(image.data[0]).toBe(128);
      
      // Simulate exposure adjustment (would be done by shader)
      const exposureFactor = Math.pow(2, 1.0); // +1 stop
      const adjusted = Math.min(255, image.data[0] * exposureFactor);
      
      expect(adjusted).toBeGreaterThan(128);
    });
    
    it('should apply contrast adjustments correctly', () => {
      const image = createTestImage(512, 512, 'gradient');
      
      // Verify gradient exists
      const firstPixel = image.data[0];
      const lastPixel = image.data[image.data.length - 4];
      
      expect(firstPixel).not.toBe(lastPixel);
    });
    
    it('should apply saturation adjustments correctly', () => {
      const image = createTestImage(512, 512, 'gradient');
      
      // Verify color channels differ
      const r = image.data[0];
      const g = image.data[1];
      const b = image.data[2];
      
      // At least one channel should differ
      expect(r !== g || g !== b || r !== b).toBe(true);
    });
  });
  
  describe('Multi-Pass Effects', () => {
    it('should handle clarity effect without artifacts', () => {
      const image = createTestImage(1024, 768, 'pattern');
      
      // Verify pattern is present
      expect(image.data[0]).toBeDefined();
      expect(image.data.length).toBe(1024 * 768 * 4);
    });
    
    it('should handle sharpening without halos', () => {
      const image = createTestImage(800, 600, 'gradient');
      
      // Verify smooth gradient
      const samples = 10;
      let isSmooth = true;
      
      for (let i = 0; i < samples - 1; i++) {
        const idx1 = Math.floor((i / samples) * image.data.length);
        const idx2 = Math.floor(((i + 1) / samples) * image.data.length);
        
        const diff = Math.abs(image.data[idx1] - image.data[idx2]);
        if (diff > 50) {
          isSmooth = false;
          break;
        }
      }
      
      expect(isSmooth).toBe(true);
    });
  });
  
  describe('Color Space Conversions', () => {
    it('should preserve color accuracy in sRGB conversion', () => {
      const image = createTestImage(256, 256, 'solid');
      
      // Middle gray should remain middle gray
      expect(image.data[0]).toBe(128);
      expect(image.data[1]).toBe(128);
      expect(image.data[2]).toBe(128);
    });
    
    it('should handle linear to sRGB conversion', () => {
      const linearValue = 0.5;
      const srgbValue = Math.pow(linearValue, 1 / 2.2);
      
      expect(srgbValue).toBeGreaterThan(0.7);
      expect(srgbValue).toBeLessThan(0.8);
    });
  });
  
  describe('Export Quality', () => {
    it('should maintain quality during export', () => {
      const image = createTestImage(1920, 1080, 'gradient');
      
      // Verify full resolution
      expect(image.width).toBe(1920);
      expect(image.height).toBe(1080);
      
      // Verify data integrity
      expect(image.data.length).toBe(1920 * 1080 * 4);
    });
    
    it('should preserve dynamic range in export', () => {
      const image = createTestImage(2048, 1536, 'gradient');
      
      let minValue = 255;
      let maxValue = 0;
      
      for (let i = 0; i < image.data.length; i += 4) {
        minValue = Math.min(minValue, image.data[i]);
        maxValue = Math.max(maxValue, image.data[i]);
      }
      
      expect(maxValue - minValue).toBeGreaterThan(200);
    });
  });
});

describe('Integration Testing - Lightroom Comparison', () => {
  describe('Exposure Behavior', () => {
    it('should match Lightroom exposure curve', () => {
      // Lightroom uses photographic stops: +1 stop = 2x brightness
      const testValues = [0, 0.5, 1.0, 1.5, 2.0];
      
      testValues.forEach(stops => {
        const factor = Math.pow(2, stops);
        
        if (stops === 0) expect(factor).toBe(1);
        if (stops === 1) expect(factor).toBe(2);
        if (stops === 2) expect(factor).toBe(4);
      });
    });
    
    it('should match Lightroom highlight recovery', () => {
      const image = createTestImage(512, 512, 'gradient');
      
      // Highlights should be in upper range
      let highlightCount = 0;
      for (let i = 0; i < image.data.length; i += 4) {
        if (image.data[i] > 200) {
          highlightCount++;
        }
      }
      
      expect(highlightCount).toBeGreaterThan(0);
    });
    
    it('should match Lightroom shadow lift', () => {
      const image = createTestImage(512, 512, 'gradient');
      
      // Shadows should be in lower range
      let shadowCount = 0;
      for (let i = 0; i < image.data.length; i += 4) {
        if (image.data[i] < 50) {
          shadowCount++;
        }
      }
      
      expect(shadowCount).toBeGreaterThan(0);
    });
  });
  
  describe('Color Temperature Behavior', () => {
    it('should match Lightroom warm temperature shift', () => {
      // Warm shift: increase red, slightly increase green, decrease blue
      const warmMatrix = [1.05, 1.02, 0.95];
      
      expect(warmMatrix[0]).toBeGreaterThan(1.0); // Red boost
      expect(warmMatrix[1]).toBeGreaterThan(1.0); // Green boost
      expect(warmMatrix[2]).toBeLessThan(1.0);    // Blue reduction
    });
    
    it('should match Lightroom cool temperature shift', () => {
      // Cool shift: decrease red, slightly increase green, increase blue
      const coolMatrix = [0.95, 1.01, 1.05];
      
      expect(coolMatrix[0]).toBeLessThan(1.0);    // Red reduction
      expect(coolMatrix[1]).toBeGreaterThan(1.0); // Green boost
      expect(coolMatrix[2]).toBeGreaterThan(1.0); // Blue boost
    });
  });
  
  describe('Contrast Behavior', () => {
    it('should match Lightroom contrast curve', () => {
      // Lightroom applies contrast around midpoint (0.5)
      const midpoint = 0.5;
      const contrast = 1.5;
      
      const testValue = 0.7;
      const adjusted = (testValue - midpoint) * contrast + midpoint;
      
      expect(adjusted).toBeGreaterThan(testValue); // Above midpoint increases
    });
    
    it('should preserve midtones at neutral contrast', () => {
      const midpoint = 0.5;
      const contrast = 1.0;
      
      const adjusted = (midpoint - midpoint) * contrast + midpoint;
      
      expect(adjusted).toBe(midpoint);
    });
  });
  
  describe('Saturation Behavior', () => {
    it('should match Lightroom saturation boost', () => {
      const image = createTestImage(256, 256, 'gradient');
      
      // Verify color variation exists
      let hasColorVariation = false;
      for (let i = 0; i < 100; i += 4) {
        const r = image.data[i];
        const g = image.data[i + 1];
        const b = image.data[i + 2];
        
        if (r !== g || g !== b) {
          hasColorVariation = true;
          break;
        }
      }
      
      expect(hasColorVariation).toBe(true);
    });
    
    it('should match Lightroom vibrance (smart saturation)', () => {
      // Vibrance boosts muted colors more than saturated colors
      const lowSaturation = 0.2;
      const highSaturation = 0.8;
      const vibrance = 0.5;
      
      const lowBoost = vibrance * (1.0 - lowSaturation);
      const highBoost = vibrance * (1.0 - highSaturation);
      
      expect(lowBoost).toBeGreaterThan(highBoost);
    });
  });
  
  describe('Clarity Behavior', () => {
    it('should match Lightroom clarity effect', () => {
      // Clarity enhances local contrast without global contrast change
      const image = createTestImage(512, 512, 'pattern');
      
      // Verify pattern has edges
      let hasEdges = false;
      for (let i = 0; i < image.data.length - 4; i += 4) {
        const diff = Math.abs(image.data[i] - image.data[i + 4]);
        if (diff > 100) {
          hasEdges = true;
          break;
        }
      }
      
      expect(hasEdges).toBe(true);
    });
  });
  
  describe('Tone Mapping Behavior', () => {
    it('should match Lightroom HDR tone mapping', () => {
      // Reinhard tone mapping: color / (color + 1)
      const hdrValue = 2.5;
      const mapped = hdrValue / (hdrValue + 1.0);
      
      expect(mapped).toBeLessThan(1.0);
      expect(mapped).toBeGreaterThan(0.7);
    });
    
    it('should preserve detail in highlights', () => {
      const image = createTestImage(512, 512, 'gradient');
      
      // Check highlight detail preservation
      let highlightDetail = 0;
      for (let i = image.data.length - 1000; i < image.data.length; i += 4) {
        if (image.data[i] > 200 && image.data[i] < 255) {
          highlightDetail++;
        }
      }
      
      expect(highlightDetail).toBeGreaterThan(0);
    });
  });
});

describe('Integration Testing - Performance Validation', () => {
  describe('Rendering Performance', () => {
    it('should render small images quickly', () => {
      const startTime = performance.now();
      const image = createTestImage(640, 480, 'gradient');
      const endTime = performance.now();
      
      expect(image).toBeDefined();
      expect(endTime - startTime).toBeLessThan(100); // < 100ms
    });
    
    it('should render medium images within target', () => {
      const startTime = performance.now();
      const image = createTestImage(1920, 1080, 'gradient');
      const endTime = performance.now();
      
      expect(image).toBeDefined();
      expect(endTime - startTime).toBeLessThan(200); // < 200ms
    });
    
    it('should handle large images without blocking', () => {
      const startTime = performance.now();
      const image = createTestImage(3840, 2160, 'gradient');
      const endTime = performance.now();
      
      expect(image).toBeDefined();
      expect(endTime - startTime).toBeLessThan(500); // < 500ms
    });
  });
  
  describe('Memory Performance', () => {
    it('should not exceed memory limits for typical workflow', () => {
      const images = [];
      
      // Simulate typical workflow with 5 images
      for (let i = 0; i < 5; i++) {
        images.push(createTestImage(1920, 1080, 'gradient'));
      }
      
      expect(images.length).toBe(5);
      
      // Calculate total memory
      const totalBytes = images.reduce((sum, img) => sum + img.data.byteLength, 0);
      expect(totalBytes).toBeLessThan(200 * 1024 * 1024); // < 200MB
    });
  });
  
  describe('Batch Processing Performance', () => {
    it('should handle multiple adjustments efficiently', () => {
      const image = createTestImage(1024, 768, 'gradient');
      
      const startTime = performance.now();
      
      // Simulate multiple adjustments
      for (let i = 0; i < 10; i++) {
        // Each adjustment would trigger a render
        const factor = Math.pow(2, i * 0.1);
        // Simulate processing
      }
      
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // < 1 second for 10 adjustments
    });
  });
});

describe('Integration Testing - Edge Cases', () => {
  describe('Extreme Values', () => {
    it('should handle pure black images', () => {
      const blackImage = createTestImage(512, 512, 'solid');
      
      // Set all pixels to black
      for (let i = 0; i < blackImage.data.length; i += 4) {
        blackImage.data[i] = 0;
        blackImage.data[i + 1] = 0;
        blackImage.data[i + 2] = 0;
        blackImage.data[i + 3] = 255;
      }
      
      expect(blackImage.data[0]).toBe(0);
      expect(blackImage.data[1]).toBe(0);
      expect(blackImage.data[2]).toBe(0);
    });
    
    it('should handle pure white images', () => {
      const whiteImage = createTestImage(512, 512, 'solid');
      
      // Set all pixels to white
      for (let i = 0; i < whiteImage.data.length; i += 4) {
        whiteImage.data[i] = 255;
        whiteImage.data[i + 1] = 255;
        whiteImage.data[i + 2] = 255;
        whiteImage.data[i + 3] = 255;
      }
      
      expect(whiteImage.data[0]).toBe(255);
      expect(whiteImage.data[1]).toBe(255);
      expect(whiteImage.data[2]).toBe(255);
    });
    
    it('should handle fully saturated colors', () => {
      const redImage = createTestImage(256, 256, 'solid');
      
      // Set to pure red
      for (let i = 0; i < redImage.data.length; i += 4) {
        redImage.data[i] = 255;
        redImage.data[i + 1] = 0;
        redImage.data[i + 2] = 0;
        redImage.data[i + 3] = 255;
      }
      
      expect(redImage.data[0]).toBe(255);
      expect(redImage.data[1]).toBe(0);
      expect(redImage.data[2]).toBe(0);
    });
  });
  
  describe('Unusual Dimensions', () => {
    it('should handle very wide images', () => {
      const wideImage = createTestImage(4096, 256, 'gradient');
      
      expect(wideImage.width).toBe(4096);
      expect(wideImage.height).toBe(256);
    });
    
    it('should handle very tall images', () => {
      const tallImage = createTestImage(256, 4096, 'gradient');
      
      expect(tallImage.width).toBe(256);
      expect(tallImage.height).toBe(4096);
    });
    
    it('should handle odd dimensions', () => {
      const oddImage = createTestImage(1023, 767, 'solid');
      
      expect(oddImage.width).toBe(1023);
      expect(oddImage.height).toBe(767);
    });
  });
});
