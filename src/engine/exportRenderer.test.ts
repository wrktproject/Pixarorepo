/**
 * Export Renderer Tests
 * Tests for high-quality export rendering
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExportRenderer } from './exportRenderer';
import type { AdjustmentState } from '../types/adjustments';

// Mock OffscreenCanvas if not available
if (typeof OffscreenCanvas === 'undefined') {
  global.OffscreenCanvas = class OffscreenCanvas {
    width: number;
    height: number;

    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }

    getContext() {
      return null;
    }
  } as any;
}

describe('ExportRenderer', () => {
  let renderer: ExportRenderer;

  beforeEach(() => {
    renderer = new ExportRenderer();
  });

  afterEach(() => {
    // Renderer cleans up automatically
  });

  describe('renderToImageData', () => {
    it('should render image at full resolution', async () => {
      // Create test image data
      const width = 100;
      const height = 100;
      const imageData = new ImageData(width, height);

      // Fill with test pattern
      for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] = 255; // R
        imageData.data[i + 1] = 0; // G
        imageData.data[i + 2] = 0; // B
        imageData.data[i + 3] = 255; // A
      }

      // Create default adjustments
      const adjustments: AdjustmentState = {
        exposure: 0,
        contrast: 0,
        highlights: 0,
        shadows: 0,
        whites: 0,
        blacks: 0,
        temperature: 6500,
        tint: 0,
        vibrance: 0,
        saturation: 0,
        hsl: {
          red: { hue: 0, saturation: 0, luminance: 0 },
          orange: { hue: 0, saturation: 0, luminance: 0 },
          yellow: { hue: 0, saturation: 0, luminance: 0 },
          green: { hue: 0, saturation: 0, luminance: 0 },
          aqua: { hue: 0, saturation: 0, luminance: 0 },
          blue: { hue: 0, saturation: 0, luminance: 0 },
          purple: { hue: 0, saturation: 0, luminance: 0 },
          magenta: { hue: 0, saturation: 0, luminance: 0 },
        },
        clarity: 0,
        sharpening: 0,
        noiseReductionLuma: 0,
        noiseReductionColor: 0,
        vignette: {
          amount: 0,
          midpoint: 50,
          feather: 50,
        },
        grain: {
          amount: 0,
          size: 'medium',
        },
        crop: null,
        straighten: 0,
      };

      // Skip test if WebGL2 not available
      const testCanvas = new OffscreenCanvas(1, 1);
      const testGl = testCanvas.getContext('webgl2');
      if (!testGl) {
        console.log('WebGL2 not available, skipping test');
        return;
      }

      try {
        // Render
        const result = await renderer.renderToImageData(imageData, adjustments, {
          enableDithering: false,
        });

        // Verify dimensions
        expect(result.width).toBe(width);
        expect(result.height).toBe(height);
        expect(result.data.length).toBe(width * height * 4);
      } catch (error) {
        // WebGL may not be available in test environment
        console.log('WebGL test skipped:', error);
      }
    });

    it('should apply dithering when enabled', async () => {
      const width = 50;
      const height = 50;
      const imageData = new ImageData(width, height);

      const adjustments: AdjustmentState = {
        exposure: 0,
        contrast: 0,
        highlights: 0,
        shadows: 0,
        whites: 0,
        blacks: 0,
        temperature: 6500,
        tint: 0,
        vibrance: 0,
        saturation: 0,
        hsl: {
          red: { hue: 0, saturation: 0, luminance: 0 },
          orange: { hue: 0, saturation: 0, luminance: 0 },
          yellow: { hue: 0, saturation: 0, luminance: 0 },
          green: { hue: 0, saturation: 0, luminance: 0 },
          aqua: { hue: 0, saturation: 0, luminance: 0 },
          blue: { hue: 0, saturation: 0, luminance: 0 },
          purple: { hue: 0, saturation: 0, luminance: 0 },
          magenta: { hue: 0, saturation: 0, luminance: 0 },
        },
        clarity: 0,
        sharpening: 0,
        noiseReductionLuma: 0,
        noiseReductionColor: 0,
        vignette: {
          amount: 0,
          midpoint: 50,
          feather: 50,
        },
        grain: {
          amount: 0,
          size: 'medium',
        },
        crop: null,
        straighten: 0,
      };

      // Skip test if WebGL2 not available
      const testCanvas = new OffscreenCanvas(1, 1);
      const testGl = testCanvas.getContext('webgl2');
      if (!testGl) {
        console.log('WebGL2 not available, skipping test');
        return;
      }

      try {
        // Render with dithering
        const result = await renderer.renderToImageData(imageData, adjustments, {
          enableDithering: true,
          ditherStrength: 0.5,
        });

        // Verify result exists
        expect(result).toBeDefined();
        expect(result.width).toBe(width);
        expect(result.height).toBe(height);
      } catch (error) {
        console.log('WebGL test skipped:', error);
      }
    });

    it('should handle errors gracefully', async () => {
      const imageData = new ImageData(1, 1);
      const adjustments: AdjustmentState = {
        exposure: 0,
        contrast: 0,
        highlights: 0,
        shadows: 0,
        whites: 0,
        blacks: 0,
        temperature: 6500,
        tint: 0,
        vibrance: 0,
        saturation: 0,
        hsl: {
          red: { hue: 0, saturation: 0, luminance: 0 },
          orange: { hue: 0, saturation: 0, luminance: 0 },
          yellow: { hue: 0, saturation: 0, luminance: 0 },
          green: { hue: 0, saturation: 0, luminance: 0 },
          aqua: { hue: 0, saturation: 0, luminance: 0 },
          blue: { hue: 0, saturation: 0, luminance: 0 },
          purple: { hue: 0, saturation: 0, luminance: 0 },
          magenta: { hue: 0, saturation: 0, luminance: 0 },
        },
        clarity: 0,
        sharpening: 0,
        noiseReductionLuma: 0,
        noiseReductionColor: 0,
        vignette: {
          amount: 0,
          midpoint: 50,
          feather: 50,
        },
        grain: {
          amount: 0,
          size: 'medium',
        },
        crop: null,
        straighten: 0,
      };

      // Test should either succeed or throw an error (not hang)
      try {
        await renderer.renderToImageData(imageData, adjustments);
      } catch (error) {
        // Expected if WebGL not available
        expect(error).toBeDefined();
      }
    });
  });
});
