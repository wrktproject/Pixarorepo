/**
 * Preset Adjustments Component
 * UI section for browsing and applying presets with live preview
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { setAllAdjustments, addToHistory } from '../store';
import { builtInPresets as defaultPresets } from '../data/builtInPresets';
import type { Preset } from '../types/store';
import type { AdjustmentState } from '../types/adjustments';
import './PresetAdjustments.css';

interface PresetAdjustmentsProps {
  disabled?: boolean;
}

export const PresetAdjustments: React.FC<PresetAdjustmentsProps> = ({ disabled = false }) => {
  const dispatch = useDispatch();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [hoveredPreset, setHoveredPreset] = useState<Preset | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const originalAdjustmentsRef = useRef<AdjustmentState | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const builtInPresets = useSelector((state: RootState) => state.presets.builtIn);
  const customPresets = useSelector((state: RootState) => state.presets.custom);
  const currentAdjustments = useSelector((state: RootState) => state.adjustments);
  const hasImage = useSelector((state: RootState) => state.image.current !== null);

  const allPresets = [...(builtInPresets.length > 0 ? builtInPresets : defaultPresets), ...customPresets];

  // Get unique categories
  const categories = ['all', 'portrait', 'landscape', 'bw'];

  const filteredPresets = selectedCategory === 'all'
    ? allPresets
    : allPresets.filter(p => {
        if (p.isBuiltIn && p.name.includes('Portrait') && selectedCategory === 'portrait') return true;
        if (p.isBuiltIn && p.name.includes('Landscape') && selectedCategory === 'landscape') return true;
        if (p.isBuiltIn && (p.name.includes('B&W') || p.name.includes('Black')) && selectedCategory === 'bw') return true;
        return false;
      });

  // Toggle dropdown
  const handleToggleDropdown = useCallback(() => {
    if (!isDropdownOpen) {
      // Store original adjustments when opening
      originalAdjustmentsRef.current = currentAdjustments;
    }
    setIsDropdownOpen(!isDropdownOpen);
  }, [isDropdownOpen, currentAdjustments]);

  // Preview preset on hover
  const handlePresetHover = useCallback((preset: Preset | null) => {
    if (!originalAdjustmentsRef.current) return;
    
    setHoveredPreset(preset);
    
    if (preset) {
      // Apply preset temporarily for preview
      dispatch(setAllAdjustments(preset.adjustments));
    } else {
      // Restore original adjustments when not hovering
      dispatch(setAllAdjustments(originalAdjustmentsRef.current));
    }
  }, [dispatch]);

  // Apply preset permanently
  const handleApplyPreset = useCallback((preset: Preset) => {
    if (!originalAdjustmentsRef.current) return;

    console.log('🎨 Applying preset:', preset.name);
    // Add original state to history before applying preset
    dispatch(addToHistory(originalAdjustmentsRef.current));
    // Apply preset
    dispatch(setAllAdjustments(preset.adjustments));
    // Close dropdown
    setIsDropdownOpen(false);
    setHoveredPreset(null);
    originalAdjustmentsRef.current = null;
  }, [dispatch]);

  // Cancel and restore original adjustments
  const handleCancel = useCallback(() => {
    if (originalAdjustmentsRef.current) {
      dispatch(setAllAdjustments(originalAdjustmentsRef.current));
    }
    setIsDropdownOpen(false);
    setHoveredPreset(null);
    originalAdjustmentsRef.current = null;
  }, [dispatch]);

  // Click outside to close
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        handleCancel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen, handleCancel]);

  const getCategoryLabel = (category: string): string => {
    switch (category) {
      case 'all': return 'All';
      case 'portrait': return 'Portrait';
      case 'landscape': return 'Landscape';
      case 'bw': return 'B&W';
      default: return category;
    }
  };

  return (
    <div className="preset-adjustments" ref={dropdownRef}>
      <div className="preset-adjustments__header">
        <button
          className={`preset-adjustments__toggle ${isDropdownOpen ? 'preset-adjustments__toggle--active' : ''}`}
          onClick={handleToggleDropdown}
          disabled={disabled || !hasImage}
          title="Choose a preset"
        >
          <span className="preset-adjustments__icon">🎨</span>
          <span>Presets</span>
          <span className="preset-adjustments__arrow">{isDropdownOpen ? '▲' : '▼'}</span>
        </button>
      </div>

      {isDropdownOpen && (
        <div className="preset-adjustments__dropdown">
          <div className="preset-adjustments__categories">
            {categories.map(category => (
              <button
                key={category}
                className={`preset-adjustments__category ${selectedCategory === category ? 'preset-adjustments__category--active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {getCategoryLabel(category)}
              </button>
            ))}
          </div>

          <div 
            className="preset-adjustments__grid"
            onMouseLeave={() => handlePresetHover(null)}
          >
            {filteredPresets.length === 0 ? (
              <div className="preset-adjustments__empty">
                No presets in this category
              </div>
            ) : (
              filteredPresets.map(preset => (
                <button
                  key={preset.id}
                  className={`preset-adjustments__preset-card ${hoveredPreset?.id === preset.id ? 'preset-adjustments__preset-card--hover' : ''}`}
                  onMouseEnter={() => handlePresetHover(preset)}
                  onClick={() => handleApplyPreset(preset)}
                >
                  <span className="preset-adjustments__preset-icon">🎨</span>
                  <span className="preset-adjustments__preset-name">{preset.name}</span>
                  {preset.isBuiltIn && (
                    <span className="preset-adjustments__preset-badge">Built-in</span>
                  )}
                </button>
              ))
            )}
          </div>

          <div className="preset-adjustments__footer">
            <span className="preset-adjustments__hint">
              {hoveredPreset ? `Previewing: ${hoveredPreset.name}` : 'Hover to preview • Click to apply'}
            </span>
            <button 
              className="preset-adjustments__cancel"
              onClick={handleCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!isDropdownOpen && (
        <p className="preset-adjustments__description">
          Choose from 24 professionally crafted presets. Hover to preview live on your image.
        </p>
      )}
    </div>
  );
};

