/**
 * CropTool Component
 * Provides draggable crop overlay with aspect ratio presets and composition grids
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { setCrop } from '../store/adjustmentsSlice';
import { setActiveTool } from '../store/uiSlice';
import type { CropBounds } from '../types/adjustments';
import './CropTool.css';

type AspectRatioPreset = '1:1' | '4:3' | '16:9' | 'original' | 'freeform';

interface AspectRatioOption {
  label: string;
  value: AspectRatioPreset;
  ratio: number | null;
}

const ASPECT_RATIO_PRESETS: AspectRatioOption[] = [
  { label: 'Freeform', value: 'freeform', ratio: null },
  { label: '1:1', value: '1:1', ratio: 1 },
  { label: '4:3', value: '4:3', ratio: 4 / 3 },
  { label: '16:9', value: '16:9', ratio: 16 / 9 },
  { label: 'Original', value: 'original', ratio: null }, // Will be set based on image
];

type DragHandle =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'
  | 'move'
  | null;

export const CropTool: React.FC = () => {
  const dispatch = useDispatch();
  const overlayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Redux state
  const image = useSelector((state: RootState) => state.image.current);
  const cropBounds = useSelector((state: RootState) => state.adjustments.crop);
  const activeTool = useSelector((state: RootState) => state.ui.activeTool);

  // Local state
  const [selectedPreset, setSelectedPreset] = useState<AspectRatioPreset>('freeform');
  const [showGrid, setShowGrid] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragHandle, setDragHandle] = useState<DragHandle>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [originalAspectRatio, setOriginalAspectRatio] = useState<number | null>(null);

  // Initialize crop bounds when tool is activated
  useEffect(() => {
    if (activeTool === 'crop' && image && !cropBounds) {
      // Set original aspect ratio
      const ratio = image.width / image.height;
      setOriginalAspectRatio(ratio);

      // Initialize with full image bounds
      const initialBounds: CropBounds = {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
        aspectRatio: null,
      };
      dispatch(setCrop(initialBounds));
    }
  }, [activeTool, image, cropBounds, dispatch]);

  /**
   * Handle aspect ratio preset selection
   */
  const handlePresetChange = useCallback(
    (preset: AspectRatioPreset) => {
      if (!cropBounds || !image) return;

      setSelectedPreset(preset);

      let newAspectRatio: number | null = null;

      if (preset === 'original' && originalAspectRatio) {
        newAspectRatio = originalAspectRatio;
      } else {
        const option = ASPECT_RATIO_PRESETS.find((p) => p.value === preset);
        newAspectRatio = option?.ratio ?? null;
      }

      // Adjust crop bounds to match new aspect ratio
      if (newAspectRatio !== null) {
        const currentAspect = cropBounds.width / cropBounds.height;

        let newWidth = cropBounds.width;
        let newHeight = cropBounds.height;

        if (currentAspect > newAspectRatio) {
          // Too wide, adjust width
          newWidth = cropBounds.height * newAspectRatio;
        } else {
          // Too tall, adjust height
          newHeight = cropBounds.width / newAspectRatio;
        }

        // Center the new bounds
        const newX = cropBounds.x + (cropBounds.width - newWidth) / 2;
        const newY = cropBounds.y + (cropBounds.height - newHeight) / 2;

        dispatch(
          setCrop({
            x: Math.max(0, newX),
            y: Math.max(0, newY),
            width: Math.min(newWidth, image.width),
            height: Math.min(newHeight, image.height),
            aspectRatio: newAspectRatio,
          })
        );
      } else {
        // Freeform - just update aspect ratio
        dispatch(
          setCrop({
            ...cropBounds,
            aspectRatio: null,
          })
        );
      }
    },
    [cropBounds, image, originalAspectRatio, dispatch]
  );

  /**
   * Handle mouse down on drag handles
   */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, handle: DragHandle) => {
      if (!cropBounds) return;

      e.preventDefault();
      e.stopPropagation();

      setIsDragging(true);
      setDragHandle(handle);
      setDragStart({ x: e.clientX, y: e.clientY });
    },
    [cropBounds]
  );

  /**
   * Handle mouse move for dragging
   */
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !dragHandle || !cropBounds || !image || !containerRef.current)
        return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();

      // Calculate scale factor between display and actual image
      const scaleX = image.width / rect.width;
      const scaleY = image.height / rect.height;

      const deltaX = (e.clientX - dragStart.x) * scaleX;
      const deltaY = (e.clientY - dragStart.y) * scaleY;

      let newBounds = { ...cropBounds };

      if (dragHandle === 'move') {
        // Move entire crop area
        newBounds.x = Math.max(0, Math.min(image.width - cropBounds.width, cropBounds.x + deltaX));
        newBounds.y = Math.max(0, Math.min(image.height - cropBounds.height, cropBounds.y + deltaY));
      } else {
        // Resize from handle
        const aspectRatio = cropBounds.aspectRatio;

        switch (dragHandle) {
          case 'nw':
            newBounds.x = Math.max(0, cropBounds.x + deltaX);
            newBounds.y = Math.max(0, cropBounds.y + deltaY);
            newBounds.width = cropBounds.width - (newBounds.x - cropBounds.x);
            newBounds.height = cropBounds.height - (newBounds.y - cropBounds.y);
            break;
          case 'n':
            newBounds.y = Math.max(0, cropBounds.y + deltaY);
            newBounds.height = cropBounds.height - (newBounds.y - cropBounds.y);
            break;
          case 'ne':
            newBounds.y = Math.max(0, cropBounds.y + deltaY);
            newBounds.width = Math.min(image.width - cropBounds.x, cropBounds.width + deltaX);
            newBounds.height = cropBounds.height - (newBounds.y - cropBounds.y);
            break;
          case 'e':
            newBounds.width = Math.min(image.width - cropBounds.x, cropBounds.width + deltaX);
            break;
          case 'se':
            newBounds.width = Math.min(image.width - cropBounds.x, cropBounds.width + deltaX);
            newBounds.height = Math.min(image.height - cropBounds.y, cropBounds.height + deltaY);
            break;
          case 's':
            newBounds.height = Math.min(image.height - cropBounds.y, cropBounds.height + deltaY);
            break;
          case 'sw':
            newBounds.x = Math.max(0, cropBounds.x + deltaX);
            newBounds.width = cropBounds.width - (newBounds.x - cropBounds.x);
            newBounds.height = Math.min(image.height - cropBounds.y, cropBounds.height + deltaY);
            break;
          case 'w':
            newBounds.x = Math.max(0, cropBounds.x + deltaX);
            newBounds.width = cropBounds.width - (newBounds.x - cropBounds.x);
            break;
        }

        // Apply aspect ratio constraint if set
        if (aspectRatio !== null && dragHandle !== 'n' && dragHandle !== 's') {
          const currentAspect = newBounds.width / newBounds.height;

          if (Math.abs(currentAspect - aspectRatio) > 0.01) {
            // Adjust based on which dimension changed more
            if (dragHandle === 'e' || dragHandle === 'w') {
              newBounds.height = newBounds.width / aspectRatio;
            } else {
              newBounds.width = newBounds.height * aspectRatio;
            }
          }
        }

        // Ensure minimum size
        newBounds.width = Math.max(50, newBounds.width);
        newBounds.height = Math.max(50, newBounds.height);

        // Ensure bounds stay within image
        if (newBounds.x + newBounds.width > image.width) {
          newBounds.width = image.width - newBounds.x;
        }
        if (newBounds.y + newBounds.height > image.height) {
          newBounds.height = image.height - newBounds.y;
        }
      }

      dispatch(setCrop(newBounds));
      setDragStart({ x: e.clientX, y: e.clientY });
    },
    [isDragging, dragHandle, cropBounds, image, dragStart, dispatch]
  );

  /**
   * Handle mouse up to end dragging
   */
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragHandle(null);
  }, []);

  /**
   * Set up global mouse event listeners
   */
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  /**
   * Apply crop and close tool
   */
  const handleApply = useCallback(() => {
    dispatch(setActiveTool('none'));
  }, [dispatch]);

  /**
   * Cancel crop and close tool
   */
  const handleCancel = useCallback(() => {
    dispatch(setCrop(null));
    dispatch(setActiveTool('none'));
  }, [dispatch]);

  /**
   * Reset crop to full image
   */
  const handleReset = useCallback(() => {
    if (!image) return;

    dispatch(
      setCrop({
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
        aspectRatio: null,
      })
    );
    setSelectedPreset('freeform');
  }, [image, dispatch]);

  if (activeTool !== 'crop' || !image || !cropBounds) {
    return null;
  }

  return (
    <div className="crop-tool">
      {/* Crop overlay */}
      <div ref={containerRef} className="crop-tool__overlay-container">
        <div
          ref={overlayRef}
          className="crop-tool__overlay"
          style={{
            left: `${(cropBounds.x / image.width) * 100}%`,
            top: `${(cropBounds.y / image.height) * 100}%`,
            width: `${(cropBounds.width / image.width) * 100}%`,
            height: `${(cropBounds.height / image.height) * 100}%`,
          }}
        >
          {/* Darkened areas outside crop */}
          <div className="crop-tool__mask crop-tool__mask--top" />
          <div className="crop-tool__mask crop-tool__mask--right" />
          <div className="crop-tool__mask crop-tool__mask--bottom" />
          <div className="crop-tool__mask crop-tool__mask--left" />

          {/* Crop border */}
          <div className="crop-tool__border" />

          {/* Grid overlay (rule of thirds) */}
          {showGrid && (
            <div className="crop-tool__grid">
              <div className="crop-tool__grid-line crop-tool__grid-line--v1" />
              <div className="crop-tool__grid-line crop-tool__grid-line--v2" />
              <div className="crop-tool__grid-line crop-tool__grid-line--h1" />
              <div className="crop-tool__grid-line crop-tool__grid-line--h2" />
            </div>
          )}

          {/* Drag handles */}
          <div
            className="crop-tool__handle crop-tool__handle--nw"
            onMouseDown={(e) => handleMouseDown(e, 'nw')}
          />
          <div
            className="crop-tool__handle crop-tool__handle--n"
            onMouseDown={(e) => handleMouseDown(e, 'n')}
          />
          <div
            className="crop-tool__handle crop-tool__handle--ne"
            onMouseDown={(e) => handleMouseDown(e, 'ne')}
          />
          <div
            className="crop-tool__handle crop-tool__handle--e"
            onMouseDown={(e) => handleMouseDown(e, 'e')}
          />
          <div
            className="crop-tool__handle crop-tool__handle--se"
            onMouseDown={(e) => handleMouseDown(e, 'se')}
          />
          <div
            className="crop-tool__handle crop-tool__handle--s"
            onMouseDown={(e) => handleMouseDown(e, 's')}
          />
          <div
            className="crop-tool__handle crop-tool__handle--sw"
            onMouseDown={(e) => handleMouseDown(e, 'sw')}
          />
          <div
            className="crop-tool__handle crop-tool__handle--w"
            onMouseDown={(e) => handleMouseDown(e, 'w')}
          />

          {/* Move handle (center area) */}
          <div
            className="crop-tool__move-area"
            onMouseDown={(e) => handleMouseDown(e, 'move')}
          />
        </div>
      </div>

      {/* Controls panel */}
      <div className="crop-tool__controls">
        <div className="crop-tool__section">
          <h3 className="crop-tool__section-title">Aspect Ratio</h3>
          <div className="crop-tool__preset-buttons">
            {ASPECT_RATIO_PRESETS.map((preset) => (
              <button
                key={preset.value}
                className={`crop-tool__preset-button ${
                  selectedPreset === preset.value ? 'crop-tool__preset-button--active' : ''
                }`}
                onClick={() => handlePresetChange(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="crop-tool__section">
          <label className="crop-tool__checkbox">
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
            />
            <span>Show grid</span>
          </label>
        </div>

        <div className="crop-tool__actions">
          <button className="crop-tool__button crop-tool__button--secondary" onClick={handleReset}>
            Reset
          </button>
          <button className="crop-tool__button crop-tool__button--secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button className="crop-tool__button crop-tool__button--primary" onClick={handleApply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};
