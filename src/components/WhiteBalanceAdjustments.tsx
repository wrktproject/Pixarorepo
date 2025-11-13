/**
 * WhiteBalanceAdjustments Component
 * Professional white balance controls with Bradford chromatic adaptation
 * Provides temperature and tint adjustments with preset illuminants
 */

import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import {
  setWhiteBalanceModuleEnabled,
  setWhiteBalanceModuleTemperature,
  setWhiteBalanceModuleTint,
} from '../store';
import { CollapsibleSection } from './CollapsibleSection';
import { SliderControl } from './SliderControl';
import { addToHistory } from '../store/historySlice';
import './WhiteBalanceAdjustments.css';

interface WhiteBalanceAdjustmentsProps {
  disabled?: boolean;
  expanded?: boolean;
}

interface WhiteBalancePreset {
  temperature: number;
  tint: number;
  name: string;
}

const PRESETS: Record<string, WhiteBalancePreset> = {
  daylight: { temperature: 6500, tint: 0.0, name: 'Daylight (D65)' },
  cloudy: { temperature: 7500, tint: 0.0, name: 'Cloudy' },
  shade: { temperature: 8000, tint: 0.0, name: 'Shade' },
  tungsten: { temperature: 3200, tint: 0.0, name: 'Tungsten' },
  fluorescent: { temperature: 4000, tint: 0.15, name: 'Fluorescent' },
  flash: { temperature: 5500, tint: 0.0, name: 'Flash' },
};

export const WhiteBalanceAdjustments: React.FC<WhiteBalanceAdjustmentsProps> = ({ 
  disabled = false, 
  expanded 
}) => {
  const dispatch = useDispatch();
  const whiteBalanceModule = useSelector((state: RootState) => state.adjustments.whiteBalanceModule);
  const adjustments = useSelector((state: RootState) => state.adjustments);

  // Handler for saving to history when slider is released
  const handleChangeComplete = useCallback(() => {
    dispatch(addToHistory(adjustments));
  }, [dispatch, adjustments]);

  const handleEnabledChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(setWhiteBalanceModuleEnabled(event.target.checked));
      dispatch(addToHistory({ 
        ...adjustments, 
        whiteBalanceModule: { ...whiteBalanceModule, enabled: event.target.checked } 
      }));
    },
    [dispatch, adjustments, whiteBalanceModule]
  );

  const handleTemperatureChange = useCallback(
    (value: number) => {
      dispatch(setWhiteBalanceModuleTemperature(value));
    },
    [dispatch]
  );

  const handleTintChange = useCallback(
    (value: number) => {
      dispatch(setWhiteBalanceModuleTint(value));
    },
    [dispatch]
  );

  const handlePresetClick = useCallback(
    (preset: WhiteBalancePreset) => {
      dispatch(setWhiteBalanceModuleTemperature(preset.temperature));
      dispatch(setWhiteBalanceModuleTint(preset.tint));
      dispatch(addToHistory({ 
        ...adjustments, 
        whiteBalanceModule: { 
          ...whiteBalanceModule, 
          temperature: preset.temperature,
          tint: preset.tint
        } 
      }));
    },
    [dispatch, adjustments, whiteBalanceModule]
  );

  return (
    <CollapsibleSection 
      title="White Balance (Advanced)" 
      defaultExpanded={false} 
      expanded={expanded} 
      disabled={disabled}
    >
      <div className="white-balance-adjustments">
        {/* Enable/Disable Toggle */}
        <div className="white-balance-adjustments__toggle">
          <label className="white-balance-adjustments__toggle-label">
            <input
              type="checkbox"
              checked={whiteBalanceModule.enabled}
              onChange={handleEnabledChange}
              disabled={disabled}
              className="white-balance-adjustments__checkbox"
            />
            <span>Enable Advanced White Balance</span>
          </label>
        </div>

        {/* Temperature Slider */}
        <SliderControl
          label="Temperature"
          value={whiteBalanceModule.temperature}
          min={2000}
          max={25000}
          step={50}
          precision={0}
          onChange={handleTemperatureChange}
          onChangeComplete={handleChangeComplete}
          tooltip="Color temperature in Kelvin. Lower values (2000-4000K) produce warm/orange tones (tungsten, candlelight). Higher values (7000-25000K) produce cool/blue tones (shade, overcast). 6500K is neutral daylight."
          disabled={disabled || !whiteBalanceModule.enabled}
          colorGradient="linear-gradient(to right, #ff8c42, #ffffff, #a8d8ff)"
          unit="K"
        />

        {/* Tint Slider */}
        <SliderControl
          label="Tint"
          value={whiteBalanceModule.tint}
          min={-1.0}
          max={1.0}
          step={0.01}
          precision={2}
          onChange={handleTintChange}
          onChangeComplete={handleChangeComplete}
          tooltip="Green-magenta color shift. Negative values add magenta (useful for fluorescent lighting). Positive values add green. Use to correct color casts not addressed by temperature."
          disabled={disabled || !whiteBalanceModule.enabled}
          colorGradient="linear-gradient(to right, #ff00ff, #ffffff, #00ff00)"
        />

        {/* Preset Illuminants */}
        {whiteBalanceModule.enabled && (
          <div className="white-balance-adjustments__presets">
            <div className="white-balance-adjustments__presets-label">Presets:</div>
            <div className="white-balance-adjustments__presets-buttons">
              {Object.entries(PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  className="white-balance-adjustments__preset-button"
                  onClick={() => handlePresetClick(preset)}
                  disabled={disabled}
                  title={`${preset.name}: ${preset.temperature}K`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Color Temperature Indicator */}
        {whiteBalanceModule.enabled && (
          <div className="white-balance-adjustments__info">
            <div className="white-balance-adjustments__info-section">
              <strong>Current Setting:</strong> {Math.round(whiteBalanceModule.temperature)}K
              {whiteBalanceModule.tint !== 0 && ` with ${whiteBalanceModule.tint > 0 ? 'green' : 'magenta'} tint`}
            </div>
            <div className="white-balance-adjustments__info-section">
              <strong>Bradford Adaptation:</strong> Uses industry-standard Bradford chromatic 
              adaptation transform for accurate white balance that preserves color relationships.
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};
