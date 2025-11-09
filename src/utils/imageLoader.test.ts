/**
 * Image Loader Tests
 * Integration tests for unified image loading
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadImage } from './imageLoader';
import { ErrorCode } from '../types/errors';
import * as imageDecoder from './imageDecoder';

// Mock EXIF library
vi.mock('exif-js', () => ({
  default: {
    getData: (img: any, callback: Function) => {
      callback.call(img);
    },
    getAllTags: () => ({
      ColorSpace: 1,
    }),
  },
}));

describe('imageLoader', () => {
  beforeEach(() => {
    // Mock Image constructor
    global.Image = class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = '';
      naturalWidth = 200;
      naturalHeight = 150;

      constructor() {
        setTimeout(() => {
          if (this.onload) {
            this.onload();
          }
        }, 0);
      }
    } as any;

    // Mock URL methods
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    // Mock canvas
    const mockContext = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(200 * 150 * 4),
        width: 200,
        height: 150,
        colorSpace: 'srgb',
      })),
    };

    HTMLCanvasElement.prototype.getContext = vi.fn(() => mockContext) as any;
  });

  it('loads JPEG files using standard decoder', async () => {
    const file = new File(['fake-jpeg'], 'photo.jpg', { type: 'image/jpeg' });

    const result = await loadImage(file);

    expect(result.image).toBeDefined();
    expect(result.image.width).toBe(200);
    expect(result.image.height).toBe(150);
    expect(result.metadata.format).toBe('image/jpeg');
  });

  it('loads PNG files using standard decoder', async () => {
    const file = new File(['fake-png'], 'photo.png', { type: 'image/png' });

    const result = await loadImage(file);

    expect(result.image).toBeDefined();
    expect(result.metadata.format).toBe('image/png');
  });

  it('loads TIFF files using standard decoder', async () => {
    const file = new File(['fake-tiff'], 'photo.tiff', { type: 'image/tiff' });

    const result = await loadImage(file);

    expect(result.image).toBeDefined();
    expect(result.metadata.format).toBe('image/tiff');
  });

  it('throws error for RAW files (Worker not available in test environment)', async () => {
    const file = new File(['fake-raw'], 'photo.cr2', { type: 'image/x-canon-cr2' });

    // In test environment, Worker is not defined, so we expect an error
    await expect(loadImage(file)).rejects.toThrow();
  });

  it('throws error for unsupported file formats', async () => {
    const file = new File(['text'], 'document.txt', { type: 'text/plain' });

    await expect(loadImage(file)).rejects.toThrow();
  });

  it('handles corrupted standard image files', async () => {
    // Override Image mock to simulate error
    global.Image = class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = '';

      constructor() {
        setTimeout(() => {
          if (this.onerror) {
            this.onerror();
          }
        }, 0);
      }
    } as any;

    const file = new File(['corrupted'], 'corrupted.jpg', { type: 'image/jpeg' });

    await expect(loadImage(file)).rejects.toThrow();
  });

  it('preserves image dimensions', async () => {
    const file = new File(['fake-image'], 'large.jpg', { type: 'image/jpeg' });

    const result = await loadImage(file);

    expect(result.image.width).toBe(200);
    expect(result.image.height).toBe(150);
    expect(result.metadata.width).toBe(200);
    expect(result.metadata.height).toBe(150);
  });
});
