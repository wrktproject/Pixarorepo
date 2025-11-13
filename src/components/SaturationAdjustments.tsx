/**
 * SaturationAdjustments Component
 * Section for perceptual saturation and vibrance adjustments
 * Provides global saturation, vibrance, and skin tone protection
 */

import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import {
  setSaturationModuleEnabled,
  setSaturationModuleSaturation,
  setSaturationModuleVibrance,
  setSaturationModuleSkinToneProtection,
  setSaturationModuleSkinProtectionStrength,
} from '../store';
import { CollapsibleSection } from './CollapsibleSection';
import { SliderControl } from './SliderControl';
import { addToHistory } from '../store/historySlice';
import './SaturationAdjustments.css';

interface SaturationAdjustmentsProps {
  disabled?: boolean;
  expanded?: boolean;
}

export const SaturationAdjustments: React.FC<SaturationAdjustmentsProps> = ({ 
  disabled = false, 
  expanded 
}) => {
  const dispatch = useDispatch();
  const saturationModule = useSelector((state: RootState) => state.adjustments.saturationModule);
  const adjustments = useSelector((state: RootState) => state.adjustments);

  // Handler for saving to history when slider is released
  const handleChangeComplete = useCallback(() => {
    dispatch(addToHistory(adjustments));
  }, [dispatch, adjustments]);

  const handleEnabledChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(setSaturationModuleEnabled(event.target.checked));
      dispatch(addToHistory({ 
        ...adjustments, 
        saturationModule: { ...saturationModule, enabled: event.target.checked } 
      }));
    },
    [dispatch, adjustments, saturationModule]
  );

  const handleSaturationChange = useCallback(
    (value: number) => {
      dispatch(setSaturationModuleSaturation(value));
    },
    [dispatch]
  );

  const handleVibranceChange = useCallback(
    (value: number) => {
      dispatch(setSaturationModuleVibrance(value));
    },
    [dispatch]
  );

  const handleSkinToneProtectionChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(setSaturationModuleSkinToneProtection(event.target.checked));
      dispatch(addToHistory({ 
        ...adjustments, 
        saturationModule: { 
          ...saturationModule, 
          skinToneProtection: event.target.checked 
        } 
      }));
    },
    [dispatch, adjustments, saturationModule]
  );

  const handleSkinProtectionStrengthChange = useCallback(
    (value: number) => {
      dispatch(setSaturationModuleSkinProtectionStrength(value));
    },
    [dispatch]
  );

  return (
    <CollapsibleSection 
      title="Perceptual Saturation" 
      defaultExpanded={false} 
      expanded={expanded} 
      disabled={disabled}
    >
      <div className="saturation-adjustments">
        {/* Enable/Disable Toggle */}
        <div className="saturation-adjustments__toggle">
          <label className="saturation-adjustments__toggle-label">
            <input
              type="checkbox"
              checked={saturationModule.enabled}
              onChange={handleEnabledChange}
              disabled={disabled}
              className="saturation-adjustments__checkbox"
            />
            <span>Enable Perceptual Saturation</span>
          </label>
        </div>

        {/* Global Saturation Slider */}
        <SliderControl
          label="Saturation"
          value={saturationModule.saturation}
          min={-1.0}
          max={1.0}
          step={0.01}
          precision={2}
          onChange={handleSaturationChange}
          onChangeComplete={handleChangeComplete}
          tooltip="Global saturation adjustment in perceptually uniform JzAzBz color space. Maintains luminance while scaling chroma. Positive values increase saturation, negative values decrease it."
          disabled={disabled || !saturationModule.enabled}
        />

        {/* Vibrance Slider */}
        <SliderControl
          label="Vibrance"
          value={saturationModule.vibrance}
          min={-1.0}
          max={1.0}
          step={0.01}
          precision={2}
          onChange={handleVibranceChange}
          onChangeComplete={handleChangeComplete}
          tooltip="Adaptive saturation that enhances muted colors more than already-saturated colors. Provides more natural-looking saturation boost without oversaturating already-vivid colors."
          disabled={disabled || !saturationModule.enabled}
        />

        {/* Skin Tone Protection Toggle */}
        <div className="saturation-adjustments__skin-protection">
          <label className="saturation-adjustments__toggle-label">
            <input
              type="checkbox"
              checked={saturationModule.skinToneProtection}
              onChange={handleSkinToneProtectionChange}
              disabled={disabled || !saturationModule.enabled}
              className="saturation-adjustments__checkbox"
            />
            <span>Skin Tone Protection</span>
          </label>
        </div>

        {/* Skin Protection Strength Slider */}
        {saturationModule.skinToneProtection && (
          <SliderControl
            label="Protection Strength"
            value={saturationModule.skinProtectionStrength}
            min={0.0}
            max={1.0}
            step={0.01}
            precision={2}
            onChange={handleSkinProtectionStrengthChange}
            onChangeComplete={handleChangeComplete}
            tooltip="Controls how much skin tones (orange-yellow hues around 30-60 degrees) are protected from saturation adjustments. Higher values provide stronger protection to prevent unnatural skin colors."
            disabled={disabled || !saturationModule.enabled}
          />
        )}

        {/* Info Text */}
        {saturationModule.enabled && (
          <div className="saturation-adjustments__info">
            Perceptual saturation uses JzAzBz color space for accurate, hue-preserving adjustments.
            Vibrance intelligently enhances muted colors while protecting already-saturated tones.
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};
