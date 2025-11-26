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
import { paintBrushStroke, createStrokeMask } from '../utils/healingBrush';
import { contentAwareFillWithMask } from '../utils/contentAwareFill';
import './RemovalAdjustments.css';

type BrushMode = 'clone' | 'heal' | 'content-aware';

interface RemovalAdjustmentsProps {
  disabled?: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export const RemovalAdjustments: React.FC<RemovalAdjustmentsProps> = ({ disabled = false, canvasRef }) => {
  const dispatch = useDispatch();
  const activeTool = useSelector((state: RootState) => state.ui.activeTool);
  const imageState = useSelector((state: RootState) => state.image);
  
  const [brushMode, setBrushMode] = useState<BrushMode>('heal');
  const [brushSize, setBrushSize] = useState(80);
  const [feather, setFeather] = useState(0.5);
  const [opacity, setOpacity] = useState(1.0);
  const [strokes, setStrokes] = useState<BrushStroke[]>([]);
  const [sourcePoint, setSourcePoint] = useState<{ x: number; y: number } | null>(null);
  const [originalImageBeforeEdits, setOriginalImageBeforeEdits] = useState<ImageData | null>(null);
  const [workingImage, setWorkingImage] = useState<ImageData | null>(null);
  
  // Use ref to always have current working image in callbacks (avoid stale closure)
  const workingImageRef = useRef<ImageData | null>(null);
  const originalImageRef = useRef<ImageData | null>(null);
  const sourcePointRef = useRef<{ x: number; y: number } | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    workingImageRef.current = workingImage;
  }, [workingImage]);

  useEffect(() => {
    originalImageRef.current = originalImageBeforeEdits;
  }, [originalImageBeforeEdits]);

  useEffect(() => {
    sourcePointRef.current = sourcePoint;
  }, [sourcePoint]);

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
    setSourcePoint(null);
    sourcePointRef.current = null;
    
    dispatch(setActiveTool('removal'));
    
    console.log('✅ Healing tool activated');
  }, [dispatch, hasImage, imageState.current]);

  /**
   * Handle completed brush stroke
   */
  const handleStrokeComplete = useCallback(
    (stroke: BrushStroke) => {
      // Use ref to get current working image (avoids stale closure)
      const currentWorkingImage = workingImageRef.current;
      const currentSourcePoint = sourcePointRef.current;
      
      if (!currentWorkingImage) {
        console.error('No working image available - ref is null');
        console.log('State workingImage:', workingImage);
        console.log('Ref workingImage:', workingImageRef.current);
        return;
      }

      console.log('Stroke complete:', {
        mode: stroke.mode,
        points: stroke.points.length,
        size: stroke.size,
        hasSourceOffset: !!stroke.sourceOffset,
        imageSize: `${currentWorkingImage.width}x${currentWorkingImage.height}`,
      });

      // Add stroke to list (include source point for visualization)
      const strokeWithSource = {
        ...stroke,
        sourcePoint: currentSourcePoint ? { ...currentSourcePoint } : undefined,
      };
      setStrokes((prev) => [...prev, strokeWithSource]);

      // Create new image data to work with (clone of working image)
      const modifiedImage = new ImageData(
        new Uint8ClampedArray(currentWorkingImage.data),
        currentWorkingImage.width,
        currentWorkingImage.height
      );

      // Apply stroke to the new image
      if (stroke.mode === 'clone' || stroke.mode === 'heal') {
        console.log('Applying', stroke.mode, 'stroke...');
        // Pass the absolute source point, not the offset
        // The healing brush will calculate the correct offset from the mask centroid
        paintBrushStroke(modifiedImage, stroke.points, {
          mode: stroke.mode,
          sourcePoint: currentSourcePoint || undefined, // Absolute source point
          radius: stroke.size / 2,
          feather: stroke.feather,
          opacity: stroke.opacity,
        });
      } else if (stroke.mode === 'content-aware') {
        console.log('Applying content-aware fill...');
        
        // Create mask from stroke shape (same as heal/clone)
        const { mask, bounds } = createStrokeMask(
          modifiedImage.width,
          modifiedImage.height,
          stroke.points,
          stroke.size / 2,
          stroke.feather
        );
        
        // Use mask-based content-aware fill
        contentAwareFillWithMask(modifiedImage, mask, bounds);
      }

      console.log('Updating canvas with modified image...');

      // Update both state and ref
      setWorkingImage(modifiedImage);
      workingImageRef.current = modifiedImage;

      // Use setTimeout to ensure stroke state update completes before image dispatch
      // This prevents the overlay from re-rendering with empty strokes
      setTimeout(() => {
        dispatch(setCurrentImage({
          data: modifiedImage,
          width: modifiedImage.width,
          height: modifiedImage.height,
          colorSpace: 'sRGB',
        }));
        console.log('Canvas update dispatched');
      }, 0);
    },
    [dispatch]
  );

  /**
   * Apply changes
   */
  const handleApply = useCallback(() => {
    dispatch(setActiveTool('none'));
    setStrokes([]);
    setWorkingImage(null);
    setOriginalImageBeforeEdits(null);
    setSourcePoint(null);
    workingImageRef.current = null;
    originalImageRef.current = null;
    sourcePointRef.current = null;
  }, [dispatch]);

  /**
   * Cancel changes
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
    setSourcePoint(null);
    workingImageRef.current = null;
    originalImageRef.current = null;
    sourcePointRef.current = null;
  }, [dispatch]);

  /**
   * Undo last stroke
   */
  const handleUndo = useCallback(() => {
    const originalImage = originalImageRef.current;
    if (strokes.length === 0 || !originalImage) return;

    const newStrokes = strokes.slice(0, -1);
    setStrokes(newStrokes);

    const freshImage = new ImageData(
      new Uint8ClampedArray(originalImage.data),
      originalImage.width,
      originalImage.height
    );

    newStrokes.forEach((stroke) => {
      if (stroke.mode === 'clone' || stroke.mode === 'heal') {
        paintBrushStroke(freshImage, stroke.points, {
          mode: stroke.mode,
          sourceOffset: stroke.sourceOffset,
          radius: stroke.size / 2,
          feather: stroke.feather,
          opacity: stroke.opacity,
        });
      }
    });

    setWorkingImage(freshImage);
    workingImageRef.current = freshImage;

    dispatch(setCurrentImage({
      data: freshImage,
      width: freshImage.width,
      height: freshImage.height,
      colorSpace: 'sRGB',
    }));
  }, [strokes, dispatch]);

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
          Remove unwanted objects, blemishes, or clone areas of your image.
        </p>

        <div className="removal-adjustments__mode-selector">
          <label className="removal-adjustments__label">Tool Mode</label>
          <div className="removal-adjustments__mode-grid">
            <button
              className={`removal-adjustments__mode-btn ${brushMode === 'heal' ? 'removal-adjustments__mode-btn--active' : ''}`}
              onClick={() => setBrushMode('heal')}
              title="Heal: Blends texture while matching colors"
            >
              <span className="removal-adjustments__mode-icon">🩹</span>
              <span>Heal</span>
            </button>
            <button
              className={`removal-adjustments__mode-btn ${brushMode === 'clone' ? 'removal-adjustments__mode-btn--active' : ''}`}
              onClick={() => setBrushMode('clone')}
              title="Clone: Direct pixel copy from source"
            >
              <span className="removal-adjustments__mode-icon">📋</span>
              <span>Clone</span>
            </button>
            <button
              className={`removal-adjustments__mode-btn ${brushMode === 'content-aware' ? 'removal-adjustments__mode-btn--active' : ''}`}
              onClick={() => setBrushMode('content-aware')}
              title="Content-Aware: AI fills using surrounding content"
            >
              <span className="removal-adjustments__mode-icon">✨</span>
              <span>Fill</span>
            </button>
          </div>
          <p className="removal-adjustments__hint">
            {brushMode === 'heal' && 'Copies texture, matches colors automatically'}
            {brushMode === 'clone' && 'Exact pixel copy from source point'}
            {brushMode === 'content-aware' && 'Fills with surrounding patterns'}
          </p>
        </div>

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

          {(brushMode === 'clone' || brushMode === 'heal') && (
            <div className="removal-adjustments__control-group">
              <label className="removal-adjustments__label">
                Opacity: {Math.round(opacity * 100)}%
              </label>
              <input
                type="range"
                min="10"
                max="100"
                value={opacity * 100}
                onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                className="removal-adjustments__slider"
              />
            </div>
          )}
        </div>

        <button
          className="removal-adjustments__activate-button"
          onClick={handleActivate}
          disabled={disabled || !hasImage}
        >
          Start {brushMode === 'heal' ? 'Healing' : brushMode === 'clone' ? 'Cloning' : 'Content-Aware Fill'}
        </button>

        {(brushMode === 'clone' || brushMode === 'heal') && (
          <div className="removal-adjustments__tip">
            <strong>How to use:</strong>
            <ol className="removal-adjustments__tip-list">
              <li>Hold <kbd>Alt</kbd> + Click to set source point</li>
              <li>Paint over the area you want to fix</li>
              <li>Click Apply when done</li>
            </ol>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="removal-adjustments__active">
      <div className="removal-adjustments__toolbar">
        <div className="removal-adjustments__tool-info">
          <span className="removal-adjustments__mode-badge">
            {brushMode === 'heal' && '🩹 Healing'}
            {brushMode === 'clone' && '📋 Cloning'}
            {brushMode === 'content-aware' && '✨ Content-Aware'}
          </span>
          <span className="removal-adjustments__stroke-count">
            {strokes.length} {strokes.length === 1 ? 'stroke' : 'strokes'}
          </span>
          {(brushMode === 'clone' || brushMode === 'heal') && (
            <span className={`removal-adjustments__source-status ${sourcePoint ? 'removal-adjustments__source-status--set' : ''}`}>
              {sourcePoint ? '✓ Source set' : '⚠ Alt+Click to set source'}
            </span>
          )}
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
            disabled={strokes.length === 0}
            title="Undo last stroke (Ctrl+Z)"
          >
            ↶ Undo
          </button>
          <button
            className="removal-adjustments__action-btn removal-adjustments__action-btn--danger"
            onClick={handleCancel}
            title="Cancel and discard all changes (Esc)"
          >
            Cancel
          </button>
          <button
            className="removal-adjustments__action-btn removal-adjustments__action-btn--primary"
            onClick={handleApply}
            title="Apply all changes (Enter)"
          >
            ✓ Apply
          </button>
        </div>
      </div>

      {/* Overlay for drawing */}
      <RemovalToolOverlay
        canvasRef={canvasRef}
        onStrokeComplete={handleStrokeComplete}
        brushMode={brushMode}
        brushSize={brushSize}
        feather={feather}
        opacity={opacity}
        onBrushSizeChange={setBrushSize}
        completedStrokes={strokes}
        sourcePoint={sourcePoint}
        onSourcePointChange={setSourcePoint}
      />
    </div>
  );
};
