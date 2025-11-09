/**
 * GeometricAdjustments Component Tests
 * Integration tests for crop and straighten tools
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { GeometricAdjustments } from './GeometricAdjustments';
import imageReducer from '../store/imageSlice';
import adjustmentsReducer from '../store/adjustmentsSlice';
import uiReducer from '../store/uiSlice';
import historyReducer from '../store/historySlice';
import presetReducer from '../store/presetSlice';
import type { CropBounds } from '../types/adjustments';

// Helper to create test store
function createTestStore(initialState = {}) {
  return configureStore({
    reducer: {
      image: imageReducer,
      adjustments: adjustmentsReducer,
      ui: uiReducer,
      history: historyReducer,
      presets: presetReducer,
    },
    preloadedState: initialState as any,
  });
}

describe('GeometricAdjustments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders crop and straighten controls', () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <GeometricAdjustments />
      </Provider>
    );

    expect(screen.getByText('Crop Image')).toBeInTheDocument();
    expect(screen.getByText('Straighten')).toBeInTheDocument();
  });

  it('activates crop tool when button is clicked', () => {
    const store = createTestStore({
      ui: {
        activeSection: 'basic',
        zoom: 1,
        pan: { x: 0, y: 0 },
        showHistogram: false,
        showComparison: false,
        isExportDialogOpen: false,
        activeTool: 'none',
        brushSize: 50,
      },
    });

    render(
      <Provider store={store}>
        <GeometricAdjustments />
      </Provider>
    );

    const cropButton = screen.getByText('Crop Image');
    fireEvent.click(cropButton);

    const state = store.getState();
    expect(state.ui.activeTool).toBe('crop');
  });

  it('displays crop dimensions when crop is active', () => {
    const cropBounds: CropBounds = {
      x: 100,
      y: 100,
      width: 800,
      height: 600,
      aspectRatio: null,
    };

    const store = createTestStore({
      adjustments: {
        crop: cropBounds,
        straighten: 0,
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
        sharpening: 0,
        clarity: 0,
        noiseReductionLuma: 0,
        noiseReductionColor: 0,
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
        vignette: { amount: 0, midpoint: 50, feather: 50 },
        grain: { amount: 0, size: 'medium' },
        removals: [],
      },
    });

    render(
      <Provider store={store}>
        <GeometricAdjustments />
      </Provider>
    );

    expect(screen.getByText('800 × 600 px')).toBeInTheDocument();
  });

  it('updates straighten angle when slider changes', () => {
    const store = createTestStore({
      adjustments: {
        straighten: 0,
        crop: null,
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
        sharpening: 0,
        clarity: 0,
        noiseReductionLuma: 0,
        noiseReductionColor: 0,
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
        vignette: { amount: 0, midpoint: 50, feather: 50 },
        grain: { amount: 0, size: 'medium' },
        removals: [],
      },
    });

    render(
      <Provider store={store}>
        <GeometricAdjustments />
      </Provider>
    );

    // Expand the collapsible section first
    const sectionHeader = screen.getByText('Crop & Straighten');
    fireEvent.click(sectionHeader);

    const slider = screen.getByLabelText('Straighten slider');
    fireEvent.change(slider, { target: { value: '15.5' } });

    const state = store.getState();
    expect(state.adjustments.straighten).toBe(15.5);
  });

  it('clamps straighten angle to valid range', () => {
    const store = createTestStore({
      adjustments: {
        straighten: 0,
        crop: null,
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
        sharpening: 0,
        clarity: 0,
        noiseReductionLuma: 0,
        noiseReductionColor: 0,
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
        vignette: { amount: 0, midpoint: 50, feather: 50 },
        grain: { amount: 0, size: 'medium' },
        removals: [],
      },
    });

    render(
      <Provider store={store}>
        <GeometricAdjustments />
      </Provider>
    );

    // Expand the collapsible section first
    const sectionHeader = screen.getByText('Crop & Straighten');
    fireEvent.click(sectionHeader);

    const slider = screen.getByLabelText('Straighten slider');

    // Test upper bound
    fireEvent.change(slider, { target: { value: '50' } });
    let state = store.getState();
    expect(state.adjustments.straighten).toBe(45); // Clamped to max

    // Test lower bound
    fireEvent.change(slider, { target: { value: '-50' } });
    state = store.getState();
    expect(state.adjustments.straighten).toBe(-45); // Clamped to min
  });

  it('shows active state when crop tool is active', () => {
    const store = createTestStore({
      ui: {
        activeSection: 'basic',
        zoom: 1,
        pan: { x: 0, y: 0 },
        showHistogram: false,
        showComparison: false,
        isExportDialogOpen: false,
        activeTool: 'crop',
        brushSize: 50,
      },
    });

    render(
      <Provider store={store}>
        <GeometricAdjustments />
      </Provider>
    );

    expect(screen.getByText('Crop Active')).toBeInTheDocument();
  });
});
