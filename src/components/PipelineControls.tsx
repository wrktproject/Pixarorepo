/**
 * Pipeline Controls Component
 * Unified UI for Darktable-inspired pipeline with module organization
 */

import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { ExposureAdjustments } from './ExposureAdjustments';
import { WhiteBalanceAdjustments } from './WhiteBalanceAdjustments';
import { FilmicAdjustments } from './FilmicAdjustments';
import { SigmoidAdjustments } from './SigmoidAdjustments';
import { ColorBalanceRGBAdjustments } from './ColorBalanceRGBAdjustments';
import { SaturationAdjustments } from './SaturationAdjustments';
import { LocalContrastAdjustments } from './LocalContrastAdjustments';
import { DetailAdjustments } from './DetailAdjustments';
import './PipelineControls.css';

interface PipelineControlsProps {
  disabled?: boolean;
  expanded?: boolean;
}

export const PipelineControls: React.FC<PipelineControlsProps> = ({
  disabled = false,
  expanded = false,
}) => {
  const [advancedMode, setAdvancedMode] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string | null>('tone');

  // Get module enable states from Redux
  const exposureEnabled = useSelector(
    (state: RootState) => state.adjustments.exposureModule.enabled
  );
  const whiteBalanceEnabled = useSelector(
    (state: RootState) => state.adjustments.whiteBalanceModule.enabled
  );
  const filmicEnabled = useSelector(
    (state: RootState) => state.adjustments.filmic.enabled
  );
  const sigmoidEnabled = useSelector(
    (state: RootState) => state.adjustments.sigmoid.enabled
  );
  const colorBalanceEnabled = useSelector(
    (state: RootState) => state.adjustments.colorBalanceRGB.enabled
  );
  const saturationEnabled = useSelector(
    (state: RootState) => state.adjustments.saturationModule.enabled
  );
  const localLaplacianEnabled = useSelector(
    (state: RootState) => state.adjustments.localLaplacian.enabled
  );
  const guidedFilterEnabled = useSelector(
    (state: RootState) => state.adjustments.guidedFilter.enabled
  );

  const toggleGroup = (groupName: string) => {
    setActiveGroup(activeGroup === groupName ? null : groupName);
  };

  const getModuleCount = (group: string): number => {
    switch (group) {
      case 'tone':
        return [exposureEnabled, filmicEnabled, sigmoidEnabled].filter(Boolean).length;
      case 'color':
        return [whiteBalanceEnabled, colorBalanceEnabled, saturationEnabled].filter(Boolean).length;
      case 'detail':
        return [localLaplacianEnabled, guidedFilterEnabled].filter(Boolean).length;
      default:
        return 0;
    }
  };

  return (
    <div className="pipeline-controls">
      {/* Mode Toggle */}
      <div className="pipeline-controls__header">
        <h3 className="pipeline-controls__title">Processing Pipeline</h3>
        <button
          className={`pipeline-controls__mode-toggle ${advancedMode ? 'active' : ''}`}
          onClick={() => setAdvancedMode(!advancedMode)}
          disabled={disabled}
          title={advancedMode ? 'Switch to Basic Mode' : 'Switch to Advanced Mode'}
        >
          {advancedMode ? 'Advanced' : 'Basic'}
        </button>
      </div>

      {/* Pipeline Visualization */}
      {advancedMode && (
        <div className="pipeline-controls__visualization">
          <div className="pipeline-flow">
            <div className={`pipeline-node ${exposureEnabled ? 'active' : ''}`}>
              Exposure
            </div>
            <div className="pipeline-arrow">→</div>
            <div className={`pipeline-node ${whiteBalanceEnabled ? 'active' : ''}`}>
              White Balance
            </div>
            <div className="pipeline-arrow">→</div>
            <div className={`pipeline-node ${filmicEnabled || sigmoidEnabled ? 'active' : ''}`}>
              Tone Mapping
            </div>
            <div className="pipeline-arrow">→</div>
            <div className={`pipeline-node ${colorBalanceEnabled ? 'active' : ''}`}>
              Color Grading
            </div>
            <div className="pipeline-arrow">→</div>
            <div className={`pipeline-node ${saturationEnabled ? 'active' : ''}`}>
              Saturation
            </div>
            <div className="pipeline-arrow">→</div>
            <div className={`pipeline-node ${localLaplacianEnabled || guidedFilterEnabled ? 'active' : ''}`}>
              Detail
            </div>
          </div>
        </div>
      )}

      {/* Module Groups */}
      <div className="pipeline-controls__groups">
        {/* Tone Mapping Group */}
        <div className="pipeline-group">
          <button
            className={`pipeline-group__header ${activeGroup === 'tone' ? 'active' : ''}`}
            onClick={() => toggleGroup('tone')}
            disabled={disabled}
          >
            <span className="pipeline-group__title">
              Tone Mapping
              {getModuleCount('tone') > 0 && (
                <span className="pipeline-group__badge">{getModuleCount('tone')}</span>
              )}
            </span>
            <span className="pipeline-group__icon">
              {activeGroup === 'tone' ? '▼' : '▶'}
            </span>
          </button>
          {activeGroup === 'tone' && (
            <div className="pipeline-group__content">
              <ExposureAdjustments disabled={disabled} expanded={expanded} />
              {advancedMode && (
                <>
                  <FilmicAdjustments disabled={disabled} expanded={expanded} />
                  <SigmoidAdjustments disabled={disabled} expanded={expanded} />
                </>
              )}
            </div>
          )}
        </div>

        {/* Color Grading Group */}
        <div className="pipeline-group">
          <button
            className={`pipeline-group__header ${activeGroup === 'color' ? 'active' : ''}`}
            onClick={() => toggleGroup('color')}
            disabled={disabled}
          >
            <span className="pipeline-group__title">
              Color Grading
              {getModuleCount('color') > 0 && (
                <span className="pipeline-group__badge">{getModuleCount('color')}</span>
              )}
            </span>
            <span className="pipeline-group__icon">
              {activeGroup === 'color' ? '▼' : '▶'}
            </span>
          </button>
          {activeGroup === 'color' && (
            <div className="pipeline-group__content">
              <WhiteBalanceAdjustments disabled={disabled} expanded={expanded} />
              {advancedMode && (
                <ColorBalanceRGBAdjustments disabled={disabled} expanded={expanded} />
              )}
              <SaturationAdjustments disabled={disabled} expanded={expanded} />
            </div>
          )}
        </div>

        {/* Detail Enhancement Group */}
        <div className="pipeline-group">
          <button
            className={`pipeline-group__header ${activeGroup === 'detail' ? 'active' : ''}`}
            onClick={() => toggleGroup('detail')}
            disabled={disabled}
          >
            <span className="pipeline-group__title">
              Detail Enhancement
              {getModuleCount('detail') > 0 && (
                <span className="pipeline-group__badge">{getModuleCount('detail')}</span>
              )}
            </span>
            <span className="pipeline-group__icon">
              {activeGroup === 'detail' ? '▼' : '▶'}
            </span>
          </button>
          {activeGroup === 'detail' && (
            <div className="pipeline-group__content">
              <LocalContrastAdjustments disabled={disabled} expanded={expanded} />
              <DetailAdjustments disabled={disabled} expanded={expanded} />
            </div>
          )}
        </div>
      </div>

      {/* Help Text */}
      {advancedMode && (
        <div className="pipeline-controls__help">
          <p className="pipeline-controls__help-text">
            <strong>Scene-Referred Workflow:</strong> Modules are processed in order from top to bottom.
            Enable only the modules you need for optimal performance.
          </p>
        </div>
      )}
    </div>
  );
};
