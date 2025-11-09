/**
 * DetailAdjustments Component
 * Section for detail adjustments (sharpening, clarity, noise reduction)
 */

import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import {
  setSharpening,
  setClarity,
  setNoiseReductionLuma,
  setNoiseReductionColor,
} from '../store';
import { CollapsibleSection } from './CollapsibleSection';
import { SliderControl } from './SliderControl';

interface DetailAdjustmentsProps {
  disabled?: boolean;
  expanded?: boolean;
}

export const DetailAdjustments: React.FC<DetailAdjustmentsProps> = ({ disabled = false, expanded }) => {
  const dispatch = useDispatch();
  const adjustments = useSelector((state: RootState) => state.adjustments);

  const handleSharpeningChange = useCallback(
    (value: number) => {
      dispatch(setSharpening(value));
    },
    [dispatch]
  );

  const handleClarityChange = useCallback(
    (value: number) => {
      dispatch(setClarity(value));
    },
    [dispatch]
  );

  const handleNoiseReductionLumaChange = useCallback(
    (value: number) => {
      dispatch(setNoiseReductionLuma(value));
    },
    [dispatch]
  );

  const handleNoiseReductionColorChange = useCallback(
    (value: number) => {
      dispatch(setNoiseReductionColor(value));
    },
    [dispatch]
  );

  return (
    <CollapsibleSection title="Detail" defaultExpanded={false} expanded={expanded} disabled={disabled}>
      <SliderControl
        label="Sharpening"
        value={adjustments.sharpening}
        min={0}
        max={150}
        step={1}
        precision={0}
        onChange={handleSharpeningChange}
        disabled={disabled}
        warning="High sharpening values may cause artifacts"
        tooltip="Enhances edge detail using unsharp mask technique. Applied in luminance channel only to avoid color fringing. Uses multi-pass rendering with Gaussian blur."
      />
      <SliderControl
        label="Clarity"
        value={adjustments.clarity}
        min={-100}
        max={100}
        step={1}
        precision={0}
        onChange={handleClarityChange}
        disabled={disabled}
        tooltip="Enhances local contrast and mid-tone detail using high-pass filtering. Positive values add punch and definition, negative values create a softer look. Uses two-pass rendering."
      />
      <SliderControl
        label="Luminance NR"
        value={adjustments.noiseReductionLuma}
        min={0}
        max={100}
        step={1}
        precision={0}
        onChange={handleNoiseReductionLumaChange}
        disabled={disabled}
        tooltip="Reduces brightness noise using bilateral filtering. Smooths grainy areas while preserving edges. Higher values provide stronger noise reduction but may soften detail."
      />
      <SliderControl
        label="Color NR"
        value={adjustments.noiseReductionColor}
        min={0}
        max={100}
        step={1}
        precision={0}
        onChange={handleNoiseReductionColorChange}
        disabled={disabled}
        tooltip="Reduces color noise and chromatic artifacts using bilateral filtering. Removes color speckles common in high-ISO images. Higher values provide stronger smoothing."
      />
    </CollapsibleSection>
  );
};
