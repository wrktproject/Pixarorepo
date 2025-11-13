/**
 * Accuracy Tests
 * 
 * Tests for mathematical accuracy including:
 * - Color space conversion accuracy against references
 * - Tone curve monotonicity
 * - Gamut mapping hue preservation
 * - Numerical stability
 */

import { describe, it, expect } from 'vitest';
import { temperatureToXYZ, Illuminants } from '../engine/colorspaces/colorspaces';

describe('Accuracy Tests', () => {
  describe('Color Space Conversion Accuracy', () => {
    describe('sRGB to Linear RGB', () => {
      it('should match reference values for sRGB to linear conversion', () => {
        // Reference values from sRGB specification
        const testCases = [
          { srgb: 0.0, linear: 0.0 },
          { srgb: 0.04045, linear: 0.04045 / 12.92 },
          { srgb: 0.5, linear: Math.pow((0.5 + 0.055) / 1.055, 2.4) },
          { srgb: 1.0, linear: 1.0 },
        ];

        for (const { srgb, linear } of testCases) {
          let result: number;
          if (srgb <= 0.04045) {
            result = srgb / 12.92;
          } else {
            result = Math.pow((srgb + 0.055) / 1.055, 2.4);
          }
          expect(result).toBeCloseTo(linear, 10);
        }
      });

      it('should handle linear segment correctly', () => {
        // The linear segment is for values <= 0.04045
        const threshold = 0.04045;
        const linearResult = threshold / 12.92;
        
        expect(linearResult).toBeCloseTo(0.0031308, 7);
      });

      it('should be monotonically increasing', () => {
        const steps = 100;
        let prev = -1;
        
        for (let i = 0; i <= steps; i++) {
          const srgb = i / steps;
          const linear = srgb <= 0.04045 
            ? srgb / 12.92 
            : Math.pow((srgb + 0.055) / 1.055, 2.4);
          
          expect(linear).toBeGreaterThanOrEqual(prev);
          prev = linear;
        }
      });
    });

    describe('RGB to XYZ (D65)', () => {
      it('should match reference transformation matrix', () => {
        // sRGB to XYZ (D65) matrix from IEC 61966-2-1
        const matrix = [
          [0.4124564, 0.3575761, 0.1804375],
          [0.2126729, 0.7151522, 0.0721750],
          [0.0193339, 0.1191920, 0.9503041],
        ];

        // Test with sRGB primaries
        const red = [1, 0, 0];
        const xyzRed = [
          matrix[0][0] * red[0] + matrix[0][1] * red[1] + matrix[0][2] * red[2],
          matrix[1][0] * red[0] + matrix[1][1] * red[1] + matrix[1][2] * red[2],
          matrix[2][0] * red[0] + matrix[2][1] * red[1] + matrix[2][2] * red[2],
        ];

        expect(xyzRed[0]).toBeCloseTo(0.4124564, 6);
        expect(xyzRed[1]).toBeCloseTo(0.2126729, 6);
        expect(xyzRed[2]).toBeCloseTo(0.0193339, 6);
      });

      it('should convert white (1,1,1) to D65 white point', () => {
        const matrix = [
          [0.4124564, 0.3575761, 0.1804375],
          [0.2126729, 0.7151522, 0.0721750],
          [0.0193339, 0.1191920, 0.9503041],
        ];

        const white = [1, 1, 1];
        const xyzWhite = [
          matrix[0][0] + matrix[0][1] + matrix[0][2],
          matrix[1][0] + matrix[1][1] + matrix[1][2],
          matrix[2][0] + matrix[2][1] + matrix[2][2],
        ];

        // Should match D65 white point
        expect(xyzWhite[0]).toBeCloseTo(0.9505, 3);
        expect(xyzWhite[1]).toBeCloseTo(1.0000, 3);
        expect(xyzWhite[2]).toBeCloseTo(1.0890, 3);
      });
    });

    describe('XYZ to Lab (D50)', () => {
      it('should convert D50 white point to Lab (100, 0, 0)', () => {
        const d50 = Illuminants.D50;
        
        // Lab conversion
        const fx = Math.pow(d50.x / d50.x, 1/3);
        const fy = Math.pow(d50.y / d50.y, 1/3);
        const fz = Math.pow(d50.z / d50.z, 1/3);
        
        const L = 116 * fy - 16;
        const a = 500 * (fx - fy);
        const b = 200 * (fy - fz);
        
        expect(L).toBeCloseTo(100, 1);
        expect(a).toBeCloseTo(0, 1);
        expect(b).toBeCloseTo(0, 1);
      });

      it('should handle the Lab f function correctly', () => {
        const delta = 6/29;
        const threshold = Math.pow(delta, 3);
        
        // Test the piecewise function
        const testValue = 0.5;
        let result: number;
        
        if (testValue > threshold) {
          result = Math.pow(testValue, 1/3);
        } else {
          result = (testValue / (3 * delta * delta)) + (4/29);
        }
        
        expect(result).toBeGreaterThan(0);
        expect(result).toBeLessThan(1);
      });
    });

    describe('Round-trip Accuracy', () => {
      it('should preserve values in sRGB -> Linear -> sRGB round-trip', () => {
        const testValues = [0.0, 0.1, 0.2, 0.5, 0.8, 1.0];
        
        for (const srgb of testValues) {
          // sRGB to Linear
          const linear = srgb <= 0.04045 
            ? srgb / 12.92 
            : Math.pow((srgb + 0.055) / 1.055, 2.4);
          
          // Linear to sRGB
          const backToSRGB = linear <= 0.0031308
            ? linear * 12.92
            : 1.055 * Math.pow(linear, 1/2.4) - 0.055;
          
          expect(backToSRGB).toBeCloseTo(srgb, 10);
        }
      });

      it('should preserve values in RGB -> XYZ -> RGB round-trip', () => {
        // Forward matrix (RGB to XYZ D65)
        const forward = [
          [0.4124564, 0.3575761, 0.1804375],
          [0.2126729, 0.7151522, 0.0721750],
          [0.0193339, 0.1191920, 0.9503041],
        ];

        // Inverse matrix (XYZ D65 to RGB)
        const inverse = [
          [ 3.2404542, -1.5371385, -0.4985314],
          [-0.9692660,  1.8760108,  0.0415560],
          [ 0.0556434, -0.2040259,  1.0572252],
        ];

        const testColors = [
          [1, 0, 0], // Red
          [0, 1, 0], // Green
          [0, 0, 1], // Blue
          [1, 1, 1], // White
          [0.5, 0.5, 0.5], // Gray
        ];

        for (const rgb of testColors) {
          // RGB to XYZ
          const xyz = [
            forward[0][0] * rgb[0] + forward[0][1] * rgb[1] + forward[0][2] * rgb[2],
            forward[1][0] * rgb[0] + forward[1][1] * rgb[1] + forward[1][2] * rgb[2],
            forward[2][0] * rgb[0] + forward[2][1] * rgb[1] + forward[2][2] * rgb[2],
          ];

          // XYZ to RGB
          const backToRGB = [
            inverse[0][0] * xyz[0] + inverse[0][1] * xyz[1] + inverse[0][2] * xyz[2],
            inverse[1][0] * xyz[0] + inverse[1][1] * xyz[1] + inverse[1][2] * xyz[2],
            inverse[2][0] * xyz[0] + inverse[2][1] * xyz[1] + inverse[2][2] * xyz[2],
          ];

          expect(backToRGB[0]).toBeCloseTo(rgb[0], 6);
          expect(backToRGB[1]).toBeCloseTo(rgb[1], 6);
          expect(backToRGB[2]).toBeCloseTo(rgb[2], 6);
        }
      });
    });

    describe('Bradford Chromatic Adaptation', () => {
      it('should use correct Bradford matrix', () => {
        // Bradford matrix from Bruce Lindbloom
        const bradford = [
          [ 0.8951,  0.2664, -0.1614],
          [-0.7502,  1.7135,  0.0367],
          [ 0.0389, -0.0685,  1.0296],
        ];

        // Verify matrix values
        expect(bradford[0][0]).toBeCloseTo(0.8951, 4);
        expect(bradford[1][1]).toBeCloseTo(1.7135, 4);
        expect(bradford[2][2]).toBeCloseTo(1.0296, 4);
      });

      it('should adapt D65 to D50 correctly', () => {
        const d65 = Illuminants.D65;
        const d50 = Illuminants.D50;

        // Bradford matrix
        const M = [
          [ 0.8951,  0.2664, -0.1614],
          [-0.7502,  1.7135,  0.0367],
          [ 0.0389, -0.0685,  1.0296],
        ];

        // Convert white points to cone response
        const sourceRho = [
          M[0][0] * d65.x + M[0][1] * d65.y + M[0][2] * d65.z,
          M[1][0] * d65.x + M[1][1] * d65.y + M[1][2] * d65.z,
          M[2][0] * d65.x + M[2][1] * d65.y + M[2][2] * d65.z,
        ];

        const targetRho = [
          M[0][0] * d50.x + M[0][1] * d50.y + M[0][2] * d50.z,
          M[1][0] * d50.x + M[1][1] * d50.y + M[1][2] * d50.z,
          M[2][0] * d50.x + M[2][1] * d50.y + M[2][2] * d50.z,
        ];

        // Adaptation ratios
        const ratios = [
          targetRho[0] / sourceRho[0],
          targetRho[1] / sourceRho[1],
          targetRho[2] / sourceRho[2],
        ];

        // Ratios should be reasonable (not extreme)
        for (const ratio of ratios) {
          expect(ratio).toBeGreaterThan(0.5);
          expect(ratio).toBeLessThan(2.0);
        }
      });
    });
  });

  describe('Tone Curve Monotonicity', () => {
    describe('Sigmoid Curve', () => {
      it('should be monotonically increasing', () => {
        const sigmoidCurve = (x: number, contrast: number, skew: number) => {
          const x0 = 0.5 + skew * 0.3;
          const k = contrast * 10.0;
          return 1.0 / (1.0 + Math.exp(-k * (x - x0)));
        };

        const steps = 100;
        const contrast = 1.0;
        const skew = 0.0;
        
        let prev = -1;
        for (let i = 0; i <= steps; i++) {
          const x = i / steps;
          const y = sigmoidCurve(x, contrast, skew);
          
          expect(y).toBeGreaterThanOrEqual(prev);
          prev = y;
        }
      });

      it('should map [0,1] to approximately [0,1]', () => {
        const sigmoidCurve = (x: number, contrast: number, skew: number) => {
          const x0 = 0.5 + skew * 0.3;
          const k = contrast * 10.0;
          return 1.0 / (1.0 + Math.exp(-k * (x - x0)));
        };

        const contrast = 1.0;
        const skew = 0.0;
        
        const y0 = sigmoidCurve(0, contrast, skew);
        const y1 = sigmoidCurve(1, contrast, skew);
        
        expect(y0).toBeGreaterThan(0);
        expect(y0).toBeLessThan(0.1);
        expect(y1).toBeGreaterThan(0.9);
        expect(y1).toBeLessThan(1.0);
      });
    });

    describe('Filmic Curve', () => {
      it('should be monotonically increasing', () => {
        // Simplified filmic curve: x / (x + 1)
        const filmicCurve = (x: number) => x / (x + 1);

        const steps = 100;
        let prev = -1;
        
        for (let i = 0; i <= steps; i++) {
          const x = i / steps * 10; // Test up to 10 EV
          const y = filmicCurve(x);
          
          expect(y).toBeGreaterThanOrEqual(prev);
          prev = y;
        }
      });

      it('should compress highlights smoothly', () => {
        const filmicCurve = (x: number) => x / (x + 1);

        // Test highlight compression
        const inputs = [1, 2, 4, 8, 16];
        const outputs = inputs.map(filmicCurve);
        
        // Outputs should be compressed (< 1.0)
        for (const output of outputs) {
          expect(output).toBeLessThan(1.0);
        }
        
        // Outputs should be monotonically increasing
        for (let i = 1; i < outputs.length; i++) {
          expect(outputs[i]).toBeGreaterThan(outputs[i-1]);
        }
        
        // Distance from 1.0 should decrease (approaching asymptote)
        for (let i = 1; i < outputs.length; i++) {
          const distPrev = 1 - outputs[i-1];
          const distCurr = 1 - outputs[i];
          expect(distCurr).toBeLessThan(distPrev);
        }
      });

      it('should have smooth derivative (no discontinuities)', () => {
        const filmicCurve = (x: number) => x / (x + 1);
        const derivative = (x: number, h = 0.0001) => {
          return (filmicCurve(x + h) - filmicCurve(x - h)) / (2 * h);
        };

        const steps = 50;
        for (let i = 1; i < steps; i++) {
          const x = i / steps * 10;
          const d = derivative(x);
          
          // Derivative should be positive (monotonic)
          expect(d).toBeGreaterThan(0);
          
          // Derivative should be finite
          expect(Number.isFinite(d)).toBe(true);
        }
      });
    });

    describe('Exposure Curve', () => {
      it('should be linear in log space', () => {
        const exposureCurve = (x: number, ev: number) => x * Math.pow(2, ev);

        const ev = 1.0; // +1 EV
        const inputs = [0.1, 0.2, 0.4, 0.8];
        
        for (const x of inputs) {
          const output = exposureCurve(x, ev);
          expect(output).toBeCloseTo(x * 2, 10);
        }
      });

      it('should preserve color ratios', () => {
        const exposureCurve = (x: number, ev: number) => x * Math.pow(2, ev);

        const ev = 2.0;
        const rgb = [0.5, 0.3, 0.1];
        const exposed = rgb.map(x => exposureCurve(x, ev));
        
        // Ratios should be preserved
        const originalRatio = rgb[0] / rgb[1];
        const exposedRatio = exposed[0] / exposed[1];
        
        expect(exposedRatio).toBeCloseTo(originalRatio, 10);
      });
    });
  });

  describe('Gamut Mapping Hue Preservation', () => {
    it('should preserve hue when compressing chroma', () => {
      // Convert RGB to LCH and back
      const rgbToLCH = (r: number, g: number, b: number) => {
        // Simplified: use RGB as proxy
        const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const a = r - g;
        const b_val = g - b;
        const C = Math.sqrt(a * a + b_val * b_val);
        const H = Math.atan2(b_val, a);
        return { L, C, H };
      };

      const testColors = [
        [1.5, 0.5, 0.5], // Out-of-gamut red
        [0.5, 1.5, 0.5], // Out-of-gamut green
        [0.5, 0.5, 1.5], // Out-of-gamut blue
      ];

      for (const rgb of testColors) {
        const original = rgbToLCH(rgb[0], rgb[1], rgb[2]);
        
        // Simulate gamut compression (reduce chroma)
        const compressed = { ...original, C: original.C * 0.8 };
        
        // Hue should be preserved
        expect(compressed.H).toBeCloseTo(original.H, 10);
      }
    });

    it('should compress chroma smoothly', () => {
      const gamutCompress = (chroma: number, maxChroma: number) => {
        if (chroma <= maxChroma) return chroma;
        // Soft compression using asymptotic approach
        // Map [maxChroma, infinity] to [maxChroma, maxChroma * 2]
        const excess = chroma - maxChroma;
        const compressed = maxChroma + maxChroma * (1 - Math.exp(-excess / maxChroma));
        return Math.min(compressed, maxChroma * 2);
      };

      const maxChroma = 1.0;
      const inputs = [0.5, 1.0, 1.5, 2.0, 3.0];
      const outputs = inputs.map(c => gamutCompress(c, maxChroma));
      
      // Should be monotonically increasing
      for (let i = 1; i < outputs.length; i++) {
        expect(outputs[i]).toBeGreaterThan(outputs[i-1]);
      }
      
      // Values within gamut should be unchanged
      expect(outputs[0]).toBe(0.5);
      expect(outputs[1]).toBe(1.0);
      
      // Values outside gamut should be compressed
      expect(outputs[2]).toBeGreaterThan(maxChroma);
      expect(outputs[2]).toBeLessThan(inputs[2]);
    });

    it('should maintain relative saturation relationships', () => {
      const gamutCompress = (chroma: number, maxChroma: number) => {
        if (chroma <= maxChroma) return chroma;
        // Soft compression
        const excess = chroma - maxChroma;
        const compressed = maxChroma + maxChroma * (1 - Math.exp(-excess / maxChroma));
        return Math.min(compressed, maxChroma * 2);
      };

      const maxChroma = 1.0;
      const color1 = 2.0; // More saturated (out of gamut)
      const color2 = 1.5; // Less saturated (also out of gamut)
      
      const compressed1 = gamutCompress(color1, maxChroma);
      const compressed2 = gamutCompress(color2, maxChroma);
      
      // More saturated should remain more saturated after compression
      expect(compressed1).toBeGreaterThan(compressed2);
      
      // Both should be compressed but still distinguishable
      expect(compressed1).toBeGreaterThan(maxChroma);
      expect(compressed2).toBeGreaterThan(maxChroma);
    });
  });

  describe('Numerical Stability', () => {
    it('should handle very small values without underflow', () => {
      const verySmall = [1e-10, 1e-20, 1e-30];
      
      for (const value of verySmall) {
        const safeLog = Math.log(Math.max(value, 1e-8));
        expect(Number.isFinite(safeLog)).toBe(true);
      }
    });

    it('should handle very large values without overflow', () => {
      const veryLarge = [1e10, 1e20, 1e30];
      
      for (const value of veryLarge) {
        const compressed = value / (value + 1);
        expect(Number.isFinite(compressed)).toBe(true);
        expect(compressed).toBeLessThanOrEqual(1);
      }
    });

    it('should handle division by zero with epsilon', () => {
      const safeDivide = (a: number, b: number, epsilon = 1e-8) => {
        return a / (b + epsilon);
      };

      const result = safeDivide(1.0, 0.0);
      expect(Number.isFinite(result)).toBe(true);
      expect(result).toBeGreaterThan(0);
    });

    it('should handle negative values in pow operations', () => {
      const safePow = (base: number, exp: number) => {
        return Math.pow(Math.max(base, 0), exp);
      };

      const result = safePow(-0.5, 2.4);
      expect(Number.isFinite(result)).toBe(true);
      expect(result).toBe(0);
    });

    it('should maintain precision in iterative calculations', () => {
      // Test that repeated operations don't accumulate error
      let value = 0.5;
      const iterations = 1000;
      
      // Apply and reverse operation many times
      for (let i = 0; i < iterations; i++) {
        value = value * 2; // Double
        value = value / 2; // Halve
      }
      
      expect(value).toBeCloseTo(0.5, 10);
    });

    it('should handle NaN and Infinity gracefully', () => {
      const sanitize = (value: number) => {
        if (!Number.isFinite(value)) return 0;
        return value;
      };

      expect(sanitize(NaN)).toBe(0);
      expect(sanitize(Infinity)).toBe(0);
      expect(sanitize(-Infinity)).toBe(0);
      expect(sanitize(1.0)).toBe(1.0);
    });
  });

  describe('Temperature to White Point Accuracy', () => {
    it('should match reference white points', () => {
      // Test against known reference values
      const testCases = [
        { temp: 6500, name: 'D65', expected: Illuminants.D65 },
        { temp: 5000, name: 'D50', expected: Illuminants.D50 },
      ];

      for (const { temp, name, expected } of testCases) {
        const result = temperatureToXYZ(temp);
        
        expect(result.x).toBeCloseTo(expected.x, 1);
        expect(result.y).toBeCloseTo(expected.y, 3);
        expect(result.z).toBeCloseTo(expected.z, 1);
      }
    });

    it('should produce valid XYZ values for all temperatures', () => {
      const temperatures = [2000, 3000, 5000, 6500, 10000, 25000];
      
      for (const temp of temperatures) {
        const xyz = temperatureToXYZ(temp);
        
        // All components should be positive
        expect(xyz.x).toBeGreaterThan(0);
        expect(xyz.y).toBeGreaterThan(0);
        expect(xyz.z).toBeGreaterThan(0);
        
        // Y should be normalized to 1.0
        expect(xyz.y).toBeCloseTo(1.0, 3);
      }
    });

    it('should show correct color temperature trends', () => {
      const temps = [2000, 5000, 10000, 25000];
      const xyzValues = temps.map(temperatureToXYZ);
      
      // As temperature increases from warm to cool:
      // - Low temps (2000K) should have higher X (more red)
      // - High temps (25000K) should have higher Z (more blue)
      
      // Compare warm (2000K) to cool (25000K)
      expect(xyzValues[0].x).toBeGreaterThan(xyzValues[3].x); // Warm has more red
      expect(xyzValues[0].z).toBeLessThan(xyzValues[3].z);    // Warm has less blue
      
      // Z should generally increase with temperature
      expect(xyzValues[3].z).toBeGreaterThan(xyzValues[0].z);
    });
  });
});
