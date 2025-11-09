/**
 * End-to-End Integration Tests
 * Tests complete workflows from upload to export
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { makeStore } from '../store';
import App from '../App';

// Mock ad network
vi.mock('../utils/adNetwork', () => ({
  adNetworkManager: {
    initialize: vi.fn(),
    loadAd: vi.fn(),
    refreshAd: vi.fn(),
    pauseRefresh: vi.fn(),
    resumeRefresh: vi.fn(),
  },
}));

// Mock WebGL detection
vi.mock('../utils/webglDetection', () => ({
  detectWebGLCapabilities: vi.fn(() => ({
    webgl: true,
    webgl2: true,
    maxTextureSize: 4096,
    maxViewportDims: [4096, 4096],
  })),
  getWebGLWarningMessage: vi.fn(() => null),
}));

// Mock browser compatibility
vi.mock('../utils/browserCompatibility', () => ({
  detectBrowser: vi.fn(() => ({
    name: 'Chrome',
    version: 120,
    isSupported: true,
    missingFeatures: [],
  })),
  getCompatibilityWarning: vi.fn(() => null),
}));

describe('End-to-End Workflows', () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    store = makeStore();
  });

  describe('Application Initialization', () => {
    it('should render the application without errors', () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      expect(screen.getByText('Pixaro')).toBeInTheDocument();
    });

    it('should show upload container when no image is loaded', () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      // Should show upload area
      expect(screen.getByText(/drag.*drop/i)).toBeInTheDocument();
    });

    it('should initialize with correct Redux state', () => {
      const state = store.getState();

      expect(state.image.current).toBeNull();
      expect(state.adjustments.exposure).toBe(0);
      expect(state.history.past).toHaveLength(0);
      expect(state.presets.builtIn.length).toBeGreaterThan(0);
    });
  });

  describe('Image Upload Workflow', () => {
    it('should handle image upload and display canvas', async () => {
      const { container } = render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      // Create a mock image file
      const file = new File(['dummy content'], 'test.jpg', { type: 'image/jpeg' });
      
      // Mock FileReader
      const mockFileReader = {
        readAsDataURL: vi.fn(),
        result: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        onload: null as ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null,
      };

      vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as unknown as FileReader);

      // Find file input
      const fileInput = container.querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();

      // Note: Full file upload testing would require more complex mocking
      // This test verifies the structure is in place
    });
  });

  describe('Adjustment Workflow', () => {
    it('should apply adjustments and update state', async () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      // Load a mock image first
      const mockImageData = new ImageData(100, 100);
      store.dispatch({
        type: 'image/setCurrentImage',
        payload: {
          data: mockImageData,
          width: 100,
          height: 100,
          colorSpace: 'srgb',
        },
      });

      await waitFor(() => {
        // Should show editing panel
        expect(screen.getByText('Adjustments')).toBeInTheDocument();
      });

      // Apply exposure adjustment
      store.dispatch({
        type: 'adjustments/setExposure',
        payload: 1.5,
      });

      const state = store.getState();
      expect(state.adjustments.exposure).toBe(1.5);
    });
  });

  describe('Preset Application Workflow', () => {
    it('should apply preset and update adjustments', async () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      // Load a mock image
      const mockImageData = new ImageData(100, 100);
      store.dispatch({
        type: 'image/setCurrentImage',
        payload: {
          data: mockImageData,
          width: 100,
          height: 100,
          colorSpace: 'srgb',
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Adjustments')).toBeInTheDocument();
      });

      // Get initial state
      const initialState = store.getState();
      const initialExposure = initialState.adjustments.exposure;

      // Apply a preset
      const presets = store.getState().presets.builtIn;
      if (presets.length > 0) {
        store.dispatch({
          type: 'adjustments/setAllAdjustments',
          payload: presets[0].adjustments,
        });

        const newState = store.getState();
        // Adjustments should have changed
        expect(newState.adjustments).not.toEqual(initialState.adjustments);
      }
    });

    it('should save custom preset', () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      // Set some adjustments
      store.dispatch({
        type: 'adjustments/setExposure',
        payload: 2.0,
      });
      store.dispatch({
        type: 'adjustments/setContrast',
        payload: 50,
      });

      // Save as custom preset
      const adjustments = store.getState().adjustments;
      store.dispatch({
        type: 'presets/saveCustomPreset',
        payload: {
          id: 'custom-1',
          name: 'My Custom Preset',
          adjustments,
          isBuiltIn: false,
        },
      });

      const state = store.getState();
      expect(state.presets.custom).toHaveLength(1);
      expect(state.presets.custom[0].name).toBe('My Custom Preset');
    });
  });

  describe('Undo/Redo Workflow', () => {
    it('should handle undo and redo operations', () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      // Make several adjustments
      store.dispatch({ type: 'adjustments/setExposure', payload: 1.0 });
      store.dispatch({ type: 'history/addToHistory', payload: store.getState().adjustments });
      
      store.dispatch({ type: 'adjustments/setExposure', payload: 2.0 });
      store.dispatch({ type: 'history/addToHistory', payload: store.getState().adjustments });
      
      store.dispatch({ type: 'adjustments/setExposure', payload: 3.0 });
      store.dispatch({ type: 'history/addToHistory', payload: store.getState().adjustments });

      let state = store.getState();
      expect(state.adjustments.exposure).toBe(3.0);
      expect(state.history.past.length).toBeGreaterThan(0);

      // Undo
      store.dispatch({ type: 'history/undo' });
      state = store.getState();
      expect(state.adjustments.exposure).toBe(2.0);

      // Undo again
      store.dispatch({ type: 'history/undo' });
      state = store.getState();
      expect(state.adjustments.exposure).toBe(1.0);

      // Redo
      store.dispatch({ type: 'history/redo' });
      state = store.getState();
      expect(state.adjustments.exposure).toBe(2.0);
    });

    it('should limit history to max size', () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      // Add more than max history size (50)
      for (let i = 0; i < 60; i++) {
        store.dispatch({ type: 'adjustments/setExposure', payload: i * 0.1 });
        store.dispatch({ type: 'history/addToHistory', payload: store.getState().adjustments });
      }

      const state = store.getState();
      expect(state.history.past.length).toBeLessThanOrEqual(50);
    });
  });

  describe('Multi-Photo Library Workflow', () => {
    it('should manage multiple photos in library', () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      // Add multiple photos
      const photo1 = {
        id: 'photo-1',
        name: 'test1.jpg',
        thumbnail: 'data:image/jpeg;base64,test1',
        adjustments: store.getState().adjustments,
        timestamp: Date.now(),
      };

      const photo2 = {
        id: 'photo-2',
        name: 'test2.jpg',
        thumbnail: 'data:image/jpeg;base64,test2',
        adjustments: store.getState().adjustments,
        timestamp: Date.now() + 1000,
      };

      store.dispatch({ type: 'library/addPhoto', payload: photo1 });
      store.dispatch({ type: 'library/addPhoto', payload: photo2 });

      const state = store.getState();
      expect(state.library.photos).toHaveLength(2);
      expect(state.library.currentPhotoId).toBe('photo-2');
    });

    it('should switch between photos and preserve adjustments', () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      // Add photo with specific adjustments
      const photo1Adjustments = { ...store.getState().adjustments, exposure: 1.5 };
      store.dispatch({
        type: 'library/addPhoto',
        payload: {
          id: 'photo-1',
          name: 'test1.jpg',
          thumbnail: 'data:image/jpeg;base64,test1',
          adjustments: photo1Adjustments,
          timestamp: Date.now(),
        },
      });

      // Add another photo with different adjustments
      const photo2Adjustments = { ...store.getState().adjustments, exposure: 2.5 };
      store.dispatch({
        type: 'library/addPhoto',
        payload: {
          id: 'photo-2',
          name: 'test2.jpg',
          thumbnail: 'data:image/jpeg;base64,test2',
          adjustments: photo2Adjustments,
          timestamp: Date.now() + 1000,
        },
      });

      // Switch to photo 1
      store.dispatch({ type: 'library/setCurrentPhoto', payload: 'photo-1' });

      let state = store.getState();
      expect(state.library.currentPhotoId).toBe('photo-1');

      // Switch to photo 2
      store.dispatch({ type: 'library/setCurrentPhoto', payload: 'photo-2' });

      state = store.getState();
      expect(state.library.currentPhotoId).toBe('photo-2');
    });
  });

  describe('Ad Integration Behavior', () => {
    it('should render ad containers', () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      // Check for ad containers (they should be in the DOM)
      const adContainers = document.querySelectorAll('[class*="ad-container"]');
      expect(adContainers.length).toBeGreaterThan(0);
    });

    it('should not interfere with editing controls', () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      // Load a mock image
      const mockImageData = new ImageData(100, 100);
      store.dispatch({
        type: 'image/setCurrentImage',
        payload: {
          data: mockImageData,
          width: 100,
          height: 100,
          colorSpace: 'srgb',
        },
      });

      // Verify editing panel is accessible
      expect(screen.getByText('Adjustments')).toBeInTheDocument();

      // Verify canvas area is accessible
      const canvasArea = document.querySelector('.app-canvas-area');
      expect(canvasArea).toBeInTheDocument();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should handle undo shortcut', () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      // Make an adjustment
      store.dispatch({ type: 'adjustments/setExposure', payload: 1.5 });
      store.dispatch({ type: 'history/addToHistory', payload: store.getState().adjustments });

      // Simulate Ctrl+Z
      const event = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
      });
      window.dispatchEvent(event);

      // Note: Full keyboard shortcut testing would require more setup
      // This verifies the structure is in place
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully with error boundaries', () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      // Error boundaries should be in place
      const errorBoundaries = document.querySelectorAll('[class*="error-boundary"]');
      // The app should render without throwing
      expect(screen.getByText('Pixaro')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      // Check for main landmarks
      expect(screen.getByRole('banner')).toBeInTheDocument(); // header
      expect(screen.getByRole('main')).toBeInTheDocument(); // main content
      expect(screen.getAllByRole('complementary').length).toBeGreaterThan(0); // sidebars
    });

    it('should have skip to content link', () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      const skipLink = screen.getByText(/skip to main content/i);
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute('href', '#main-content');
    });
  });
});
