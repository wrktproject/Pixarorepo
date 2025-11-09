/**
 * BasicAdjustments Component
 * Section for basic tonal adjustments (exposure, contrast, etc.)
 */

import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import {
  setExposure,
  setContrast,
  setHighlights,
  setShadows,
  setWhites,
  setBlacks,
} from '../store';
import { CollapsibleSection } from './CollapsibleSection';
import { SliderControl } from './SliderControl';

interface BasicAdjustmentsProps {
  disabled?: boolean;
  expanded?: boolean;
}

export const BasicAdjustments: React.FC<BasicAdjustmentsProps> = ({ disabled = false, expanded }) => {
  const dispatch = useDispatch();
  const adjustments = useSelector((state: RootState) => state.adjustments);

  const handleExposureChange = useCallback(
    (value: number) => {
      dispatch(setExposure(value));
    },
    [dispatch]
  );

  const handleContrastChange = useCallback(
    (value: number) => {
      dispatch(setContrast(value));
    },
    [dispatch]
  );

  const handleHighlightsChange = useCallback(
    (value: number) => {
      dispatch(setHighlights(value));
    },
    [dispatch]
  );

  const handleShadowsChange = useCallback(
    (value: number) => {
      dispatch(setShadows(value));
    },
    [dispatch]
  );

  const handleWhitesChange = useCallback(
    (value: number) => {
      dispatch(setWhites(value));
    },
    [dispatch]
  );

  const handleBlacksChange = useCallback(
    (value: number) => {
      dispatch(setBlacks(value));
    },
    [dispatch]
  );

  return (
    <CollapsibleSection title="Basic" defaultExpanded={false} expanded={expanded} disabled={disabled}>
      <SliderControl
        label="Exposure"
        value={adjustments.exposure}
        min={-5}
        max={5}
        step={0.01}
        precision={2}
        onChange={handleExposureChange}
        tooltip="Adjusts overall brightness in photographic stops. +1 stop doubles brightness, -1 stop halves it. Applied in linear color space for accurate results."
        disabled={disabled}
        colorGradient="linear-gradient(to right, #000000, #808080, #ffffff)"
      />
      <SliderControl
        label="Contrast"
        value={adjustments.contrast}
        min={-100}
        max={100}
        step={1}
        precision={0}
        onChange={handleContrastChange}
        tooltip="Expands or compresses the tonal range around the midpoint. Increases separation between light and dark areas without clipping."
        disabled={disabled}
      />
      <SliderControl
        label="Highlights"
        value={adjustments.highlights}
        min={-100}
        max={100}
        step={1}
        precision={0}
        onChange={handleHighlightsChange}
        tooltip="Recovers detail in bright areas using luminance-based masking. Negative values darken highlights, positive values brighten them."
        disabled={disabled}
        colorGradient="linear-gradient(to right, #606060, #c0c0c0, #ffffff)"
      />
      <SliderControl
        label="Shadows"
        value={adjustments.shadows}
        min={-100}
        max={100}
        step={1}
        precision={0}
        onChange={handleShadowsChange}
        tooltip="Recovers detail in dark areas using luminance-based masking. Positive values lift shadows, negative values deepen them."
        disabled={disabled}
        colorGradient="linear-gradient(to right, #000000, #404040, #808080)"
      />
      <SliderControl
        label="Whites"
        value={adjustments.whites}
        min={-100}
        max={100}
        step={1}
        precision={0}
        onChange={handleWhitesChange}
        tooltip="Adjusts the brightest tones in the image. Affects pixels with luminance above 80%. Use to fine-tune extreme highlights."
        disabled={disabled}
        colorGradient="linear-gradient(to right, #a0a0a0, #e0e0e0, #ffffff)"
      />
      <SliderControl
        label="Blacks"
        value={adjustments.blacks}
        min={-100}
        max={100}
        step={1}
        precision={0}
        disabled={disabled}
        colorGradient="linear-gradient(to right, #000000, #202020, #404040)"
        onChange={handleBlacksChange}
        tooltip="Adjusts the darkest tones in the image. Affects pixels with luminance below 15%. Use to fine-tune extreme shadows."
      />
    </CollapsibleSection>
  );
};
