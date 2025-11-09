/**
 * SettingsAdjustments Component
 * Section for rendering settings (tone mapping, quality mode)
 */

import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { toggleToneMapping, setQualityMode } from '../store';
import { CollapsibleSection } from './CollapsibleSection';
import './SettingsAdjustments.css';

interface SettingsAdjustmentsProps {
  disabled?: boolean;
}

export const SettingsAdjustments: React.FC<SettingsAdjustmentsProps> = ({ disabled = false }) => {
  const dispatch = useDispatch();
  const { enableToneMapping, qualityMode } = useSelector((state: RootState) => state.ui);

  const handleToneMappingToggle = useCallback(() => {
    dispatch(toggleToneMapping());
  }, [dispatch]);

  const handleQualityModeChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      dispatch(setQualityMode(event.target.value as 'preview' | 'export'));
    },
    [dispatch]
  );

  return (
    <CollapsibleSection title="Settings" defaultExpanded={false}>
      <div className="settings-adjustments">
        <div className="settings-adjustments__control">
          <label className="settings-adjustments__label">
            <input
              type="checkbox"
              checked={enableToneMapping}
              onChange={handleToneMappingToggle}
              disabled={disabled}
              className="settings-adjustments__checkbox"
              aria-label="Enable tone mapping for HDR images"
            />
            <span 
              className="settings-adjustments__label-text"
              title="Applies tone mapping to compress high dynamic range values for better display. Useful for HDR images with very bright highlights."
            >
              Tone Mapping
            </span>
          </label>
          <p className="settings-adjustments__description">
            Compress HDR highlights for better display
          </p>
        </div>

        <div className="settings-adjustments__control">
          <label className="settings-adjustments__label" htmlFor="quality-mode-select">
            <span 
              className="settings-adjustments__label-text"
              title="Preview mode downscales images to 2048px for faster rendering. Export mode always uses full resolution."
            >
              Quality Mode
            </span>
          </label>
          <select
            id="quality-mode-select"
            value={qualityMode}
            onChange={handleQualityModeChange}
            disabled={disabled}
            className="settings-adjustments__select"
            aria-label="Select quality mode"
          >
            <option value="preview">Preview (Faster)</option>
            <option value="export">Full Quality (Slower)</option>
          </select>
          <p className="settings-adjustments__description">
            {qualityMode === 'preview' 
              ? 'Downscaled to 2048px for real-time performance'
              : 'Full resolution rendering (may be slower)'}
          </p>
        </div>
      </div>
    </CollapsibleSection>
  );
};
