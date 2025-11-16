/**
 * SliderControl Component
 * Reusable slider with label, value display, and keyboard support
 */

import React, { useCallback, useRef, useState } from 'react';
import './SliderControl.css';

export interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  onChangeComplete?: (value: number) => void;
  unit?: string;
  precision?: number;
  warning?: string;
  tooltip?: string;
  disabled?: boolean;
  colorGradient?: string;
}

export const SliderControl: React.FC<SliderControlProps> = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
  onChangeComplete,
  unit = '',
  precision = 0,
  warning,
  tooltip,
  disabled = false,
  colorGradient,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const sliderRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialValueRef = useRef<number>(value);

  const clamp = useCallback(
    (val: number): number => {
      return Math.max(min, Math.min(max, val));
    },
    [min, max]
  );

  const formatValue = useCallback(
    (val: number): string => {
      const formatted = val.toFixed(precision);
      return unit ? `${formatted}${unit}` : formatted;
    },
    [precision, unit]
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseFloat(event.target.value);
      onChange(clamp(newValue));
    },
    [onChange, clamp]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      let delta = 0;
      
      if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
        delta = step;
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
        delta = -step;
      }

      if (delta !== 0) {
        event.preventDefault();
        const newValue = clamp(value + delta);
        onChange(newValue);
      }
    },
    [value, step, onChange, clamp]
  );

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
    initialValueRef.current = value;
  }, [value]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    // Only trigger onChangeComplete if value actually changed
    if (onChangeComplete && initialValueRef.current !== value) {
      onChangeComplete(value);
    }
  }, [value, onChangeComplete]);

  const handleValueClick = useCallback(() => {
    if (disabled) return;
    setIsEditing(true);
    setEditValue(value.toFixed(precision));
  }, [value, precision, disabled]);

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setEditValue(event.target.value);
    },
    []
  );

  const handleInputBlur = useCallback(() => {
    const numValue = parseFloat(editValue);
    if (!isNaN(numValue)) {
      const clampedValue = clamp(numValue);
      onChange(clampedValue);
      if (onChangeComplete) {
        onChangeComplete(clampedValue);
      }
    }
    setIsEditing(false);
  }, [editValue, onChange, onChangeComplete, clamp]);

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        handleInputBlur();
      } else if (event.key === 'Escape') {
        setIsEditing(false);
      }
    },
    [handleInputBlur]
  );

  // Focus input when entering edit mode
  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const showWarning = warning && value > (max * 0.66);

  return (
    <div className="slider-control">
      <div className="slider-control__header">
        <label 
          className="slider-control__label" 
          htmlFor={`slider-${label}`}
          title={tooltip}
        >
          {label}
          {tooltip && (
            <span className="slider-control__info-icon" title={tooltip} aria-label="More information">
              ⓘ
            </span>
          )}
        </label>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className="slider-control__value-input"
            value={editValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            disabled={disabled}
          />
        ) : (
          <span 
            className="slider-control__value slider-control__value--clickable" 
            onClick={handleValueClick}
            title="Click to edit"
          >
            {formatValue(value)}
          </span>
        )}
      </div>
      <div className="slider-control__track-container">
        <input
          ref={sliderRef}
          id={`slider-${label}`}
          type="range"
          className={`slider-control__slider ${isDragging ? 'slider-control__slider--dragging' : ''} ${disabled ? 'slider-control__slider--disabled' : ''} ${colorGradient ? 'slider-control__slider--colored' : ''}`}
          style={colorGradient ? { background: colorGradient } : undefined}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchEnd={handleMouseUp}
          aria-label={`${label} slider`}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={formatValue(value)}
          aria-describedby={tooltip ? `${label}-tooltip` : undefined}
          disabled={disabled}
        />
        {isDragging && (
          <div className="slider-control__value-popup">
            {formatValue(value)}
          </div>
        )}
      </div>
      {tooltip && (
        <div id={`${label}-tooltip`} className="slider-control__tooltip sr-only">
          {tooltip}
        </div>
      )}
      {showWarning && (
        <div className="slider-control__warning" role="alert">
          {warning}
        </div>
      )}
    </div>
  );
};
