/**
 * Removal Adjustments Component (Redesigned)
 * Professional healing/clone/content-aware tool with direct drawing
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { setActiveTool } from '../store/uiSlice';
import { setCurrentImage } from '../store/imageSlice';
import { RemovalToolOverlay, type BrushStroke } from './RemovalToolOverlay';
import { createStrokeMask } from '../utils/healingBrush';
import { contentAwareFillWithMaskAsync } from '../utils/contentAwareFill';
import { getRemainingAIUses } from '../utils/serverInpainting';
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
  const [aiUsesRemaining, setAiUsesRemaining] = useState<number | null>(getRemainingAIUses());
  
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

    // Update remaining AI uses
    setAiUsesRemaining(getRemainingAIUses());
    setIsProcessing(false);
    setProcessingProgress(0);

    // Update the image
    setWorkingImage(resultImage);
    workingImageRef.current = resultImage;

    dispatch(setCurrentImage({
      data: resultImage,
      width: resultImage.width,
      height: resultImage.height,
      colorSpace: 'sRGB',
    }));

    // Clear strokes after processing
    setStrokes([]);

    console.log('All strokes processed and applied');
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
              : aiUsesRemaining === 0 
                ? '⚠️ Daily AI limit reached. Using local processing.'
                : aiUsesRemaining !== null 
                  ? `✨ ${aiUsesRemaining} AI removals remaining today`
                  : '✨ 5 free AI removals per day'
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="removal-adjustments__active">
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
            {strokes.length > 0 
              ? `✨ Remove ${strokes.length} ${strokes.length === 1 ? 'area' : 'areas'}`
              : '✓ Done'
            }
          </button>
        </div>
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
      
      {/* Inline Processing Panel - appears in the sidebar area */}
      {isProcessing && (
        <div className="removal-adjustments__processing-panel">
          <div className="removal-adjustments__processing-header">
            <span className="removal-adjustments__processing-icon">✨</span>
            <span>AI Processing</span>
          </div>
          
          {/* Progress bar */}
          <div className="removal-adjustments__progress-container">
            <div 
              className="removal-adjustments__progress-bar"
              style={{ width: `${processingProgress}%` }}
            />
          </div>
          
          {/* Milestones */}
          <div className="removal-adjustments__milestones">
            <div className={`removal-adjustments__milestone ${processingStage === 'preparing' ? 'active' : ''} ${['analyzing', 'generating', 'blending', 'complete'].includes(processingStage) ? 'complete' : ''}`}>
              <div className="removal-adjustments__milestone-dot" />
              <span>Preparing</span>
            </div>
            <div className={`removal-adjustments__milestone ${processingStage === 'analyzing' ? 'active' : ''} ${['generating', 'blending', 'complete'].includes(processingStage) ? 'complete' : ''}`}>
              <div className="removal-adjustments__milestone-dot" />
              <span>Analyzing</span>
            </div>
            <div className={`removal-adjustments__milestone ${processingStage === 'generating' ? 'active' : ''} ${['blending', 'complete'].includes(processingStage) ? 'complete' : ''}`}>
              <div className="removal-adjustments__milestone-dot" />
              <span>Generating</span>
            </div>
            <div className={`removal-adjustments__milestone ${processingStage === 'blending' ? 'active' : ''} ${processingStage === 'complete' ? 'complete' : ''}`}>
              <div className="removal-adjustments__milestone-dot" />
              <span>Blending</span>
            </div>
          </div>
          
          {/* Status text */}
          <div className="removal-adjustments__processing-status">
            {processingStatus}
          </div>
          
          {/* Percentage */}
          <div className="removal-adjustments__processing-percent">
            {Math.round(processingProgress)}%
          </div>
        </div>
      )}
    </div>
  );
};
