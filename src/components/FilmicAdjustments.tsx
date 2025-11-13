/**
 * FilmicAdjustments Component
 * Section for filmic RGB tone mapping adjustments
 * Provides professional-grade tone mapping with film-like highlight rolloff
 */

import React, { useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import {
  setFilmicEnabled,
  setFilmicWhitePoint,
  setFilmicBlackPoint,
  setFilmicLatitude,
  setFilmicBalance,
  setFilmicShadowsContrast,
  setFilmicHighlightsContrast,
} from '../store';
import { CollapsibleSection } from './CollapsibleSection';
import { SliderControl } from './SliderControl';
import { addToHistory } from '../store/historySlice';
import './FilmicAdjustments.css';

interface FilmicAdjustmentsProps {
  disabled?: boolean;
  expanded?: boolean;
}

// Preset configurations for common use cases
const FILMIC_PRESETS = {
  standard: {
    whitePoint: 4.0,
    blackPoint: -8.0,
    latitude: 0.5,
    balance: 0.0,
    shadowsContrast: 'soft' as const,
    highlightsContrast: 'soft' as const,
  },
  highContrast: {
    whitePoint: 3.0,
    blackPoint: -6.0,
    latitude: 0.3,
    balance: 0.0,
    shadowsContrast: 'hard' as const,
    highlightsContrast: 'hard' as const,
  },
  lowContrast: {
    whitePoint: 6.0,
    blackPoint: -10.0,
    latitude: 0.7,
    balance: 0.0,
    shadowsContrast: 'safe' as const,
    highlightsContrast: 'safe' as const,
  },
};

export const FilmicAdjustments: React.FC<FilmicAdjustmentsProps> = ({ 
  disabled = false, 
  expanded 
}) => {
  const dispatch = useDispatch();
  const filmic = useSelector((state: RootState) => state.adjustments.filmic);
  const adjustments = useSelector((state: RootState) => state.adjustments);

  // Handler for saving to history when slider is released
  const handleChangeComplete = useCallback(() => {
    dispatch(addToHistory(adjustments));
  }, [dispatch, adjustments]);

  const handleEnabledChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(setFilmicEnabled(event.target.checked));
      dispatch(addToHistory({ ...adjustments, filmic: { ...filmic, enabled: event.target.checked } }));
    },
    [dispatch, adjustments, filmic]
  );

  const handleWhitePointChange = useCallback(
    (value: number) => {
      dispatch(setFilmicWhitePoint(value));
    },
    [dispatch]
  );

  const handleBlackPointChange = useCallback(
    (value: number) => {
      dispatch(setFilmicBlackPoint(value));
    },
    [dispatch]
  );

  const handleShadowsContrastChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value as 'hard' | 'soft' | 'safe';
      dispatch(setFilmicShadowsContrast(value));
      dispatch(addToHistory({ ...adjustments, filmic: { ...filmic, shadowsContrast: value } }));
    },
    [dispatch, adjustments, filmic]
  );

  const handleHighlightsContrastChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value as 'hard' | 'soft' | 'safe';
      dispatch(setFilmicHighlightsContrast(value));
      dispatch(addToHistory({ ...adjustments, filmic: { ...filmic, highlightsContrast: value } }));
    },
    [dispatch, adjustments, filmic]
  );

  const handlePresetClick = useCallback(
    (presetName: keyof typeof FILMIC_PRESETS) => {
      const preset = FILMIC_PRESETS[presetName];
      dispatch(setFilmicWhitePoint(preset.whitePoint));
      dispatch(setFilmicBlackPoint(preset.blackPoint));
      dispatch(setFilmicLatitude(preset.latitude));
      dispatch(setFilmicBalance(preset.balance));
      dispatch(setFilmicShadowsContrast(preset.shadowsContrast));
      dispatch(setFilmicHighlightsContrast(preset.highlightsContrast));
      dispatch(addToHistory({
        ...adjustments,
        filmic: {
          ...filmic,
          ...preset,
        },
      }));
    },
    [dispatch, adjustments, filmic]
  );

  // Convert latitude from 0.1-1.0 to 10-100% for display
  const latitudePercent = useMemo(() => filmic.latitude * 100, [filmic.latitude]);
  const handleLatitudePercentChange = useCallback(
    (value: number) => {
      dispatch(setFilmicLatitude(value / 100));
    },
    [dispatch]
  );

  // Convert balance from -0.5-0.5 to -50-50 for display
  const balancePercent = useMemo(() => filmic.balance * 100, [filmic.balance]);
  const handleBalancePercentChange = useCallback(
    (value: number) => {
      dispatch(setFilmicBalance(value / 100));
    },
    [dispatch]
  );

  return (
    <CollapsibleSection 
      title="Filmic RGB Tone Mapping" 
      defaultExpanded={false} 
      expanded={expanded} 
      disabled={disabled}
    >
      <div className="filmic-adjustments">
        {/* Enable/Disable Toggle */}
        <div className="filmic-adjustments__toggle">
          <label className="filmic-adjustments__toggle-label">
            <input
              type="checkbox"
              checked={filmic.enabled}
              onChange={handleEnabledChange}
              disabled={disabled}
              className="filmic-adjustments__checkbox"
            />
            <span>Enable Filmic</span>
          </label>
        </div>

        {/* Preset Buttons */}
        <div className="filmic-adjustments__presets">
          <button
            className="filmic-adjustments__preset-button"
            onClick={() => handlePresetClick('standard')}
            disabled={disabled || !filmic.enabled}
            title="Standard filmic curve with balanced compression"
          >
            Standard
          </button>
          <button
            className="filmic-adjustments__preset-button"
            onClick={() => handlePresetClick('highContrast')}
            disabled={disabled || !filmic.enabled}
            title="High contrast with strong compression"
          >
            High Contrast
          </button>
          <button
            className="filmic-adjustments__preset-button"
            onClick={() => handlePresetClick('lowContrast')}
            disabled={disabled || !filmic.enabled}
            title="Low contrast with gentle compression"
          >
            Low Contrast
          </button>
        </div>

        {/* White Point Slider */}
        <SliderControl
          label="White Point (EV)"
          value={filmic.whitePoint}
          min={0.5}
          max={8.0}
          step={0.1}
          precision={1}
          onChange={handleWhitePointChange}
          onChangeComplete={handleChangeComplete}
          tooltip="Sets the exposure value that maps to white. Higher values preserve more highlight detail but may reduce overall contrast. Lower values create a more contrasty look with earlier highlight rolloff."
          disabled={disabled || !filmic.enabled}
        />

        {/* Black Point Slider */}
        <SliderControl
          label="Black Point (EV)"
          value={filmic.blackPoint}
          min={-8.0}
          max={-0.5}
          step={0.1}
          precision={1}
          onChange={handleBlackPointChange}
          onChangeComplete={handleChangeComplete}
          tooltip="Sets the exposure value that maps to black. Lower values (more negative) preserve more shadow detail. Higher values (less negative) create deeper blacks with earlier shadow compression."
          disabled={disabled || !filmic.enabled}
        />

        {/* Latitude Slider */}
        <SliderControl
          label="Latitude (%)"
          value={latitudePercent}
          min={10}
          max={100}
          step={1}
          precision={0}
          onChange={handleLatitudePercentChange}
          onChangeComplete={handleChangeComplete}
          tooltip="Controls the contrast in the midtones. Higher values create a more linear response with lower contrast. Lower values create a steeper curve with higher contrast in the midtones."
          disabled={disabled || !filmic.enabled}
        />

        {/* Balance Slider */}
        <SliderControl
          label="Balance"
          value={balancePercent}
          min={-50}
          max={50}
          step={1}
          precision={0}
          onChange={handleBalancePercentChange}
          onChangeComplete={handleChangeComplete}
          tooltip="Shifts the balance between shadows and highlights. Negative values favor shadow preservation. Positive values favor highlight preservation. Zero provides balanced treatment."
          disabled={disabled || !filmic.enabled}
        />

        {/* Shadows Contrast Type */}
        <div className="filmic-adjustments__select-group">
          <label className="filmic-adjustments__select-label">
            Shadows Contrast
            <select
              value={filmic.shadowsContrast}
              onChange={handleShadowsContrastChange}
              disabled={disabled || !filmic.enabled}
              className="filmic-adjustments__select"
              title="Controls the curve shape in shadows. Hard: steep slope with strong contrast. Soft: gentle slope with moderate contrast. Safe: very gentle slope with minimal contrast."
            >
              <option value="hard">Hard</option>
              <option value="soft">Soft</option>
              <option value="safe">Safe</option>
            </select>
          </label>
        </div>

        {/* Highlights Contrast Type */}
        <div className="filmic-adjustments__select-group">
          <label className="filmic-adjustments__select-label">
            Highlights Contrast
            <select
              value={filmic.highlightsContrast}
              onChange={handleHighlightsContrastChange}
              disabled={disabled || !filmic.enabled}
              className="filmic-adjustments__select"
              title="Controls the curve shape in highlights. Hard: steep slope with strong contrast. Soft: gentle slope with moderate contrast. Safe: very gentle slope with minimal contrast and maximum highlight preservation."
            >
              <option value="hard">Hard</option>
              <option value="soft">Soft</option>
              <option value="safe">Safe</option>
            </select>
          </label>
        </div>

        {/* Info Text */}
        {filmic.enabled && (
          <div className="filmic-adjustments__info">
            Filmic RGB provides professional tone mapping with film-like highlight rolloff.
            Uses rational spline curves for smooth transitions and excellent color preservation.
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};
