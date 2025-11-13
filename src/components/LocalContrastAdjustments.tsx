/**
 * LocalContrastAdjustments Component
 * Section for Local Laplacian-based multi-scale local contrast enhancement
 * Provides fine detail and coarse structure controls
 */

import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import {
  setLocalLaplacianEnabled,
  setLocalLaplacianDetail,
  setLocalLaplacianCoarse,
  setLocalLaplacianStrength,
} from '../store';
import { CollapsibleSection } from './CollapsibleSection';
import { SliderControl } from './SliderControl';
import { addToHistory } from '../store/historySlice';
import './LocalContrastAdjustments.css';

interface LocalContrastAdjustmentsProps {
  disabled?: boolean;
  expanded?: boolean;
}

export const LocalContrastAdjustments: React.FC<LocalContrastAdjustmentsProps> = ({ 
  disabled = false, 
  expanded 
}) => {
  const dispatch = useDispatch();
  const localLaplacian = useSelector((state: RootState) => state.adjustments.localLaplacian);
  const adjustments = useSelector((state: RootState) => state.adjustments);

  // Handler for saving to history when slider is released
  const handleChangeComplete = useCallback(() => {
    dispatch(addToHistory(adjustments));
  }, [dispatch, adjustments]);

  const handleEnabledChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(setLocalLaplacianEnabled(event.target.checked));
      dispatch(addToHistory({ 
        ...adjustments, 
        localLaplacian: { ...localLaplacian, enabled: event.target.checked } 
      }));
    },
    [dispatch, adjustments, localLaplacian]
  );

  const handleDetailChange = useCallback(
    (value: number) => {
      dispatch(setLocalLaplacianDetail(value));
    },
    [dispatch]
  );

  const handleCoarseChange = useCallback(
    (value: number) => {
      dispatch(setLocalLaplacianCoarse(value));
    },
    [dispatch]
  );

  const handleStrengthChange = useCallback(
    (value: number) => {
      dispatch(setLocalLaplacianStrength(value));
    },
    [dispatch]
  );

  return (
    <CollapsibleSection 
      title="Local Contrast" 
      defaultExpanded={false} 
      expanded={expanded} 
      disabled={disabled}
    >
      <div className="local-contrast-adjustments">
        {/* Enable/Disable Toggle */}
        <div className="local-contrast-adjustments__toggle">
          <label className="local-contrast-adjustments__toggle-label">
            <input
              type="checkbox"
              checked={localLaplacian.enabled}
              onChange={handleEnabledChange}
              disabled={disabled}
              className="local-contrast-adjustments__checkbox"
            />
            <span>Enable Local Contrast</span>
          </label>
        </div>

        {/* Fine Detail Slider */}
        <SliderControl
          label="Fine Detail"
          value={localLaplacian.detail}
          min={-1.0}
          max={1.0}
          step={0.05}
          precision={2}
          onChange={handleDetailChange}
          onChangeComplete={handleChangeComplete}
          tooltip="Controls fine detail enhancement at high frequencies. Positive values enhance texture and small details. Negative values smooth fine details. Affects the finest pyramid levels."
          disabled={disabled || !localLaplacian.enabled}
        />

        {/* Coarse Structure Slider */}
        <SliderControl
          label="Coarse Structure"
          value={localLaplacian.coarse}
          min={-1.0}
          max={1.0}
          step={0.05}
          precision={2}
          onChange={handleCoarseChange}
          onChangeComplete={handleChangeComplete}
          tooltip="Controls coarse structure enhancement at low frequencies. Positive values enhance larger-scale contrast and dimension. Negative values flatten structure. Affects the coarsest pyramid levels."
          disabled={disabled || !localLaplacian.enabled}
        />

        {/* Overall Strength Slider */}
        <SliderControl
          label="Overall Strength"
          value={localLaplacian.strength}
          min={0.0}
          max={2.0}
          step={0.1}
          precision={1}
          onChange={handleStrengthChange}
          onChangeComplete={handleChangeComplete}
          tooltip="Overall strength multiplier for all adjustments. Use this to scale the effect of both fine detail and coarse structure controls. Default is 1.0 (100%)."
          disabled={disabled || !localLaplacian.enabled}
        />

        {/* Info Text */}
        {localLaplacian.enabled && (
          <div className="local-contrast-adjustments__info">
            Local Laplacian provides multi-scale contrast enhancement without halos.
            {localLaplacian.detail > 0 && ' Enhancing fine texture and details.'}
            {localLaplacian.detail < 0 && ' Smoothing fine details.'}
            {localLaplacian.coarse > 0 && ' Enhancing coarse structure and dimension.'}
            {localLaplacian.coarse < 0 && ' Flattening coarse structure.'}
            {localLaplacian.detail === 0 && localLaplacian.coarse === 0 && ' Adjust detail or structure to see effects.'}
          </div>
        )}

        {/* Multi-scale Visualization Hint */}
        {localLaplacian.enabled && (localLaplacian.detail !== 0 || localLaplacian.coarse !== 0) && (
          <div className="local-contrast-adjustments__visualization">
            <div className="local-contrast-adjustments__scale-indicator">
              <div className="local-contrast-adjustments__scale-bar">
                <div 
                  className="local-contrast-adjustments__scale-detail"
                  style={{ 
                    width: '50%',
                    opacity: Math.abs(localLaplacian.detail) 
                  }}
                />
                <div 
                  className="local-contrast-adjustments__scale-coarse"
                  style={{ 
                    width: '50%',
                    opacity: Math.abs(localLaplacian.coarse) 
                  }}
                />
              </div>
              <div className="local-contrast-adjustments__scale-labels">
                <span>Fine</span>
                <span>Coarse</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};
