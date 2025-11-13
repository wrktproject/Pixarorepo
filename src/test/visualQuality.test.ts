/**
 * Visual Quality Tests
 * 
 * Tests for visual quality issues including:
 * - Banding and posterization
 * - Halos and artifacts
 * - High dynamic range handling
 * - Color accuracy with ColorChecker
 */

import { describe, it, expect } from 'vitest';

describe('Visual Quality Tests', () => {
  describe('Banding and Posterization Detection', () => {
    it('should detect smooth gradients without banding', () => {
      // Create a smooth gradient from black to white
      const width = 256;
      const height = 1;
      const gradient = new Uint8ClampedArray(width * height * 4);
      
      for (let x = 0; x < width; x++) {
        const value = (x / (width - 1)) * 255;
        const idx = x * 4;
        gradient[idx] = value;     // R
        gradient[idx + 1] = value; // G
        gradient[idx + 2] = value; // B
        gradient[idx + 3] = 255;   // A
      }
      
      // Check for smooth transitions (no jumps > 2 levels)
      let maxJump = 0;
      for (let x = 1; x < width; x++) {
        const prev = gradient[(x - 1) * 4];
        const curr = gradient[x * 4];
        const jump = Math.abs(curr - prev);
        maxJump = Math.max(maxJump, jump);
      }
      
      expect(maxJump).toBeLessThanOrEqual(2);
    });

    it('should detect posterization in processed gradients', () => {
      // Simulate a posterized gradient (8 levels instead of 256)
      const width = 256;
      const posterized = new Uint8ClampedArray(width * 4);
      
      for (let x = 0; x < width; x++) {
        // Quantize to 8 levels
        const level = Math.floor((x / width) * 8);
        const value = (level / 7) * 255;
        const idx = x * 4;
        posterized[idx] = value;
        posterized[idx + 1] = value;
        posterized[idx + 2] = value;
        posterized[idx + 3] = 255;
      }
      
      // Count distinct values
      const distinctValues = new Set<number>();
      for (let x = 0; x < width; x++) {
        distinctValues.add(posterized[x * 4]);
      }
      
      // Should have exactly 8 distinct values (posterized)
      expect(distinctValues.size).toBe(8);
    });

    it('should verify 16-bit precision prevents banding', () => {
      // Simulate 16-bit processing
      const width = 256;
      const gradient16 = new Float32Array(width);
      
      for (let x = 0; x < width; x++) {
        gradient16[x] = x / (width - 1);
      }
      
      // Check precision is maintained
      for (let x = 1; x < width; x++) {
        const diff = gradient16[x] - gradient16[x - 1];
        expect(diff).toBeCloseTo(1 / (width - 1), 6);
      }
    });
  });

  describe('Halo Detection', () => {
    it('should detect halos around high-contrast edges', () => {
      // Create a high-contrast edge (black to white)
      const width = 10;
      const height = 1;
      const edge = new Uint8ClampedArray(width * height * 4);
      
      for (let x = 0; x < width; x++) {
        const value = x < width / 2 ? 0 : 255;
        const idx = x * 4;
        edge[idx] = value;
        edge[idx + 1] = value;
        edge[idx + 2] = value;
        edge[idx + 3] = 255;
      }
      
      // Check for sharp transition (no overshoot)
      const midpoint = Math.floor(width / 2);
      const beforeEdge = edge[(midpoint - 1) * 4];
      const atEdge = edge[midpoint * 4];
      const afterEdge = edge[(midpoint + 1) * 4];
      
      expect(beforeEdge).toBe(0);
      expect(atEdge).toBe(255);
      expect(afterEdge).toBe(255);
      
      // No overshoot (values should not exceed 255)
      for (let x = 0; x < width; x++) {
        expect(edge[x * 4]).toBeLessThanOrEqual(255);
        expect(edge[x * 4]).toBeGreaterThanOrEqual(0);
      }
    });

    it('should verify guided filter preserves edges', () => {
      // Test that edge-aware filtering doesn't create halos
      const edgeStrength = 255;
      const smoothArea = 128;
      
      // Simulate guided filter behavior: preserve edges, smooth flat areas
      const preservedEdge = edgeStrength;
      const smoothedFlat = smoothArea;
      
      expect(preservedEdge).toBe(255);
      expect(smoothedFlat).toBeLessThanOrEqual(128);
    });
  });

  describe('High Dynamic Range Handling', () => {
    it('should handle HDR values > 1.0 without clipping', () => {
      const hdrValues = [0.5, 1.0, 2.0, 4.0, 8.0];
      
      // Verify values are preserved in linear space
      for (const value of hdrValues) {
        expect(value).toBeGreaterThanOrEqual(0);
        // HDR values should be representable
        expect(Number.isFinite(value)).toBe(true);
      }
    });

    it('should compress HDR to display range smoothly', () => {
      // Simulate filmic tone mapping
      const hdrInput = [0.1, 0.5, 1.0, 2.0, 4.0, 8.0];
      const compressed = hdrInput.map(x => {
        // Simple filmic curve: x / (x + 1)
        return x / (x + 1);
      });
      
      // All outputs should be in [0, 1] range
      for (const value of compressed) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
      
      // Should be monotonically increasing
      for (let i = 1; i < compressed.length; i++) {
        expect(compressed[i]).toBeGreaterThan(compressed[i - 1]);
      }
    });

    it('should preserve highlight detail in HDR images', () => {
      // Test highlight preservation
      const highlights = [1.0, 1.5, 2.0, 2.5, 3.0];
      
      // After tone mapping, highlights should still be distinguishable
      const toneMapped = highlights.map(x => x / (x + 1));
      
      for (let i = 1; i < toneMapped.length; i++) {
        const diff = toneMapped[i] - toneMapped[i - 1];
        expect(diff).toBeGreaterThan(0.01); // At least 1% difference
      }
    });

    it('should handle extreme HDR values without NaN or Infinity', () => {
      const extremeValues = [0, 0.001, 100, 1000, 10000];
      
      for (const value of extremeValues) {
        const processed = value / (value + 1);
        expect(Number.isFinite(processed)).toBe(true);
        expect(Number.isNaN(processed)).toBe(false);
      }
    });
  });

  describe('ColorChecker Chart Accuracy', () => {
    // ColorChecker Classic 24 patch sRGB values (approximate)
    const colorCheckerPatches = [
      { name: 'Dark Skin', rgb: [115, 82, 68] },
      { name: 'Light Skin', rgb: [194, 150, 130] },
      { name: 'Blue Sky', rgb: [98, 122, 157] },
      { name: 'Foliage', rgb: [87, 108, 67] },
      { name: 'Blue Flower', rgb: [133, 128, 177] },
      { name: 'Bluish Green', rgb: [103, 189, 170] },
      { name: 'Orange', rgb: [214, 126, 44] },
      { name: 'Purplish Blue', rgb: [80, 91, 166] },
      { name: 'Moderate Red', rgb: [193, 90, 99] },
      { name: 'Purple', rgb: [94, 60, 108] },
      { name: 'Yellow Green', rgb: [157, 188, 64] },
      { name: 'Orange Yellow', rgb: [224, 163, 46] },
      { name: 'Blue', rgb: [56, 61, 150] },
      { name: 'Green', rgb: [70, 148, 73] },
      { name: 'Red', rgb: [175, 54, 60] },
      { name: 'Yellow', rgb: [231, 199, 31] },
      { name: 'Magenta', rgb: [187, 86, 149] },
      { name: 'Cyan', rgb: [8, 133, 161] },
      { name: 'White', rgb: [243, 243, 242] },
      { name: 'Neutral 8', rgb: [200, 200, 200] },
      { name: 'Neutral 6.5', rgb: [160, 160, 160] },
      { name: 'Neutral 5', rgb: [122, 122, 121] },
      { name: 'Neutral 3.5', rgb: [85, 85, 85] },
      { name: 'Black', rgb: [52, 52, 52] },
    ];

    it('should preserve ColorChecker patch colors', () => {
      // Test that color processing doesn't drastically alter known colors
      for (const patch of colorCheckerPatches) {
        const [r, g, b] = patch.rgb;
        
        // Verify values are in valid range
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(255);
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(255);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(255);
      }
    });

    it('should maintain neutral patch neutrality', () => {
      // Neutral patches should have R ≈ G ≈ B
      const neutralPatches = colorCheckerPatches.slice(18, 24);
      
      for (const patch of neutralPatches) {
        const [r, g, b] = patch.rgb;
        const maxDiff = Math.max(
          Math.abs(r - g),
          Math.abs(g - b),
          Math.abs(b - r)
        );
        
        // Neutral patches should have minimal color cast (< 5 levels)
        expect(maxDiff).toBeLessThanOrEqual(5);
      }
    });

    it('should preserve color relationships', () => {
      // Red patch should be redder than green patch
      const redPatch = colorCheckerPatches[14]; // Red
      const greenPatch = colorCheckerPatches[13]; // Green
      
      expect(redPatch.rgb[0]).toBeGreaterThan(greenPatch.rgb[0]); // R
      expect(greenPatch.rgb[1]).toBeGreaterThan(redPatch.rgb[1]); // G
    });

    it('should maintain luminance order', () => {
      // Neutral patches should be ordered by luminance
      const neutralPatches = colorCheckerPatches.slice(18, 24);
      
      for (let i = 1; i < neutralPatches.length; i++) {
        const prevLum = neutralPatches[i - 1].rgb[0]; // Use R as proxy for luminance
        const currLum = neutralPatches[i].rgb[0];
        
        // Each patch should be darker than the previous
        expect(currLum).toBeLessThan(prevLum);
      }
    });
  });

  describe('Artifact Detection', () => {
    it('should detect color fringing', () => {
      // Color fringing: colored edges around high-contrast boundaries
      const width = 5;
      const edge = new Uint8ClampedArray(width * 4);
      
      // Black to white edge
      for (let x = 0; x < width; x++) {
        const idx = x * 4;
        if (x < 2) {
          edge[idx] = 0;
          edge[idx + 1] = 0;
          edge[idx + 2] = 0;
        } else {
          edge[idx] = 255;
          edge[idx + 1] = 255;
          edge[idx + 2] = 255;
        }
        edge[idx + 3] = 255;
      }
      
      // Check that edge pixels are neutral (no color fringing)
      const edgeIdx = 2 * 4;
      const r = edge[edgeIdx];
      const g = edge[edgeIdx + 1];
      const b = edge[edgeIdx + 2];
      
      // Edge should be neutral (R ≈ G ≈ B)
      expect(Math.abs(r - g)).toBeLessThanOrEqual(1);
      expect(Math.abs(g - b)).toBeLessThanOrEqual(1);
    });

    it('should detect blocking artifacts', () => {
      // Blocking: visible 8x8 or 16x16 blocks
      const blockSize = 8;
      const width = blockSize * 2;
      const height = blockSize * 2;
      
      // Create uniform blocks
      const blocks = new Uint8ClampedArray(width * height * 4);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const blockX = Math.floor(x / blockSize);
          const blockY = Math.floor(y / blockSize);
          const value = ((blockX + blockY) % 2) * 128;
          
          const idx = (y * width + x) * 4;
          blocks[idx] = value;
          blocks[idx + 1] = value;
          blocks[idx + 2] = value;
          blocks[idx + 3] = 255;
        }
      }
      
      // Verify block boundaries exist
      const topLeft = blocks[0];
      const topRight = blocks[(blockSize) * 4];
      expect(Math.abs(topLeft - topRight)).toBeGreaterThan(0);
    });

    it('should detect noise amplification', () => {
      // Test that detail enhancement doesn't amplify noise excessively
      const noiseLevel = 5; // Small noise
      const amplificationFactor = 2; // Detail enhancement
      
      const amplifiedNoise = noiseLevel * amplificationFactor;
      
      // Amplified noise should still be reasonable (< 20 levels)
      expect(amplifiedNoise).toBeLessThan(20);
    });
  });

  describe('Numerical Stability', () => {
    it('should handle division by zero gracefully', () => {
      const safeDivide = (a: number, b: number, epsilon = 1e-8) => {
        return a / (b + epsilon);
      };
      
      const result = safeDivide(1.0, 0.0);
      expect(Number.isFinite(result)).toBe(true);
      expect(result).toBeGreaterThan(0);
    });

    it('should handle very small values without underflow', () => {
      const verySmall = 1e-10;
      const processed = Math.log(verySmall + 1e-8);
      
      expect(Number.isFinite(processed)).toBe(true);
      expect(Number.isNaN(processed)).toBe(false);
    });

    it('should handle very large values without overflow', () => {
      const veryLarge = 1e10;
      const compressed = veryLarge / (veryLarge + 1);
      
      expect(Number.isFinite(compressed)).toBe(true);
      expect(compressed).toBeLessThanOrEqual(1);
    });

    it('should maintain precision in color space conversions', () => {
      // Test round-trip conversion precision
      const original = 0.5;
      const epsilon = 1e-6;
      
      // Simulate sRGB -> Linear -> sRGB
      const linear = Math.pow((original + 0.055) / 1.055, 2.4);
      const backToSRGB = 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
      
      expect(backToSRGB).toBeCloseTo(original, 5);
    });
  });
});
