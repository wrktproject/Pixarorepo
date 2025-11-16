/**
 * Preset Selector Component
 * UI for selecting and managing adjustment presets
 * Supports drag-and-drop onto canvas for quick application
 */

import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import {
  setAllAdjustments,
  saveCustomPreset,
  deleteCustomPreset,
  setBuiltInPresets,
  addToHistory,
} from '../store';
import { builtInPresets as defaultPresets } from '../data/builtInPresets';
import type { Preset } from '../types/store';
import './PresetSelector.css';

interface PresetSelectorProps {
  disabled?: boolean;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({ disabled = false }) => {
  const dispatch = useDispatch();
  const [isOpen, setIsOpen] = useState(true); // Start open by default for better UX
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [draggedPreset, setDraggedPreset] = useState<Preset | null>(null);

  const builtInPresets = useSelector((state: RootState) => state.presets.builtIn);
  const customPresets = useSelector((state: RootState) => state.presets.custom);
  const currentAdjustments = useSelector((state: RootState) => state.adjustments);

  // Load built-in presets on mount
  useEffect(() => {
    if (builtInPresets.length === 0) {
      console.log('📦 Loading built-in presets:', defaultPresets.length, 'presets');
      console.log('First preset sample:', defaultPresets[0]);
      dispatch(setBuiltInPresets(defaultPresets));
    } else {
      console.log('✅ Presets already loaded:', builtInPresets.length);
    }
  }, [dispatch, builtInPresets.length]);

  const allPresets = [...builtInPresets, ...customPresets];

  // Get unique categories
  const categories = ['all', ...new Set(allPresets.map(p => {
    if (p.isBuiltIn && p.name.includes('Filmic')) return 'film';
    if (p.isBuiltIn && p.name.includes('Portrait')) return 'portrait';
    if (p.isBuiltIn && p.name.includes('Landscape')) return 'landscape';
    if (p.isBuiltIn && p.name.includes('B&W')) return 'bw';
    return 'custom';
  }))];

  const filteredPresets = selectedCategory === 'all'
    ? allPresets
    : allPresets.filter(p => {
        if (p.isBuiltIn && p.name.includes('Filmic') && selectedCategory === 'film') return true;
        if (p.isBuiltIn && p.name.includes('Portrait') && selectedCategory === 'portrait') return true;
        if (p.isBuiltIn && p.name.includes('Landscape') && selectedCategory === 'landscape') return true;
        if (p.isBuiltIn && p.name.includes('B&W') && selectedCategory === 'bw') return true;
        if (!p.isBuiltIn && selectedCategory === 'custom') return true;
        return false;
      });

  const handleApplyPreset = (presetId: string) => {
    const preset = allPresets.find(p => p.id === presetId);
    if (preset) {
      console.log('🎨 APPLYING PRESET:', preset.name);
      console.log('Preset adjustments:', preset.adjustments);
      console.log('Current adjustments before:', currentAdjustments);
      
      // Add current state to history before applying preset
      dispatch(addToHistory(currentAdjustments));
      
      // Apply preset
      dispatch(setAllAdjustments(preset.adjustments));
      
      console.log('✅ Preset dispatched to Redux');
    } else {
      console.error('❌ Preset not found:', presetId);
    }
  };

  const handleDragStart = (e: React.DragEvent, preset: Preset) => {
    setDraggedPreset(preset);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', preset.id);
    
    // Create a custom drag image
    const dragImage = document.createElement('div');
    dragImage.textContent = `🎨 ${preset.name}`;
    dragImage.style.cssText = 'position: absolute; top: -9999px; padding: 8px 12px; background: #4a9eff; color: white; border-radius: 4px; font-weight: 500; font-size: 14px;';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const handleDragEnd = () => {
    setDraggedPreset(null);
  };

  const handleSavePreset = () => {
    if (presetName.trim()) {
      dispatch(saveCustomPreset({
        name: presetName.trim(),
        adjustments: currentAdjustments,
      }));
      setPresetName('');
      setSaveDialogOpen(false);
    }
  };

  const handleDeletePreset = (presetId: string) => {
    if (confirm('Are you sure you want to delete this preset?')) {
      dispatch(deleteCustomPreset(presetId));
    }
  };

  const getCategoryLabel = (category: string): string => {
    switch (category) {
      case 'all': return 'All Presets';
      case 'film': return 'Film Emulation';
      case 'portrait': return 'Portrait';
      case 'landscape': return 'Landscape';
      case 'bw': return 'Black & White';
      case 'custom': return 'Custom';
      default: return category;
    }
  };

  return (
    <div className="preset-selector">
      <div className="preset-selector__header">
        <button
          className="preset-selector__toggle"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          title="Open preset selector"
        >
          <span className="preset-selector__icon">🎨</span>
          <span className="preset-selector__label">Presets</span>
          <span className="preset-selector__arrow">{isOpen ? '▼' : '▶'}</span>
        </button>
        <button
          className="preset-selector__save-btn"
          onClick={() => setSaveDialogOpen(true)}
          disabled={disabled}
          title="Save current settings as preset"
        >
          Save
        </button>
      </div>

      {isOpen && (
        <div className="preset-selector__dropdown">
          {/* Category Filter */}
          <div className="preset-selector__categories">
            {categories.map(category => (
              <button
                key={category}
                className={`preset-selector__category ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {getCategoryLabel(category)}
              </button>
            ))}
          </div>

          {/* Preset List */}
          <div className="preset-selector__list">
            {filteredPresets.length === 0 ? (
              <div className="preset-selector__empty">
                No presets in this category
              </div>
            ) : (
              filteredPresets.map(preset => (
                <div 
                  key={preset.id} 
                  className={`preset-selector__item ${draggedPreset?.id === preset.id ? 'dragging' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, preset)}
                  onDragEnd={handleDragEnd}
                >
                  <button
                    className="preset-selector__item-btn"
                    onClick={() => handleApplyPreset(preset.id)}
                    title={`Apply ${preset.name} preset (or drag onto image)`}
                  >
                    <span className="preset-selector__item-icon">🎨</span>
                    <span className="preset-selector__item-name">{preset.name}</span>
                    {preset.isBuiltIn && (
                      <span className="preset-selector__item-badge">Built-in</span>
                    )}
                  </button>
                  {!preset.isBuiltIn && (
                    <button
                      className="preset-selector__item-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePreset(preset.id);
                      }}
                      title="Delete preset"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Save Dialog */}
      {saveDialogOpen && (
        <div className="preset-selector__dialog-overlay" onClick={() => setSaveDialogOpen(false)}>
          <div className="preset-selector__dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="preset-selector__dialog-title">Save Preset</h3>
            <input
              type="text"
              className="preset-selector__dialog-input"
              placeholder="Enter preset name..."
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSavePreset();
                if (e.key === 'Escape') setSaveDialogOpen(false);
              }}
              autoFocus
            />
            <div className="preset-selector__dialog-actions">
              <button
                className="preset-selector__dialog-btn preset-selector__dialog-btn--cancel"
                onClick={() => setSaveDialogOpen(false)}
              >
                Cancel
              </button>
              <button
                className="preset-selector__dialog-btn preset-selector__dialog-btn--save"
                onClick={handleSavePreset}
                disabled={!presetName.trim()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
