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
import { Histogram } from './Histogram';
import './EditingPanel.css';

export const EditingPanel: React.FC = () => {
  const dispatch = useDispatch();
  const hasImage = useSelector((state: RootState) => state.image.current !== null);
  const renderedImageData = useSelector((state: RootState) => state.ui.renderedImageData);
  const saturation = useSelector((state: RootState) => state.adjustments.saturation);
  const exposure = useSelector((state: RootState) => state.adjustments.exposure);
  const contrast = useSelector((state: RootState) => state.adjustments.contrast);
  const highlights = useSelector((state: RootState) => state.adjustments.highlights);
  const shadows = useSelector((state: RootState) => state.adjustments.shadows);
  const disabled = !hasImage;
  const [sectionsExpanded, setSectionsExpanded] = useState(false);
  
  // Store previous values before auto adjustment
  const [previousAutoValues, setPreviousAutoValues] = useState<{
    exposure: number;
    contrast: number;
    highlights: number;
    shadows: number;
  } | null>(null);

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
    if (previousAutoValues) {
      // Toggle back to previous values
      dispatch(setExposure(previousAutoValues.exposure));
      dispatch(setContrast(previousAutoValues.contrast));
      dispatch(setHighlights(previousAutoValues.highlights));
      dispatch(setShadows(previousAutoValues.shadows));
      setPreviousAutoValues(null);
    } else {
      // Store current values before auto-adjusting
      setPreviousAutoValues({
        exposure,
        contrast,
        highlights,
        shadows,
      });
      
      // Apply auto-adjust settings (simple algorithm)
      dispatch(setExposure(0));
      dispatch(setContrast(20));
      dispatch(setHighlights(-20));
      dispatch(setShadows(20));
    }
  }, [dispatch, previousAutoValues, exposure, contrast, highlights, shadows]);

  return (
    <div className="editing-panel" role="region" aria-label="Editing adjustments panel">
      {/* Histogram - sticky at top */}
      {hasImage && renderedImageData && (
        <div className="editing-panel__histogram editing-panel__histogram--sticky">
          <Histogram 
            imageData={renderedImageData} 
            width={256} 
            height={100}
          />
        </div>
      )}
      
      <div className="editing-panel__sections" role="group">
        {/* Auto Controls */}
        <div className="editing-panel__auto-controls">
          <button
            className={`editing-panel__auto-button ${previousAutoValues ? 'active' : ''}`}
            onClick={handleAuto}
            disabled={disabled}
            title={previousAutoValues ? "Reset to previous values" : "Auto-adjust exposure, contrast, highlights, and shadows"}
          >
            {previousAutoValues ? "Reset" : "Auto"}
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

        {/* Settings Section */}
        <div className="editing-panel__section-group">
          <SettingsAdjustments disabled={disabled} />
        </div>
      </div>
    </div>
  );
};
