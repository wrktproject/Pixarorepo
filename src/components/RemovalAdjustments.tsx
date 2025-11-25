/**
 * Removal Adjustments Component
 * UI section for healing brush tool (Lightroom-style)
 */

import React, { useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { setActiveTool } from '../store/uiSlice';
import { addRemovalOperation } from '../store/adjustmentsSlice';
import { RemovalTool } from './RemovalTool';
import type { RemovalMask, RemovalOperation } from '../types/adjustments';
import { healPatch, clonePatch, findSourcePatch, type HealingPatch } from '../utils/healingBrush';
import './RemovalAdjustments.css';

type BrushMode = 'heal' | 'clone';

interface RemovalAdjustmentsProps {
  disabled?: boolean;
}

export const RemovalAdjustments: React.FC<RemovalAdjustmentsProps> = ({ disabled = false }) => {
  const dispatch = useDispatch();
  const activeTool = useSelector((state: RootState) => state.ui.activeTool);
  const imageState = useSelector((state: RootState) => state.image);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [brushMode, setBrushMode] = useState<BrushMode>('heal');
  const [brushSize, setBrushSize] = useState(30);
  const [feather, setFeather] = useState(0.3);
  const [error, setError] = useState<string | null>(null);

  const isToolActive = activeTool === 'removal';
  const hasImage = imageState.current !== null;

  const handleActivateTool = useCallback(async () => {
    if (!hasImage) {
      setError('Please load an image first');
      return;
    }

    setError(null);
    dispatch(setActiveTool('removal'));
  }, [dispatch, hasImage]);

  const handleDeactivateTool = useCallback(() => {
    dispatch(setActiveTool('none'));
    setError(null);
  }, [dispatch]);

  const handleMaskComplete = useCallback(
    async (mask: RemovalMask) => {
      if (!imageState.current) {
        setError('No image loaded');
        return;
      }

      setIsProcessing(true);
      setError(null);

      try {
        // Create a copy of the image data for processing
        const imageData = new ImageData(
          new Uint8ClampedArray(imageState.current.data.data),
          imageState.current.data.width,
          imageState.current.data.height
        );

        // Auto-find source patch or use center of mask as target
        const targetX = Math.round(mask.bounds.x);
        const targetY = Math.round(mask.bounds.y);
        const radius = Math.round(mask.bounds.width / 2);
        
        const source = findSourcePatch(imageData, targetX, targetY, radius);
        
        const healingPatch: HealingPatch = {
          sourceX: source.x,
          sourceY: source.y,
          targetX,
          targetY,
          radius,
        };

        // Apply healing or cloning based on mode
        if (brushMode === 'heal') {
          healPatch(imageData, healingPatch, feather);
        } else {
          clonePatch(imageData, healingPatch, feather);
        }

        // Create removal operation
        const operation: RemovalOperation = {
          id: `removal-${Date.now()}`,
          mask,
          timestamp: Date.now(),
        };

        // Add to history
        dispatch(addRemovalOperation(operation));

        console.log(`${brushMode === 'heal' ? 'Healing' : 'Cloning'} operation completed:`, operation);

        // Deactivate tool after successful removal
        handleDeactivateTool();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Removal operation failed. Please try again.'
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [imageState.current, dispatch, handleDeactivateTool, brushMode, feather]
  );

  return (
    <div className="removal-adjustments">
        {!isToolActive ? (
          <div className="removal-adjustments__inactive">
            <p className="removal-adjustments__description">
              Remove unwanted objects and blemishes with the healing brush.
            </p>
            
            <div className="removal-adjustments__mode-selector">
              <label className="removal-adjustments__label">Brush Mode</label>
              <div className="removal-adjustments__buttons">
                <button
                  className={`removal-adjustments__mode-btn ${brushMode === 'heal' ? 'removal-adjustments__mode-btn--active' : ''}`}
                  onClick={() => setBrushMode('heal')}
                >
                  Heal
                </button>
                <button
                  className={`removal-adjustments__mode-btn ${brushMode === 'clone' ? 'removal-adjustments__mode-btn--active' : ''}`}
                  onClick={() => setBrushMode('clone')}
                >
                  Clone
                </button>
              </div>
              <p className="removal-adjustments__hint">
                {brushMode === 'heal' 
                  ? 'Blends source texture with surrounding area'
                  : 'Copies source texture exactly'}
              </p>
            </div>

            <div className="removal-adjustments__controls">
              <label className="removal-adjustments__label">
                Brush Size: {brushSize}px
              </label>
              <input
                type="range"
                min="10"
                max="100"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="removal-adjustments__slider"
              />
              
              <label className="removal-adjustments__label">
                Feather: {Math.round(feather * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={feather * 100}
                onChange={(e) => setFeather(Number(e.target.value) / 100)}
                className="removal-adjustments__slider"
              />
            </div>

            {error && (
              <div className="removal-adjustments__error">
                {error}
              </div>
            )}

            <button
              className="removal-adjustments__activate-button"
              onClick={handleActivateTool}
              disabled={disabled || !hasImage}
            >
              Activate {brushMode === 'heal' ? 'Healing' : 'Clone'} Brush
            </button>
          </div>
        ) : (
          <div className="removal-adjustments__active">
            {error && (
              <div className="removal-adjustments__error">
                {error}
              </div>
            )}

            {isProcessing && (
              <div className="removal-adjustments__processing">
                <div className="removal-adjustments__spinner" />
                <p>Processing removal...</p>
              </div>
            )}

            <RemovalTool
              imageData={imageState.current?.data || null}
              onMaskComplete={handleMaskComplete}
              isProcessing={isProcessing}
            />

            <button
              className="removal-adjustments__deactivate-button"
              onClick={handleDeactivateTool}
              disabled={isProcessing}
            >
              Close Removal Tool
            </button>
          </div>
        )}
    </div>
  );
};
