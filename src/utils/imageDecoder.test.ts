/**
 * Image Decoder Tests
 * Tests for image decoding functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { decodeImage, isStandardFormat, isRawFormat } from './imageDecoder';
import { ErrorCode } from '../types/errors';

// Mock EXIF library
vi.mock('exif-js', () => ({
  default: {
    getData: (img: any, callback: Function) => {
      callback.call(img);
    },
    getAllTags: () => ({
      ColorSpace: 1,
      Make: 'Test Camera',
      Model: 'Test Model',
    }),
  },
}));

describe('imageDecoder', () => {
  describe('isStandardFormat', () => {
    it('returns true for JPEG files', () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
      expect(isStandardFormat(file)).toBe(true);
    });

    it('returns true for PNG files', () => {
      const file = new File([''], 'test.png', { type: 'image/png' });
      expect(isStandardFormat(file)).toBe(true);
    });

    it('returns true for TIFF files', () => {
      const file = new File([''], 'test.tiff', { type: 'image/tiff' });
      expect(isStandardFormat(file)).toBe(true);
    });

    it('returns true for files with standard extensions even without MIME type', () => {
      const file = new File([''], 'test.jpeg', { type: '' });
      expect(isStandardFormat(file)).toBe(true);
    });

    it('returns false for RAW files', () => {
      const file = new File([''], 'test.cr2', { type: 'image/x-canon-cr2' });
      expect(isStandardFormat(file)).toBe(false);
    });

    it('returns false for unsupported files', () => {
      const file = new File([''], 'test.txt', { type: 'text/plain' });
      expect(isStandardFormat(file)).toBe(false);
    });
  });

  describe('isRawFormat', () => {
    it('returns true for CR2 files', () => {
      const file = new File([''], 'test.cr2', { type: 'image/x-canon-cr2' });
      expect(isRawFormat(file)).toBe(true);
    });

    it('returns true for NEF files', () => {
      const file = new File([''], 'test.nef', { type: 'image/x-nikon-nef' });
      expect(isRawFormat(file)).toBe(true);
    });

    it('returns true for ARW files', () => {
      const file = new File([''], 'test.arw', { type: 'image/x-sony-arw' });
      expect(isRawFormat(file)).toBe(true);
    });

    it('returns true for DNG files', () => {
      const file = new File([''], 'test.dng', { type: 'image/x-adobe-dng' });
      expect(isRawFormat(file)).toBe(true);
    });

    it('returns true for RAW files by extension even without MIME type', () => {
      const file = new File([''], 'test.nef', { type: '' });
      expect(isRawFormat(file)).toBe(true);
    });

    it('returns false for standard image files', () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
      expect(isRawFormat(file)).toBe(false);
    });
  });

  describe('decodeImage', () => {
    beforeEach(() => {
      // Mock Image constructor
      global.Image = class MockImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        src = '';
        naturalWidth = 100;
        naturalHeight = 100;

        constructor() {
          setTimeout(() => {
            if (this.onload) {
              this.onload();
            }
          }, 0);
        }
      } as any;

      // Mock URL.createObjectURL and revokeObjectURL
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();

      // Mock canvas and context
      const mockContext = {
        drawImage: vi.fn(),
        getImageData: vi.fn(() => ({
          data: new Uint8ClampedArray(100 * 100 * 4),
          width: 100,
          height: 100,
          colorSpace: 'srgb',
        })),
      };

      HTMLCanvasElement.prototype.getContext = vi.fn(() => mockContext) as any;
    });

    it('decodes a valid JPEG file', async () => {
      const file = new File(['fake-image-data'], 'test.jpg', { type: 'image/jpeg' });

      const result = await decodeImage(file);

      expect(result.image).toBeDefined();
      expect(result.image.width).toBe(100);
      expect(result.image.height).toBe(100);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.format).toBe('image/jpeg');
    });

    it('throws error for corrupted files', async () => {
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

      await expect(decodeImage(file)).rejects.toThrow();
    });

    it('handles files without canvas context', async () => {
      HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as any;

      const file = new File(['fake-image-data'], 'test.jpg', { type: 'image/jpeg' });

      await expect(decodeImage(file)).rejects.toThrow();
    });
  });
});
