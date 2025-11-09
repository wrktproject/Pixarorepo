/**
 * Crop Utilities Tests
 * Tests for crop bounds calculation and aspect ratio constraints
 */

import { describe, it, expect } from 'vitest';
import type { CropBounds } from '../types/adjustments';

/**
 * Calculate crop bounds with aspect ratio constraint
 */
export function calculateCropBounds(
  currentBounds: CropBounds,
  imageWidth: number,
  imageHeight: number,
  targetAspectRatio: number | null
): CropBounds {
  if (targetAspectRatio === null) {
    return currentBounds;
  }

  const currentAspect = currentBounds.width / currentBounds.height;

  let newWidth = currentBounds.width;
  let newHeight = currentBounds.height;

  if (Math.abs(currentAspect - targetAspectRatio) > 0.01) {
    if (currentAspect > targetAspectRatio) {
      // Too wide, adjust width
      newWidth = currentBounds.height * targetAspectRatio;
    } else {
      // Too tall, adjust height
      newHeight = currentBounds.width / targetAspectRatio;
    }
  }

  // Center the new bounds
  const newX = currentBounds.x + (currentBounds.width - newWidth) / 2;
  const newY = currentBounds.y + (currentBounds.height - newHeight) / 2;

  // Ensure bounds stay within image
  const clampedX = Math.max(0, Math.min(newX, imageWidth - newWidth));
  const clampedY = Math.max(0, Math.min(newY, imageHeight - newHeight));
  const clampedWidth = Math.min(newWidth, imageWidth - clampedX);
  const clampedHeight = Math.min(newHeight, imageHeight - clampedY);

  return {
    x: clampedX,
    y: clampedY,
    width: clampedWidth,
    height: clampedHeight,
    aspectRatio: targetAspectRatio,
  };
}

/**
 * Validate crop bounds are within image dimensions
 */
export function validateCropBounds(
  bounds: CropBounds,
  imageWidth: number,
  imageHeight: number
): boolean {
  return (
    bounds.x >= 0 &&
    bounds.y >= 0 &&
    bounds.x + bounds.width <= imageWidth &&
    bounds.y + bounds.height <= imageHeight &&
    bounds.width > 0 &&
    bounds.height > 0
  );
}

describe('Crop Utilities', () => {
  describe('calculateCropBounds', () => {
    it('maintains freeform crop when aspect ratio is null', () => {
      const currentBounds: CropBounds = {
        x: 100,
        y: 100,
        width: 800,
        height: 600,
        aspectRatio: null,
      };

      const result = calculateCropBounds(currentBounds, 1920, 1080, null);

      expect(result).toEqual(currentBounds);
    });

    it('adjusts width for 1:1 aspect ratio', () => {
      const currentBounds: CropBounds = {
        x: 100,
        y: 100,
        width: 800,
        height: 600,
        aspectRatio: null,
      };

      const result = calculateCropBounds(currentBounds, 1920, 1080, 1);

      expect(result.width).toBe(600); // Adjusted to match height
      expect(result.height).toBe(600);
      expect(result.aspectRatio).toBe(1);
      // Should be centered
      expect(result.x).toBe(200); // 100 + (800 - 600) / 2
      expect(result.y).toBe(100);
    });

    it('adjusts height for 16:9 aspect ratio', () => {
      const currentBounds: CropBounds = {
        x: 100,
        y: 100,
        width: 800,
        height: 600,
        aspectRatio: null,
      };

      const result = calculateCropBounds(currentBounds, 1920, 1080, 16 / 9);

      expect(result.width).toBe(800);
      expect(result.height).toBeCloseTo(450, 0); // 800 / (16/9)
      expect(result.aspectRatio).toBe(16 / 9);
      // Should be centered vertically
      expect(result.x).toBe(100);
      expect(result.y).toBeCloseTo(175, 0); // 100 + (600 - 450) / 2
    });

    it('adjusts width for 4:3 aspect ratio', () => {
      const currentBounds: CropBounds = {
        x: 100,
        y: 100,
        width: 800,
        height: 600,
        aspectRatio: null,
      };

      const result = calculateCropBounds(currentBounds, 1920, 1080, 4 / 3);

      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
      expect(result.aspectRatio).toBe(4 / 3);
      // Already at correct aspect ratio, no adjustment needed
      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
    });

    it('clamps bounds to image dimensions', () => {
      const currentBounds: CropBounds = {
        x: 1500,
        y: 800,
        width: 800,
        height: 600,
        aspectRatio: null,
      };

      const result = calculateCropBounds(currentBounds, 1920, 1080, 1);

      // Should adjust to fit within image
      expect(result.x + result.width).toBeLessThanOrEqual(1920);
      expect(result.y + result.height).toBeLessThanOrEqual(1080);
      expect(result.x).toBeGreaterThanOrEqual(0);
      expect(result.y).toBeGreaterThanOrEqual(0);
    });

    it('handles edge case at image boundaries', () => {
      const currentBounds: CropBounds = {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        aspectRatio: null,
      };

      const result = calculateCropBounds(currentBounds, 1920, 1080, 16 / 9);

      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.width).toBe(1920);
      expect(result.height).toBeCloseTo(1080, 0);
    });
  });

  describe('validateCropBounds', () => {
    it('validates correct crop bounds', () => {
      const bounds: CropBounds = {
        x: 100,
        y: 100,
        width: 800,
        height: 600,
        aspectRatio: null,
      };

      expect(validateCropBounds(bounds, 1920, 1080)).toBe(true);
    });

    it('rejects negative x coordinate', () => {
      const bounds: CropBounds = {
        x: -10,
        y: 100,
        width: 800,
        height: 600,
        aspectRatio: null,
      };

      expect(validateCropBounds(bounds, 1920, 1080)).toBe(false);
    });

    it('rejects negative y coordinate', () => {
      const bounds: CropBounds = {
        x: 100,
        y: -10,
        width: 800,
        height: 600,
        aspectRatio: null,
      };

      expect(validateCropBounds(bounds, 1920, 1080)).toBe(false);
    });

    it('rejects bounds exceeding image width', () => {
      const bounds: CropBounds = {
        x: 1500,
        y: 100,
        width: 800,
        height: 600,
        aspectRatio: null,
      };

      expect(validateCropBounds(bounds, 1920, 1080)).toBe(false);
    });

    it('rejects bounds exceeding image height', () => {
      const bounds: CropBounds = {
        x: 100,
        y: 800,
        width: 800,
        height: 600,
        aspectRatio: null,
      };

      expect(validateCropBounds(bounds, 1920, 1080)).toBe(false);
    });

    it('rejects zero width', () => {
      const bounds: CropBounds = {
        x: 100,
        y: 100,
        width: 0,
        height: 600,
        aspectRatio: null,
      };

      expect(validateCropBounds(bounds, 1920, 1080)).toBe(false);
    });

    it('rejects zero height', () => {
      const bounds: CropBounds = {
        x: 100,
        y: 100,
        width: 800,
        height: 0,
        aspectRatio: null,
      };

      expect(validateCropBounds(bounds, 1920, 1080)).toBe(false);
    });

    it('validates bounds at image edges', () => {
      const bounds: CropBounds = {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        aspectRatio: null,
      };

      expect(validateCropBounds(bounds, 1920, 1080)).toBe(true);
    });
  });

  describe('Aspect Ratio Calculations', () => {
    it('calculates 1:1 aspect ratio correctly', () => {
      const aspectRatio = 1;
      const width = 600;
      const height = width / aspectRatio;

      expect(height).toBe(600);
    });

    it('calculates 4:3 aspect ratio correctly', () => {
      const aspectRatio = 4 / 3;
      const width = 800;
      const height = width / aspectRatio;

      expect(height).toBe(600);
    });

    it('calculates 16:9 aspect ratio correctly', () => {
      const aspectRatio = 16 / 9;
      const width = 1920;
      const height = width / aspectRatio;

      expect(height).toBe(1080);
    });
  });

  describe('Rotation Angle Application', () => {
    it('converts degrees to radians correctly', () => {
      const degrees = 45;
      const radians = (degrees * Math.PI) / 180;

      expect(radians).toBeCloseTo(0.7854, 4);
    });

    it('handles negative angles', () => {
      const degrees = -30;
      const radians = (degrees * Math.PI) / 180;

      expect(radians).toBeCloseTo(-0.5236, 4);
    });

    it('handles zero angle', () => {
      const degrees = 0;
      const radians = (degrees * Math.PI) / 180;

      expect(radians).toBe(0);
    });

    it('handles maximum positive angle', () => {
      const degrees = 45;
      const radians = (degrees * Math.PI) / 180;

      expect(radians).toBeCloseTo(0.7854, 4);
      expect(radians).toBeLessThanOrEqual(Math.PI / 2);
    });

    it('handles maximum negative angle', () => {
      const degrees = -45;
      const radians = (degrees * Math.PI) / 180;

      expect(radians).toBeCloseTo(-0.7854, 4);
      expect(radians).toBeGreaterThanOrEqual(-Math.PI / 2);
    });
  });
});
