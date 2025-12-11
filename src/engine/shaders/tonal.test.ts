/**
 * Tonal Adjustment Shader Tests
 * Validates Lightroom-style smooth tonal adjustments
 */

import { describe, it, expect } from 'vitest';

/**
 * Test suite for tonal adjustment calculations
 * Verifies that:
 * 1. Smooth step function produces values between 0 and 1
 * 2. Mask functions produce smooth gradients
 * 3. Adjustment functions apply correctly with proper clamping
 */
describe('Tonal Shader Calculations', () => {
  // Smooth step function from shader
  function smoothStep3(t: number): number {
    return t * t * (3.0 - 2.0 * t);
  }

  // Highlight mask from shader
  function highlightMask(lum: number): number {
    const transitionStart = 0.4;
    const fullEffectStart = 0.7;

    if (lum < transitionStart) {
      return 0.0;
    } else if (lum >= fullEffectStart) {
      return 1.0;
    } else {
      const t = (lum - transitionStart) / (fullEffectStart - transitionStart);
      return smoothStep3(t);
    }
  }

  // Shadow mask from shader
  function shadowMask(lum: number): number {
    const transitionStart = 0.4;
    const fullEffectStart = 0.15;

    if (lum > transitionStart) {
      return 0.0;
    } else if (lum <= fullEffectStart) {
      return 1.0;
    } else {
      const t = (lum - fullEffectStart) / (transitionStart - fullEffectStart);
      return 1.0 - smoothStep3(t);
    }
  }

  // White mask from shader
  function whiteMask(lum: number): number {
    if (lum < 0.75) {
      return 0.0;
    } else if (lum >= 1.0) {
      return 1.0;
    } else {
      const t = (lum - 0.75) / 0.25;
      return smoothStep3(t);
    }
  }

  // Black mask from shader
  function blackMask(lum: number): number {
    if (lum > 0.15) {
      return 0.0;
    } else if (lum <= 0.0) {
      return 1.0;
    } else {
      const t = lum / 0.15;
      return 1.0 - smoothStep3(t);
    }
  }

  describe('smoothStep3 function', () => {
    it('should return 0 at t=0', () => {
      expect(smoothStep3(0.0)).toBe(0.0);
    });

    it('should return 0.5 at t=0.5', () => {
      const result = smoothStep3(0.5);
      expect(result).toBeCloseTo(0.5, 5);
    });

    it('should return 1 at t=1', () => {
      expect(smoothStep3(1.0)).toBe(1.0);
    });

    it('should produce smooth progression', () => {
      const values = [0.0, 0.25, 0.5, 0.75, 1.0].map(smoothStep3);
      // Check monotonic increase
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
      }
    });
  });

  describe('Highlight mask', () => {
    it('should be 0 below transition start (0.4)', () => {
      expect(highlightMask(0.3)).toBe(0.0);
      expect(highlightMask(0.0)).toBe(0.0);
    });

    it('should be 1 at full effect start (0.7)', () => {
      expect(highlightMask(0.7)).toBe(1.0);
      expect(highlightMask(1.0)).toBe(1.0);
    });

    it('should transition smoothly between 0.4 and 0.7', () => {
      const mask04 = highlightMask(0.4);
      const mask055 = highlightMask(0.55);
      const mask07 = highlightMask(0.7);

      expect(mask04).toBeGreaterThanOrEqual(0.0);
      expect(mask055).toBeGreaterThan(mask04);
      expect(mask07).toBeGreaterThanOrEqual(mask055);
    });

    it('should not have discontinuities', () => {
      // Check derivative is continuous (no sharp jumps)
      for (let lum = 0.3; lum <= 0.8; lum += 0.05) {
        const m1 = highlightMask(lum - 0.01);
        const m2 = highlightMask(lum + 0.01);
        const changeMagnitude = Math.abs(m2 - m1);
        // Smooth step function has maximum derivative of 0.75 at midpoint
        expect(changeMagnitude).toBeLessThan(0.1); // Smooth transition
      }
    });
  });

  describe('Shadow mask', () => {
    it('should be 1 at full effect start (0.15)', () => {
      expect(shadowMask(0.15)).toBe(1.0);
      expect(shadowMask(0.0)).toBe(1.0);
    });

    it('should be 0 above transition start (0.4)', () => {
      expect(shadowMask(0.4)).toBeCloseTo(0.0, 5);
      expect(shadowMask(1.0)).toBeCloseTo(0.0, 5);
    });

    it('should transition smoothly between 0.15 and 0.4', () => {
      const mask015 = shadowMask(0.15);
      const mask025 = shadowMask(0.275);
      const mask04 = shadowMask(0.4);

      // Decreasing as luminance increases (shadows affect darker areas)
      expect(mask015).toBeGreaterThanOrEqual(mask025);
      expect(mask025).toBeGreaterThanOrEqual(mask04);
    });
  });

  describe('White mask', () => {
    it('should be 0 below 0.75', () => {
      expect(whiteMask(0.7)).toBe(0.0);
      expect(whiteMask(0.0)).toBe(0.0);
    });

    it('should be 1 at 1.0', () => {
      expect(whiteMask(1.0)).toBe(1.0);
    });

    it('should transition smoothly between 0.75 and 1.0', () => {
      const values = [0.75, 0.8, 0.9, 1.0].map(whiteMask);
      // Monotonically increasing
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
      }
    });
  });

  describe('Black mask', () => {
    it('should be 1 at 0', () => {
      expect(blackMask(0.0)).toBe(1.0);
    });

    it('should be ~0 at 0.15', () => {
      expect(blackMask(0.15)).toBeCloseTo(0.0, 5);
      expect(blackMask(1.0)).toBeCloseTo(0.0, 5);
    });

    it('should transition smoothly between 0 and 0.15', () => {
      const values = [0.0, 0.05, 0.1, 0.15].map(blackMask);
      // Monotonically decreasing
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
      }
    });
  });

  describe('Contrast calculation', () => {
    // Contrast function
    function applyContrast(normalizedValue: number, contrast: number): number {
      const grey_fulcrum = 0.1845;

      if (Math.abs(contrast) < 0.01) {
        return normalizedValue;
      }

      const normalizedContrast = contrast / 100.0;
      const gamma = Math.pow(2.0, -normalizedContrast);

      if (normalizedValue <= 0.0001) {
        return 0.0;
      } else {
        return Math.pow(normalizedValue / grey_fulcrum, gamma) * grey_fulcrum;
      }
    }

    it('should have no effect at 0 contrast', () => {
      const values = [0.1, 0.5, 0.9];
      values.forEach(v => {
        expect(applyContrast(v, 0)).toBeCloseTo(v, 5);
      });
    });

    it('should preserve relative order (monotonicity)', () => {
      // Contrast must preserve relative ordering
      // If a < b before contrast, then a < b after contrast
      const testValues = [0.05, 0.1, 0.2, 0.5];
      const withPositiveContrast = testValues.map(v => applyContrast(v, 50));

      for (let i = 1; i < withPositiveContrast.length; i++) {
        expect(withPositiveContrast[i]).toBeGreaterThan(withPositiveContrast[i - 1]);
      }
    });

    it('should work smoothly across range', () => {
      // Test that contrast produces reasonable values across the spectrum
      const testValue = 0.5;
      const contrastLevels = [-100, -50, 0, 50, 100];

      contrastLevels.forEach(contrast => {
        const result = applyContrast(testValue, contrast);
        // Result should stay within 0-1 range for SDR
        expect(result).toBeGreaterThanOrEqual(0.0);
        expect(result).toBeLessThanOrEqual(1.5); // Allow some HDR values
      });
    });

    it('should maintain monotonicity', () => {
      // Verify contrast maintains order (darker stays darker, lighter stays lighter)
      const values = [0.05, 0.1, 0.2, 0.5, 0.8, 0.9];
      const contrastResult = values.map(v => applyContrast(v, 75));

      for (let i = 1; i < contrastResult.length; i++) {
        expect(contrastResult[i]).toBeGreaterThan(contrastResult[i - 1]);
      }
    });
  });

  describe('Adjustment factors', () => {
    // Test highlights adjustment
    function applyHighlights(color: number, highlights: number): number {
      if (Math.abs(highlights) < 0.01) {
        return color;
      }

      const adjustment = highlights / 100.0;
      const mask = highlightMask(color);
      let factor = 1.0 + adjustment * mask * 0.7;
      factor = Math.max(0.4, Math.min(1.8, factor));
      return color * factor;
    }

    it('should not exceed clamp boundaries', () => {
      const testColors = [0.1, 0.5, 0.8, 0.95];
      const highlights = [100, -100];

      testColors.forEach(color => {
        highlights.forEach(h => {
          const result = applyHighlights(color, h);
          // Result should be in reasonable range
          expect(result).toBeGreaterThan(0.0);
          expect(result).toBeLessThan(2.0);
        });
      });
    });

    it('should handle zero adjustment', () => {
      expect(applyHighlights(0.5, 0)).toBe(0.5);
      expect(applyHighlights(0.8, 0)).toBe(0.8);
    });
  });
});
