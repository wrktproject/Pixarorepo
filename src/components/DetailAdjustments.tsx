/**
 * DetailAdjustments Component
 * Darktable-inspired sharpening with radius and threshold controls
 * Plus edge-aware guided filter for advanced detail enhancement
 */

import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import {
  setSharpening,
  setSharpenRadius,
  setSharpenThreshold,
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
  const adjustments = useSelector((state: RootState) => state.adjustments);
  const guidedFilter = adjustments.guidedFilter;
  const sharpening = adjustments.sharpening;
  const sharpenRadius = adjustments.sharpenRadius;
  const sharpenThreshold = adjustments.sharpenThreshold;

  // Handler for saving to history when slider is released
  const handleChangeComplete = useCallback(() => {
    dispatch(addToHistory(adjustments));
  }, [dispatch, adjustments]);

  // Sharpening handlers (Darktable-style)
  const handleSharpeningChange = useCallback(
    (value: number) => {
      dispatch(setSharpening(value));
    },
    [dispatch]
  );

  const handleSharpenRadiusChange = useCallback(
    (value: number) => {
      dispatch(setSharpenRadius(value));
    },
    [dispatch]
  );

  const handleSharpenThresholdChange = useCallback(
    (value: number) => {
      dispatch(setSharpenThreshold(value));
    },
    [dispatch]
  );

  // Guided filter handlers
  const handleGuidedEnabledChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(setGuidedFilterEnabled(event.target.checked));
      dispatch(addToHistory({ 
        ...adjustments, 
        guidedFilter: { ...guidedFilter, enabled: event.target.checked } 
      }));
    },
    [dispatch, adjustments, guidedFilter]
  );

  const handleGuidedStrengthChange = useCallback(
    (value: number) => {
      dispatch(setGuidedFilterStrength(value));
    },
    [dispatch]
  );

  const handleGuidedRadiusChange = useCallback(
    (value: number) => {
      dispatch(setGuidedFilterRadius(value));
    },
    [dispatch]
  );

  const handleGuidedEpsilonChange = useCallback(
    (value: number) => {
      dispatch(setGuidedFilterEpsilon(value));
    },
    [dispatch]
  );

  return (
    <CollapsibleSection 
      title="Detail" 
      defaultExpanded={false} 
      expanded={expanded} 
      disabled={disabled}
    >
      <div className="detail-adjustments">
        {/* Darktable-Style Sharpening Section */}
        <div className="detail-adjustments__section">
          <h4 className="detail-adjustments__section-title">Sharpening</h4>
          <p className="detail-adjustments__section-desc">
            Unsharp Mask (USM) algorithm inspired by Darktable
          </p>

          <SliderControl
            label="Amount"
            value={sharpening}
            min={0}
            max={150}
            step={1}
            precision={0}
            onChange={handleSharpeningChange}
            onChangeComplete={handleChangeComplete}
            tooltip="Sharpening strength. Controls how much the edges are enhanced. Higher values = stronger sharpening."
            disabled={disabled}
          />

          <SliderControl
            label="Radius"
            value={sharpenRadius}
            min={0.5}
            max={10}
            step={0.1}
            precision={1}
            onChange={handleSharpenRadiusChange}
            onChangeComplete={handleChangeComplete}
            tooltip="Spatial extent of the blur used for unsharp masking. Larger radius = affects larger features. Smaller radius = finer detail sharpening."
            disabled={disabled}
          />

          <SliderControl
            label="Threshold"
            value={sharpenThreshold}
            min={0}
            max={100}
            step={0.5}
            precision={1}
            onChange={handleSharpenThresholdChange}
            onChangeComplete={handleChangeComplete}
            tooltip="Noise gate threshold. Only sharpen pixels where the difference exceeds this value. Prevents sharpening of noise. Higher = less sharpening of subtle details."
            disabled={disabled}
          />

          {sharpening > 0 && (
            <div className="detail-adjustments__info detail-adjustments__info--active">
              ✓ Sharpening active: Amount {sharpening}%, Radius {sharpenRadius}px
            </div>
          )}
        </div>

        {/* Guided Filter Section */}
        <div className="detail-adjustments__section">
          <h4 className="detail-adjustments__section-title">Advanced Detail Enhancement</h4>
          
          <div className="detail-adjustments__toggle">
            <label className="detail-adjustments__toggle-label">
              <input
                type="checkbox"
                checked={guidedFilter.enabled}
                onChange={handleGuidedEnabledChange}
                disabled={disabled}
                className="detail-adjustments__checkbox"
              />
              <span>Enable Guided Filter</span>
            </label>
          </div>

          <SliderControl
            label="Detail Strength"
            value={guidedFilter.strength}
            min={-2.0}
            max={2.0}
            step={0.1}
            precision={1}
            onChange={handleGuidedStrengthChange}
            onChangeComplete={handleChangeComplete}
            tooltip="Edge-aware detail enhancement. Positive = sharpen. Negative = denoise."
            disabled={disabled || !guidedFilter.enabled}
          />

          <SliderControl
            label="Filter Radius"
            value={guidedFilter.radius}
            min={1}
            max={20}
            step={1}
            precision={0}
            onChange={handleGuidedRadiusChange}
            onChangeComplete={handleChangeComplete}
            tooltip="Filter radius in pixels. Larger = broader effect."
            disabled={disabled || !guidedFilter.enabled}
          />

          <SliderControl
            label="Edge Threshold"
            value={guidedFilter.epsilon}
            min={0.001}
            max={1.0}
            step={0.001}
            precision={3}
            onChange={handleGuidedEpsilonChange}
            onChangeComplete={handleChangeComplete}
            tooltip="Edge preservation. Lower = sharper edges. Higher = smoother."
            disabled={disabled || !guidedFilter.enabled}
          />

          {guidedFilter.enabled && (
            <div className="detail-adjustments__info">
              Guided filter provides edge-aware enhancement without halos.
            </div>
          )}
        </div>
      </div>
    </CollapsibleSection>
  );
};
