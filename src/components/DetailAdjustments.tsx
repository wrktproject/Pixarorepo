/**
 * DetailAdjustments Component
 * Section for guided filter-based detail enhancement
 * Provides edge-aware sharpening and smoothing controls
 */

import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import {
  setGuidedFilterEnabled,
  setGuidedFilterRadius,
  setGuidedFilterEpsilon,
  setGuidedFilterStrength,
} from '../store';
import { CollapsibleSection } from './CollapsibleSection';
import { SliderControl } from './SliderControl';
import { addToHistory } from '../store/historySlice';
import './DetailAdjustments.css';

interface DetailAdjustmentsProps {
  disabled?: boolean;
  expanded?: boolean;
}

export const DetailAdjustments: React.FC<DetailAdjustmentsProps> = ({ 
  disabled = false, 
  expanded 
}) => {
  const dispatch = useDispatch();
  const guidedFilter = useSelector((state: RootState) => state.adjustments.guidedFilter);
  const adjustments = useSelector((state: RootState) => state.adjustments);

  // Handler for saving to history when slider is released
  const handleChangeComplete = useCallback(() => {
    dispatch(addToHistory(adjustments));
  }, [dispatch, adjustments]);

  const handleEnabledChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(setGuidedFilterEnabled(event.target.checked));
      dispatch(addToHistory({ 
        ...adjustments, 
        guidedFilter: { ...guidedFilter, enabled: event.target.checked } 
      }));
    },
    [dispatch, adjustments, guidedFilter]
  );

  const handleStrengthChange = useCallback(
    (value: number) => {
      dispatch(setGuidedFilterStrength(value));
    },
    [dispatch]
  );

  const handleRadiusChange = useCallback(
    (value: number) => {
      dispatch(setGuidedFilterRadius(value));
    },
    [dispatch]
  );

  const handleEpsilonChange = useCallback(
    (value: number) => {
      dispatch(setGuidedFilterEpsilon(value));
    },
    [dispatch]
  );

  return (
    <CollapsibleSection 
      title="Detail Enhancement" 
      defaultExpanded={false} 
      expanded={expanded} 
      disabled={disabled}
    >
      <div className="detail-adjustments">
        {/* Enable/Disable Toggle */}
        <div className="detail-adjustments__toggle">
          <label className="detail-adjustments__toggle-label">
            <input
              type="checkbox"
              checked={guidedFilter.enabled}
              onChange={handleEnabledChange}
              disabled={disabled}
              className="detail-adjustments__checkbox"
            />
            <span>Enable Detail Enhancement</span>
          </label>
        </div>

        {/* Detail Strength Slider */}
        <SliderControl
          label="Detail Strength"
          value={guidedFilter.strength}
          min={-2.0}
          max={2.0}
          step={0.1}
          precision={1}
          onChange={handleStrengthChange}
          onChangeComplete={handleChangeComplete}
          tooltip="Controls detail enhancement strength. Positive values sharpen and enhance details. Negative values smooth and reduce details (denoising). Uses edge-aware guided filter to prevent halos."
          disabled={disabled || !guidedFilter.enabled}
        />

        {/* Radius Slider */}
        <SliderControl
          label="Radius"
          value={guidedFilter.radius}
          min={1}
          max={20}
          step={1}
          precision={0}
          onChange={handleRadiusChange}
          onChangeComplete={handleChangeComplete}
          tooltip="Filter radius in pixels. Larger radius affects broader areas and produces smoother results. Smaller radius preserves finer details. Typical range: 3-10 pixels."
          disabled={disabled || !guidedFilter.enabled}
        />

        {/* Edge Threshold (Epsilon) Slider */}
        <SliderControl
          label="Edge Threshold"
          value={guidedFilter.epsilon}
          min={0.001}
          max={1.0}
          step={0.001}
          precision={3}
          onChange={handleEpsilonChange}
          onChangeComplete={handleChangeComplete}
          tooltip="Edge preservation threshold (epsilon). Lower values preserve more edges and create sharper transitions. Higher values smooth across edges. Typical range: 0.01-0.1."
          disabled={disabled || !guidedFilter.enabled}
        />

        {/* Info Text */}
        {guidedFilter.enabled && (
          <div className="detail-adjustments__info">
            Guided filter provides edge-aware detail enhancement without halos.
            {guidedFilter.strength > 0 && ' Positive strength sharpens and enhances details.'}
            {guidedFilter.strength < 0 && ' Negative strength smooths and reduces noise.'}
            {guidedFilter.strength === 0 && ' Set strength above 0 to sharpen or below 0 to smooth.'}
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};
