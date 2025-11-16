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
import { addToHistory } from '../store/historySlice';

interface ColorAdjustmentsProps {
  disabled?: boolean;
  expanded?: boolean;
}

export const ColorAdjustments: React.FC<ColorAdjustmentsProps> = ({ disabled = false, expanded }) => {
  const dispatch = useDispatch();
  const adjustments = useSelector((state: RootState) => state.adjustments);

  const handleChangeComplete = useCallback(() => {
    dispatch(addToHistory(adjustments));
  }, [dispatch, adjustments]);

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
    <CollapsibleSection title="Color" defaultExpanded={false} expanded={expanded} disabled={disabled}>
      <SliderControl
        label="Temperature"
        value={adjustments.temperature}
        min={2500}
        max={25000}
        step={50}
        precision={0}
        unit="K"
        onChange={handleTemperatureChange}
        onChangeComplete={handleChangeComplete}
        tooltip="Color temperature white balance. 2500K = tungsten/warm lighting (adds blue correction). 6500K = daylight neutral. 25000K = shade/cool lighting (adds orange correction). Uses Bradford chromatic adaptation."
        disabled={disabled}
        colorGradient="linear-gradient(to right, #4d9aff, #ffffff, #ffb366)"
      />
      <SliderControl
        label="Tint"
        value={adjustments.tint}
        min={-150}
        max={150}
        step={1}
        precision={0}
        onChange={handleTintChange}
        onChangeComplete={handleChangeComplete}
        tooltip="Corrects color cast by shifting between magenta and green. Negative values add green, positive values add magenta. Useful for correcting fluorescent lighting."
        disabled={disabled}
        colorGradient="linear-gradient(to right, #00ff00, #808080, #ff00ff)"
      />
      <SliderControl
        label="Vibrance"
        value={adjustments.vibrance}
        min={-100}
        max={100}
        step={1}
        precision={0}
        onChange={handleVibranceChange}
        onChangeComplete={handleChangeComplete}
        tooltip="Smart saturation that boosts muted colors more than already-saturated colors. Protects skin tones and prevents oversaturation. Ideal for natural-looking color enhancement."
        disabled={disabled}
      />
      <SliderControl
        label="Saturation"
        value={adjustments.saturation}
        min={-100}
        max={100}
        step={1}
        precision={0}
        onChange={handleSaturationChange}
        onChangeComplete={handleChangeComplete}
        tooltip="Uniformly adjusts color intensity across the entire image. Positive values make colors more vivid, negative values move toward grayscale. Applied in HSL color space."
        disabled={disabled}
        colorGradient="linear-gradient(to right, #808080, #ff0000)"
      />
    </CollapsibleSection>
  );
};
