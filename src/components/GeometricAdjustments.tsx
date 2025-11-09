/**
 * GeometricAdjustments Component
 * Container for crop and straighten tools
 */

import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { setActiveTool } from '../store/uiSlice';
import { CollapsibleSection } from './CollapsibleSection';
import { SliderControl } from './SliderControl';
import { setStraighten } from '../store/adjustmentsSlice';
import './GeometricAdjustments.css';

export const GeometricAdjustments: React.FC = () => {
  const dispatch = useDispatch();

  // Redux state
  const straightenAngle = useSelector((state: RootState) => state.adjustments.straighten);
  const cropBounds = useSelector((state: RootState) => state.adjustments.crop);
  const activeTool = useSelector((state: RootState) => state.ui.activeTool);

  /**
   * Activate crop tool
   */
  const handleActivateCrop = useCallback(() => {
    dispatch(setActiveTool('crop'));
  }, [dispatch]);

  /**
   * Handle straighten angle change
   */
  const handleStraightenChange = useCallback(
    (value: number) => {
      dispatch(setStraighten(value));
    },
    [dispatch]
  );

  return (
    <CollapsibleSection title="Crop & Straighten" defaultExpanded={false}>
      <div className="geometric-adjustments">
        {/* Crop tool button */}
        <div className="geometric-adjustments__tool">
          <button
            className={`geometric-adjustments__tool-button ${
              activeTool === 'crop' ? 'geometric-adjustments__tool-button--active' : ''
            }`}
            onClick={handleActivateCrop}
          >
            {activeTool === 'crop' ? 'Crop Active' : 'Crop Image'}
          </button>
          {cropBounds && (
            <p className="geometric-adjustments__tool-info">
              {Math.round(cropBounds.width)} × {Math.round(cropBounds.height)} px
            </p>
          )}
        </div>

        {/* Straighten slider */}
        <div className="geometric-adjustments__straighten">
          <SliderControl
            label="Straighten"
            value={straightenAngle}
            min={-45}
            max={45}
            step={0.1}
            onChange={handleStraightenChange}
            unit="°"
          />
        </div>
      </div>
    </CollapsibleSection>
  );
};
