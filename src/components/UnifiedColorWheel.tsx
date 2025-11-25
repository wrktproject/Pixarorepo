/**
 * UnifiedColorWheel Component
 * Darktable-style LCH color wheel with perceptually uniform Lab color space
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { ColorChannel } from '../types/adjustments';
import './UnifiedColorWheel.css';

// ============================================================================
// Lab ↔ RGB Color Space Conversions (Perceptually Uniform)
// ============================================================================

// RGB (0..1) → XYZ
// @ts-ignore - used via labToRgb chain
function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  const f = (v: number) => (v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92);
  r = f(r); g = f(g); b = f(b);
  return [
    r * 0.4124 + g * 0.3576 + b * 0.1805,
    r * 0.2126 + g * 0.7152 + b * 0.0722,
    r * 0.0193 + g * 0.1192 + b * 0.9505
  ];
}

// XYZ → Lab
// @ts-ignore - used via labToRgb chain
function xyzToLab(x: number, y: number, z: number): [number, number, number] {
  const refX = 0.95047, refY = 1.00000, refZ = 1.08883;
  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const fx = f(x / refX), fy = f(y / refY), fz = f(z / refZ);
  return [
    116 * fy - 16,
    500 * (fx - fy),
    200 * (fy - fz)
  ];
}

// Lab → XYZ
function labToXyz(l: number, a: number, b: number): [number, number, number] {
  const fy = (l + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const fInv = (t: number) => (Math.pow(t, 3) > 0.008856 ? Math.pow(t, 3) : (t - 16 / 116) / 7.787);
  const x = fInv(fx) * 0.95047;
  const y = fInv(fy) * 1.00000;
  const z = fInv(fz) * 1.08883;
  return [x, y, z];
}

// XYZ → RGB (0..1)
function xyzToRgb(x: number, y: number, z: number): [number, number, number] {
  let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
  let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
  let b = x * 0.0557 + y * -0.2040 + z * 1.0570;
  const f = (v: number) => (v > 0.0031308 ? 1.055 * Math.pow(v, 1 / 2.4) - 0.055 : 12.92 * v);
  r = Math.min(Math.max(f(r), 0), 1);
  g = Math.min(Math.max(f(g), 0), 1);
  b = Math.min(Math.max(f(b), 0), 1);
  return [r, g, b];
}

// Lab → RGB shortcut
function labToRgb(l: number, a: number, b: number): [number, number, number] {
  return xyzToRgb(...labToXyz(l, a, b));
}

// ============================================================================

interface UnifiedColorWheelProps {
  /** Currently selected color channel */
  selectedChannel: ColorChannel;
  /** HSL values for all channels */
  hslValues: Record<ColorChannel, { hue: number; saturation: number; luminance: number }>;
  /** Called when a color channel is selected */
  onSelectChannel: (channel: ColorChannel) => void;
  /** Called when values change */
  onChange: (channel: ColorChannel, hue: number, saturation: number) => void;
  /** Disabled state */
  disabled?: boolean;
}

const COLOR_CHANNELS: Array<{ key: ColorChannel; label: string; hue: number }> = [
  { key: 'red', label: 'Red', hue: 0 },
  { key: 'orange', label: 'Orange', hue: 30 },
  { key: 'yellow', label: 'Yellow', hue: 60 },
  { key: 'green', label: 'Green', hue: 120 },
  { key: 'aqua', label: 'Aqua', hue: 180 },
  { key: 'blue', label: 'Blue', hue: 240 },
  { key: 'purple', label: 'Purple', hue: 270 },
  { key: 'magenta', label: 'Magenta', hue: 315 },
];

export const UnifiedColorWheel: React.FC<UnifiedColorWheelProps> = ({
  selectedChannel,
  hslValues,
  onSelectChannel,
  onChange,
  disabled = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Draw the LCH color wheel using Lab color space
  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 240;
    const center = size / 2;
    const radius = size / 2 - 8;

    canvas.width = size;
    canvas.height = size;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Get lightness from selected channel (default to 50 for perceptual mid-gray)
    const selectedValues = hslValues[selectedChannel];
    const lightness = 50 + (selectedValues.luminance * 0.3); // Map -100..100 to ~20..80

    // Draw LCH wheel using Lab color space (perceptually uniform)
    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - center;
        const dy = y - center;
        const distRatio = Math.sqrt(dx * dx + dy * dy) / radius;
        
        if (distRatio > 1) continue; // Outside wheel

        // Polar coordinates: angle = hue, distance = chroma
        let theta = Math.atan2(dy, dx);
        if (theta < 0) theta += 2 * Math.PI;
        const chroma = distRatio * 100; // Scale to max ~100

        // Convert LCH (polar Lab) → Lab → RGB
        const a = chroma * Math.cos(theta);
        const b = chroma * Math.sin(theta);
        const [R, G, B] = labToRgb(lightness, a, b);

        const idx = (y * size + x) * 4;
        data[idx] = R * 255;
        data[idx + 1] = G * 255;
        data[idx + 2] = B * 255;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Draw outer ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw center point (neutral)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(center, center, 4, 0, Math.PI * 2);
    ctx.fill();

    // Draw color channel markers (using Lab-derived colors)
    COLOR_CHANNELS.forEach(({ key, hue }) => {
      const angle = (hue - 90) * (Math.PI / 180);
      const markerRadius = radius + 12;
      const x = center + markerRadius * Math.cos(angle);
      const y = center + markerRadius * Math.sin(angle);

      // Get color from Lab space for perceptual accuracy
      const theta = hue * Math.PI / 180;
      const chroma = 80; // High chroma for vibrant markers
      const a = chroma * Math.cos(theta);
      const b = chroma * Math.sin(theta);
      const [R, G, B] = labToRgb(50, a, b);

      // Marker circle
      const isSelected = key === selectedChannel;
      ctx.fillStyle = `rgb(${R * 255}, ${G * 255}, ${B * 255})`;
      ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.beginPath();
      ctx.arc(x, y, isSelected ? 8 : 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // Draw cursor for selected channel (in LCH space)
    if (!disabled) {
      const selectedColor = COLOR_CHANNELS.find(c => c.key === selectedChannel);
      if (selectedColor) {
        const values = hslValues[selectedChannel];
        const baseHue = selectedColor.hue;
        
        // Map hue adjustment (-100 to 100) to angle offset in Lab space
        const hueOffset = (values.hue / 100) * 60; // ±60 degrees
        const actualHue = baseHue + hueOffset;
        const angle = (actualHue - 90) * (Math.PI / 180);
        
        // Map saturation (-100 to 100) to chroma (distance from center)
        const chromaRatio = (values.saturation + 100) / 200;
        const cursorRadius = chromaRatio * radius;
        
        const cursorX = center + cursorRadius * Math.cos(angle);
        const cursorY = center + cursorRadius * Math.sin(angle);

        // Draw cursor
        ctx.strokeStyle = '#ffffff';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cursorX, cursorY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner dot
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cursorX, cursorY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [selectedChannel, hslValues, disabled]);

  // Redraw on value changes
  useEffect(() => {
    drawWheel();
  }, [drawWheel]);

  // Handle mouse interaction
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const size = 240;
    const center = size / 2;
    const x = ((e.clientX - rect.left) / rect.width) * size - center;
    const y = ((e.clientY - rect.top) / rect.height) * size - center;
    const distance = Math.sqrt(x * x + y * y);
    const radius = size / 2 - 8;

    // Check if clicking on a color marker
    if (distance > radius + 5) {
      const angle = Math.atan2(y, x);
      const degrees = ((angle * 180) / Math.PI + 90 + 360) % 360;
      
      // Find closest color channel
      let closestChannel = COLOR_CHANNELS[0];
      let minDiff = 360;
      
      COLOR_CHANNELS.forEach(channel => {
        let diff = Math.abs(channel.hue - degrees);
        if (diff > 180) diff = 360 - diff;
        if (diff < minDiff) {
          minDiff = diff;
          closestChannel = channel;
        }
      });
      
      if (minDiff < 30) {
        onSelectChannel(closestChannel.key);
        return;
      }
    }

    // Otherwise, start dragging
    setIsDragging(true);
    updateValues(e);
  }, [disabled, onSelectChannel]);

  const updateValues = useCallback((e: MouseEvent | React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const size = 240;
    const center = size / 2;
    const radius = size / 2 - 8;

    // Get mouse position relative to canvas center
    const x = ((e.clientX - rect.left) / rect.width) * size - center;
    const y = ((e.clientY - rect.top) / rect.height) * size - center;

    // Calculate distance from center
    const distance = Math.sqrt(x * x + y * y);
    const clampedDistance = Math.min(distance, radius);

    // Calculate angle
    const angle = Math.atan2(y, x);
    const degrees = ((angle * 180) / Math.PI + 90 + 360) % 360;

    // Get base hue for selected channel
    const selectedColor = COLOR_CHANNELS.find(c => c.key === selectedChannel);
    if (!selectedColor) return;

    // Calculate hue offset from base color
    let hueOffset = degrees - selectedColor.hue;
    if (hueOffset > 180) hueOffset -= 360;
    if (hueOffset < -180) hueOffset += 360;
    
    // Map to -100 to 100 range (±60 degrees)
    let hueShift = (hueOffset / 60) * 100;
    hueShift = Math.max(-100, Math.min(100, hueShift));

    // Map distance to saturation shift (-100 to 100)
    let satShift = ((clampedDistance / radius) * 200) - 100;
    satShift = Math.max(-100, Math.min(100, satShift));

    onChange(selectedChannel, Math.round(hueShift), Math.round(satShift));
  }, [selectedChannel, onChange]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    updateValues(e);
  }, [isDragging, updateValues]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className="unified-color-wheel">
      <canvas
        ref={canvasRef}
        className={`unified-color-wheel__canvas ${disabled ? 'unified-color-wheel__canvas--disabled' : ''}`}
        onMouseDown={handleMouseDown}
      />
      <div className="unified-color-wheel__legend">
        {COLOR_CHANNELS.map(({ key, label }) => (
          <button
            key={key}
            className={`unified-color-wheel__color-btn ${selectedChannel === key ? 'unified-color-wheel__color-btn--active' : ''}`}
            onClick={() => onSelectChannel(key)}
            disabled={disabled}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};
