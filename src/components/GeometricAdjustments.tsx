/**
 * GeometricAdjustments Component
 * Container for crop and straighten tools
 */

import React, { useCallback, useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { setActiveTool, setShowGrid } from '../store/uiSlice';
import { SliderControl } from './SliderControl';
import { setCrop, setCropPreview, setStraighten, setStraightenPreview, setFlipHorizontal, setFlipVertical, setRotation, rotateLeft, rotateRight } from '../store/adjustmentsSlice';
import type { CropBounds } from '../types/adjustments';
import './GeometricAdjustments.css';

type AspectRatioPreset = '1:1' | '4:3' | '16:9' | 'original';

interface AspectRatioOption {
  label: string;
  value: AspectRatioPreset;
  ratio: number | null;
}

const ASPECT_RATIO_PRESETS: AspectRatioOption[] = [
  { label: '1:1', value: '1:1', ratio: 1 },
  { label: '4:3', value: '4:3', ratio: 4 / 3 },
  { label: '16:9', value: '16:9', ratio: 16 / 9 },
  { label: 'Original', value: 'original', ratio: null },
];

interface GeometricAdjustmentsProps {
  disabled?: boolean;
}

export const GeometricAdjustments: React.FC<GeometricAdjustmentsProps> = ({ disabled = false }) => {
  const dispatch = useDispatch();

  // Redux state
  const straightenAngle = useSelector((state: RootState) => state.adjustments.straighten);
  const cropBounds = useSelector((state: RootState) => state.adjustments.crop);
  const image = useSelector((state: RootState) => state.image.current);
  const activeTool = useSelector((state: RootState) => state.ui.activeTool);
  const showGrid = useSelector((state: RootState) => state.ui.showGrid);
  const flipHorizontal = useSelector((state: RootState) => state.adjustments.flipHorizontal);
  const flipVertical = useSelector((state: RootState) => state.adjustments.flipVertical);

  // Local state
  const [selectedPreset, setSelectedPreset] = useState<AspectRatioPreset | null>(null);
  const [originalAspectRatio, setOriginalAspectRatio] = useState<number | null>(null);
  const [initialCropState, setInitialCropState] = useState<typeof cropBounds>(null);

  // Set original aspect ratio when image loads
  useEffect(() => {
    if (image) {
      setOriginalAspectRatio(image.width / image.height);
    }
  }, [image]);

  // Save initial crop state when tool opens (only once)
  useEffect(() => {
    if (activeTool === 'crop' && initialCropState === null) {
      setInitialCropState(cropBounds);
    }
    // Reset when tool closes
    if (activeTool !== 'crop') {
      setInitialCropState(null);
    }
  }, [activeTool, cropBounds, initialCropState]);

  /**
   * Handle aspect ratio preset selection
   * Sets initial crop to the selected ratio but doesn't lock it
   */
  const handlePresetChange = useCallback(
    (preset: AspectRatioPreset) => {
      if (!image) return;

      setSelectedPreset(preset);

      let targetAspectRatio: number | null = null;

      // Determine target aspect ratio
      if (preset === 'original') {
        targetAspectRatio = originalAspectRatio;
      } else {
        const presetOption = ASPECT_RATIO_PRESETS.find((p) => p.value === preset);
        targetAspectRatio = presetOption?.ratio ?? null;
      }

      // Create new crop bounds centered with the target aspect ratio
      let width: number;
      let height: number;

      if (targetAspectRatio === null) {
        // Original - use full image
        width = image.width;
        height = image.height;
      } else {
        // Calculate crop size to fit image with target aspect ratio
        const imageAspect = image.width / image.height;
        
        if (targetAspectRatio > imageAspect) {
          // Wider than image - use full width
          width = image.width;
          height = width / targetAspectRatio;
        } else {
          // Taller than image - use full height
          height = image.height;
          width = height * targetAspectRatio;
        }
      }

      // Center the crop
      const x = (image.width - width) / 2;
      const y = (image.height - height) / 2;

      // Update crop without locking aspect ratio
      dispatch(
        setCropPreview({
          x,
          y,
          width,
          height,
          aspectRatio: null, // Don't lock aspect ratio - user can adjust freely
        })
      );
    },
    [image, originalAspectRatio, dispatch]
  );

  /**
   * Calculate the largest axis-aligned rectangle that fits in a rotated rectangle
   * MAINTAINING THE ORIGINAL ASPECT RATIO (like Lightroom)
   */
  const calculateInscribedCrop = useCallback((
    angleDegrees: number,
    imgWidth: number,
    imgHeight: number
  ): CropBounds => {
    if (Math.abs(angleDegrees) < 0.01) {
      return {
        x: 0,
        y: 0,
        width: imgWidth,
        height: imgHeight,
        aspectRatio: null,
      };
    }

    const angleRad = Math.abs(angleDegrees * Math.PI / 180);
    const c = Math.abs(Math.cos(angleRad));
    const s = Math.abs(Math.sin(angleRad));
    
    const W = imgWidth;
    const H = imgHeight;
    
    // Calculate the scale factor that makes the rotated rectangle fit
    // We need to scale uniformly to maintain aspect ratio
    
    // For a rectangle rotated by θ, the bounding box becomes:
    // boundingW = W*|cos| + H*|sin|
    // boundingH = W*|sin| + H*|cos|
    
    // To fit back in original WxH, we need scale factors:
    const scaleW = W / (W * c + H * s);
    const scaleH = H / (W * s + H * c);
    
    // Use the SMALLER scale to ensure both dimensions fit
    // This maintains aspect ratio
    const scale = Math.min(scaleW, scaleH);
    
    const cropWidth = W * scale;
    const cropHeight = H * scale;
    
    // Center the crop
    const x = (W - cropWidth) / 2;
    const y = (H - cropHeight) / 2;
    
    return {
      x,
      y,
      width: cropWidth,
      height: cropHeight,
      aspectRatio: null,
    };
  }, []);

  /**
   * Handle straighten angle change (preview only, doesn't add to history)
   * Auto-adjusts crop to largest rectangle that fits ONLY when crop tool is active
   */
  const handleStraightenChange = useCallback(
    (value: number) => {
      dispatch(setStraightenPreview(value));
      
      if (image && activeTool === 'crop') {
        if (Math.abs(value) > 0.01) {
          // Auto-shrink crop when rotating
          const newCrop = calculateInscribedCrop(value, image.width, image.height);
          dispatch(setCropPreview(newCrop));
        } else {
          // When angle returns to 0, reset crop to full image bounds
          // This allows user to expand crop to edges
          const fullCrop: CropBounds = {
            x: 0,
            y: 0,
            width: image.width,
            height: image.height,
            aspectRatio: null,
          };
          dispatch(setCropPreview(fullCrop));
        }
      }
    },
    [dispatch, image, activeTool, calculateInscribedCrop]
  );

  /**
   * Handle straighten angle change complete (adds to history)
   */
  const handleStraightenChangeComplete = useCallback(
    (value: number) => {
      dispatch(setStraighten(value));
      
      // Only commit adjusted crop if crop tool is active AND angle is not 0
      if (image && activeTool === 'crop' && Math.abs(value) > 0.01) {
        const newCrop = calculateInscribedCrop(value, image.width, image.height);
        dispatch(setCrop(newCrop));
      }
    },
    [dispatch, image, activeTool, calculateInscribedCrop]
  );

  /**
   * Reset crop to full image and clear all transformations
   */
  const handleReset = useCallback(() => {
    if (!image) return;

      dispatch(
        setCropPreview({
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
          aspectRatio: null,
        })
      );
    dispatch(setStraighten(0));
    dispatch(setRotation(0));
    dispatch(setFlipHorizontal(false));
    dispatch(setFlipVertical(false));
    setSelectedPreset(null);
  }, [image, dispatch]);

  /**
   * Cancel crop and close tool
   * Restores to the initial crop state without adding to history
   */
  const handleCancel = useCallback(() => {
    dispatch(setCropPreview(initialCropState));
    dispatch(setActiveTool('none'));
  }, [dispatch, initialCropState]);

  /**
   * Apply crop and close tool
   * This commits the crop to history (unlike preview updates during dragging)
   */
  const handleApply = useCallback(() => {
    // Commit the current crop bounds to history
    if (cropBounds) {
      dispatch(setCrop(cropBounds));
    }
    dispatch(setActiveTool('none'));
  }, [dispatch, cropBounds]);

  return (
    <div className="geometric-adjustments">
      {/* Crop dimensions */}
      {cropBounds && (
        <div className="geometric-adjustments__info">
          <p className="geometric-adjustments__dimensions">
            {Math.round(cropBounds.width)} × {Math.round(cropBounds.height)} px
          </p>
        </div>
      )}

      {/* Aspect Ratio Presets */}
      <div className="geometric-adjustments__section">
        <h4 className="geometric-adjustments__section-title">Aspect Ratio</h4>
        <div className="geometric-adjustments__preset-buttons">
          {ASPECT_RATIO_PRESETS.map((preset) => (
            <button
              key={preset.value}
              className={`geometric-adjustments__preset-button ${
                selectedPreset === preset.value ? 'geometric-adjustments__preset-button--active' : ''
              }`}
              onClick={() => handlePresetChange(preset.value)}
              disabled={disabled}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rotate & Flip section */}
      <div className="geometric-adjustments__section">
        <h3 className="geometric-adjustments__section-title">Rotate & Flip</h3>
        <div className="geometric-adjustments__rotate-flip-buttons">
          <button
            className="geometric-adjustments__icon-button"
            onClick={() => dispatch(rotateLeft())}
            disabled={disabled}
            title="Rotate left 90°"
          >
            ↶
          </button>
          <button
            className="geometric-adjustments__icon-button"
            onClick={() => dispatch(rotateRight())}
            disabled={disabled}
            title="Rotate right 90°"
          >
            ↷
          </button>
          <button
            className={`geometric-adjustments__icon-button ${flipHorizontal ? 'geometric-adjustments__icon-button--active' : ''}`}
            onClick={() => dispatch(setFlipHorizontal(!flipHorizontal))}
            disabled={disabled}
            title="Flip horizontal"
          >
            ⇄
          </button>
          <button
            className={`geometric-adjustments__icon-button ${flipVertical ? 'geometric-adjustments__icon-button--active' : ''}`}
            onClick={() => dispatch(setFlipVertical(!flipVertical))}
            disabled={disabled}
            title="Flip vertical"
          >
            ⇅
          </button>
        </div>
      </div>

      {/* Straighten slider */}
      <div className="geometric-adjustments__section">
        <SliderControl
          label="Straighten"
          value={straightenAngle}
          min={-45}
          max={45}
          step={0.1}
          onChange={handleStraightenChange}
          onChangeComplete={handleStraightenChangeComplete}
          disabled={disabled}
          unit="°"
        />
      </div>

      {/* Grid toggle */}
      <div className="geometric-adjustments__section">
        <label className="geometric-adjustments__checkbox">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => dispatch(setShowGrid(e.target.checked))}
            disabled={disabled}
          />
          <span>Show grid</span>
        </label>
      </div>

      {/* Action buttons */}
      <div className="geometric-adjustments__actions">
        <button
          className="geometric-adjustments__button geometric-adjustments__button--reset"
          onClick={handleReset}
          disabled={disabled}
        >
          Reset
        </button>
        <button
          className="geometric-adjustments__button geometric-adjustments__button--cancel"
          onClick={handleCancel}
          disabled={disabled}
        >
          Cancel
        </button>
        <button
          className="geometric-adjustments__button geometric-adjustments__button--primary"
          onClick={handleApply}
          disabled={disabled}
        >
          Apply
        </button>
      </div>
    </div>
  );
};
