/**
 * SigmoidAdjustments Component
 * Section for sigmoid tone mapping adjustments
 * Provides S-curve tone compression with excellent color preservation
 */

import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import {
  setSigmoidEnabled,
  setSigmoidContrast,
  setSigmoidSkew,
  setSigmoidMiddleGrey,
} from '../store';
import { CollapsibleSection } from './CollapsibleSection';
import { SliderControl } from './SliderControl';
import { addToHistory } from '../store/historySlice';
import './SigmoidAdjustments.css';

interface SigmoidAdjustmentsProps {
  disabled?: boolean;
  expanded?: boolean;
}

// Preset configurations for common use cases
const SIGMOID_PRESETS = {
  soft: {
    contrast: 0.8,
    skew: 0.0,
    middleGrey: 0.1845,
  },
  medium: {
    contrast: 1.0,
    skew: 0.0,
    middleGrey: 0.1845,
  },
  hard: {
    contrast: 1.5,
    skew: 0.0,
    middleGrey: 0.1845,
  },
};

export const SigmoidAdjustments: React.FC<SigmoidAdjustmentsProps> = ({ 
  disabled = false, 
  expanded 
}) => {
  const dispatch = useDispatch();
  const sigmoid = useSelector((state: RootState) => state.adjustments.sigmoid);
  const adjustments = useSelector((state: RootState) => state.adjustments);

  // Handler for saving to history when slider is released
  const handleChangeComplete = useCallback(() => {
    dispatch(addToHistory(adjustments));
  }, [dispatch, adjustments]);

  const handleEnabledChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(setSigmoidEnabled(event.target.checked));
      dispatch(addToHistory({ ...adjustments, sigmoid: { ...sigmoid, enabled: event.target.checked } }));
    },
    [dispatch, adjustments, sigmoid]
  );

  const handleContrastChange = useCallback(
    (value: number) => {
      dispatch(setSigmoidContrast(value));
    },
    [dispatch]
  );

  const handleSkewChange = useCallback(
    (value: number) => {
      dispatch(setSigmoidSkew(value));
    },
    [dispatch]
  );

  const handleMiddleGreyChange = useCallback(
    (value: number) => {
      dispatch(setSigmoidMiddleGrey(value));
    },
    [dispatch]
  );

  const handlePresetClick = useCallback(
    (presetName: keyof typeof SIGMOID_PRESETS) => {
      const preset = SIGMOID_PRESETS[presetName];
      dispatch(setSigmoidContrast(preset.contrast));
      dispatch(setSigmoidSkew(preset.skew));
      dispatch(setSigmoidMiddleGrey(preset.middleGrey));
      dispatch(addToHistory({
        ...adjustments,
        sigmoid: {
          ...sigmoid,
          ...preset,
        },
      }));
    },
    [dispatch, adjustments, sigmoid]
  );

  return (
    <CollapsibleSection 
      title="Sigmoid Tone Mapping" 
      defaultExpanded={false} 
      expanded={expanded} 
      disabled={disabled}
    >
      <div className="sigmoid-adjustments">
        {/* Enable/Disable Toggle */}
        <div className="sigmoid-adjustments__toggle">
          <label className="sigmoid-adjustments__toggle-label">
            <input
              type="checkbox"
              checked={sigmoid.enabled}
              onChange={handleEnabledChange}
              disabled={disabled}
              className="sigmoid-adjustments__checkbox"
            />
            <span>Enable Sigmoid</span>
          </label>
        </div>

        {/* Preset Buttons */}
        <div className="sigmoid-adjustments__presets">
          <button
            className="sigmoid-adjustments__preset-button ripple"
            onClick={() => handlePresetClick('soft')}
            disabled={disabled || !sigmoid.enabled}
            title="Soft S-curve with gentle compression"
            aria-label="Apply soft sigmoid preset"
          >
            Soft
          </button>
          <button
            className="sigmoid-adjustments__preset-button ripple"
            onClick={() => handlePresetClick('medium')}
            disabled={disabled || !sigmoid.enabled}
            title="Medium S-curve with balanced compression"
            aria-label="Apply medium sigmoid preset"
          >
            Medium
          </button>
          <button
            className="sigmoid-adjustments__preset-button ripple"
            onClick={() => handlePresetClick('hard')}
            disabled={disabled || !sigmoid.enabled}
            title="Hard S-curve with strong compression"
            aria-label="Apply hard sigmoid preset"
          >
            Hard
          </button>
        </div>

        {/* Contrast Slider */}
        <SliderControl
          label="Contrast"
          value={sigmoid.contrast}
          min={0.5}
          max={2.0}
          step={0.01}
          precision={2}
          onChange={handleContrastChange}
          onChangeComplete={handleChangeComplete}
          tooltip="Controls the steepness of the S-curve. Higher values create more contrast with stronger highlight and shadow compression. Lower values produce a gentler, more linear response."
          disabled={disabled || !sigmoid.enabled}
        />

        {/* Skew Slider */}
        <SliderControl
          label="Skew"
          value={sigmoid.skew}
          min={-1.0}
          max={1.0}
          step={0.01}
          precision={2}
          onChange={handleSkewChange}
          onChangeComplete={handleChangeComplete}
          tooltip="Shifts the curve to favor shadows or highlights. Negative values preserve shadow detail at the expense of highlights. Positive values preserve highlight detail at the expense of shadows."
          disabled={disabled || !sigmoid.enabled}
        />

        {/* Middle Grey Slider */}
        <SliderControl
          label="Middle Grey"
          value={sigmoid.middleGrey}
          min={0.1}
          max={0.3}
          step={0.001}
          precision={3}
          onChange={handleMiddleGreyChange}
          onChangeComplete={handleChangeComplete}
          tooltip="Sets the target middle grey value (pivot point). Default is 0.1845 (18.45%), the photographic standard. Lower values darken the image, higher values brighten it."
          disabled={disabled || !sigmoid.enabled}
        />

        {/* Info Text */}
        {sigmoid.enabled && (
          <div className="sigmoid-adjustments__info">
            Sigmoid provides film-like S-curve tone mapping with excellent color preservation.
            Works in linear space for accurate results.
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};
