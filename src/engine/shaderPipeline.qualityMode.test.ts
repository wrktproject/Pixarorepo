/**
 * Tests for ShaderPipeline quality mode (preview vs export)
 * These tests verify the downscaling logic without requiring WebGL
 */

import { describe, it, expect } from 'vitest';
import { calculatePreviewSize, downscaleImageData } from '../utils/imageDownscaling';

describe('ShaderPipeline - Quality Mode (Downscaling Logic)', () => {

  describe('calculatePreviewSize', () => {
    it('should not downscale images smaller than maxSize', () => {
      const result = calculatePreviewSize(800, 600, 2048);
      
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
      expect(result.scale).toBe(1);
    });

    it('should downscale wide images to maxSize', () => {
      const result = calculatePreviewSize(4000, 2000, 2048);
      
      expect(result.width).toBe(2048);
      expect(result.height).toBe(1024);
      expect(result.scale).toBeCloseTo(2048 / 4000);
    });

    it('should downscale tall images to maxSize', () => {
      const result = calculatePreviewSize(2000, 4000, 2048);
      
      expect(result.width).toBe(1024);
      expect(result.height).toBe(2048);
      expect(result.scale).toBeCloseTo(1024 / 2000);
    });

    it('should maintain aspect ratio when downscaling', () => {
      const result = calculatePreviewSize(3000, 2000, 2048);
      
      const originalAspect = 3000 / 2000;
      const previewAspect = result.width / result.height;
      
      expect(Math.abs(previewAspect - originalAspect)).toBeLessThan(0.01);
    });
  });

  describe('downscaling behavior', () => {
    it('should identify when downscaling is needed', () => {
      const largeResult = calculatePreviewSize(4000, 3000, 2048);
      const smallResult = calculatePreviewSize(800, 600, 2048);
      
      expect(largeResult.scale).toBeLessThan(1);
      expect(smallResult.scale).toBe(1);
    });

    it('should calculate correct dimensions for various sizes', () => {
      const testCases = [
        { width: 4000, height: 3000, expected: { width: 2048, height: 1536 } },
        { width: 3000, height: 4000, expected: { width: 1536, height: 2048 } },
        { width: 2048, height: 1024, expected: { width: 2048, height: 1024 } },
        { width: 1024, height: 768, expected: { width: 1024, height: 768 } },
      ];

      testCases.forEach(({ width, height, expected }) => {
        const result = calculatePreviewSize(width, height, 2048);
        expect(result.width).toBe(expected.width);
        expect(result.height).toBe(expected.height);
      });
    });
  });

  describe('quality modes', () => {
    it('should calculate correct scale factor for preview', () => {
      const result = calculatePreviewSize(4000, 3000, 2048);
      
      // Scale should be approximately 0.512 (2048/4000)
      expect(result.scale).toBeCloseTo(0.512, 2);
    });

    it('should handle edge case of exactly maxSize', () => {
      const result = calculatePreviewSize(2048, 2048, 2048);
      
      expect(result.width).toBe(2048);
      expect(result.height).toBe(2048);
      expect(result.scale).toBe(1);
    });

    it('should handle very large images', () => {
      const result = calculatePreviewSize(8000, 6000, 2048);
      
      expect(result.width).toBe(2048);
      expect(result.height).toBe(1536);
      expect(result.scale).toBeCloseTo(0.256, 2);
    });
  });
});
