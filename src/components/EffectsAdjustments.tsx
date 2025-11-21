/**
 * EffectsAdjustments Component
 * Section for effects adjustments (vignette, grain)
 */

import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import {
  setVignetteAmount,
  setVignetteMidpoint,
  setVignetteFeather,
  setGrainAmount,
  setGrainSize,
  setGrainRoughness,
} from '../store';
import { CollapsibleSection } from './CollapsibleSection';
import { SliderControl } from './SliderControl';
import './EffectsAdjustments.css';

interface EffectsAdjustmentsProps {
  disabled?: boolean;
  expanded?: boolean;
}

export const EffectsAdjustments: React.FC<EffectsAdjustmentsProps> = ({ disabled = false, expanded }) => {
  const dispatch = useDispatch();
  const adjustments = useSelector((state: RootState) => state.adjustments);

  const handleVignetteAmountChange = useCallback(
    (value: number) => {
      dispatch(setVignetteAmount(value));
    },
    [dispatch]
  );

  const handleVignetteMidpointChange = useCallback(
    (value: number) => {
      dispatch(setVignetteMidpoint(value));
    },
    [dispatch]
  );

  const handleVignetteFeatherChange = useCallback(
    (value: number) => {
      dispatch(setVignetteFeather(value));
    },
    [dispatch]
  );

  const handleGrainAmountChange = useCallback(
    (value: number) => {
      dispatch(setGrainAmount(value));
    },
    [dispatch]
  );

  const handleGrainSizeChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      dispatch(setGrainSize(event.target.value as 'fine' | 'medium' | 'coarse'));
    },
    [dispatch]
  );

  const handleGrainRoughnessChange = useCallback(
    (value: number) => {
      dispatch(setGrainRoughness(value));
    },
    [dispatch]
  );

  return (
    <CollapsibleSection title="Effects" defaultExpanded={false} expanded={expanded} disabled={disabled}>
      <div className="effects-adjustments__group">
        <h4 className="effects-adjustments__subtitle">Vignette</h4>
        <SliderControl
          label="Amount"
          value={adjustments.vignette.amount}
          min={-100}
          max={100}
          step={1}
          precision={0}
          onChange={handleVignetteAmountChange}
          disabled={disabled}
        />
        <SliderControl
          label="Midpoint"
          value={adjustments.vignette.midpoint}
          min={0}
          max={100}
          step={1}
          precision={0}
          onChange={handleVignetteMidpointChange}
          disabled={disabled}
        />
        <SliderControl
          label="Feather"
          value={adjustments.vignette.feather}
          min={0}
          max={100}
          step={1}
          precision={0}
          onChange={handleVignetteFeatherChange}
          disabled={disabled}
        />
      </div>

      <div className="effects-adjustments__group">
        <h4 className="effects-adjustments__subtitle">Grain</h4>
        <SliderControl
          label="Amount"
          value={adjustments.grain.amount}
          min={0}
          max={100}
          step={1}
          precision={0}
          onChange={handleGrainAmountChange}
          disabled={disabled}
        />
        <div className="effects-adjustments__dropdown">
          <label
            htmlFor="grain-size"
            className="effects-adjustments__dropdown-label"
          >
            Size
          </label>
          <select
            id="grain-size"
            className="effects-adjustments__select"
            value={adjustments.grain.size}
            onChange={handleGrainSizeChange}
            disabled={disabled}
          >
            <option value="fine">Fine</option>
            <option value="medium">Medium</option>
            <option value="coarse">Coarse</option>
          </select>
        </div>
        <SliderControl
          label="Roughness"
          value={adjustments.grain.roughness}
          min={0}
          max={100}
          step={1}
          precision={0}
          onChange={handleGrainRoughnessChange}
          disabled={disabled}
        />
      </div>
    </CollapsibleSection>
  );
};
