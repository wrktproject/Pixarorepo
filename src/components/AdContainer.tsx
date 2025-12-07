/**
 * AdContainer Component
 * Lazy-loaded ad container with configurable positioning and refresh logic
 */

import { useEffect, useRef, useState } from 'react';
import { useAdRefresh } from '../hooks/useAdRefresh';
import { adNetworkManager } from '../utils/adNetwork';
import './AdContainer.css';

export interface AdContainerProps {
  adSlot: string;
  position: 'sidebar-bottom' | 'bottom-bar';
  maxRefreshInterval: number; // milliseconds
  adClient?: string; // AdSense client ID
  onAdLoad?: () => void;
  onAdError?: (error: Error) => void;
}

export function AdContainer({
  adSlot,
  position,
  maxRefreshInterval,
  adClient = 'ca-pub-5191398812438911', // Your AdSense publisher ID
  onAdLoad,
  onAdError,
}: AdContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const adContentRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [adLoaded, setAdLoaded] = useState(false);
  const [adKey, setAdKey] = useState(0);
  const [adBlocked, setAdBlocked] = useState(false);

  // Use ad refresh hook with user activity tracking
  const { refreshCount, isActive } = useAdRefresh({
    refreshInterval: maxRefreshInterval,
    minRefreshInterval: 30000, // 30 seconds minimum
    pauseOnActivity: true,
    enabled: adLoaded && isVisible && !adBlocked,
  });

  // Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isVisible) {
            setIsVisible(true);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, [isVisible]);

  // Load ad when visible
  useEffect(() => {
    if (!isVisible || adLoaded || !adContentRef.current) return;

    const loadAd = async () => {
      try {
        // Check for ad blocker
        const isBlocked = await adNetworkManager.detectAdBlocker();
        if (isBlocked) {
          setAdBlocked(true);
          console.info('Ad blocker detected - gracefully handling');
          return;
        }

        // Initialize ad unit
        const success = await adNetworkManager.initializeAdUnit(
          adContentRef.current!,
          {
            adSlot,
            adClient,
            adFormat: position === 'bottom-bar' ? 'horizontal' : 'rectangle',
            fullWidthResponsive: false,
          }
        );

        if (success) {
          setAdLoaded(true);
          onAdLoad?.();
        } else {
          throw new Error('Failed to initialize ad unit');
        }
      } catch (error) {
        console.error('Failed to load ad:', error);
        onAdError?.(error as Error);
        setAdBlocked(true);
      }
    };

    loadAd();
  }, [isVisible, adLoaded, adSlot, adClient, position, onAdLoad, onAdError]);

  // Handle ad refresh when refresh count changes
  useEffect(() => {
    if (refreshCount > 0 && !isActive) {
      // Trigger ad refresh by incrementing key
      setAdKey((prev) => prev + 1);
      setAdLoaded(false);
    }
  }, [refreshCount, isActive]);

  const dimensions =
    position === 'sidebar-bottom'
      ? { width: 300, height: 250 }
      : { width: 728, height: 90 };

  // Don't render if ad blocker is detected (graceful handling)
  if (adBlocked) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`ad-container ad-container--${position}`}
      data-ad-slot={adSlot}
      data-ad-key={adKey}
      style={{
        minWidth: `${dimensions.width}px`,
        minHeight: `${dimensions.height}px`,
      }}
      role="complementary"
      aria-label="Advertisement"
    >
      {isVisible && (
        <div
          key={adKey}
          ref={adContentRef}
          className="ad-container__content"
          style={{
            width: `${dimensions.width}px`,
            height: `${dimensions.height}px`,
          }}
        >
          {/* Ad content will be injected here by ad network */}
          {!adLoaded && (
            <div className="ad-container__placeholder">
              <span className="ad-container__label">Advertisement</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
