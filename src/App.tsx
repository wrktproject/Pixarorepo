/**
 * Pixaro - Main Application Component
 * Professional photo editing application with dark theme UI
 */

import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from './store';
import { Canvas } from './components/Canvas';
import { ToolsPanel } from './components/ToolsPanel';
import { PresetManager } from './components/PresetManager';
import { PhotoLibrary } from './components/PhotoLibrary';
import { HistoryIndicator } from './components/HistoryIndicator';
import { SavePresetButton } from './components/SavePresetButton';
import { ImageUploadContainer } from './components/ImageUploadContainer';
import { AdContainer } from './components/AdContainer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingOverlay } from './components/LoadingOverlay';
import { ToastContainer } from './components/ToastContainer';
import { WebGLWarning } from './components/WebGLWarning';
import { BrowserWarning } from './components/BrowserWarning';
import { useToast } from './hooks/useToast';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { usePhotoSync } from './hooks/usePhotoSync';
import { ShortcutPanel } from './components/ShortcutPanel';
import { adNetworkManager } from './utils/adNetwork';
import { detectWebGLCapabilities, getWebGLWarningMessage } from './utils/webglDetection';
import { detectBrowser, getCompatibilityWarning } from './utils/browserCompatibility';
import './App.css';
import './components/VisualFeedback.css';

function App() {
  const hasImage = useSelector((state: RootState) => state.image.current !== null);
  const hasPhotos = useSelector((state: RootState) => state.library.photos.length > 0);
  const loadingState = useSelector((state: RootState) => state.ui.loadingState);
  const { toasts, removeToast } = useToast();
  const [webglWarning, setWebglWarning] = useState<string | null>(null);
  const [browserWarning, setBrowserWarning] = useState<string | null>(null);
  
  // Initialize keyboard shortcuts
  useKeyboardShortcuts();
  
  // Sync photo adjustments with library
  usePhotoSync();

  // Check browser compatibility on mount
  useEffect(() => {
    const browserInfo = detectBrowser();
    const warning = getCompatibilityWarning(browserInfo);
    
    if (warning) {
      setBrowserWarning(warning);
      
      // Log browser info for debugging
      if (import.meta.env.DEV) {
        console.log('Browser Info:', browserInfo);
      }
    }
  }, []);

  // Check WebGL support on mount
  useEffect(() => {
    const capabilities = detectWebGLCapabilities();
    const warning = getWebGLWarningMessage(capabilities);
    
    if (warning) {
      setWebglWarning(warning);
      
      // Log capabilities for debugging
      if (import.meta.env.DEV) {
        console.log('WebGL Capabilities:', capabilities);
      }
    }
  }, []);

  // Initialize ad network on mount (only in production)
  useEffect(() => {
    // Only initialize ads if publisher ID is configured
    const publisherId = import.meta.env.VITE_ADSENSE_PUBLISHER_ID;
    if (publisherId && publisherId !== 'ca-pub-0000000000000000') {
      adNetworkManager.initialize({
        publisherId,
        testMode: import.meta.env.DEV, // Test mode in development
      });
    }
  }, []);

  // Get loading message based on operation
  const getLoadingMessage = () => {
    switch (loadingState.operation) {
      case 'upload':
        return 'Loading image...';
      case 'export':
        return 'Exporting image...';
      case 'ai-processing':
        return 'Processing with AI...';
      default:
        return 'Processing...';
    }
  };

  return (
    <ErrorBoundary>
      <div className="app" role="application" aria-label="Pixaro Photo Editor">
        {/* Skip to content link for keyboard navigation */}
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>

        {/* Screen reader announcements */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {loadingState.isLoading && getLoadingMessage()}
        </div>

        {/* Global Loading Overlay */}
        <LoadingOverlay
          isLoading={loadingState.isLoading}
          message={getLoadingMessage()}
          progress={loadingState.progress}
          estimatedTime={loadingState.estimatedTime}
          fullScreen={true}
        />

        {/* Toast Notifications */}
        <ToastContainer toasts={toasts} onRemove={removeToast} />

        {/* Keyboard Shortcuts Panel */}
        <ShortcutPanel />

        {/* Browser Compatibility Warning */}
        {browserWarning && (
          <BrowserWarning
            message={browserWarning}
            severity={browserWarning.includes('missing critical features') ? 'error' : 'warning'}
            dismissible={true}
          />
        )}

        {/* WebGL Warning */}
        {webglWarning && (
          <WebGLWarning
            message={webglWarning}
            severity={webglWarning.includes('not supported') ? 'error' : 'warning'}
            dismissible={true}
          />
        )}

        {/* Header */}
        <header className="app-header" role="banner">
          <div className="app-header__content">
            <h1 className="app-title">Pixaro</h1>
            <div className="app-header__controls">
              <ErrorBoundary>
                <SavePresetButton />
              </ErrorBoundary>
              {hasImage && (
                <ErrorBoundary>
                  <HistoryIndicator />
                </ErrorBoundary>
              )}
            </div>
          </div>
        </header>

        {/* Main Layout */}
        <main className="app-main" role="main">
          {/* Left Sidebar */}
          <aside className="app-sidebar" role="complementary" aria-label="Presets and library sidebar">
            {hasPhotos && (
              <ErrorBoundary>
                <PhotoLibrary />
              </ErrorBoundary>
            )}
            {hasPhotos && hasImage && (
              <ErrorBoundary>
                <PresetManager />
              </ErrorBoundary>
            )}
            {/* Ad in sidebar bottom - 300x250 (only if configured) */}
            {import.meta.env.VITE_ADSENSE_PUBLISHER_ID && (
              <ErrorBoundary>
                <AdContainer
                  adSlot="sidebar-bottom"
                  position="sidebar-bottom"
                  maxRefreshInterval={60000} // 1 minute
                />
              </ErrorBoundary>
            )}
          </aside>

          {/* Center Canvas Area */}
          <section id="main-content" className="app-canvas-area" role="region" aria-label="Image canvas">
            <ErrorBoundary>
              {hasImage ? <Canvas /> : <ImageUploadContainer />}
            </ErrorBoundary>
          </section>

          {/* Tools Panel (right side icons and panels) */}
          <aside className="app-tools-panel" role="complementary" aria-label="Tools">
            <ErrorBoundary>
              <ToolsPanel />
            </ErrorBoundary>
          </aside>
        </main>

        {/* Bottom Bar Ad - 728x90 (only if configured) */}
        {import.meta.env.VITE_ADSENSE_PUBLISHER_ID && (
          <div className="app-bottom-bar">
            <ErrorBoundary>
              <AdContainer
                adSlot="bottom-bar"
                position="bottom-bar"
                maxRefreshInterval={90000} // 1.5 minutes
              />
            </ErrorBoundary>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;
