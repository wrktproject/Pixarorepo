/**
 * SavePresetButton Component
 * Button in header to save current adjustments as a preset
 */

import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { saveCustomPreset } from '../store/presetSlice';
import { createPresetFromAdjustments, validatePresetName, presetNameExists } from '../utils/presetUtils';
import './SavePresetButton.css';

export const SavePresetButton: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { builtIn, custom } = useSelector((state: RootState) => state.presets);
  const currentAdjustments = useSelector((state: RootState) => state.adjustments);
  const hasImage = useSelector((state: RootState) => state.image.current !== null);
  
  const [showModal, setShowModal] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  const handleSavePreset = () => {
    const error = validatePresetName(presetName);
    if (error) {
      setNameError(error);
      return;
    }

    const allPresets = [...builtIn, ...custom];
    if (presetNameExists(presetName, allPresets)) {
      setNameError('A preset with this name already exists');
      return;
    }

    const presetData = createPresetFromAdjustments(presetName, currentAdjustments);
    dispatch(saveCustomPreset({
      name: presetData.name,
      adjustments: presetData.adjustments,
    }));

    setShowModal(false);
    setPresetName('');
    setNameError(null);
  };

  return (
    <>
      <button
        className="save-preset-button"
        onClick={() => setShowModal(true)}
        disabled={!hasImage}
        title="Save current adjustments as preset"
      >
        Save Preset
      </button>

      {showModal && (
        <div className="save-preset-modal" onClick={() => setShowModal(false)}>
          <div className="save-preset-modal__content" onClick={(e) => e.stopPropagation()}>
            <h3 className="save-preset-modal__title">Save Preset</h3>
            <input
              type="text"
              className="save-preset-modal__input"
              placeholder="Preset name"
              value={presetName}
              onChange={(e) => {
                setPresetName(e.target.value);
                setNameError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
              autoFocus
            />
            {nameError && <p className="save-preset-modal__error">{nameError}</p>}
            <div className="save-preset-modal__buttons">
              <button onClick={() => setShowModal(false)}>Cancel</button>
              <button onClick={handleSavePreset} className="button-primary">Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
