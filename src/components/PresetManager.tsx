/**
 * PresetManager Component
 * Displays and manages built-in and custom presets
 */

import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { saveCustomPreset, deleteCustomPreset } from '../store/presetSlice';
import { applyPreset, createPresetFromAdjustments, validatePresetName, presetNameExists } from '../utils/presetUtils';
import type { Preset } from '../types/store';
import './PresetManager.css';

export const PresetManager: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { builtIn, custom } = useSelector((state: RootState) => state.presets);
  const currentAdjustments = useSelector((state: RootState) => state.adjustments);
  
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  const handleApplyPreset = (preset: Preset) => {
    applyPreset(preset, dispatch, currentAdjustments);
  };

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

    // Reset modal state
    setShowSaveModal(false);
    setPresetName('');
    setNameError(null);
  };

  const handleDeletePreset = (id: string) => {
    if (window.confirm('Are you sure you want to delete this preset?')) {
      dispatch(deleteCustomPreset(id));
    }
  };

  const handleOpenSaveModal = () => {
    setShowSaveModal(true);
    setPresetName('');
    setNameError(null);
  };

  const handleCloseSaveModal = () => {
    setShowSaveModal(false);
    setPresetName('');
    setNameError(null);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPresetName(e.target.value);
    setNameError(null);
  };

  return (
    <div className="preset-manager" role="region" aria-label="Preset manager">
      <div className="preset-manager-header">
        <h3>Presets</h3>
        <button
          className="save-preset-button"
          onClick={handleOpenSaveModal}
          title="Save current adjustments as preset"
          aria-label="Save current adjustments as preset"
        >
          Save as Preset
        </button>
      </div>

      {/* Built-in Presets */}
      {builtIn.length > 0 && (
        <div className="preset-section">
          <h4 className="preset-section-title">Built-in</h4>
          <div className="preset-grid" role="list" aria-label="Built-in presets">
            {builtIn.map((preset) => (
              <div
                key={preset.id}
                className="preset-item"
                onClick={() => handleApplyPreset(preset)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleApplyPreset(preset);
                  }
                }}
                role="button"
                tabIndex={0}
                title={`Apply ${preset.name} preset`}
                aria-label={`Apply ${preset.name} preset`}
              >
                <div className="preset-thumbnail">
                  {preset.thumbnail ? (
                    <img src={preset.thumbnail} alt={`${preset.name} preset preview`} />
                  ) : (
                    <div className="preset-thumbnail-placeholder" aria-hidden="true">
                      <span>{preset.name.charAt(0)}</span>
                    </div>
                  )}
                </div>
                <div className="preset-name">{preset.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom Presets */}
      {custom.length > 0 && (
        <div className="preset-section">
          <h4 className="preset-section-title">Custom</h4>
          <div className="preset-grid" role="list" aria-label="Custom presets">
            {custom.map((preset) => (
              <div key={preset.id} className="preset-item custom-preset" role="listitem">
                <div
                  className="preset-content"
                  onClick={() => handleApplyPreset(preset)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleApplyPreset(preset);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  title={`Apply ${preset.name} preset`}
                  aria-label={`Apply ${preset.name} preset`}
                >
                  <div className="preset-thumbnail">
                    {preset.thumbnail ? (
                      <img src={preset.thumbnail} alt={`${preset.name} preset preview`} />
                    ) : (
                      <div className="preset-thumbnail-placeholder" aria-hidden="true">
                        <span>{preset.name.charAt(0)}</span>
                      </div>
                    )}
                  </div>
                  <div className="preset-name">{preset.name}</div>
                </div>
                <button
                  className="delete-preset-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeletePreset(preset.id);
                  }}
                  title="Delete preset"
                  aria-label={`Delete ${preset.name} preset`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save Preset Modal */}
      {showSaveModal && (
        <div 
          className="modal-overlay" 
          onClick={handleCloseSaveModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-preset-title"
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 id="save-preset-title">Save Preset</h3>
              <button
                className="modal-close"
                onClick={handleCloseSaveModal}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <label htmlFor="preset-name-input">Preset Name</label>
              <input
                id="preset-name-input"
                type="text"
                value={presetName}
                onChange={handleNameChange}
                placeholder="Enter preset name"
                maxLength={50}
                autoFocus
                aria-required="true"
                aria-invalid={!!nameError}
                aria-describedby={nameError ? "preset-name-error" : undefined}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSavePreset();
                  } else if (e.key === 'Escape') {
                    handleCloseSaveModal();
                  }
                }}
              />
              {nameError && (
                <div className="error-message" id="preset-name-error" role="alert">
                  {nameError}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="button-secondary" onClick={handleCloseSaveModal}>
                Cancel
              </button>
              <button className="button-primary" onClick={handleSavePreset}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
