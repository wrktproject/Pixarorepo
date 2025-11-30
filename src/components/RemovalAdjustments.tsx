/**
 * Removal Adjustments Component (Redesigned)
 * Professional healing/clone/content-aware tool with direct drawing
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { setActiveTool } from '../store/uiSlice';
import { setCurrentImage, setCurrentImageWithHistory } from '../store/imageSlice';
import { RemovalToolOverlay, type BrushStroke } from './RemovalToolOverlay';
import { createStrokeMask } from '../utils/healingBrush';
import { contentAwareFillWithMaskAsync } from '../utils/contentAwareFill';
import { getAIUsageStats, incrementAIUsage } from '../utils/serverInpainting';
import './RemovalAdjustments.css';

// Simplified to single mode - content-aware with auto-healing

interface RemovalAdjustmentsProps {
  disabled?: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export const RemovalAdjustments: React.FC<RemovalAdjustmentsProps> = ({ disabled = false, canvasRef }) => {
  const dispatch = useDispatch();
  const activeTool = useSelector((state: RootState) => state.ui.activeTool);
  const imageState = useSelector((state: RootState) => state.image);
  
  const [brushSize, setBrushSize] = useState(80);
  const [feather, setFeather] = useState(0.5);
  const [opacity] = useState(1.0);
  const [strokes, setStrokes] = useState<BrushStroke[]>([]);
  const [originalImageBeforeEdits, setOriginalImageBeforeEdits] = useState<ImageData | null>(null);
  const [workingImage, setWorkingImage] = useState<ImageData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('Processing...');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState<'preparing' | 'analyzing' | 'generating' | 'blending' | 'complete'>('preparing');
  const [aiUsageStats, setAiUsageStats] = useState(getAIUsageStats());
  
  // Use ref to always have current working image in callbacks (avoid stale closure)
  const workingImageRef = useRef<ImageData | null>(null);
  const originalImageRef = useRef<ImageData | null>(null);

  // Keep refs in sync with state - only update if state has a value
  // This prevents overwriting direct ref assignments with stale state
  useEffect(() => {
    if (workingImage !== null) {
      workingImageRef.current = workingImage;
    }
  }, [workingImage]);

  useEffect(() => {
    if (originalImageBeforeEdits !== null) {
      originalImageRef.current = originalImageBeforeEdits;
    }
  }, [originalImageBeforeEdits]);

  const isToolActive = activeTool === 'removal';
  const hasImage = imageState.current !== null;

  /**
   * Activate tool
   */
  const handleActivate = useCallback(() => {
    if (!hasImage || !imageState.current) {
      console.error('Cannot activate: no image available');
      return;
    }
    
    console.log('🔧 Activating healing tool with image:', {
      width: imageState.current.data.width,
      height: imageState.current.data.height,
    });
    
    // Store a copy of current image as backup
    const imageDataCopy = new ImageData(
      new Uint8ClampedArray(imageState.current.data.data),
      imageState.current.data.width,
      imageState.current.data.height
    );
    
    const workingCopy = new ImageData(
      new Uint8ClampedArray(imageState.current.data.data),
      imageState.current.data.width,
      imageState.current.data.height
    );
    
    // Set both state and refs immediately
    setOriginalImageBeforeEdits(imageDataCopy);
    setWorkingImage(workingCopy);
    workingImageRef.current = workingCopy;
    originalImageRef.current = imageDataCopy;
    
    setStrokes([]);
    
    dispatch(setActiveTool('removal'));
    
    console.log('✅ Removal tool activated');
  }, [dispatch, hasImage, imageState.current]);

  /**
   * Handle completed brush stroke - just save it, don't process yet
   */
  const handleStrokeComplete = useCallback(
    (stroke: BrushStroke) => {
      console.log('Stroke saved:', {
        points: stroke.points.length,
        size: stroke.size,
        isClosed: stroke.isClosed,
      });

      // Just add stroke to list - processing happens on Apply
      setStrokes((prev) => [...prev, stroke]);
    },
    []
  );

  /**
   * Process all strokes and apply to image
   */
  const processStrokes = useCallback(async () => {
    const originalImage = originalImageRef.current;
    if (!originalImage || strokes.length === 0) return;

    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingStage('preparing');
    setProcessingStatus('Preparing image...');

    // Start from original image
    const resultImage = new ImageData(
      new Uint8ClampedArray(originalImage.data),
      originalImage.width,
      originalImage.height
    );

    try {
      // Process each stroke with progress milestones
      const totalStrokes = strokes.length;
      for (let i = 0; i < totalStrokes; i++) {
        const stroke = strokes[i];
        const baseProgress = (i / totalStrokes) * 100;
        const strokeWeight = 100 / totalStrokes;
        
        // Stage 1: Preparing (0-10% of this stroke)
        setProcessingStage('preparing');
        setProcessingStatus(`Preparing area ${i + 1} of ${totalStrokes}...`);
        setProcessingProgress(baseProgress + strokeWeight * 0.1);
        
        // Create mask from stroke shape
        const { mask, bounds } = createStrokeMask(
          resultImage.width,
          resultImage.height,
          stroke.points,
          stroke.size / 2,
          stroke.feather
        );

        // Stage 2: Analyzing (10-30% of this stroke)
        setProcessingStage('analyzing');
        setProcessingStatus(`Analyzing surroundings...`);
        setProcessingProgress(baseProgress + strokeWeight * 0.3);
        await new Promise(r => setTimeout(r, 100)); // Brief pause for UI

        // Stage 3: Generating (30-80% of this stroke)
        setProcessingStage('generating');
        
        // Apply content-aware fill with progress callback
        await contentAwareFillWithMaskAsync(resultImage, mask, bounds, {
          onProgress: (status) => {
            setProcessingStatus(status);
            // Map internal progress to 30-80% range
            if (status.includes('Sending')) {
              setProcessingProgress(baseProgress + strokeWeight * 0.4);
            } else if (status.includes('Processing')) {
              setProcessingProgress(baseProgress + strokeWeight * 0.6);
            } else if (status.includes('Applying')) {
              setProcessingStage('blending');
              setProcessingProgress(baseProgress + strokeWeight * 0.85);
            }
          },
        });

        // Stage 4: Complete this stroke (100% of this stroke)
        setProcessingProgress(baseProgress + strokeWeight);
      }

      // Final stage
      setProcessingStage('complete');
      setProcessingStatus('Complete!');
      setProcessingProgress(100);
      
      // Brief pause to show completion
      await new Promise(r => setTimeout(r, 300));

      // Increment AI usage counter (tracks locally)
      incrementAIUsage();
      
      // Update AI usage stats for UI
      setAiUsageStats(getAIUsageStats());
      setIsProcessing(false);
      setProcessingProgress(0);

      // Update the image WITH HISTORY for undo support
      setWorkingImage(resultImage);
      workingImageRef.current = resultImage;

      dispatch(setCurrentImageWithHistory({
        data: resultImage,
        width: resultImage.width,
        height: resultImage.height,
        colorSpace: 'sRGB',
      }));

      // Clear strokes after processing
      setStrokes([]);

      console.log('All strokes processed and applied (added to undo history)');
    } catch (error) {
      console.error('AI removal failed:', error);
      setProcessingStatus(error instanceof Error ? error.message : 'AI removal failed');
      setProcessingStage('preparing'); // Reset stage
      
      // Show error briefly then reset
      await new Promise(r => setTimeout(r, 2000));
      setIsProcessing(false);
      setProcessingProgress(0);
      setProcessingStatus('Processing...');
      
      // Don't clear strokes so user can retry
    }
  }, [strokes, dispatch]);

  /**
   * Apply - process all strokes then close tool
   */
  const handleApply = useCallback(async () => {
    if (strokes.length > 0) {
      // Process all strokes first
      await processStrokes();
    }
    // Then close the tool
    dispatch(setActiveTool('none'));
    setStrokes([]);
    setWorkingImage(null);
    setOriginalImageBeforeEdits(null);
    workingImageRef.current = null;
    originalImageRef.current = null;
  }, [dispatch, strokes.length, processStrokes]);

  /**
   * Cancel changes - restore original and close
   */
  const handleCancel = useCallback(() => {
    const originalImage = originalImageRef.current;
    if (originalImage) {
      dispatch(setCurrentImage({
        data: originalImage,
        width: originalImage.width,
        height: originalImage.height,
        colorSpace: 'sRGB',
      }));
    }
    dispatch(setActiveTool('none'));
    setStrokes([]);
    setWorkingImage(null);
    setOriginalImageBeforeEdits(null);
    workingImageRef.current = null;
    originalImageRef.current = null;
  }, [dispatch]);

  /**
   * Undo - remove the last stroke (no processing yet)
   */
  const handleUndo = useCallback(() => {
    if (strokes.length === 0) return;
    // Just remove the last stroke from the list
    setStrokes((prev) => prev.slice(0, -1));
  }, [strokes.length]);

  /**
   * Keyboard shortcuts
   */
  useEffect(() => {
    if (!isToolActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Enter') {
        handleApply();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isToolActive, handleCancel, handleApply, handleUndo]);

  if (!isToolActive) {
    return (
      <div className="removal-adjustments__inactive">
        <p className="removal-adjustments__description">
          Draw around objects to remove them. The tool uses content-aware fill 
          with automatic healing for natural-looking results.
        </p>

        <div className="removal-adjustments__controls">
          <div className="removal-adjustments__control-group">
            <label className="removal-adjustments__label">
              Brush Size: {brushSize}px
            </label>
            <input
              type="range"
              min="10"
              max="200"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="removal-adjustments__slider"
            />
          </div>

          <div className="removal-adjustments__control-group">
            <label className="removal-adjustments__label">
              Edge Softness: {Math.round(feather * 100)}%
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
        </div>

        <button
          className="removal-adjustments__activate-button"
          onClick={handleActivate}
          disabled={disabled || !hasImage}
        >
          Start Removal Tool
        </button>

        <div className="removal-adjustments__tip">
          <strong>How to use:</strong>
          <ol className="removal-adjustments__tip-list">
            <li>Draw around or over the object you want to remove</li>
            <li>Close the shape for best results</li>
            <li>Click Apply when done</li>
          </ol>
        </div>

        {/* AI Usage Info */}
        <div className="removal-adjustments__ai-info">
          <div className="removal-adjustments__ai-badge">
            {window.location.hostname === 'localhost' || window.location.port === '5173'
              ? '🔧 Local Processing (Dev Mode)'
              : '🤖 AI-Powered Removal'
            }
          </div>
          <p className="removal-adjustments__ai-description">
            {window.location.hostname === 'localhost' || window.location.port === '5173'
              ? 'Deploy to Vercel to enable AI removal'
              : aiUsageStats.remaining === 0 
                ? '⚠️ Daily AI limit reached (5/5 used). Using local processing.'
                : `✨ ${aiUsageStats.used}/${aiUsageStats.limit} AI removals used today`
            }
          </p>
        </div>
      </div>
    );
  }

  // When tool is active, we render:
  // 1. A portal for the fixed toolbar at top
  // 2. The sidebar content in normal flow (for right column)
  return (
    <>
      {/* Fixed toolbar at top of screen */}
      <div className="removal-adjustments__fixed-toolbar">
        <div className="removal-adjustments__toolbar">
          <div className="removal-adjustments__tool-info">
            <span className="removal-adjustments__mode-badge">
              ✨ Remove Tool
            </span>
            <span className="removal-adjustments__stroke-count">
              {strokes.length === 0 
                ? 'Draw on areas to remove' 
                : `${strokes.length} ${strokes.length === 1 ? 'area' : 'areas'} marked`
              }
            </span>
          </div>

          <div className="removal-adjustments__brush-size-control">
            <label className="removal-adjustments__label" style={{ fontSize: '12px', marginRight: '8px' }}>
              Size: {brushSize}px
            </label>
            <input
              type="range"
              min="10"
              max="200"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="removal-adjustments__slider"
              style={{ width: '100px' }}
              title="Brush size (also use Ctrl+Scroll)"
            />
          </div>

          <div className="removal-adjustments__actions">
            <button
              className="removal-adjustments__action-btn removal-adjustments__action-btn--secondary"
              onClick={handleUndo}
              disabled={strokes.length === 0 || isProcessing}
              title="Remove last mark (Ctrl+Z)"
            >
              ↶ Undo
            </button>
            <button
              className="removal-adjustments__action-btn removal-adjustments__action-btn--danger"
              onClick={handleCancel}
              disabled={isProcessing}
              title="Cancel and discard all changes (Esc)"
            >
              Cancel
            </button>
            <button
              className="removal-adjustments__action-btn removal-adjustments__action-btn--primary"
              onClick={handleApply}
              disabled={strokes.length === 0 || isProcessing}
              title="Process and apply all removals (Enter)"
            >
              {isProcessing 
                ? '⏳ Processing...'
                : strokes.length > 0 
                  ? `✨ Remove ${strokes.length} ${strokes.length === 1 ? 'area' : 'areas'}`
                  : '✓ Done'
              }
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar content - flows in right column */}
      <div className="removal-adjustments__sidebar">
        {isProcessing ? (
          /* Processing Progress Panel */
          <div className="removal-adjustments__progress-panel">
            <div className="removal-adjustments__progress-header">
              <span className="removal-adjustments__progress-icon">✨</span>
              <span>AI Removing...</span>
            </div>
            
            <div className="removal-adjustments__progress-percent-large">
              {Math.round(processingProgress)}%
            </div>
            
            <div className="removal-adjustments__progress-bar-container">
              <div 
                className="removal-adjustments__progress-bar-fill" 
                style={{ width: `${processingProgress}%` }}
              />
            </div>
            
            <div className="removal-adjustments__progress-milestones-vertical">
              {(['preparing', 'analyzing', 'generating', 'blending'] as const).map((milestone, idx) => {
                const milestoneOrder = ['preparing', 'analyzing', 'generating', 'blending'];
                const currentIdx = milestoneOrder.indexOf(processingStage);
                const isComplete = idx < currentIdx || processingStage === 'complete';
                const isActive = processingStage === milestone;
                return (
                  <div 
                    key={milestone}
                    className={`removal-adjustments__milestone-row ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}`}
                  >
                    <span className="removal-adjustments__milestone-dot" />
                    <span className="removal-adjustments__milestone-label">
                      {milestone.charAt(0).toUpperCase() + milestone.slice(1)}
                    </span>
                    {isActive && <span className="removal-adjustments__milestone-spinner">⏳</span>}
                    {isComplete && <span className="removal-adjustments__milestone-check">✓</span>}
                  </div>
                );
              })}
            </div>
            
            <div className="removal-adjustments__progress-status">{processingStatus}</div>
          </div>
        ) : (
          /* Controls when not processing */
          <div className="removal-adjustments__controls-active">
            <p className="removal-adjustments__hint">
              Draw on the image to mark areas for removal.
            </p>
            
            <div className="removal-adjustments__control-group">
              <label className="removal-adjustments__label">
                Brush Size: {brushSize}px
              </label>
              <input
                type="range"
                min="10"
                max="200"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="removal-adjustments__slider"
              />
            </div>

            <div className="removal-adjustments__control-group">
              <label className="removal-adjustments__label">
                Edge Softness: {Math.round(feather * 100)}%
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

            <div className="removal-adjustments__tip">
              <strong>Shortcuts:</strong>
              <ul className="removal-adjustments__tip-list">
                <li><kbd>Ctrl</kbd>+<kbd>Scroll</kbd> - resize brush</li>
                <li><kbd>Enter</kbd> - apply changes</li>
                <li><kbd>Esc</kbd> - cancel</li>
              </ul>
            </div>

            {/* AI Usage Info */}
            <div className="removal-adjustments__ai-info">
              <div className="removal-adjustments__ai-badge">🤖 AI-Powered</div>
              <p className="removal-adjustments__ai-description">
                {aiUsageStats.remaining === 0 
                  ? '⚠️ Daily limit reached (5/5 used)'
                  : `${aiUsageStats.used}/${aiUsageStats.limit} AI removals used today`
                }
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Overlay for drawing */}
      {!isProcessing && (
        <RemovalToolOverlay
          canvasRef={canvasRef}
          onStrokeComplete={handleStrokeComplete}
          brushMode="content-aware"
          brushSize={brushSize}
          feather={feather}
          opacity={opacity}
          onBrushSizeChange={setBrushSize}
          completedStrokes={strokes}
        />
      )}
    </>
  );
};
