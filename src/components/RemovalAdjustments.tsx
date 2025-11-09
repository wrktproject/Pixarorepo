/**
 * Removal Adjustments Component
 * UI section for AI-powered removal tool
 */

import React, { useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { setActiveTool } from '../store/uiSlice';
import { addRemovalOperation } from '../store/adjustmentsSlice';
import { RemovalTool } from './RemovalTool';
import type { RemovalMask, RemovalOperation } from '../types/adjustments';
import { loadInpaintingModel, isModelLoaded } from '../utils/aiModelLoader';
import { performAIInpainting } from '../utils/aiInpaintingWorker';
import {
  isSpotRemoval,
  performSpotRemovalAsync,
  getRecommendedTimeout,
} from '../utils/spotRemoval';
import './RemovalAdjustments.css';

interface RemovalAdjustmentsProps {
  disabled?: boolean;
}

export const RemovalAdjustments: React.FC<RemovalAdjustmentsProps> = ({ disabled = false }) => {
  const dispatch = useDispatch();
  const activeTool = useSelector((state: RootState) => state.ui.activeTool);
  const imageState = useSelector((state: RootState) => state.image);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isToolActive = activeTool === 'removal';
  const hasImage = imageState.current !== null;

  const handleActivateTool = useCallback(async () => {
    if (!hasImage) {
      setError('Please load an image first');
      return;
    }

    setError(null);

    // Load model if not already loaded
    if (!isModelLoaded()) {
      setIsLoadingModel(true);
      setLoadProgress(0);

      try {
        await loadInpaintingModel((progress) => {
          setLoadProgress(progress);
        });
        setIsLoadingModel(false);
      } catch (err) {
        setIsLoadingModel(false);
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load AI model. Please try again.'
        );
        return;
      }
    }

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
        // Check if this is a spot removal (small area)
        if (isSpotRemoval(mask)) {
          // Use fast spot removal
          const timeout = getRecommendedTimeout(mask);
          await performSpotRemovalAsync(
            imageState.current.data,
            mask,
            timeout
          );
        } else {
          // Use AI inpainting for larger areas
          await performAIInpainting(
            imageState.current.data,
            mask
          );
        }

        // Create removal operation
        const operation: RemovalOperation = {
          id: `removal-${Date.now()}`,
          mask,
          timestamp: Date.now(),
        };

        // Add to history
        dispatch(addRemovalOperation(operation));

        // Update image state would happen here
        // For now, we'll just log success
        console.log('Removal operation completed:', operation);

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
    [imageState.current, dispatch, handleDeactivateTool]
  );

  return (
    <div className="removal-adjustments">
        {!isToolActive ? (
          <div className="removal-adjustments__inactive">
            <p className="removal-adjustments__description">
              Remove unwanted objects and blemishes using AI-powered inpainting.
            </p>
            
            {isLoadingModel && (
              <div className="removal-adjustments__loading">
                <div className="removal-adjustments__progress-bar">
                  <div
                    className="removal-adjustments__progress-fill"
                    style={{ width: `${loadProgress}%` }}
                  />
                </div>
                <p className="removal-adjustments__loading-text">
                  Loading AI model... {Math.round(loadProgress)}%
                </p>
              </div>
            )}

            {error && (
              <div className="removal-adjustments__error">
                {error}
              </div>
            )}

            <button
              className="removal-adjustments__activate-button"
              onClick={handleActivateTool}
              disabled={disabled || !hasImage || isLoadingModel}
            >
              {isLoadingModel ? 'Loading Model...' : 'Activate Removal Tool'}
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
