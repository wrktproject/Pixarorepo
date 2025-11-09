/**
 * ColorAdjustments Component
 * Section for color adjustments (temperature, tint, vibrance, saturation)
 */

import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import {
  setTemperature,
  setTint,
  setVibrance,
  setSaturation,
} from '../store';
import { CollapsibleSection } from './CollapsibleSection';
import { SliderControl } from './SliderControl';

export const ColorAdjustments: React.FC = () => {
  const dispatch = useDispatch();
  const adjustments = useSelector((state: RootState) => state.adjustments);

  const handleTemperatureChange = useCallback(
    (value: number) => {
      dispatch(setTemperature(value));
    },
    [dispatch]
  );

  const handleTintChange = useCallback(
    (value: number) => {
      dispatch(setTint(value));
    },
    [dispatch]
  );

  const handleVibranceChange = useCallback(
    (value: number) => {
      dispatch(setVibrance(value));
    },
    [dispatch]
  );

  const handleSaturationChange = useCallback(
    (value: number) => {
      dispatch(setSaturation(value));
    },
    [dispatch]
  );

  return (
    <CollapsibleSection title="Color" defaultExpanded={false}>
      <SliderControl
        label="Temperature"
        value={adjustments.temperature}
        min={2000}
        max={50000}
        step={50}
        precision={0}
        unit="K"
        onChange={handleTemperatureChange}
        tooltip="Adjusts color temperature to simulate different lighting conditions. Lower values add cool (blue) tones, higher values add warm (orange) tones. Uses accurate color matrices for natural results."
      />
      <SliderControl
        label="Tint"
        value={adjustments.tint}
        min={-150}
        max={150}
        step={1}
        precision={0}
        onChange={handleTintChange}
        tooltip="Corrects color cast by shifting between magenta and green. Negative values add green, positive values add magenta. Useful for correcting fluorescent lighting."
      />
      <SliderControl
        label="Vibrance"
        value={adjustments.vibrance}
        min={-100}
        max={100}
        step={1}
        precision={0}
        onChange={handleVibranceChange}
        tooltip="Smart saturation that boosts muted colors more than already-saturated colors. Protects skin tones and prevents oversaturation. Ideal for natural-looking color enhancement."
      />
      <SliderControl
        label="Saturation"
        value={adjustments.saturation}
        min={-100}
        max={100}
        step={1}
        precision={0}
        onChange={handleSaturationChange}
        tooltip="Uniformly adjusts color intensity across the entire image. Positive values make colors more vivid, negative values move toward grayscale. Applied in HSL color space."
      />
    </CollapsibleSection>
  );
};
