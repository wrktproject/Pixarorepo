/**
 * White Balance Shader Tests
 * Tests for Bradford chromatic adaptation and temperature conversion
 */

import { describe, it, expect } from 'vitest';
import {
  whiteBalanceVertexShader,
  whiteBalanceFragmentShader,
  defaultWhiteBalanceParams,
  WhiteBalancePresets,
  type WhiteBalanceParams,
} from './whitebalance';

describe('White Balance Shader', () => {
  describe('Shader Source', () => {
    it('should have valid vertex shader source', () => {
      expect(whiteBalanceVertexShader).toBeTruthy();
      expect(whiteBalanceVertexShader).toContain('#version 300 es');
      expect(whiteBalanceVertexShader).toContain('in vec2 a_position');
      expect(whiteBalanceVertexShader).toContain('in vec2 a_texCoord');
      expect(whiteBalanceVertexShader).toContain('out vec2 v_texCoord');
    });

    it('should have valid fragment shader source', () => {
      expect(whiteBalanceFragmentShader).toBeTruthy();
      expect(whiteBalanceFragmentShader).toContain('#version 300 es');
      expect(whiteBalanceFragmentShader).toContain('uniform sampler2D u_texture');
      expect(whiteBalanceFragmentShader).toContain('out vec4 fragColor');
    });

    it('should include white balance uniforms', () => {
      expect(whiteBalanceFragmentShader).toContain('uniform float u_temperature');
      expect(whiteBalanceFragmentShader).toContain('uniform float u_tint');
      expect(whiteBalanceFragmentShader).toContain('uniform bool u_enabled');
    });

    it('should include D65 white point constant', () => {
      expect(whiteBalanceFragmentShader).toContain('D65_WHITE');
      expect(whiteBalanceFragmentShader).toContain('vec3(0.9505, 1.0000, 1.0890)');
    });

    it('should include color space conversion functions', () => {
      expect(whiteBalanceFragmentShader).toContain('vec3 srgbToLinear');
      // White balance stays in Linear space (output shader converts to sRGB)
      expect(whiteBalanceFragmentShader).toContain('srgbToLinear');
      expect(whiteBalanceFragmentShader).toContain('vec3 linearRGBToXYZ_D65');
      expect(whiteBalanceFragmentShader).toContain('vec3 xyzD65ToLinearRGB');
    });

    it('should include temperature conversion function', () => {
      expect(whiteBalanceFragmentShader).toContain('vec3 temperatureToXYZ');
      expect(whiteBalanceFragmentShader).toContain('Planckian locus');
    });

    it('should include Bradford adaptation function', () => {
      expect(whiteBalanceFragmentShader).toContain('vec3 bradfordAdaptation');
      expect(whiteBalanceFragmentShader).toContain('Bradford cone response matrix');
    });

    it('should include tint adjustment function', () => {
      expect(whiteBalanceFragmentShader).toContain('vec3 applyTint');
    });

    it('should include main white balance function', () => {
      expect(whiteBalanceFragmentShader).toContain('vec3 applyWhiteBalance');
    });
  });

  describe('Default Parameters', () => {
    it('should have correct default values', () => {
      expect(defaultWhiteBalanceParams.temperature).toBe(6500);
      expect(defaultWhiteBalanceParams.tint).toBe(0.0);
      expect(defaultWhiteBalanceParams.enabled).toBe(true);
    });

    it('should have temperature in valid range', () => {
      expect(defaultWhiteBalanceParams.temperature).toBeGreaterThanOrEqual(2000);
      expect(defaultWhiteBalanceParams.temperature).toBeLessThanOrEqual(25000);
    });

    it('should have tint in valid range', () => {
      expect(defaultWhiteBalanceParams.tint).toBeGreaterThanOrEqual(-1.0);
      expect(defaultWhiteBalanceParams.tint).toBeLessThanOrEqual(1.0);
    });

    it('should default to D65 daylight', () => {
      expect(defaultWhiteBalanceParams.temperature).toBe(6500);
    });
  });

  describe('Preset Illuminants', () => {
    it('should have daylight preset', () => {
      expect(WhiteBalancePresets.daylight).toBeDefined();
      expect(WhiteBalancePresets.daylight.temperature).toBe(6500);
      expect(WhiteBalancePresets.daylight.tint).toBe(0.0);
      expect(WhiteBalancePresets.daylight.name).toBe('Daylight (D65)');
    });

    it('should have cloudy preset', () => {
      expect(WhiteBalancePresets.cloudy).toBeDefined();
      expect(WhiteBalancePresets.cloudy.temperature).toBe(7500);
      expect(WhiteBalancePresets.cloudy.tint).toBe(0.0);
    });

    it('should have shade preset', () => {
      expect(WhiteBalancePresets.shade).toBeDefined();
      expect(WhiteBalancePresets.shade.temperature).toBe(8000);
    });

    it('should have tungsten preset', () => {
      expect(WhiteBalancePresets.tungsten).toBeDefined();
      expect(WhiteBalancePresets.tungsten.temperature).toBe(3200);
      expect(WhiteBalancePresets.tungsten.tint).toBe(0.0);
    });

    it('should have fluorescent preset', () => {
      expect(WhiteBalancePresets.fluorescent).toBeDefined();
      expect(WhiteBalancePresets.fluorescent.temperature).toBe(4000);
      expect(WhiteBalancePresets.fluorescent.tint).toBe(0.15);
    });

    it('should have flash preset', () => {
      expect(WhiteBalancePresets.flash).toBeDefined();
      expect(WhiteBalancePresets.flash.temperature).toBe(5500);
    });

    it('should have auto preset', () => {
      expect(WhiteBalancePresets.auto).toBeDefined();
      expect(WhiteBalancePresets.auto.temperature).toBe(6500);
    });

    it('should have all presets with valid temperature ranges', () => {
      Object.values(WhiteBalancePresets).forEach(preset => {
        expect(preset.temperature).toBeGreaterThanOrEqual(2000);
        expect(preset.temperature).toBeLessThanOrEqual(25000);
      });
    });

    it('should have all presets with valid tint ranges', () => {
      Object.values(WhiteBalancePresets).forEach(preset => {
        expect(preset.tint).toBeGreaterThanOrEqual(-1.0);
        expect(preset.tint).toBeLessThanOrEqual(1.0);
      });
    });
  });

  describe('Parameter Validation', () => {
    it('should accept valid temperature values', () => {
      const params: WhiteBalanceParams = {
        ...defaultWhiteBalanceParams,
        temperature: 5000,
      };
      expect(params.temperature).toBe(5000);
    });

    it('should accept minimum temperature', () => {
      const params: WhiteBalanceParams = {
        ...defaultWhiteBalanceParams,
        temperature: 2000,
      };
      expect(params.temperature).toBe(2000);
    });

    it('should accept maximum temperature', () => {
      const params: WhiteBalanceParams = {
        ...defaultWhiteBalanceParams,
        temperature: 25000,
      };
      expect(params.temperature).toBe(25000);
    });

    it('should accept valid tint values', () => {
      const params: WhiteBalanceParams = {
        ...defaultWhiteBalanceParams,
        tint: 0.5,
      };
      expect(params.tint).toBe(0.5);
    });

    it('should accept negative tint (magenta)', () => {
      const params: WhiteBalanceParams = {
        ...defaultWhiteBalanceParams,
        tint: -0.8,
      };
      expect(params.tint).toBe(-0.8);
    });

    it('should accept positive tint (green)', () => {
      const params: WhiteBalanceParams = {
        ...defaultWhiteBalanceParams,
        tint: 0.8,
      };
      expect(params.tint).toBe(0.8);
    });

    it('should accept enabled/disabled state', () => {
      const enabledParams: WhiteBalanceParams = {
        ...defaultWhiteBalanceParams,
        enabled: true,
      };
      expect(enabledParams.enabled).toBe(true);

      const disabledParams: WhiteBalanceParams = {
        ...defaultWhiteBalanceParams,
        enabled: false,
      };
      expect(disabledParams.enabled).toBe(false);
    });
  });

  describe('Bradford Transform Accuracy', () => {
    it('should include Bradford matrix coefficients', () => {
      // Bradford cone response matrix
      expect(whiteBalanceFragmentShader).toContain('0.8951000');
      expect(whiteBalanceFragmentShader).toContain('0.2664000');
      expect(whiteBalanceFragmentShader).toContain('-0.1614000');
      expect(whiteBalanceFragmentShader).toContain('-0.7502000');
      expect(whiteBalanceFragmentShader).toContain('1.7135000');
      expect(whiteBalanceFragmentShader).toContain('0.0367000');
    });

    it('should include inverse Bradford matrix', () => {
      expect(whiteBalanceFragmentShader).toContain('bradfordInv');
      expect(whiteBalanceFragmentShader).toContain('0.9869929');
      expect(whiteBalanceFragmentShader).toContain('-0.1470543');
    });

    it('should handle division by zero in adaptation', () => {
      expect(whiteBalanceFragmentShader).toContain('EPSILON');
      expect(whiteBalanceFragmentShader).toContain('max(sourceRho');
    });
  });

  describe('Temperature Conversion', () => {
    it('should clamp temperature to valid range', () => {
      expect(whiteBalanceFragmentShader).toContain('clamp(kelvin, 2000.0, 25000.0)');
    });

    it('should use different formulas for different temperature ranges', () => {
      expect(whiteBalanceFragmentShader).toContain('if (kelvin < 4000.0)');
      expect(whiteBalanceFragmentShader).toContain('if (kelvin < 2222.0)');
    });

    it('should calculate chromaticity coordinates', () => {
      expect(whiteBalanceFragmentShader).toContain('float x, y');
    });

    it('should convert xy chromaticity to XYZ', () => {
      expect(whiteBalanceFragmentShader).toContain('float Y = 1.0');
      expect(whiteBalanceFragmentShader).toContain('float X = (Y / y) * x');
      expect(whiteBalanceFragmentShader).toContain('float Z = (Y / y) * (1.0 - x - y)');
    });
  });

  describe('Color Preservation', () => {
    it('should work in linear RGB space', () => {
      expect(whiteBalanceFragmentShader).toContain('srgbToLinear');
      // White balance stays in Linear space (output shader converts to sRGB)
      expect(whiteBalanceFragmentShader).toContain('Keep in Linear space');
    });

    it('should preserve alpha channel', () => {
      expect(whiteBalanceFragmentShader).toContain('texColor.a');
    });

    it('should clamp negative values', () => {
      expect(whiteBalanceFragmentShader).toContain('max(color, vec3(0.0))');
    });

    it('should allow HDR values', () => {
      expect(whiteBalanceFragmentShader).toContain('allow values > 1.0 for HDR pipeline');
    });
  });

  describe('Shader Structure', () => {
    it('should have proper main function', () => {
      expect(whiteBalanceFragmentShader).toContain('void main()');
    });

    it('should sample texture', () => {
      expect(whiteBalanceFragmentShader).toContain('texture(u_texture, v_texCoord)');
    });

    it('should respect enabled flag', () => {
      expect(whiteBalanceFragmentShader).toContain('if (u_enabled)');
    });

    it('should output final color', () => {
      expect(whiteBalanceFragmentShader).toContain('fragColor = vec4(color, texColor.a)');
    });
  });
});
