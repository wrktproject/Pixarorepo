/**
 * HSLAdjustments Component
 * Unified HSL section with single color wheel and channel selection
 */

import React, { useCallback, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { setHSLHue, setHSLSaturation, setHSLLuminance } from '../store';
import type { ColorChannel } from '../types/adjustments';
import { CollapsibleSection } from './CollapsibleSection';
import { SliderControl } from './SliderControl';
import { UnifiedColorWheel } from './UnifiedColorWheel';
import './HSLAdjustments.css';

interface HSLAdjustmentsProps {
  disabled?: boolean;
  expanded?: boolean;
}

export const HSLAdjustments: React.FC<HSLAdjustmentsProps> = ({ disabled = false, expanded }) => {
  const dispatch = useDispatch();
  const [selectedChannel, setSelectedChannel] = useState<ColorChannel>('red');
  
  const hslValues = useSelector((state: RootState) => state.adjustments.hsl);
  const selectedValues = hslValues[selectedChannel];

  const handleWheelChange = useCallback(
    (channel: ColorChannel, hueValue: number, satValue: number) => {
      dispatch(setHSLHue({ channel, value: hueValue }));
      dispatch(setHSLSaturation({ channel, value: satValue }));
    },
    [dispatch]
  );

  const handleHueChange = useCallback(
    (value: number) => {
      dispatch(setHSLHue({ channel: selectedChannel, value }));
    },
    [dispatch, selectedChannel]
  );

  const handleSaturationChange = useCallback(
    (value: number) => {
      dispatch(setHSLSaturation({ channel: selectedChannel, value }));
    },
    [dispatch, selectedChannel]
  );

  const handleLuminanceChange = useCallback(
    (value: number) => {
      dispatch(setHSLLuminance({ channel: selectedChannel, value }));
    },
    [dispatch, selectedChannel]
  );

  return (
    <div className="hsl-adjustments">
      <CollapsibleSection title="HSL / Color" defaultExpanded={false} expanded={expanded} disabled={disabled}>
        <UnifiedColorWheel
          selectedChannel={selectedChannel}
          hslValues={hslValues}
          onSelectChannel={setSelectedChannel}
          onChange={handleWheelChange}
          disabled={disabled}
        />
        
        <div className="hsl-adjustments__sliders">
          <SliderControl
            label="Hue"
            value={selectedValues.hue}
            min={-100}
            max={100}
            step={1}
            precision={0}
            onChange={handleHueChange}
            disabled={disabled}
          />
          <SliderControl
            label="Saturation"
            value={selectedValues.saturation}
            min={-100}
            max={100}
            step={1}
            precision={0}
            onChange={handleSaturationChange}
            disabled={disabled}
          />
          <SliderControl
            label="Luminance"
            value={selectedValues.luminance}
            min={-100}
            max={100}
            step={1}
            precision={0}
            onChange={handleLuminanceChange}
            disabled={disabled}
          />
        </div>
      </CollapsibleSection>
    </div>
  );
};
