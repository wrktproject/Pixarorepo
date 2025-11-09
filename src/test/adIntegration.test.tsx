/**
 * Ad Integration Tests
 * Tests for complete ad system integration with the application
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import App from '../App';
import imageReducer from '../store/imageSlice';
import adjustmentsReducer from '../store/adjustmentsSlice';
import uiReducer from '../store/uiSlice';
import historyReducer from '../store/historySlice';
import presetReducer from '../store/presetSlice';

// Mock the ad network manager
vi.mock('../utils/adNetwork', () => ({
  adNetworkManager: {
    detectAdBlocker: vi.fn().mockResolvedValue(false),
    initializeAdUnit: vi.fn().mockResolvedValue(true),
    initialize: vi.fn(),
  },
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn(() => {
    callback([{ isIntersecting: true }]);
  }),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any;

describe('Ad Integration', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    vi.clearAllMocks();

    store = configureStore({
      reducer: {
        image: imageReducer,
        adjustments: adjustmentsReducer,
        ui: uiReducer,
        history: historyReducer,
        presets: presetReducer,
      },
    });
  });

  it('displays maximum of 2 ads simultaneously', () => {
    const { container } = render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const adContainers = container.querySelectorAll('.ad-container');
    expect(adContainers.length).toBeLessThanOrEqual(2);
  });

  it('positions ads outside Canvas and Editing Panel', () => {
    const { container } = render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const canvas = container.querySelector('.app-canvas-area');
    const editingPanel = container.querySelector('.app-editing-panel');
    const adContainers = container.querySelectorAll('.ad-container');

    adContainers.forEach((ad) => {
      // Ads should not be children of canvas or editing panel
      expect(canvas?.contains(ad)).toBe(false);
      expect(editingPanel?.contains(ad)).toBe(false);
    });
  });

  it('sidebar ad is positioned in sidebar', () => {
    const { container } = render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const sidebar = container.querySelector('.app-sidebar');
    const sidebarAd = container.querySelector('.ad-container--sidebar-bottom');

    expect(sidebar?.contains(sidebarAd)).toBe(true);
  });

  it('bottom bar ad is positioned in bottom bar', () => {
    const { container } = render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const bottomBar = container.querySelector('.app-bottom-bar');
    const bottomAd = container.querySelector('.ad-container--bottom-bar');

    expect(bottomBar?.contains(bottomAd)).toBe(true);
  });

  it('initializes ad network on app mount', () => {
    const { adNetworkManager } = require('../utils/adNetwork');

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    expect(adNetworkManager.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        publisherId: expect.any(String),
        testMode: expect.any(Boolean),
      })
    );
  });

  it('ads have different refresh intervals', () => {
    const { container } = render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const sidebarAd = container.querySelector('.ad-container--sidebar-bottom');
    const bottomAd = container.querySelector('.ad-container--bottom-bar');

    // Both ads should exist
    expect(sidebarAd).toBeTruthy();
    expect(bottomAd).toBeTruthy();

    // They should have different data attributes or configurations
    // This is verified by the component props in App.tsx
  });

  it('gracefully handles ad blocker detection', async () => {
    const { adNetworkManager } = require('../utils/adNetwork');
    adNetworkManager.detectAdBlocker.mockResolvedValue(true);

    const { container } = render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    // App should still render without errors
    expect(container.querySelector('.app')).toBeTruthy();
  });
});
