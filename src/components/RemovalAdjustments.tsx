/**
 * Removal Adjustments Component (Redesigned)
 * Professional healing/clone/content-aware tool with direct drawing
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { setActiveTool } from '../store/uiSlice';
import { setCurrentImage } from '../store/imageSlice';
import { RemovalToolOverlay, type BrushStroke } from './RemovalToolOverlay';
import { paintBrushStroke } from '../utils/healingBrush';
import { contentAwareFill } from '../utils/contentAwareFill';
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
  const [brushSize, setBrushSize] = useState(40);
  const [feather, setFeather] = useState(0.5);
  const [opacity, setOpacity] = useState(1.0);
  const [strokes, setStrokes] = useState<BrushStroke[]>([]);
  const [sourcePoint, setSourcePoint] = useState<{ x: number; y: number } | null>(null);
  const [originalImageBeforeEdits, setOriginalImageBeforeEdits] = useState<ImageData | null>(null);
  const [workingImage, setWorkingImage] = useState<ImageData | null>(null);

  const isToolActive = activeTool === 'removal';
  const hasImage = imageState.current !== null;

  /**
   * Activate tool
   */
  const handleActivate = useCallback(() => {
    if (!hasImage || !imageState.current) return;
    
    // Store a copy of current image as backup
    const imageDataCopy = new ImageData(
      new Uint8ClampedArray(imageState.current.data.data),
      imageState.current.data.width,
      imageState.current.data.height
    );
    
    setOriginalImageBeforeEdits(imageDataCopy);
    setWorkingImage(new ImageData(
      new Uint8ClampedArray(imageState.current.data.data),
      imageState.current.data.width,
      imageState.current.data.height
    ));
    setStrokes([]);
    setSourcePoint(null);
    dispatch(setActiveTool('removal'));
  }, [dispatch, hasImage, imageState.current]);

  /**
   * Handle completed brush stroke
   */
  const handleStrokeComplete = useCallback(
    (stroke: BrushStroke) => {
      if (!workingImage) {
        console.error('No working image available');
        return;
      }

      console.log('Stroke complete:', {
        mode: stroke.mode,
        points: stroke.points.length,
        size: stroke.size,
        hasSourceOffset: !!stroke.sourceOffset,
        sourceOffset: stroke.sourceOffset,
      });

      // Add stroke to list
      setStrokes((prev) => [...prev, stroke]);

      // Create new image data to work with (clone of working image)
      const modifiedImage = new ImageData(
        new Uint8ClampedArray(workingImage.data),
        workingImage.width,
        workingImage.height
      );

      // Apply stroke to the new image
      if (stroke.mode === 'clone' || stroke.mode === 'heal') {
        console.log('Applying', stroke.mode, 'stroke...');
        paintBrushStroke(modifiedImage, stroke.points, {
          mode: stroke.mode,
          sourceOffset: stroke.sourceOffset,
          radius: stroke.size / 2, // Convert diameter to radius
          feather: stroke.feather,
          opacity: stroke.opacity,
        });
      } else if (stroke.mode === 'content-aware') {
        console.log('Applying content-aware fill...');
        // Calculate bounding box of stroke
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;

        stroke.points.forEach((p) => {
          minX = Math.min(minX, p.x - stroke.size / 2);
          minY = Math.min(minY, p.y - stroke.size / 2);
          maxX = Math.max(maxX, p.x + stroke.size / 2);
          maxY = Math.max(maxY, p.y + stroke.size / 2);
        });

        contentAwareFill(modifiedImage, {
          x: Math.max(0, Math.floor(minX)),
          y: Math.max(0, Math.floor(minY)),
          width: Math.min(modifiedImage.width - minX, maxX - minX),
          height: Math.min(modifiedImage.height - minY, maxY - minY),
        });
      }

      console.log('Updating canvas with modified image...');

      // Update working image
      setWorkingImage(modifiedImage);

      // Update the displayed image so user sees the changes
      dispatch(setCurrentImage({
        data: modifiedImage,
        width: modifiedImage.width,
        height: modifiedImage.height,
        colorSpace: 'sRGB',
      }));

      console.log('Canvas update dispatched');
    },
    [workingImage, dispatch]
  );

  /**
   * Apply changes
   */
  const handleApply = useCallback(() => {
    // Changes are already applied to current image via handleStrokeComplete
    // Just clean up and deactivate
    dispatch(setActiveTool('none'));
    setStrokes([]);
    setWorkingImage(null);
    setOriginalImageBeforeEdits(null);
    setSourcePoint(null);
  }, [dispatch]);

  /**
   * Cancel changes
   */
  const handleCancel = useCallback(() => {
    // Restore original image from before any edits
    if (originalImageBeforeEdits) {
      dispatch(setCurrentImage({
        data: originalImageBeforeEdits,
        width: originalImageBeforeEdits.width,
        height: originalImageBeforeEdits.height,
        colorSpace: 'sRGB',
      }));
    }
    dispatch(setActiveTool('none'));
    setStrokes([]);
    setWorkingImage(null);
    setOriginalImageBeforeEdits(null);
    setSourcePoint(null);
  }, [dispatch, originalImageBeforeEdits]);

  /**
   * Undo last stroke
   */
  const handleUndo = useCallback(() => {
    if (strokes.length === 0 || !originalImageBeforeEdits) return;

    // Remove last stroke
    const newStrokes = strokes.slice(0, -1);
    setStrokes(newStrokes);

    // Reapply all remaining strokes from original image
    const freshImage = new ImageData(
      new Uint8ClampedArray(originalImageBeforeEdits.data),
      originalImageBeforeEdits.width,
      originalImageBeforeEdits.height
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

    // Update display
    dispatch(setCurrentImage({
      data: freshImage,
      width: freshImage.width,
      height: freshImage.height,
      colorSpace: 'sRGB',
    }));
  }, [strokes, originalImageBeforeEdits, dispatch]);

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
