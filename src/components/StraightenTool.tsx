/**
 * StraightenTool Component
 * Provides angle adjustment with visual rotation preview and grid overlay
 */

import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { setStraighten } from '../store/adjustmentsSlice';
import { SliderControl } from './SliderControl';
import './StraightenTool.css';

export const StraightenTool: React.FC = () => {
  const dispatch = useDispatch();

  // Redux state
  const straightenAngle = useSelector((state: RootState) => state.adjustments.straighten);
  const image = useSelector((state: RootState) => state.image.current);

  /**
   * Handle angle change
   */
  const handleAngleChange = useCallback(
    (value: number) => {
      dispatch(setStraighten(value));
    },
    [dispatch]
  );

  /**
   * Reset angle to 0
   */
  const handleReset = useCallback(() => {
    dispatch(setStraighten(0));
  }, [dispatch]);

  if (!image) {
    return null;
  }

  return (
    <div className="straighten-tool">
      {/* Grid overlay for alignment reference */}
      <div className="straighten-tool__grid-overlay">
        <div className="straighten-tool__grid">
          {/* Vertical lines */}
          {[...Array(9)].map((_, i) => (
            <div
              key={`v-${i}`}
              className="straighten-tool__grid-line straighten-tool__grid-line--vertical"
              style={{ left: `${(i + 1) * 10}%` }}
            />
          ))}
          {/* Horizontal lines */}
          {[...Array(9)].map((_, i) => (
            <div
              key={`h-${i}`}
              className="straighten-tool__grid-line straighten-tool__grid-line--horizontal"
              style={{ top: `${(i + 1) * 10}%` }}
            />
          ))}
          {/* Center crosshair */}
          <div className="straighten-tool__grid-line straighten-tool__grid-line--center-v" />
          <div className="straighten-tool__grid-line straighten-tool__grid-line--center-h" />
        </div>
      </div>

      {/* Controls panel */}
      <div className="straighten-tool__controls">
        <div className="straighten-tool__section">
          <h3 className="straighten-tool__section-title">Straighten</h3>
          <SliderControl
            label="Angle"
            value={straightenAngle}
            min={-45}
            max={45}
            step={0.1}
            onChange={handleAngleChange}
            unit="°"
          />
        </div>

        <div className="straighten-tool__info">
          <p className="straighten-tool__info-text">
            Use the slider to rotate the image. The grid helps align horizontal or vertical elements.
          </p>
        </div>

        <div className="straighten-tool__actions">
          <button
            className="straighten-tool__button straighten-tool__button--secondary"
            onClick={handleReset}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};
