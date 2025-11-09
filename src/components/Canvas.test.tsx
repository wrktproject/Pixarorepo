/**
 * Canvas Component Tests
 * Integration tests for Canvas rendering, zoom, pan, and comparison mode
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Canvas } from './Canvas';
import imageReducer from '../store/imageSlice';
import adjustmentsReducer from '../store/adjustmentsSlice';
import uiReducer from '../store/uiSlice';
import historyReducer from '../store/historySlice';
import presetReducer from '../store/presetSlice';

// Mock WebGLContextManager
vi.mock('../engine/webglContext', () => ({
  WebGLContextManager: class MockWebGLContextManager {
    getContext() {
      return {} as WebGL2RenderingContext;
    }
    dispose() {}
  },
}));

// Mock ShaderPipeline
vi.mock('../engine/shaderPipeline', () => ({
  ShaderPipeline: class MockShaderPipeline {
    loadImage() {}
    render() {}
    getPreviewDimensions() {
      return { width: 800, height: 600 };
    }
    getImageDimensions() {
      return { width: 1920, height: 1080 };
    }
    dispose() {}
  },
}));

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

// Helper to create test image data
function createTestImageData(width = 100, height = 100): ImageData {
  // Create a simple ImageData object without canvas
  const data = new Uint8ClampedArray(width * height * 4);
  return {
    data,
    width,
    height,
    colorSpace: 'srgb',
  } as ImageData;
}

describe('Canvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders placeholder when no image is loaded', () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <Canvas />
      </Provider>
    );

    expect(screen.getByText('No image loaded')).toBeInTheDocument();
    expect(screen.getByText('Upload an image to start editing')).toBeInTheDocument();
  });

  it('renders canvas when image is loaded', () => {
    const imageData = createTestImageData();
    const store = createTestStore({
      image: {
        original: {
          data: imageData,
          width: 100,
          height: 100,
          colorSpace: 'srgb',
        },
        current: {
          data: imageData,
          width: 100,
          height: 100,
          colorSpace: 'srgb',
        },
        metadata: null,
        isLoading: false,
      },
    });

    render(
      <Provider store={store}>
        <Canvas />
      </Provider>
    );

    expect(screen.queryByText('No image loaded')).not.toBeInTheDocument();
    const canvas = document.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('displays zoom controls', () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <Canvas />
      </Provider>
    );

    expect(screen.getByTitle('Fit to screen')).toBeInTheDocument();
    expect(screen.getByTitle('Reset view (100%)')).toBeInTheDocument();
    // Check for zoom display in the controls area
    const zoomDisplay = document.querySelector('span[class*="zoomDisplay"]');
    expect(zoomDisplay).toBeInTheDocument();
  });

  it('updates zoom display when zoom changes', () => {
    const store = createTestStore({
      ui: {
        zoom: 2.5,
        pan: { x: 0, y: 0 },
        showHistogram: false,
        showComparison: false,
        isExportDialogOpen: false,
        activeTool: 'none',
        brushSize: 50,
        activeSection: 'basic',
      },
    });

    render(
      <Provider store={store}>
        <Canvas />
      </Provider>
    );

    expect(screen.getByText('250%')).toBeInTheDocument();
  });

  it('displays comparison controls when image is loaded', () => {
    const imageData = createTestImageData();
    const store = createTestStore({
      image: {
        original: {
          data: imageData,
          width: 100,
          height: 100,
          colorSpace: 'srgb',
        },
        current: {
          data: imageData,
          width: 100,
          height: 100,
          colorSpace: 'srgb',
        },
        metadata: null,
        isLoading: false,
      },
    });

    render(
      <Provider store={store}>
        <Canvas />
      </Provider>
    );

    expect(screen.getByTitle('Toggle before/after (Spacebar)')).toBeInTheDocument();
    expect(screen.getByTitle('Toggle split view')).toBeInTheDocument();
  });

  it('toggles comparison mode when button is clicked', () => {
    const imageData = createTestImageData();
    const store = createTestStore({
      image: {
        original: {
          data: imageData,
          width: 100,
          height: 100,
          colorSpace: 'srgb',
        },
        current: {
          data: imageData,
          width: 100,
          height: 100,
          colorSpace: 'srgb',
        },
        metadata: null,
        isLoading: false,
      },
      ui: {
        zoom: 1,
        pan: { x: 0, y: 0 },
        showHistogram: false,
        showComparison: false,
        isExportDialogOpen: false,
        activeTool: 'none',
        brushSize: 50,
        activeSection: 'basic',
      },
    });

    render(
      <Provider store={store}>
        <Canvas />
      </Provider>
    );

    const comparisonButton = screen.getByTitle('Toggle before/after (Spacebar)');
    expect(comparisonButton).toHaveTextContent('After');

    fireEvent.click(comparisonButton);

    const state = store.getState();
    expect(state.ui.showComparison).toBe(true);
  });

  it('displays histogram when enabled', () => {
    const imageData = createTestImageData();
    const store = createTestStore({
      image: {
        original: {
          data: imageData,
          width: 100,
          height: 100,
          colorSpace: 'srgb',
        },
        current: {
          data: imageData,
          width: 100,
          height: 100,
          colorSpace: 'srgb',
        },
        metadata: null,
        isLoading: false,
      },
      ui: {
        zoom: 1,
        pan: { x: 0, y: 0 },
        showHistogram: true,
        showComparison: false,
        isExportDialogOpen: false,
        activeTool: 'none',
        brushSize: 50,
        activeSection: 'basic',
      },
    });

    render(
      <Provider store={store}>
        <Canvas />
      </Provider>
    );

    // Histogram component should be rendered
    const canvases = document.querySelectorAll('canvas');
    expect(canvases.length).toBeGreaterThan(1); // Main canvas + histogram canvas
  });

  it('handles fit to screen button click', () => {
    const imageData = createTestImageData();
    const store = createTestStore({
      image: {
        original: {
          data: imageData,
          width: 100,
          height: 100,
          colorSpace: 'srgb',
        },
        current: {
          data: imageData,
          width: 100,
          height: 100,
          colorSpace: 'srgb',
        },
        metadata: null,
        isLoading: false,
      },
      ui: {
        zoom: 2,
        pan: { x: 50, y: 50 },
        showHistogram: false,
        showComparison: false,
        isExportDialogOpen: false,
        activeTool: 'none',
        brushSize: 50,
        activeSection: 'basic',
      },
    });

    render(
      <Provider store={store}>
        <Canvas />
      </Provider>
    );

    const fitButton = screen.getByTitle('Fit to screen');
    fireEvent.click(fitButton);

    const state = store.getState();
    // Zoom and pan should be adjusted
    expect(state.ui.pan).toEqual({ x: 0, y: 0 });
  });

  it('handles reset view button click', () => {
    const imageData = createTestImageData();
    const store = createTestStore({
      image: {
        original: {
          data: imageData,
          width: 100,
          height: 100,
          colorSpace: 'srgb',
        },
        current: {
          data: imageData,
          width: 100,
          height: 100,
          colorSpace: 'srgb',
        },
        metadata: null,
        isLoading: false,
      },
      ui: {
        zoom: 2.5,
        pan: { x: 100, y: 100 },
        showHistogram: false,
        showComparison: false,
        isExportDialogOpen: false,
        activeTool: 'none',
        brushSize: 50,
        activeSection: 'basic',
      },
    });

    render(
      <Provider store={store}>
        <Canvas />
      </Provider>
    );

    const resetButton = screen.getByTitle('Reset view (100%)');
    fireEvent.click(resetButton);

    const state = store.getState();
    expect(state.ui.zoom).toBe(1);
    expect(state.ui.pan).toEqual({ x: 0, y: 0 });
  });
});
