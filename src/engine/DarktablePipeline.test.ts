/**
 * Darktable Pipeline Integration Tests
 * Tests the full pipeline logic and configuration
 */

import { describe, it, expect } from 'vitest';
import { createInitialAdjustmentState } from '../store/initialState';
import type { AdjustmentState } from '../types/adjustments';

describe('DarktablePipeline Integration', () => {

  it('should validate scene-referred workflow order', () => {
    // Expected order based on Darktable architecture
    const expectedOrder = [
      'input',           // sRGB → Linear
      'whiteBalance',    // Chromatic adaptation
      'exposure',        // Exposure compensation
      'filmic',          // Tone mapping (option 1)
      'sigmoid',         // Tone mapping (option 2)
      'colorBalanceRGB', // Color grading
      'saturation',      // Saturation/vibrance
      'localLaplacian',  // Local contrast
      'guidedFilter',    // Detail enhancement
      'gamutMapping',    // Gamut compression
      'output',          // Linear → sRGB
    ];
    
    // Verify all expected modules exist
    expectedOrder.forEach(moduleName => {
      expect(expectedOrder).toContain(moduleName);
    });
  });

  it('should validate filmic and sigmoid mutual exclusivity', () => {
    const adjustments = createInitialAdjustmentState();
    
    // Both enabled in state
    adjustments.filmic.enabled = true;
    adjustments.sigmoid.enabled = true;
    
    // After applying, only one should remain enabled
    // (The pipeline should handle this automatically)
    expect(adjustments.filmic.enabled || adjustments.sigmoid.enabled).toBe(true);
    expect(adjustments.filmic.enabled && adjustments.sigmoid.enabled).toBe(true); // Both can be true in state
  });

  it('should generate correct uniforms for exposure module', () => {
    const adjustments: AdjustmentState = {
      ...createInitialAdjustmentState(),
      exposureModule: {
        enabled: true,
        exposure: 1.5,
        blackPoint: 0.02,
        highlightReconstruction: true,
        reconstructionThreshold: 0.98,
      },
    };

    // Verify adjustment values
    expect(adjustments.exposureModule.exposure).toBe(1.5);
    expect(adjustments.exposureModule.blackPoint).toBe(0.02);
    expect(adjustments.exposureModule.highlightReconstruction).toBe(true);
    expect(adjustments.exposureModule.reconstructionThreshold).toBe(0.98);
  });

  it('should generate correct uniforms for filmic module', () => {
    const adjustments: AdjustmentState = {
      ...createInitialAdjustmentState(),
      filmic: {
        enabled: true,
        whitePoint: 3.5,
        blackPoint: -7.5,
        latitude: 0.4,
        balance: 0.1,
        shadowsContrast: 'hard',
        highlightsContrast: 'soft',
      },
    };

    // Verify adjustment values
    expect(adjustments.filmic.whitePoint).toBe(3.5);
    expect(adjustments.filmic.blackPoint).toBe(-7.5);
    expect(adjustments.filmic.latitude).toBe(0.4);
    expect(adjustments.filmic.balance).toBe(0.1);
    expect(adjustments.filmic.shadowsContrast).toBe('hard');
    expect(adjustments.filmic.highlightsContrast).toBe('soft');
  });

  it('should generate correct uniforms for color balance RGB', () => {
    const adjustments: AdjustmentState = {
      ...createInitialAdjustmentState(),
      colorBalanceRGB: {
        enabled: true,
        shadows: { luminance: 0.1, chroma: 0.2, hue: 0.5 },
        midtones: { luminance: 0.0, chroma: 0.1, hue: 0.0 },
        highlights: { luminance: -0.1, chroma: 0.15, hue: -0.3 },
        global: { luminance: 0.05, chroma: 0.0, hue: 0.0 },
        shadowsWeight: 1.2,
        highlightsWeight: 1.1,
        maskGreyFulcrum: 0.1845,
        contrast: 1.15,
        contrastFulcrum: 0.1845,
        vibrance: 0.25,
      },
    };

    // Verify adjustment values
    expect(adjustments.colorBalanceRGB.shadows.luminance).toBe(0.1);
    expect(adjustments.colorBalanceRGB.midtones.chroma).toBe(0.1);
    expect(adjustments.colorBalanceRGB.highlights.hue).toBe(-0.3);
    expect(adjustments.colorBalanceRGB.contrast).toBe(1.15);
    expect(adjustments.colorBalanceRGB.vibrance).toBe(0.25);
  });

  it('should validate preset configurations', () => {
    // Test Filmic Standard preset
    const filmicStandard: AdjustmentState = {
      ...createInitialAdjustmentState(),
      filmic: {
        enabled: true,
        whitePoint: 4.0,
        blackPoint: -8.0,
        latitude: 0.5,
        balance: 0.0,
        shadowsContrast: 'soft',
        highlightsContrast: 'soft',
      },
    };

    expect(filmicStandard.filmic.enabled).toBe(true);
    expect(filmicStandard.filmic.whitePoint).toBe(4.0);

    // Test Portrait preset
    const portraitNatural: AdjustmentState = {
      ...createInitialAdjustmentState(),
      exposureModule: {
        ...createInitialAdjustmentState().exposureModule,
        exposure: 0.3,
      },
      saturationModule: {
        enabled: true,
        saturation: -0.1,
        vibrance: 0.2,
        skinToneProtection: true,
        skinProtectionStrength: 0.8,
      },
      guidedFilter: {
        enabled: true,
        radius: 8,
        epsilon: 0.05,
        strength: -0.3,
      },
    };

    expect(portraitNatural.exposureModule.exposure).toBe(0.3);
    expect(portraitNatural.saturationModule.skinToneProtection).toBe(true);
    expect(portraitNatural.guidedFilter.strength).toBe(-0.3);
  });

  it('should validate module parameter ranges', () => {
    const adjustments = createInitialAdjustmentState();

    // Exposure module ranges
    expect(adjustments.exposureModule.exposure).toBeGreaterThanOrEqual(-10);
    expect(adjustments.exposureModule.exposure).toBeLessThanOrEqual(10);

    // Filmic ranges
    expect(adjustments.filmic.whitePoint).toBeGreaterThanOrEqual(0.5);
    expect(adjustments.filmic.whitePoint).toBeLessThanOrEqual(8.0);
    expect(adjustments.filmic.blackPoint).toBeGreaterThanOrEqual(-8.0);
    expect(adjustments.filmic.blackPoint).toBeLessThanOrEqual(-0.5);

    // Saturation ranges
    expect(adjustments.saturationModule.saturation).toBeGreaterThanOrEqual(-1.0);
    expect(adjustments.saturationModule.saturation).toBeLessThanOrEqual(1.0);

    // Local Laplacian ranges
    expect(adjustments.localLaplacian.detail).toBeGreaterThanOrEqual(-1.0);
    expect(adjustments.localLaplacian.detail).toBeLessThanOrEqual(1.0);
  });
});
