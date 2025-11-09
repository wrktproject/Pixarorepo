/**
 * HSLAdjustments Component
 * Section for HSL adjustments with 8 color channels
 */

import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { setHSLHue, setHSLSaturation, setHSLLuminance } from '../store';
import type { ColorChannel } from '../types/adjustments';
import { CollapsibleSection } from './CollapsibleSection';
import { SliderControl } from './SliderControl';
import './HSLAdjustments.css';

const COLOR_CHANNELS: Array<{ key: ColorChannel; label: string }> = [
  { key: 'red', label: 'Red' },
  { key: 'orange', label: 'Orange' },
  { key: 'yellow', label: 'Yellow' },
  { key: 'green', label: 'Green' },
  { key: 'aqua', label: 'Aqua' },
  { key: 'blue', label: 'Blue' },
  { key: 'purple', label: 'Purple' },
  { key: 'magenta', label: 'Magenta' },
];

interface ColorChannelSectionProps {
  channel: ColorChannel;
  label: string;
}

const ColorChannelSection: React.FC<ColorChannelSectionProps> = ({
  channel,
  label,
}) => {
  const dispatch = useDispatch();
  const hslValues = useSelector(
    (state: RootState) => state.adjustments.hsl[channel]
  );

  const handleHueChange = useCallback(
    (value: number) => {
      dispatch(setHSLHue({ channel, value }));
    },
    [dispatch, channel]
  );

  const handleSaturationChange = useCallback(
    (value: number) => {
      dispatch(setHSLSaturation({ channel, value }));
    },
    [dispatch, channel]
  );

  const handleLuminanceChange = useCallback(
    (value: number) => {
      dispatch(setHSLLuminance({ channel, value }));
    },
    [dispatch, channel]
  );

  return (
    <CollapsibleSection title={label} defaultExpanded={false}>
      <SliderControl
        label="Hue"
        value={hslValues.hue}
        min={-100}
        max={100}
        step={1}
        precision={0}
        onChange={handleHueChange}
      />
      <SliderControl
        label="Saturation"
        value={hslValues.saturation}
        min={-100}
        max={100}
        step={1}
        precision={0}
        onChange={handleSaturationChange}
      />
      <SliderControl
        label="Luminance"
        value={hslValues.luminance}
        min={-100}
        max={100}
        step={1}
        precision={0}
        onChange={handleLuminanceChange}
      />
    </CollapsibleSection>
  );
};

export const HSLAdjustments: React.FC = () => {
  return (
    <div className="hsl-adjustments">
      <CollapsibleSection title="HSL / Color" defaultExpanded={false}>
        <div className="hsl-adjustments__channels">
          {COLOR_CHANNELS.map(({ key, label }) => (
            <ColorChannelSection key={key} channel={key} label={label} />
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );
};
