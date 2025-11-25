/**
 * ColorWheel Component
 * Interactive circular color wheel for HSL adjustments (Lightroom-style)
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import './ColorWheel.css';

interface ColorWheelProps {
  /** Color channel being adjusted */
  color: string;
  /** Hue shift value (-100 to 100) */
  hue: number;
  /** Saturation shift value (-100 to 100) */
  saturation: number;
  /** Called when values change */
  onChange: (hue: number, saturation: number) => void;
  /** Disabled state */
  disabled?: boolean;
}

export const ColorWheel: React.FC<ColorWheelProps> = ({
  color,
  hue,
  saturation,
  onChange,
  disabled = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Map color names to base hue values
  const getColorHue = (colorName: string): number => {
    const hueMap: Record<string, number> = {
      red: 0,
      orange: 30,
      yellow: 60,
      green: 120,
      aqua: 180,
      blue: 240,
      purple: 270,
      magenta: 315,
    };
    return hueMap[colorName.toLowerCase()] || 0;
  };

  // Draw the color wheel
  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 120;
    const center = size / 2;
    const radius = size / 2 - 4;

    canvas.width = size;
    canvas.height = size;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Draw color wheel gradient
    const baseHue = getColorHue(color);
    
    // Draw radial gradient from center (desaturated) to edge (saturated)
    for (let r = 0; r < radius; r++) {
      const satPercent = (r / radius) * 100;
      
      for (let angle = 0; angle < 360; angle += 2) {
        const rad = (angle * Math.PI) / 180;
        const x = center + r * Math.cos(rad);
        const y = center + r * Math.sin(rad);
        
        // Calculate hue based on angle relative to base color
        const hueShift = ((angle - 90 + 360) % 360) - 180; // -180 to 180
        const actualHue = (baseHue + hueShift + 360) % 360;
        
        ctx.fillStyle = `hsl(${actualHue}, ${satPercent}%, 50%)`;
        ctx.fillRect(x, y, 2, 2);
      }
    }

    // Draw outer ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw center point (neutral)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(center, center, 3, 0, Math.PI * 2);
    ctx.fill();

    // Calculate and draw cursor position
    if (!disabled) {
      // Map hue (-100 to 100) to angle (0 to 360)
      const hueAngle = ((hue / 100) * 180 + 90) * (Math.PI / 180);
      
      // Map saturation (-100 to 100) to radius (0 to radius)
      const satRadius = ((saturation + 100) / 200) * radius;
      
      const cursorX = center + satRadius * Math.cos(hueAngle);
      const cursorY = center + satRadius * Math.sin(hueAngle);

      // Draw cursor
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cursorX, cursorY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Inner dot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cursorX, cursorY, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [color, hue, saturation, disabled]);

  // Redraw on value changes
  useEffect(() => {
    drawWheel();
  }, [drawWheel]);

  // Handle mouse interaction
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    setIsDragging(true);
    updateValues(e);
  }, [disabled]);

  const updateValues = useCallback((e: MouseEvent | React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const size = 120;
    const center = size / 2;
    const radius = size / 2 - 4;

    // Get mouse position relative to canvas center
    const x = ((e.clientX - rect.left) / rect.width) * size - center;
    const y = ((e.clientY - rect.top) / rect.height) * size - center;

    // Calculate distance from center
    const distance = Math.sqrt(x * x + y * y);
    const clampedDistance = Math.min(distance, radius);

    // Calculate angle
    const angle = Math.atan2(y, x);
    const degrees = ((angle * 180) / Math.PI - 90 + 360) % 360;

    // Map angle to hue shift (-100 to 100)
    let hueShift = degrees <= 180 ? degrees : degrees - 360;
    hueShift = (hueShift / 180) * 100;
    hueShift = Math.max(-100, Math.min(100, hueShift));

    // Map distance to saturation shift (-100 to 100)
    let satShift = ((clampedDistance / radius) * 200) - 100;
    satShift = Math.max(-100, Math.min(100, satShift));

    onChange(Math.round(hueShift), Math.round(satShift));
  }, [onChange]);

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
    <div className="color-wheel">
      <canvas
        ref={canvasRef}
        className={`color-wheel__canvas ${disabled ? 'color-wheel__canvas--disabled' : ''}`}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
};
