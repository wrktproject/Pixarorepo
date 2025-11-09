/**
 * ExportDialog Component Tests
 * Integration tests for export workflow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ExportDialog } from './ExportDialog';
import imageReducer from '../store/imageSlice';
import adjustmentsReducer from '../store/adjustmentsSlice';
import uiReducer from '../store/uiSlice';
import historyReducer from '../store/historySlice';
import presetReducer from '../store/presetSlice';
import type { ProcessedImage } from '../types/store';

// Mock the export processor
vi.mock('../utils/exportProcessor', () => ({
  ExportProcessor: vi.fn().mockImplementation(() => ({
    exportImage: vi.fn().mockResolvedValue(new Blob(['test'], { type: 'image/jpeg' })),
    cancel: vi.fn(),
  })),
  downloadBlob: vi.fn(),
  generateFilename: vi.fn().mockReturnValue('test-export.jpeg'),
}));

// Create a test store
function createTestStore(initialState = {}) {
  return configureStore({
    reducer: {
      image: imageReducer,
      adjustments: adjustmentsReducer,
      ui: uiReducer,
      history: historyReducer,
      presets: presetReducer,
    },
    preloadedState: initialState,
  });
}

// Create test image data
function createTestImageData(width = 100, height = 100): ImageData {
  // Create ImageData manually since jsdom doesn't support canvas
  const data = new Uint8ClampedArray(width * height * 4);
  return {
    data,
    width,
    height,
    colorSpace: 'srgb',
  } as ImageData;
}

describe('ExportDialog', () => {
  let store: ReturnType<typeof createTestStore>;
  let currentImage: ProcessedImage;

  beforeEach(() => {
    const imageData = createTestImageData(800, 600);
    currentImage = {
      data: imageData,
      width: 800,
      height: 600,
      colorSpace: 'srgb',
    };

    store = createTestStore({
      image: {
        original: currentImage,
        current: currentImage,
        metadata: null,
        isLoading: false,
      },
    });
  });

  it('renders export dialog when open', () => {
    const onClose = vi.fn();
    const onExport = vi.fn();

    render(
      <Provider store={store}>
        <ExportDialog
          isOpen={true}
          onClose={onClose}
          onExport={onExport}
          currentImage={currentImage}
        />
      </Provider>
    );

    expect(screen.getByText('Export Image')).toBeInTheDocument();
    expect(screen.getByText('JPEG')).toBeInTheDocument();
    expect(screen.getByText('PNG')).toBeInTheDocument();
    expect(screen.getByText('TIFF')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    const onClose = vi.fn();
    const onExport = vi.fn();

    render(
      <Provider store={store}>
        <ExportDialog
          isOpen={false}
          onClose={onClose}
          onExport={onExport}
          currentImage={currentImage}
        />
      </Provider>
    );

    expect(screen.queryByText('Export Image')).not.toBeInTheDocument();
  });

  it('initializes with image dimensions', () => {
    const onClose = vi.fn();
    const onExport = vi.fn();

    render(
      <Provider store={store}>
        <ExportDialog
          isOpen={true}
          onClose={onClose}
          onExport={onExport}
          currentImage={currentImage}
        />
      </Provider>
    );

    const widthInput = screen.getByLabelText('Width') as HTMLInputElement;
    const heightInput = screen.getByLabelText('Height') as HTMLInputElement;

    expect(widthInput.value).toBe('800');
    expect(heightInput.value).toBe('600');
  });

  it('allows format selection', () => {
    const onClose = vi.fn();
    const onExport = vi.fn();

    render(
      <Provider store={store}>
        <ExportDialog
          isOpen={true}
          onClose={onClose}
          onExport={onExport}
          currentImage={currentImage}
        />
      </Provider>
    );

    const jpegButton = screen.getByText('JPEG');
    const pngButton = screen.getByText('PNG');

    expect(jpegButton).toHaveClass('active');
    expect(pngButton).not.toHaveClass('active');

    fireEvent.click(pngButton);

    expect(pngButton).toHaveClass('active');
    expect(jpegButton).not.toHaveClass('active');
  });

  it('shows quality slider only for JPEG format', () => {
    const onClose = vi.fn();
    const onExport = vi.fn();

    render(
      <Provider store={store}>
        <ExportDialog
          isOpen={true}
          onClose={onClose}
          onExport={onExport}
          currentImage={currentImage}
        />
      </Provider>
    );

    // JPEG is selected by default
    expect(screen.getByText(/Quality:/)).toBeInTheDocument();

    // Switch to PNG
    const pngButton = screen.getByText('PNG');
    fireEvent.click(pngButton);

    // Quality slider should not be visible
    expect(screen.queryByText(/Quality:/)).not.toBeInTheDocument();
  });

  it('maintains aspect ratio when locked', () => {
    const onClose = vi.fn();
    const onExport = vi.fn();

    render(
      <Provider store={store}>
        <ExportDialog
          isOpen={true}
          onClose={onClose}
          onExport={onExport}
          currentImage={currentImage}
        />
      </Provider>
    );

    const widthInput = screen.getByLabelText('Width') as HTMLInputElement;
    const heightInput = screen.getByLabelText('Height') as HTMLInputElement;

    // Change width
    fireEvent.change(widthInput, { target: { value: '400' } });

    // Height should update proportionally (800:600 = 400:300)
    expect(heightInput.value).toBe('300');
  });

  it('allows independent dimension changes when unlocked', () => {
    const onClose = vi.fn();
    const onExport = vi.fn();

    render(
      <Provider store={store}>
        <ExportDialog
          isOpen={true}
          onClose={onClose}
          onExport={onExport}
          currentImage={currentImage}
        />
      </Provider>
    );

    const widthInput = screen.getByLabelText('Width') as HTMLInputElement;
    const heightInput = screen.getByLabelText('Height') as HTMLInputElement;
    const lockButton = screen.getByRole('button', { name: /aspect ratio/i });

    // Unlock aspect ratio
    fireEvent.click(lockButton);

    // Change width
    fireEvent.change(widthInput, { target: { value: '500' } });

    // Height should not change
    expect(heightInput.value).toBe('600');
  });

  it('resets dimensions to original', () => {
    const onClose = vi.fn();
    const onExport = vi.fn();

    render(
      <Provider store={store}>
        <ExportDialog
          isOpen={true}
          onClose={onClose}
          onExport={onExport}
          currentImage={currentImage}
        />
      </Provider>
    );

    const widthInput = screen.getByLabelText('Width') as HTMLInputElement;
    const heightInput = screen.getByLabelText('Height') as HTMLInputElement;

    // Change dimensions
    fireEvent.change(widthInput, { target: { value: '400' } });

    // Reset
    const resetButton = screen.getByText(/Reset to Original/i);
    fireEvent.click(resetButton);

    expect(widthInput.value).toBe('800');
    expect(heightInput.value).toBe('600');
  });

  it('toggles metadata preservation checkbox', () => {
    const onClose = vi.fn();
    const onExport = vi.fn();

    render(
      <Provider store={store}>
        <ExportDialog
          isOpen={true}
          onClose={onClose}
          onExport={onExport}
          currentImage={currentImage}
        />
      </Provider>
    );

    const checkbox = screen.getByRole('checkbox', {
      name: /Preserve EXIF metadata/i,
    }) as HTMLInputElement;

    expect(checkbox.checked).toBe(true);

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  it('closes dialog when cancel is clicked', () => {
    const onClose = vi.fn();
    const onExport = vi.fn();

    render(
      <Provider store={store}>
        <ExportDialog
          isOpen={true}
          onClose={onClose}
          onExport={onExport}
          currentImage={currentImage}
        />
      </Provider>
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('closes dialog when clicking overlay', () => {
    const onClose = vi.fn();
    const onExport = vi.fn();

    render(
      <Provider store={store}>
        <ExportDialog
          isOpen={true}
          onClose={onClose}
          onExport={onExport}
          currentImage={currentImage}
        />
      </Provider>
    );

    const overlay = screen.getByText('Export Image').closest('.export-dialog-overlay');
    fireEvent.click(overlay!);

    expect(onClose).toHaveBeenCalled();
  });

  it('does not close when clicking dialog content', () => {
    const onClose = vi.fn();
    const onExport = vi.fn();

    render(
      <Provider store={store}>
        <ExportDialog
          isOpen={true}
          onClose={onClose}
          onExport={onExport}
          currentImage={currentImage}
        />
      </Provider>
    );

    const dialog = screen.getByText('Export Image').closest('.export-dialog');
    fireEvent.click(dialog!);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('adjusts quality slider for JPEG', () => {
    const onClose = vi.fn();
    const onExport = vi.fn();

    render(
      <Provider store={store}>
        <ExportDialog
          isOpen={true}
          onClose={onClose}
          onExport={onExport}
          currentImage={currentImage}
        />
      </Provider>
    );

    const qualitySlider = screen.getByRole('slider') as HTMLInputElement;

    expect(qualitySlider.value).toBe('90');

    fireEvent.change(qualitySlider, { target: { value: '75' } });

    expect(qualitySlider.value).toBe('75');
  });
});
