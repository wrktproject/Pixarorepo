/**
 * LensBlurAdjustments Component
 * Professional AI-powered lens blur tool with depth estimation
 * Styled to match the Healing Brush section
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import {
  setLensBlurAmount,
  setLensBlurFocusDepth,
  setLensBlurFocusRange,
  setLensBlurShowDepth,
  setLensBlurEnabled,
} from '../store';
import { fetchDepthMap } from '../utils/depthEstimation';
import { DepthMapManager } from '../utils/depthMapManager';
import './LensBlurAdjustments.css';

interface LensBlurAdjustmentsProps {
  disabled?: boolean;
  expanded?: boolean;
}

type DepthStatus = 'idle' | 'generating' | 'ready' | 'error';
type ProcessingStage = 'preparing' | 'analyzing' | 'generating' | 'applying' | 'complete';

export const LensBlurAdjustments: React.FC<LensBlurAdjustmentsProps> = ({
  disabled = false,
}) => {
  const dispatch = useDispatch();
  const adjustments = useSelector((state: RootState) => state.adjustments);
  const currentImage = useSelector((state: RootState) => state.image.current);
  
  const [depthStatus, setDepthStatus] = useState<DepthStatus>('idle');
  const [depthError, setDepthError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('preparing');
  const depthDataRef = useRef<{ data: Float32Array; width: number; height: number } | null>(null);

  const lensBlur = adjustments.lensBlur;
  const hasImage = currentImage !== null;

  // Generate depth map
  const handleGenerateDepth = useCallback(async () => {
    if (!currentImage?.data) {
      setDepthError('No image loaded');
      return;
    }

    setDepthStatus('generating');
    setDepthError(null);
    setProcessingProgress(0);
    setProcessingStage('preparing');
    setStatusMessage('Preparing image...');

    try {
      // Simulate progress stages
      setProcessingProgress(10);
      
      const result = await fetchDepthMap(currentImage.data, (status) => {
        setStatusMessage(status);
        if (status.includes('Preparing')) {
          setProcessingStage('preparing');
          setProcessingProgress(15);
        } else if (status.includes('Analyzing') || status.includes('AI')) {
          setProcessingStage('analyzing');
          setProcessingProgress(40);
        } else if (status.includes('Processing')) {
          setProcessingStage('generating');
          setProcessingProgress(70);
        }
      });
      
      setProcessingStage('applying');
      setProcessingProgress(90);
      setStatusMessage('Applying depth map...');
      
      if (result) {
        depthDataRef.current = { data: result.depthMap, width: result.width, height: result.height };
        setProcessingStage('complete');
        setProcessingProgress(100);
        setStatusMessage('Complete!');
        
        // Brief pause to show completion
        await new Promise(r => setTimeout(r, 300));
        
        setDepthStatus('ready');
        setStatusMessage('');
        
        // Upload to rendering pipeline via manager
        DepthMapManager.uploadDepthMap(result.depthMap, result.width, result.height);
        
        // Enable lens blur effect now that depth map is ready
        dispatch(setLensBlurEnabled(true));
      } else {
        throw new Error('Failed to generate depth map');
      }
    } catch (error) {
      console.error('Depth estimation failed:', error);
      const message = error instanceof Error ? error.message : 'Depth estimation failed';
      setDepthError(message);
      setDepthStatus('error');
      setStatusMessage('');
      setProcessingProgress(0);
    }
  }, [currentImage]);

  // Reset depth status when image changes
  useEffect(() => {
    setDepthStatus('idle');
    depthDataRef.current = null;
    setDepthError(null);
    setProcessingProgress(0);
    // Clear depth map from manager when image changes
    DepthMapManager.clear();
    // Disable lens blur when image changes (no depth map available)
    dispatch(setLensBlurEnabled(false));
  }, [currentImage, dispatch]);

  const handleAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(setLensBlurAmount(Number(e.target.value) / 100));
    },
    [dispatch]
  );

  const handleFocusDepthChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(setLensBlurFocusDepth(Number(e.target.value) / 100));
    },
    [dispatch]
  );

  const handleFocusRangeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(setLensBlurFocusRange(Number(e.target.value) / 100));
    },
    [dispatch]
  );

  const handleShowDepthChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(setLensBlurShowDepth(e.target.checked));
    },
    [dispatch]
  );

  const handleRegenerateDepth = useCallback(() => {
    setDepthStatus('idle');
    handleGenerateDepth();
  }, [handleGenerateDepth]);

  // Processing view - when generating depth map
  if (depthStatus === 'generating') {
    return (
      <div className="lens-blur-adjustments">
        <div className="lens-blur-adjustments__progress-panel">
          <div className="lens-blur-adjustments__progress-header">
            <span className="lens-blur-adjustments__progress-icon">✨</span>
            <span>AI Analyzing Depth...</span>
          </div>
          
          <div className="lens-blur-adjustments__progress-percent-large">
            {Math.round(processingProgress)}%
          </div>
          
          <div className="lens-blur-adjustments__progress-bar-container">
            <div 
              className="lens-blur-adjustments__progress-bar-fill" 
              style={{ width: `${processingProgress}%` }}
            />
          </div>
          
          <div className="lens-blur-adjustments__progress-milestones">
            {(['preparing', 'analyzing', 'generating', 'applying'] as const).map((milestone, idx) => {
              const milestoneOrder = ['preparing', 'analyzing', 'generating', 'applying'];
              const currentIdx = milestoneOrder.indexOf(processingStage);
              const isComplete = idx < currentIdx || processingStage === 'complete';
              const isActive = processingStage === milestone;
              return (
                <div 
                  key={milestone}
                  className={`lens-blur-adjustments__milestone-row ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}`}
                >
                  <span className="lens-blur-adjustments__milestone-dot" />
                  <span className="lens-blur-adjustments__milestone-label">
                    {milestone.charAt(0).toUpperCase() + milestone.slice(1)}
                  </span>
                  {isActive && <span className="lens-blur-adjustments__milestone-spinner">⏳</span>}
                  {isComplete && <span className="lens-blur-adjustments__milestone-check">✓</span>}
                </div>
              );
            })}
          </div>
          
          <div className="lens-blur-adjustments__progress-status">{statusMessage}</div>
        </div>
      </div>
    );
  }

  // Controls view - when ready
  if (depthStatus === 'ready') {
    return (
      <div className="lens-blur-adjustments">
        {/* Status indicator */}
        <div className="lens-blur-adjustments__status-ready">
          <span className="lens-blur-adjustments__status-check">✓</span>
          <span>AI depth map ready</span>
          <button
            className="lens-blur-adjustments__regenerate-btn"
            onClick={handleRegenerateDepth}
            disabled={disabled}
            title="Regenerate depth map"
          >
            ↻
          </button>
        </div>

        {/* Controls */}
        <div className="lens-blur-adjustments__controls">
          <div className="lens-blur-adjustments__control-group">
            <label className="lens-blur-adjustments__label">
              Blur Amount: {Math.round(lensBlur.amount * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="200"
              value={lensBlur.amount * 100}
              onChange={handleAmountChange}
              className="lens-blur-adjustments__slider"
              disabled={disabled}
            />
          </div>

          <div className="lens-blur-adjustments__control-group">
            <label className="lens-blur-adjustments__label">
              Focus Point: {Math.round(lensBlur.focusDepth * 100)}% (0=far, 100=near)
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={lensBlur.focusDepth * 100}
              onChange={handleFocusDepthChange}
              className="lens-blur-adjustments__slider"
              disabled={disabled}
            />
          </div>

          <div className="lens-blur-adjustments__control-group">
            <label className="lens-blur-adjustments__label">
              Focus Range: {Math.round(lensBlur.focusRange * 100)}%
            </label>
            <input
              type="range"
              min="5"
              max="50"
              value={lensBlur.focusRange * 100}
              onChange={handleFocusRangeChange}
              className="lens-blur-adjustments__slider"
              disabled={disabled}
            />
          </div>
        </div>

        {/* Preview options */}
        <div className="lens-blur-adjustments__preview-options">
          <label className="lens-blur-adjustments__checkbox-label">
            <input
              type="checkbox"
              checked={lensBlur.showDepth}
              onChange={handleShowDepthChange}
              disabled={disabled}
              className="lens-blur-adjustments__checkbox"
            />
            <span>Show Depth Map</span>
          </label>
        </div>
      </div>
    );
  }

  // Inactive/idle view
  return (
    <div className="lens-blur-adjustments">
      <p className="lens-blur-adjustments__description">
        Create beautiful depth-of-field blur effects using AI-powered depth estimation.
        The tool analyzes your image to understand what's near and far.
      </p>

      <button
        className="lens-blur-adjustments__activate-button"
        onClick={handleGenerateDepth}
        disabled={disabled || !hasImage}
      >
        Generate AI Depth Map
      </button>

      {depthError && (
        <div className="lens-blur-adjustments__error">
          <span>⚠ {depthError}</span>
          <button
            className="lens-blur-adjustments__retry-btn"
            onClick={handleRegenerateDepth}
            disabled={disabled}
          >
            Retry
          </button>
        </div>
      )}

      <div className="lens-blur-adjustments__tip">
        <strong>How to use:</strong>
        <ol className="lens-blur-adjustments__tip-list">
          <li>Click "Generate AI Depth Map" to analyze</li>
          <li>Adjust Focus Depth to set what's sharp</li>
          <li>Increase Blur Amount for more effect</li>
        </ol>
      </div>

      {/* AI Info */}
      <div className="lens-blur-adjustments__ai-info">
        <div className="lens-blur-adjustments__ai-badge">
          {window.location.hostname === 'localhost' || window.location.port === '5173' || window.location.port === '5174'
            ? '🔧 Local Mode (Gradient Depth)'
            : '🤖 AI-Powered Depth Analysis'
          }
        </div>
        <p className="lens-blur-adjustments__ai-description">
          {window.location.hostname === 'localhost' || window.location.port === '5173' || window.location.port === '5174'
            ? 'Deploy to Netlify for AI depth estimation with MiDaS.'
            : 'Uses MiDaS neural network to estimate scene depth from a single image.'
          }
        </p>
      </div>
    </div>
  );
};
