/**
 * ColorBalanceRGBAdjustments Component
 * Section for Color Balance RGB adjustments
 * Provides per-zone color grading (shadows, midtones, highlights, global)
 */

import React, { useCallback, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import {
  setColorBalanceRGBEnabled,
  setColorBalanceRGBShadows,
  setColorBalanceRGBMidtones,
  setColorBalanceRGBHighlights,
  setColorBalanceRGBGlobal,
  setColorBalanceRGBShadowsWeight,
  setColorBalanceRGBHighlightsWeight,
  setColorBalanceRGBMaskGreyFulcrum,
  setColorBalanceRGBContrast,
  setColorBalanceRGBContrastFulcrum,
  setColorBalanceRGBVibrance,
} from '../store';
import { CollapsibleSection } from './CollapsibleSection';
import { SliderControl } from './SliderControl';
import { addToHistory } from '../store/historySlice';
import './ColorBalanceRGBAdjustments.css';

interface ColorBalanceRGBAdjustmentsProps {
  disabled?: boolean;
  expanded?: boolean;
}

type ZoneTab = 'shadows' | 'midtones' | 'highlights' | 'global' | 'masks';

export const ColorBalanceRGBAdjustments: React.FC<ColorBalanceRGBAdjustmentsProps> = ({ 
  disabled = false, 
  expanded 
}) => {
  const dispatch = useDispatch();
  const colorBalanceRGB = useSelector((state: RootState) => state.adjustments.colorBalanceRGB);
  const adjustments = useSelector((state: RootState) => state.adjustments);
  const [activeTab, setActiveTab] = useState<ZoneTab>('midtones');

  // Handler for saving to history when slider is released
  const handleChangeComplete = useCallback(() => {
    dispatch(addToHistory(adjustments));
  }, [dispatch, adjustments]);

  const handleEnabledChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(setColorBalanceRGBEnabled(event.target.checked));
      dispatch(addToHistory({ 
        ...adjustments, 
        colorBalanceRGB: { ...colorBalanceRGB, enabled: event.target.checked } 
      }));
    },
    [dispatch, adjustments, colorBalanceRGB]
  );

  // Shadows adjustments
  const handleShadowsLuminanceChange = useCallback(
    (value: number) => {
      dispatch(setColorBalanceRGBShadows({
        ...colorBalanceRGB.shadows,
        luminance: value,
      }));
    },
    [dispatch, colorBalanceRGB.shadows]
  );

  const handleShadowsChromaChange = useCallback(
    (value: number) => {
      dispatch(setColorBalanceRGBShadows({
        ...colorBalanceRGB.shadows,
        chroma: value,
      }));
    },
    [dispatch, colorBalanceRGB.shadows]
  );

  const handleShadowsHueChange = useCallback(
    (value: number) => {
      dispatch(setColorBalanceRGBShadows({
        ...colorBalanceRGB.shadows,
        hue: value,
      }));
    },
    [dispatch, colorBalanceRGB.shadows]
  );

  // Midtones adjustments
  const handleMidtonesLuminanceChange = useCallback(
    (value: number) => {
      dispatch(setColorBalanceRGBMidtones({
        ...colorBalanceRGB.midtones,
        luminance: value,
      }));
    },
    [dispatch, colorBalanceRGB.midtones]
  );

  const handleMidtonesChromaChange = useCallback(
    (value: number) => {
      dispatch(setColorBalanceRGBMidtones({
        ...colorBalanceRGB.midtones,
        chroma: value,
      }));
    },
    [dispatch, colorBalanceRGB.midtones]
  );

  const handleMidtonesHueChange = useCallback(
    (value: number) => {
      dispatch(setColorBalanceRGBMidtones({
        ...colorBalanceRGB.midtones,
        hue: value,
      }));
    },
    [dispatch, colorBalanceRGB.midtones]
  );

  // Highlights adjustments
  const handleHighlightsLuminanceChange = useCallback(
    (value: number) => {
      dispatch(setColorBalanceRGBHighlights({
        ...colorBalanceRGB.highlights,
        luminance: value,
      }));
    },
    [dispatch, colorBalanceRGB.highlights]
  );

  const handleHighlightsChromaChange = useCallback(
    (value: number) => {
      dispatch(setColorBalanceRGBHighlights({
        ...colorBalanceRGB.highlights,
        chroma: value,
      }));
    },
    [dispatch, colorBalanceRGB.highlights]
  );

  const handleHighlightsHueChange = useCallback(
    (value: number) => {
      dispatch(setColorBalanceRGBHighlights({
        ...colorBalanceRGB.highlights,
        hue: value,
      }));
    },
    [dispatch, colorBalanceRGB.highlights]
  );

  // Global adjustments
  const handleGlobalLuminanceChange = useCallback(
    (value: number) => {
      dispatch(setColorBalanceRGBGlobal({
        ...colorBalanceRGB.global,
        luminance: value,
      }));
    },
    [dispatch, colorBalanceRGB.global]
  );

  const handleGlobalChromaChange = useCallback(
    (value: number) => {
      dispatch(setColorBalanceRGBGlobal({
        ...colorBalanceRGB.global,
        chroma: value,
      }));
    },
    [dispatch, colorBalanceRGB.global]
  );

  const handleGlobalHueChange = useCallback(
    (value: number) => {
      dispatch(setColorBalanceRGBGlobal({
        ...colorBalanceRGB.global,
        hue: value,
      }));
    },
    [dispatch, colorBalanceRGB.global]
  );

  // Mask controls
  const handleShadowsWeightChange = useCallback(
    (value: number) => {
      dispatch(setColorBalanceRGBShadowsWeight(value));
    },
    [dispatch]
  );

  const handleHighlightsWeightChange = useCallback(
    (value: number) => {
      dispatch(setColorBalanceRGBHighlightsWeight(value));
    },
    [dispatch]
  );

  const handleMaskGreyFulcrumChange = useCallback(
    (value: number) => {
      dispatch(setColorBalanceRGBMaskGreyFulcrum(value));
    },
    [dispatch]
  );

  // Advanced controls
  const handleContrastChange = useCallback(
    (value: number) => {
      dispatch(setColorBalanceRGBContrast(value));
    },
    [dispatch]
  );

  const handleContrastFulcrumChange = useCallback(
    (value: number) => {
      dispatch(setColorBalanceRGBContrastFulcrum(value));
    },
    [dispatch]
  );

  const handleVibranceChange = useCallback(
    (value: number) => {
      dispatch(setColorBalanceRGBVibrance(value));
    },
    [dispatch]
  );

  // Convert hue from radians to degrees for display
  const radToDeg = (rad: number) => (rad * 180) / Math.PI;
  const degToRad = (deg: number) => (deg * Math.PI) / 180;

  const renderZoneControls = (
    zone: 'shadows' | 'midtones' | 'highlights' | 'global',
    zoneData: { luminance: number; chroma: number; hue: number },
    handlers: {
      luminance: (value: number) => void;
      chroma: (value: number) => void;
      hue: (value: number) => void;
    }
  ) => (
    <div className="colorbalance-adjustments__zone-controls">
      <SliderControl
        label="Luminance"
        value={zoneData.luminance}
        min={-1.0}
        max={1.0}
        step={0.01}
        precision={2}
        onChange={handlers.luminance}
        onChangeComplete={handleChangeComplete}
        tooltip={`Adjust lightness in ${zone}. Positive values brighten, negative values darken.`}
        disabled={disabled || !colorBalanceRGB.enabled}
      />

      <SliderControl
        label="Chroma"
        value={zoneData.chroma}
        min={-1.0}
        max={1.0}
        step={0.01}
        precision={2}
        onChange={handlers.chroma}
        onChangeComplete={handleChangeComplete}
        tooltip={`Adjust color saturation in ${zone}. Positive values increase saturation, negative values decrease it.`}
        disabled={disabled || !colorBalanceRGB.enabled}
      />

      <SliderControl
        label="Hue (°)"
        value={radToDeg(zoneData.hue)}
        min={-180}
        max={180}
        step={1}
        precision={0}
        onChange={(value) => handlers.hue(degToRad(value))}
        onChangeComplete={handleChangeComplete}
        tooltip={`Shift hue in ${zone}. Rotates colors around the color wheel.`}
        disabled={disabled || !colorBalanceRGB.enabled}
      />
    </div>
  );

  return (
    <CollapsibleSection 
      title="Color Balance RGB" 
      defaultExpanded={false} 
      expanded={expanded} 
      disabled={disabled}
    >
      <div className="colorbalance-adjustments">
        {/* Enable/Disable Toggle */}
        <div className="colorbalance-adjustments__toggle">
          <label className="colorbalance-adjustments__toggle-label">
            <input
              type="checkbox"
              checked={colorBalanceRGB.enabled}
              onChange={handleEnabledChange}
              disabled={disabled}
              className="colorbalance-adjustments__checkbox"
            />
            <span>Enable Color Balance RGB</span>
          </label>
        </div>

        {/* Tab Navigation */}
        <div className="colorbalance-adjustments__tabs">
          <button
            className={`colorbalance-adjustments__tab ${activeTab === 'shadows' ? 'active' : ''}`}
            onClick={() => setActiveTab('shadows')}
            disabled={disabled || !colorBalanceRGB.enabled}
          >
            Shadows
          </button>
          <button
            className={`colorbalance-adjustments__tab ${activeTab === 'midtones' ? 'active' : ''}`}
            onClick={() => setActiveTab('midtones')}
            disabled={disabled || !colorBalanceRGB.enabled}
          >
            Midtones
          </button>
          <button
            className={`colorbalance-adjustments__tab ${activeTab === 'highlights' ? 'active' : ''}`}
            onClick={() => setActiveTab('highlights')}
            disabled={disabled || !colorBalanceRGB.enabled}
          >
            Highlights
          </button>
          <button
            className={`colorbalance-adjustments__tab ${activeTab === 'global' ? 'active' : ''}`}
            onClick={() => setActiveTab('global')}
            disabled={disabled || !colorBalanceRGB.enabled}
          >
            Global
          </button>
          <button
            className={`colorbalance-adjustments__tab ${activeTab === 'masks' ? 'active' : ''}`}
            onClick={() => setActiveTab('masks')}
            disabled={disabled || !colorBalanceRGB.enabled}
          >
            Masks
          </button>
        </div>

        {/* Tab Content */}
        <div className="colorbalance-adjustments__tab-content">
          {activeTab === 'shadows' && renderZoneControls(
            'shadows',
            colorBalanceRGB.shadows,
            {
              luminance: handleShadowsLuminanceChange,
              chroma: handleShadowsChromaChange,
              hue: handleShadowsHueChange,
            }
          )}

          {activeTab === 'midtones' && renderZoneControls(
            'midtones',
            colorBalanceRGB.midtones,
            {
              luminance: handleMidtonesLuminanceChange,
              chroma: handleMidtonesChromaChange,
              hue: handleMidtonesHueChange,
            }
          )}

          {activeTab === 'highlights' && renderZoneControls(
            'highlights',
            colorBalanceRGB.highlights,
            {
              luminance: handleHighlightsLuminanceChange,
              chroma: handleHighlightsChromaChange,
              hue: handleHighlightsHueChange,
            }
          )}

          {activeTab === 'global' && (
            <>
              {renderZoneControls(
                'global',
                colorBalanceRGB.global,
                {
                  luminance: handleGlobalLuminanceChange,
                  chroma: handleGlobalChromaChange,
                  hue: handleGlobalHueChange,
                }
              )}

              <div className="colorbalance-adjustments__divider" />

              <SliderControl
                label="Contrast"
                value={colorBalanceRGB.contrast}
                min={0.5}
                max={2.0}
                step={0.01}
                precision={2}
                onChange={handleContrastChange}
                onChangeComplete={handleChangeComplete}
                tooltip="Global contrast adjustment. Values above 1.0 increase contrast, below 1.0 decrease it."
                disabled={disabled || !colorBalanceRGB.enabled}
              />

              <SliderControl
                label="Contrast Fulcrum"
                value={colorBalanceRGB.contrastFulcrum}
                min={0.1}
                max={0.3}
                step={0.01}
                precision={2}
                onChange={handleContrastFulcrumChange}
                onChangeComplete={handleChangeComplete}
                tooltip="Pivot point for contrast adjustment. Typically set to middle grey (0.1845)."
                disabled={disabled || !colorBalanceRGB.enabled}
              />

              <SliderControl
                label="Vibrance"
                value={colorBalanceRGB.vibrance}
                min={-1.0}
                max={1.0}
                step={0.01}
                precision={2}
                onChange={handleVibranceChange}
                onChangeComplete={handleChangeComplete}
                tooltip="Adaptive saturation that enhances muted colors more than saturated ones. Protects skin tones."
                disabled={disabled || !colorBalanceRGB.enabled}
              />
            </>
          )}

          {activeTab === 'masks' && (
            <div className="colorbalance-adjustments__mask-controls">
              <SliderControl
                label="Shadows Weight"
                value={colorBalanceRGB.shadowsWeight}
                min={0.5}
                max={3.0}
                step={0.1}
                precision={1}
                onChange={handleShadowsWeightChange}
                onChangeComplete={handleChangeComplete}
                tooltip="Controls the falloff of the shadows mask. Higher values create sharper transitions."
                disabled={disabled || !colorBalanceRGB.enabled}
              />

              <SliderControl
                label="Highlights Weight"
                value={colorBalanceRGB.highlightsWeight}
                min={0.5}
                max={3.0}
                step={0.1}
                precision={1}
                onChange={handleHighlightsWeightChange}
                onChangeComplete={handleChangeComplete}
                tooltip="Controls the falloff of the highlights mask. Higher values create sharper transitions."
                disabled={disabled || !colorBalanceRGB.enabled}
              />

              <SliderControl
                label="Grey Fulcrum"
                value={colorBalanceRGB.maskGreyFulcrum}
                min={0.1}
                max={0.3}
                step={0.01}
                precision={2}
                onChange={handleMaskGreyFulcrumChange}
                onChangeComplete={handleChangeComplete}
                tooltip="Middle grey point for mask generation. Typically set to 0.1845 (18.45% grey)."
                disabled={disabled || !colorBalanceRGB.enabled}
              />

              <div className="colorbalance-adjustments__info">
                Mask controls determine how shadows, midtones, and highlights are separated.
                Higher weight values create sharper transitions between zones.
              </div>
            </div>
          )}
        </div>

        {/* Info Text */}
        {colorBalanceRGB.enabled && (
          <div className="colorbalance-adjustments__info">
            Color Balance RGB provides professional color grading with independent control
            over shadows, midtones, and highlights. Uses perceptually uniform DT UCS color space.
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};
