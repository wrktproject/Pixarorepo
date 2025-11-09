/**
 * Spot Removal Tests
 */

import { describe, it, expect } from 'vitest';
import {
  isSpotRemoval,
  calculateMaskArea,
  performSpotRemoval,
} from './spotRemoval';
import type { RemovalMask } from '../types/adjustments';

// Helper to create test mask
const createTestMask = (width: number, height: number): RemovalMask => {
  const pixels = new Uint8Array(width * height);
  // Fill with white (255) to simulate a mask
  pixels.fill(255);
  
  return {
    pixels,
    bounds: { x: 0, y: 0, width, height },
  };
};

// Helper to create test image data
const createTestImageData = (width: number, height: number): ImageData => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 100; // R
    data[i + 1] = 150; // G
    data[i + 2] = 200; // B
    data[i + 3] = 255; // A
  }
  return new ImageData(data, width, height);
};

describe('spotRemoval', () => {
  describe('isSpotRemoval', () => {
    it('returns true for small masks under threshold', () => {
      const mask = createTestMask(10, 10); // 100 pixels
      expect(isSpotRemoval(mask)).toBe(true);
    });

    it('returns false for large masks over threshold', () => {
      const mask = createTestMask(30, 30); // 900 pixels
      expect(isSpotRemoval(mask)).toBe(false);
    });

    it('returns true for masks at threshold boundary', () => {
      const mask = createTestMask(22, 22); // 484 pixels (< 500)
      expect(isSpotRemoval(mask)).toBe(true);
    });
  });

  describe('calculateMaskArea', () => {
    it('calculates area correctly for fully filled mask', () => {
      const mask = createTestMask(10, 10);
      expect(calculateMaskArea(mask)).toBe(100);
    });

    it('calculates area correctly for partially filled mask', () => {
      const pixels = new Uint8Array(100);
      // Fill only half
      for (let i = 0; i < 50; i++) {
        pixels[i] = 255;
      }
      
      const mask: RemovalMask = {
        pixels,
        bounds: { x: 0, y: 0, width: 10, height: 10 },
      };
      
      expect(calculateMaskArea(mask)).toBe(50);
    });

    it('returns 0 for empty mask', () => {
      const pixels = new Uint8Array(100);
      const mask: RemovalMask = {
        pixels,
        bounds: { x: 0, y: 0, width: 10, height: 10 },
      };
      
      expect(calculateMaskArea(mask)).toBe(0);
    });
  });

  describe('performSpotRemoval', () => {
    it('returns ImageData with same dimensions', () => {
      const imageData = createTestImageData(100, 100);
      const mask = createTestMask(10, 10);
      
      const result = performSpotRemoval(imageData, mask);
      
      expect(result.width).toBe(100);
      expect(result.height).toBe(100);
      expect(result.data.length).toBe(imageData.data.length);
    });

    it('modifies pixels within mask bounds', () => {
      const imageData = createTestImageData(100, 100);
      const mask = createTestMask(5, 5);
      
      const result = performSpotRemoval(imageData, mask);
      
      // Result should be different from original
      expect(result.data).not.toEqual(imageData.data);
    });

    it('preserves pixels outside mask bounds', () => {
      const imageData = createTestImageData(100, 100);
      
      // Small mask in corner
      const mask: RemovalMask = {
        pixels: new Uint8Array(25).fill(255),
        bounds: { x: 0, y: 0, width: 5, height: 5 },
      };
      
      const result = performSpotRemoval(imageData, mask);
      
      // Check a pixel far from the mask (e.g., at 50, 50)
      const farIdx = (50 * 100 + 50) * 4;
      expect(result.data[farIdx]).toBe(imageData.data[farIdx]);
      expect(result.data[farIdx + 1]).toBe(imageData.data[farIdx + 1]);
      expect(result.data[farIdx + 2]).toBe(imageData.data[farIdx + 2]);
    });

    it('handles edge cases with mask at image boundary', () => {
      const imageData = createTestImageData(100, 100);
      
      // Mask at bottom-right corner
      const mask: RemovalMask = {
        pixels: new Uint8Array(25).fill(255),
        bounds: { x: 95, y: 95, width: 5, height: 5 },
      };
      
      expect(() => performSpotRemoval(imageData, mask)).not.toThrow();
    });
  });
});
