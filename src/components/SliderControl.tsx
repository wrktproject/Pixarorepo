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
  unit?: string;
  precision?: number;
  warning?: string;
  tooltip?: string;
}

export const SliderControl: React.FC<SliderControlProps> = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit = '',
  precision = 0,
  warning,
  tooltip,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLInputElement>(null);

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
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

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
        </label>
        <span className="slider-control__value">{formatValue(value)}</span>
      </div>
      <input
        ref={sliderRef}
        id={`slider-${label}`}
        type="range"
        className={`slider-control__slider ${isDragging ? 'slider-control__slider--dragging' : ''}`}
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
      />
      {showWarning && (
        <div className="slider-control__warning" role="alert">
          {warning}
        </div>
      )}
    </div>
  );
};
