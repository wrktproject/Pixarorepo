/**
 * AdContainer Component Tests
 * Tests for ad container functionality and integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AdContainer } from './AdContainer';

// Mock the ad network manager
vi.mock('../utils/adNetwork', () => ({
  adNetworkManager: {
    detectAdBlocker: vi.fn().mockResolvedValue(false),
    initializeAdUnit: vi.fn().mockResolvedValue(true),
    initialize: vi.fn(),
  },
}));

// Mock the hooks
vi.mock('../hooks/useAdRefresh', () => ({
  useAdRefresh: vi.fn(() => ({
    refreshCount: 0,
    isActive: false,
    shouldRefresh: false,
  })),
}));

describe('AdContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock IntersectionObserver
    global.IntersectionObserver = vi.fn().mockImplementation((callback) => ({
      observe: vi.fn(() => {
        // Immediately trigger intersection
        callback([{ isIntersecting: true }]);
      }),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders ad container with correct position class', () => {
    const { container } = render(
      <AdContainer
        adSlot="test-slot"
        position="sidebar-bottom"
        maxRefreshInterval={60000}
      />
    );

    const adContainer = container.querySelector('.ad-container--sidebar-bottom');
    expect(adContainer).toBeTruthy();
  });

  it('renders with correct dimensions for sidebar-bottom position', () => {
    const { container } = render(
      <AdContainer
        adSlot="test-slot"
        position="sidebar-bottom"
        maxRefreshInterval={60000}
      />
    );

    const adContainer = container.querySelector('.ad-container');
    expect(adContainer).toHaveStyle({
      minWidth: '300px',
      minHeight: '250px',
    });
  });

  it('renders with correct dimensions for bottom-bar position', () => {
    const { container } = render(
      <AdContainer
        adSlot="test-slot"
        position="bottom-bar"
        maxRefreshInterval={90000}
      />
    );

    const adContainer = container.querySelector('.ad-container');
    expect(adContainer).toHaveStyle({
      minWidth: '728px',
      minHeight: '90px',
    });
  });

  it('displays placeholder before ad loads', async () => {
    render(
      <AdContainer
        adSlot="test-slot"
        position="sidebar-bottom"
        maxRefreshInterval={60000}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Advertisement')).toBeTruthy();
    });
  });

  it('has proper ARIA attributes', () => {
    const { container } = render(
      <AdContainer
        adSlot="test-slot"
        position="sidebar-bottom"
        maxRefreshInterval={60000}
      />
    );

    const adContainer = container.querySelector('[role="complementary"]');
    expect(adContainer).toBeTruthy();
    expect(adContainer?.getAttribute('aria-label')).toBe('Advertisement');
  });

  it('enforces minimum refresh interval of 30 seconds', () => {
    const { useAdRefresh } = require('../hooks/useAdRefresh');
    
    render(
      <AdContainer
        adSlot="test-slot"
        position="sidebar-bottom"
        maxRefreshInterval={10000} // Less than 30 seconds
      />
    );

    expect(useAdRefresh).toHaveBeenCalledWith(
      expect.objectContaining({
        minRefreshInterval: 30000,
      })
    );
  });

  it('does not render when ad blocker is detected', async () => {
    const { adNetworkManager } = require('../utils/adNetwork');
    adNetworkManager.detectAdBlocker.mockResolvedValue(true);

    const { container } = render(
      <AdContainer
        adSlot="test-slot"
        position="sidebar-bottom"
        maxRefreshInterval={60000}
      />
    );

    await waitFor(() => {
      expect(container.querySelector('.ad-container')).toBeNull();
    });
  });

  it('calls onAdLoad callback when ad loads successfully', async () => {
    const onAdLoad = vi.fn();

    render(
      <AdContainer
        adSlot="test-slot"
        position="sidebar-bottom"
        maxRefreshInterval={60000}
        onAdLoad={onAdLoad}
      />
    );

    await waitFor(() => {
      expect(onAdLoad).toHaveBeenCalled();
    });
  });

  it('calls onAdError callback when ad fails to load', async () => {
    const { adNetworkManager } = require('../utils/adNetwork');
    adNetworkManager.initializeAdUnit.mockResolvedValue(false);
    
    const onAdError = vi.fn();

    render(
      <AdContainer
        adSlot="test-slot"
        position="sidebar-bottom"
        maxRefreshInterval={60000}
        onAdError={onAdError}
      />
    );

    await waitFor(() => {
      expect(onAdError).toHaveBeenCalled();
    });
  });
});
