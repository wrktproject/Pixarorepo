/**
 * ToolsPanel Component
 * Vertical toolbar with icon buttons for different tools (like Lightroom)
 */

import React, { Suspense, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setActiveTool } from '../store';
import type { RootState } from '../store';
import './ToolsPanel.css';

// Lazy load RemovalAdjustments since it uses TensorFlow.js
const RemovalAdjustments = React.lazy(() => 
  import('./RemovalAdjustments').then(module => ({ default: module.RemovalAdjustments }))
);

// Lazy load components
const EditingPanel = React.lazy(() => 
  import('./EditingPanel').then(module => ({ default: module.EditingPanel }))
);

const GeometricAdjustments = React.lazy(() => 
  import('./GeometricAdjustments').then(module => ({ default: module.GeometricAdjustments }))
);

const PresetAdjustments = React.lazy(() => 
  import('./PresetAdjustments').then(module => ({ default: module.PresetAdjustments }))
);

type ActiveTool = 'none' | 'adjustments' | 'crop' | 'removal' | 'blur' | 'presets';

export const ToolsPanel: React.FC = () => {
  const dispatch = useDispatch();
  const hasImage = useSelector((state: RootState) => state.image.current !== null);
  const reduxActiveTool = useSelector((state: RootState) => state.ui.activeTool);
  const [activeTool, setLocalActiveTool] = useState<ActiveTool>('adjustments');
  const disabled = !hasImage;

  const handleToolClick = (tool: ActiveTool) => {
    // For crop tool, activate both the overlay AND the sidebar panel
    if (tool === 'crop') {
      const newCropState = reduxActiveTool === 'crop' ? 'none' : 'crop';
      // Toggle crop overlay on/off
      dispatch(setActiveTool(newCropState));
      // Show crop panel in sidebar
      setLocalActiveTool(newCropState === 'crop' ? 'crop' : 'adjustments');
    } else {
      // For other tools, normal toggle behavior
      setLocalActiveTool(activeTool === tool ? 'none' : tool);
    }
  };

  return (
    <div className="tools-panel">
      {/* Tool Icons */}
      <div className="tools-panel__icons">
        {/* Adjustments Panel */}
        <button
          className={`tools-panel__icon-button ${activeTool === 'adjustments' ? 'tools-panel__icon-button--active' : ''}`}
          onClick={() => handleToolClick('adjustments')}
          title="Adjustments"
          aria-label="Adjustments"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>

        {/* Presets Tool */}
        <button
          className={`tools-panel__icon-button ${activeTool === 'presets' ? 'tools-panel__icon-button--active' : ''}`}
          onClick={() => handleToolClick('presets')}
          disabled={disabled}
          title="Presets"
          aria-label="Presets"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v4" />
            <path d="M12 18v4" />
            <path d="M4.93 4.93l2.83 2.83" />
            <path d="M16.24 16.24l2.83 2.83" />
            <path d="M2 12h4" />
            <path d="M18 12h4" />
            <path d="M4.93 19.07l2.83-2.83" />
            <path d="M16.24 7.76l2.83-2.83" />
          </svg>
        </button>

        {/* Crop & Transform Tool */}
        <button
          className={`tools-panel__icon-button ${reduxActiveTool === 'crop' ? 'tools-panel__icon-button--active' : ''}`}
          onClick={() => handleToolClick('crop')}
          disabled={disabled}
          title="Crop & Transform"
          aria-label="Crop & Transform"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 2v14a2 2 0 0 0 2 2h14" />
            <path d="M18 22V8a2 2 0 0 0-2-2H2" />
          </svg>
        </button>

        {/* AI Removal Tool */}
        <button
          className={`tools-panel__icon-button ${activeTool === 'removal' ? 'tools-panel__icon-button--active' : ''}`}
          onClick={() => handleToolClick('removal')}
          disabled={disabled}
          title="Healing Brush"
          aria-label="Healing Brush"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 21h10" />
            <path d="M12 21V7" />
            <path d="M12 7c-1.5-1.5-3-3-3-5a3 3 0 1 1 6 0c0 2-1.5 3.5-3 5z" />
          </svg>
        </button>

        {/* AI Lens Blur Tool */}
        <button
          className={`tools-panel__icon-button ${activeTool === 'blur' ? 'tools-panel__icon-button--active' : ''}`}
          onClick={() => handleToolClick('blur')}
          disabled={disabled}
          title="Lens Blur"
          aria-label="Lens Blur"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <circle cx="12" cy="12" r="7" opacity="0.5" />
            <circle cx="12" cy="12" r="10" opacity="0.3" />
          </svg>
        </button>
      </div>

      {/* Adjustments Panel */}
      {activeTool === 'adjustments' && (
        <div className="tools-panel__content tools-panel__content--wide">
          <div className="tools-panel__body">
            <Suspense fallback={<div className="loading-section">Loading...</div>}>
              <EditingPanel />
            </Suspense>
          </div>
        </div>
      )}

      {/* Presets Panel */}
      {activeTool === 'presets' && (
        <div className="tools-panel__content">
          <div className="tools-panel__header">
            <h2 className="tools-panel__title">Presets</h2>
          </div>
          <div className="tools-panel__body">
            <Suspense fallback={<div className="loading-section">Loading...</div>}>
              <PresetAdjustments disabled={disabled} />
            </Suspense>
          </div>
        </div>
      )}

      {/* Crop & Transform Panel */}
      {activeTool === 'crop' && (
        <div className="tools-panel__content">
          <div className="tools-panel__header">
            <h3 className="tools-panel__title">Crop & Transform</h3>
          </div>
          <div className="tools-panel__body">
            <Suspense fallback={<div className="loading-section">Loading...</div>}>
              <GeometricAdjustments disabled={disabled} />
            </Suspense>
          </div>
        </div>
      )}

      {/* Healing Brush Panel */}
      {activeTool === 'removal' && (
        <div className="tools-panel__content">
          <div className="tools-panel__header">
            <h3 className="tools-panel__title">Healing Brush</h3>
          </div>
          <div className="tools-panel__body">
            <Suspense fallback={<div className="loading-section">Loading AI tools...</div>}>
              <RemovalAdjustments disabled={disabled} />
            </Suspense>
          </div>
        </div>
      )}

      {/* Lens Blur Panel */}
      {activeTool === 'blur' && (
        <div className="tools-panel__content">
          <div className="tools-panel__header">
            <h3 className="tools-panel__title">Lens Blur</h3>
          </div>
          <div className="tools-panel__body">
            <div className="lens-blur-tool">
              <p className="lens-blur-tool__description">
                AI-powered depth-aware blur effect. Paint on areas to keep in focus, and the AI will blur the background naturally.
              </p>
              <button
                className="lens-blur-tool__button"
                disabled={disabled}
              >
                Coming Soon
              </button>
              <p className="lens-blur-tool__note">
                This feature uses AI to detect depth and create realistic bokeh effects.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
