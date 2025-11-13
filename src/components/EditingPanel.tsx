/**
 * EditingPanel Component
 * Main container for all adjustment sections
 */

import React, { useCallback, useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { setSaturation, setExposure, setContrast, setHighlights, setShadows } from '../store';
import { BasicAdjustments } from './BasicAdjustments';
import { ColorAdjustments } from './ColorAdjustments';
import { DetailAdjustments } from './DetailAdjustments';
import { HSLAdjustments } from './HSLAdjustments';
import { EffectsAdjustments } from './EffectsAdjustments';
import { SettingsAdjustments } from './SettingsAdjustments';
import { PipelineControls } from './PipelineControls';
import { PresetSelector } from './PresetSelector';
import './EditingPanel.css';

export const EditingPanel: React.FC = () => {
  const dispatch = useDispatch();
  const hasImage = useSelector((state: RootState) => state.image.current !== null);
  const saturation = useSelector((state: RootState) => state.adjustments.saturation);
  const disabled = !hasImage;
  const [sectionsExpanded, setSectionsExpanded] = useState(false);

  // Animate sections open when image loads
  useEffect(() => {
    if (hasImage && !sectionsExpanded) {
      // Stagger the expansion for smooth animation
      setTimeout(() => setSectionsExpanded(true), 100);
    } else if (!hasImage) {
      setSectionsExpanded(false);
    }
  }, [hasImage, sectionsExpanded]);

  const handleAutoBlackWhite = useCallback(() => {
    // Toggle between B&W (-100 saturation) and color (0 saturation)
    if (saturation === -100) {
      dispatch(setSaturation(0));
    } else {
      dispatch(setSaturation(-100));
    }
  }, [dispatch, saturation]);

  const handleAuto = useCallback(() => {
    // Auto-adjust basic settings (simple algorithm)
    // This is a placeholder - you could implement histogram analysis here
    dispatch(setExposure(0));
    dispatch(setContrast(20));
    dispatch(setHighlights(-20));
    dispatch(setShadows(20));
  }, [dispatch]);

  return (
    <div className="editing-panel" role="region" aria-label="Editing adjustments panel">
      <div className="editing-panel__sections" role="group">
        {/* Presets Section */}
        <div className="editing-panel__section-group">
          <PresetSelector disabled={disabled} />
        </div>

        {/* Pipeline Controls (Darktable-inspired) */}
        <div className="editing-panel__section-group">
          <PipelineControls disabled={disabled} expanded={sectionsExpanded} />
        </div>

        {/* Legacy Adjustments Section */}
        <div className="editing-panel__section-group">
          <div className="editing-panel__section-header">
            <h2 className="editing-panel__section-title">Legacy Adjustments</h2>
          </div>
          
          {/* Auto Controls */}
          <div className="editing-panel__auto-controls">
            <button
              className="editing-panel__auto-button"
              onClick={handleAuto}
              disabled={disabled}
              title="Auto-adjust exposure, contrast, highlights, and shadows"
            >
              Auto
            </button>
            <button
              className="editing-panel__auto-button"
              onClick={handleAutoBlackWhite}
              disabled={disabled}
              title={saturation === -100 ? "Convert to Color" : "Convert to Black & White"}
            >
              {saturation === -100 ? "Color" : "B&W"}
            </button>
          </div>

          <BasicAdjustments disabled={disabled} expanded={sectionsExpanded} />
          <ColorAdjustments disabled={disabled} expanded={sectionsExpanded} />
          <DetailAdjustments disabled={disabled} expanded={sectionsExpanded} />
          <HSLAdjustments disabled={disabled} expanded={sectionsExpanded} />
          <EffectsAdjustments disabled={disabled} expanded={sectionsExpanded} />
        </div>

        {/* Settings Section */}
        <div className="editing-panel__section-group">
          <SettingsAdjustments disabled={disabled} />
        </div>
      </div>
    </div>
  );
};
