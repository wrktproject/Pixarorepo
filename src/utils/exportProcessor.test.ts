/**
 * Export Processor Tests
 * Tests for export processing functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExportProcessor, downloadBlob, generateFilename } from './exportProcessor';
import type { ExportSettings } from '../types/components';
import type { ProcessedImage, ImageMetadata } from '../types/store';
import { createInitialAdjustmentState } from '../store/initialState';

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// Create test image data
function createTestImageData(width = 100, height = 100): ImageData {
  // Create ImageData manually since jsdom doesn't support canvas
  const data = new Uint8ClampedArray(width * height * 4);
  return {
    data,
    width,
    height,
    colorSpace: 'srgb',
  } as ImageData;
}

describe('ExportProcessor', () => {
  let processor: ExportProcessor;
  let originalImage: ProcessedImage;
  let adjustments: ReturnType<typeof createInitialAdjustmentState>;

  beforeEach(() => {
    processor = new ExportProcessor();
    const imageData = createTestImageData(800, 600);
    originalImage = {
      data: imageData,
      width: 800,
      height: 600,
      colorSpace: 'srgb',
    };
    adjustments = createInitialAdjustmentState();
  });

  describe('exportImage', () => {
    it('exports image in JPEG format', async () => {
      const settings: ExportSettings = {
        format: 'jpeg',
        quality: 90,
        width: 800,
        height: 600,
        maintainAspectRatio: true,
        includeMetadata: true,
      };

      const blob = await processor.exportImage(
        originalImage,
        adjustments,
        settings,
        null
      );

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('image/jpeg');
    });

    it('exports image in PNG format', async () => {
      const settings: ExportSettings = {
        format: 'png',
        quality: 100,
        width: 800,
        height: 600,
        maintainAspectRatio: true,
        includeMetadata: false,
      };

      const blob = await processor.exportImage(
        originalImage,
        adjustments,
        settings,
        null
      );

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('image/png');
    });

    it('scales image to target dimensions', async () => {
      const settings: ExportSettings = {
        format: 'jpeg',
        quality: 90,
        width: 400,
        height: 300,
        maintainAspectRatio: true,
        includeMetadata: false,
      };

      const blob = await processor.exportImage(
        originalImage,
        adjustments,
        settings,
        null
      );

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
    });

    it('reports progress during export', async () => {
      const settings: ExportSettings = {
        format: 'jpeg',
        quality: 90,
        width: 800,
        height: 600,
        maintainAspectRatio: true,
        includeMetadata: false,
      };

      const progressCallback = vi.fn();

      await processor.exportImage(
        originalImage,
        adjustments,
        settings,
        null,
        progressCallback
      );

      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: expect.any(String),
          progress: expect.any(Number),
        })
      );
    });

    it('handles export with metadata', async () => {
      const metadata: ImageMetadata = {
        format: 'jpeg',
        width: 800,
        height: 600,
        exif: { Make: 'Canon', Model: 'EOS 5D' },
        colorProfile: 'sRGB',
      };

      const settings: ExportSettings = {
        format: 'jpeg',
        quality: 90,
        width: 800,
        height: 600,
        maintainAspectRatio: true,
        includeMetadata: true,
      };

      const blob = await processor.exportImage(
        originalImage,
        adjustments,
        settings,
        metadata
      );

      expect(blob).toBeInstanceOf(Blob);
    });
  });

  describe('cancel', () => {
    it('cancels ongoing export', () => {
      expect(() => processor.cancel()).not.toThrow();
    });
  });
});

describe('downloadBlob', () => {
  beforeEach(() => {
    // Mock document methods
    document.body.appendChild = vi.fn();
    document.body.removeChild = vi.fn();
  });

  it('triggers download with correct filename', () => {
    const blob = new Blob(['test'], { type: 'image/jpeg' });
    const filename = 'test-image.jpeg';

    downloadBlob(blob, filename);

    expect(global.URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(document.body.appendChild).toHaveBeenCalled();
    expect(document.body.removeChild).toHaveBeenCalled();
  });
});

describe('generateFilename', () => {
  it('generates filename with JPEG extension', () => {
    const filename = generateFilename('jpeg');
    expect(filename).toMatch(/\.jpeg$/);
    expect(filename).toContain('pixaro-export');
  });

  it('generates filename with PNG extension', () => {
    const filename = generateFilename('png');
    expect(filename).toMatch(/\.png$/);
  });

  it('generates filename with TIFF extension', () => {
    const filename = generateFilename('tiff');
    expect(filename).toMatch(/\.tiff$/);
  });

  it('uses original name when provided', () => {
    const filename = generateFilename('jpeg', 'my-photo.jpg');
    expect(filename).toContain('my-photo');
    expect(filename).toMatch(/\.jpeg$/);
  });

  it('includes timestamp in filename', () => {
    const filename = generateFilename('jpeg');
    // Should contain date-like pattern
    expect(filename).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
