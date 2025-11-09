/**
 * RemovalTool Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { RemovalTool } from './RemovalTool';
import uiReducer from '../store/uiSlice';


// Create test store
const createTestStore = () => {
  return configureStore({
    reducer: {
      ui: uiReducer,
    },
  });
};

// Create test image data
const createTestImageData = (width = 100, height = 100): ImageData => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 128; // R
    data[i + 1] = 128; // G
    data[i + 2] = 128; // B
    data[i + 3] = 255; // A
  }
  return new ImageData(data, width, height);
};

describe('RemovalTool', () => {
  it('renders with image data', () => {
    const store = createTestStore();
    const imageData = createTestImageData();
    const onMaskComplete = vi.fn();

    render(
      <Provider store={store}>
        <RemovalTool
          imageData={imageData}
          onMaskComplete={onMaskComplete}
          isProcessing={false}
        />
      </Provider>
    );

    expect(screen.getByLabelText(/brush size/i)).toBeInTheDocument();
    expect(screen.getByText(/apply removal/i)).toBeInTheDocument();
  });

  it('displays brush size control', () => {
    const store = createTestStore();
    const imageData = createTestImageData();
    const onMaskComplete = vi.fn();

    render(
      <Provider store={store}>
        <RemovalTool
          imageData={imageData}
          onMaskComplete={onMaskComplete}
          isProcessing={false}
        />
      </Provider>
    );

    const brushSizeInput = screen.getByLabelText(/brush size/i);
    expect(brushSizeInput).toHaveAttribute('type', 'range');
    expect(brushSizeInput).toHaveAttribute('min', '5');
    expect(brushSizeInput).toHaveAttribute('max', '200');
  });

  it('updates brush size when slider changes', () => {
    const store = createTestStore();
    const imageData = createTestImageData();
    const onMaskComplete = vi.fn();

    render(
      <Provider store={store}>
        <RemovalTool
          imageData={imageData}
          onMaskComplete={onMaskComplete}
          isProcessing={false}
        />
      </Provider>
    );

    const brushSizeInput = screen.getByLabelText(/brush size/i) as HTMLInputElement;
    fireEvent.change(brushSizeInput, { target: { value: '100' } });

    expect(store.getState().ui.brushSize).toBe(100);
  });

  it('disables controls when processing', () => {
    const store = createTestStore();
    const imageData = createTestImageData();
    const onMaskComplete = vi.fn();

    render(
      <Provider store={store}>
        <RemovalTool
          imageData={imageData}
          onMaskComplete={onMaskComplete}
          isProcessing={true}
        />
      </Provider>
    );

    const brushSizeInput = screen.getByLabelText(/brush size/i);
    const applyButton = screen.getByText(/processing/i);

    expect(brushSizeInput).toBeDisabled();
    expect(applyButton).toBeDisabled();
  });

  it('enables undo button after drawing strokes', () => {
    const store = createTestStore();
    const imageData = createTestImageData();
    const onMaskComplete = vi.fn();

    render(
      <Provider store={store}>
        <RemovalTool
          imageData={imageData}
          onMaskComplete={onMaskComplete}
          isProcessing={false}
        />
      </Provider>
    );

    const undoButton = screen.getByText(/undo stroke/i);
    expect(undoButton).toBeDisabled();
  });

  it('renders canvas element', () => {
    const store = createTestStore();
    const imageData = createTestImageData();
    const onMaskComplete = vi.fn();

    const { container } = render(
      <Provider store={store}>
        <RemovalTool
          imageData={imageData}
          onMaskComplete={onMaskComplete}
          isProcessing={false}
        />
      </Provider>
    );

    const canvas = container.querySelector('.removal-tool-canvas') as HTMLCanvasElement;
    expect(canvas).toBeInTheDocument();
    expect(canvas.tagName).toBe('CANVAS');
  });
});
