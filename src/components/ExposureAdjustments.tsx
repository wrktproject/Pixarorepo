/**
 * ExposureAdjustments Component
 * Advanced exposure controls with highlight preservation
 * Provides scene-referred exposure adjustment with highlight reconstruction
 */

import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import {
  setExposureModuleEnabled,
  setExposureModuleExposure,
  setExposureModuleBlackPoint,
  setExposureModuleHighlightReconstruction,
  setExposureModuleReconstructionThreshold,
} from '../store';
import { CollapsibleSection } from './CollapsibleSection';
import { SliderControl } from './SliderControl';
import { addToHistory } from '../store/historySlice';
import './ExposureAdjustments.css';

interface ExposureAdjustmentsProps {
  disabled?: boolean;
  expanded?: boolean;
}

export const ExposureAdjustments: React.FC<ExposureAdjustmentsProps> = ({ 
  disabled = false, 
  expanded 
}) => {
  const dispatch = useDispatch();
  const exposureModule = useSelector((state: RootState) => state.adjustments.exposureModule);
  const adjustments = useSelector((state: RootState) => state.adjustments);

  // Handler for saving to history when slider is released
  const handleChangeComplete = useCallback(() => {
    dispatch(addToHistory(adjustments));
  }, [dispatch, adjustments]);

  const handleEnabledChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(setExposureModuleEnabled(event.target.checked));
      dispatch(addToHistory({ 
        ...adjustments, 
        exposureModule: { ...exposureModule, enabled: event.target.checked } 
      }));
    },
    [dispatch, adjustments, exposureModule]
  );

  const handleExposureChange = useCallback(
    (value: number) => {
      dispatch(setExposureModuleExposure(value));
    },
    [dispatch]
  );

  const handleBlackPointChange = useCallback(
    (value: number) => {
      dispatch(setExposureModuleBlackPoint(value));
    },
    [dispatch]
  );

  const handleHighlightReconstructionChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(setExposureModuleHighlightReconstruction(event.target.checked));
      dispatch(addToHistory({ 
        ...adjustments, 
        exposureModule: { 
          ...exposureModule, 
          highlightReconstruction: event.target.checked 
        } 
      }));
    },
    [dispatch, adjustments, exposureModule]
  );

  const handleReconstructionThresholdChange = useCallback(
    (value: number) => {
      dispatch(setExposureModuleReconstructionThreshold(value));
    },
    [dispatch]
  );

  return (
    <CollapsibleSection 
      title="Exposure (Advanced)" 
      defaultExpanded={false} 
      expanded={expanded} 
      disabled={disabled}
    >
      <div className="exposure-adjustments">
        {/* Enable/Disable Toggle */}
        <div className="exposure-adjustments__toggle">
          <label className="exposure-adjustments__toggle-label">
            <input
              type="checkbox"
              checked={exposureModule.enabled}
              onChange={handleEnabledChange}
              disabled={disabled}
              className="exposure-adjustments__checkbox"
            />
            <span>Enable Advanced Exposure</span>
          </label>
        </div>

        {/* Exposure Slider */}
        <SliderControl
          label="Exposure (EV)"
          value={exposureModule.exposure}
          min={-10}
          max={10}
          step={0.01}
          precision={2}
          onChange={handleExposureChange}
          onChangeComplete={handleChangeComplete}
          tooltip="Scene-referred exposure adjustment in photographic stops. Works in linear RGB space for physically accurate results. +1 EV doubles brightness, -1 EV halves it."
          disabled={disabled || !exposureModule.enabled}
          colorGradient="linear-gradient(to right, #000000, #808080, #ffffff)"
        />

        {/* Black Point Slider */}
        <SliderControl
          label="Black Point"
          value={exposureModule.blackPoint}
          min={0.0}
          max={0.1}
          step={0.001}
          precision={3}
          onChange={handleBlackPointChange}
          onChangeComplete={handleChangeComplete}
          tooltip="Subtracts black level and normalizes the image. Use to lift shadows and reduce black clipping. Higher values brighten the darkest tones."
          disabled={disabled || !exposureModule.enabled}
          colorGradient="linear-gradient(to right, #000000, #202020, #404040)"
        />

        {/* Highlight Reconstruction Toggle */}
        <div className="exposure-adjustments__toggle">
          <label className="exposure-adjustments__toggle-label">
            <input
              type="checkbox"
              checked={exposureModule.highlightReconstruction}
              onChange={handleHighlightReconstructionChange}
              disabled={disabled || !exposureModule.enabled}
              className="exposure-adjustments__checkbox"
            />
            <span>Highlight Reconstruction</span>
          </label>
        </div>

        {/* Reconstruction Threshold Slider */}
        {exposureModule.highlightReconstruction && (
          <SliderControl
            label="Reconstruction Threshold"
            value={exposureModule.reconstructionThreshold}
            min={0.9}
            max={1.0}
            step={0.01}
            precision={2}
            onChange={handleReconstructionThresholdChange}
            onChangeComplete={handleChangeComplete}
            tooltip="Threshold for detecting clipped highlights. Lower values apply reconstruction to more pixels. Use 0.95 for typical images, lower for heavily clipped images."
            disabled={disabled || !exposureModule.enabled}
          />
        )}

        {/* Clipping Indicators Info */}
        {exposureModule.enabled && (
          <div className="exposure-adjustments__info">
            <div className="exposure-adjustments__info-section">
              <strong>Scene-Referred Processing:</strong> Exposure is applied in linear RGB space 
              for physically accurate results that match in-camera behavior.
            </div>
            {exposureModule.highlightReconstruction && (
              <div className="exposure-adjustments__info-section">
                <strong>Highlight Recovery:</strong> Attempts to reconstruct clipped channels 
                using color ratios from unclipped channels. Works best with moderate clipping.
              </div>
            )}
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};
