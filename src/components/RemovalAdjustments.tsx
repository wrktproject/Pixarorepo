/**
 * Removal Adjustments Component (Redesigned)
 * Professional healing/clone/content-aware tool with direct drawing
 */

import React, { useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { setActiveTool } from '../store/uiSlice';
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
  const [previewImage, setPreviewImage] = useState<ImageData | null>(null);

  const isToolActive = activeTool === 'removal';
  const hasImage = imageState.current !== null;

  /**
   * Activate tool
   */
  const handleActivate = useCallback(() => {
    if (!hasImage || !imageState.current) return;
    
    // Store original image for preview
    setPreviewImage(new ImageData(
      new Uint8ClampedArray(imageState.current.data.data),
      imageState.current.data.width,
      imageState.current.data.height
    ));
    
    setStrokes([]);
    dispatch(setActiveTool('removal'));
  }, [dispatch, hasImage, imageState.current]);

  /**
   * Handle completed brush stroke
   */
  const handleStrokeComplete = useCallback(
    (stroke: BrushStroke) => {
      if (!previewImage) return;

      // Add stroke to list
      setStrokes((prev) => [...prev, stroke]);

      // Apply stroke to preview
      const workingImage = new ImageData(
        new Uint8ClampedArray(previewImage.data),
        previewImage.width,
        previewImage.height
      );

      if (stroke.mode === 'clone' || stroke.mode === 'heal') {
        paintBrushStroke(workingImage, stroke.points, {
          mode: stroke.mode,
          sourceOffset: stroke.sourceOffset,
          radius: stroke.size,
          feather: stroke.feather,
          opacity: stroke.opacity,
        });
      } else if (stroke.mode === 'content-aware') {
        // Calculate bounding box of stroke
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;

        stroke.points.forEach((p) => {
          minX = Math.min(minX, p.x - stroke.size);
          minY = Math.min(minY, p.y - stroke.size);
          maxX = Math.max(maxX, p.x + stroke.size);
          maxY = Math.max(maxY, p.y + stroke.size);
        });

        contentAwareFill(workingImage, {
          x: Math.max(0, minX),
          y: Math.max(0, minY),
          width: Math.min(workingImage.width - minX, maxX - minX),
          height: Math.min(workingImage.height - minY, maxY - minY),
        });
      }

      setPreviewImage(workingImage);
    },
    [previewImage]
  );

  /**
   * Apply changes
   */
  const handleApply = useCallback(() => {
    if (!previewImage || !imageState.current) return;

    // TODO: Dispatch action to update image in Redux
    // For now, just deactivate the tool
    dispatch(setActiveTool('none'));
    setStrokes([]);
    setPreviewImage(null);
  }, [dispatch, previewImage, imageState.current]);

  /**
   * Cancel changes
   */
  const handleCancel = useCallback(() => {
    dispatch(setActiveTool('none'));
    setStrokes([]);
    setPreviewImage(null);
  }, [dispatch]);

  /**
   * Undo last stroke
   */
  const handleUndo = useCallback(() => {
    if (strokes.length === 0 || !imageState.current) return;

    // Remove last stroke
    const newStrokes = strokes.slice(0, -1);
    setStrokes(newStrokes);

    // Reapply all strokes from scratch
    const freshImage = new ImageData(
      new Uint8ClampedArray(imageState.current.data.data),
      imageState.current.data.width,
      imageState.current.data.height
    );

    newStrokes.forEach((stroke) => {
      if (stroke.mode === 'clone' || stroke.mode === 'heal') {
        paintBrushStroke(freshImage, stroke.points, {
          mode: stroke.mode,
          sourceOffset: stroke.sourceOffset,
          radius: stroke.size,
          feather: stroke.feather,
          opacity: stroke.opacity,
        });
      }
    });

    setPreviewImage(freshImage);
  }, [strokes, imageState.current]);

  if (!isToolActive) {
    return (
      <div className="removal-adjustments__inactive">
        <p className="removal-adjustments__description">
          Professional healing, cloning, and content-aware fill tool.
          Paint directly on your image to remove unwanted objects.
        </p>

        <div className="removal-adjustments__mode-selector">
          <label className="removal-adjustments__label">Tool Mode</label>
          <div className="removal-adjustments__mode-grid">
            <button
              className={`removal-adjustments__mode-btn ${brushMode === 'heal' ? 'removal-adjustments__mode-btn--active' : ''}`}
              onClick={() => setBrushMode('heal')}
            >
              <span className="removal-adjustments__mode-icon">🩹</span>
              <span>Heal</span>
            </button>
            <button
              className={`removal-adjustments__mode-btn ${brushMode === 'clone' ? 'removal-adjustments__mode-btn--active' : ''}`}
              onClick={() => setBrushMode('clone')}
            >
              <span className="removal-adjustments__mode-icon">📋</span>
              <span>Clone</span>
            </button>
            <button
              className={`removal-adjustments__mode-btn ${brushMode === 'content-aware' ? 'removal-adjustments__mode-btn--active' : ''}`}
              onClick={() => setBrushMode('content-aware')}
            >
              <span className="removal-adjustments__mode-icon">✨</span>
              <span>Content-Aware</span>
            </button>
          </div>
          <p className="removal-adjustments__hint">
            {brushMode === 'heal' && 'Blends texture from source area'}
            {brushMode === 'clone' && 'Copies pixels exactly from source'}
            {brushMode === 'content-aware' && 'AI fills using surrounding content'}
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
              max="150"
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
                min="0"
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
          <p className="removal-adjustments__tip">
            💡 Tip: Hold <kbd>Alt</kbd> and click to set the source point
          </p>
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
            className="removal-adjustments__action-btn removal-adjustments__action-btn--secondary"
            onClick={handleCancel}
            title="Cancel and discard changes (Esc)"
          >
            Cancel
          </button>
          <button
            className="removal-adjustments__action-btn removal-adjustments__action-btn--primary"
            onClick={handleApply}
            disabled={strokes.length === 0}
            title="Apply changes (Enter)"
          >
            Apply
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
      />
    </div>
  );
};
