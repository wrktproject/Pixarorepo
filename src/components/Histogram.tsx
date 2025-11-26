/**
 * Histogram Component
 * Displays RGB histogram showing tonal distribution with Lightroom-quality features
 * Uses Web Worker for calculation to avoid blocking UI
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { HistogramData } from '../workers/histogram.worker';
import styles from './Histogram.module.css';

interface HistogramProps {
  imageData: ImageData | null;
  width?: number;
  height?: number;
  onClippingToggle?: (type: 'shadows' | 'highlights', enabled: boolean) => void;
  onClose?: () => void;
}

export const Histogram: React.FC<HistogramProps> = ({
  imageData,
  width = 256,
  height = 100,
  onClippingToggle,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const [histogram, setHistogram] = useState<HistogramData | null>(null);
  const [showShadowClipping, setShowShadowClipping] = useState(false);
  const [showHighlightClipping, setShowHighlightClipping] = useState(false);
  const [displayMode, setDisplayMode] = useState<'rgb' | 'luminance'>('rgb');
  const [hoverData, setHoverData] = useState<{ x: number; value: number; rgb: { r: number; g: number; b: number } } | null>(null);

  /**
   * Initialize Web Worker
   */
  useEffect(() => {
    // Create worker
    workerRef.current = new Worker(
      new URL('../workers/histogram.worker.ts', import.meta.url),
      { type: 'module' }
    );

    // Handle worker messages
    workerRef.current.onmessage = (e: MessageEvent) => {
      if (e.data.type === 'result') {
        setHistogram(e.data.histogram);
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  /**
   * Calculate histogram when image data changes
   */
  useEffect(() => {
    if (!imageData || !workerRef.current) return;

    // Send image data to worker
    workerRef.current.postMessage({
      type: 'calculate',
      imageData,
    });
  }, [imageData]);

  /**
   * Toggle shadow clipping indicator
   */
  const toggleShadowClipping = useCallback(() => {
    const newValue = !showShadowClipping;
    setShowShadowClipping(newValue);
    onClippingToggle?.('shadows', newValue);
  }, [showShadowClipping, onClippingToggle]);

  /**
   * Toggle highlight clipping indicator
   */
  const toggleHighlightClipping = useCallback(() => {
    const newValue = !showHighlightClipping;
    setShowHighlightClipping(newValue);
    onClippingToggle?.('highlights', newValue);
  }, [showHighlightClipping, onClippingToggle]);

  /**
   * Handle mouse move over histogram for hover readout
   */
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !histogram) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const bin = Math.floor((x / width) * 256);

    if (bin >= 0 && bin < 256) {
      setHoverData({
        x: bin,
        value: bin / 255,
        rgb: {
          r: histogram.red[bin],
          g: histogram.green[bin],
          b: histogram.blue[bin],
        },
      });
    }
  }, [histogram, width]);

  const handleMouseLeave = useCallback(() => {
    setHoverData(null);
  }, []);

  /**
   * Apply Gaussian smoothing to histogram data
   */
  const smoothHistogram = useCallback((data: number[]): number[] => {
    const smoothed = new Array(256);
    
    // Simple 3-point smoothing
    smoothed[0] = (data[0] + data[1]) / 2;
    for (let i = 1; i < 255; i++) {
      smoothed[i] = (data[i - 1] + data[i] + data[i + 1]) / 3;
    }
    smoothed[255] = (data[254] + data[255]) / 2;
    
    return smoothed;
  }, []);

  /**
   * Render histogram to canvas with Lightroom-quality features
   */
  useEffect(() => {
    if (!histogram || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true });

    if (!ctx) return;

    // Clear canvas with dark background
    ctx.fillStyle = 'rgba(15, 15, 15, 0.95)';
    ctx.fillRect(0, 0, width, height);

    // Apply smoothing to histogram data
    const smoothedRed = smoothHistogram(histogram.red);
    const smoothedGreen = smoothHistogram(histogram.green);
    const smoothedBlue = smoothHistogram(histogram.blue);
    const smoothedLuminance = smoothHistogram(histogram.luminance);

    // Use logarithmic scaling for better visualization (Lightroom-style)
    const applyLogScale = (value: number) => Math.log(1 + value * 10000) / Math.log(10001);

    // Find max value for scaling with logarithmic compression
    const maxValue = Math.max(
      ...smoothedRed.map(applyLogScale),
      ...smoothedGreen.map(applyLogScale),
      ...smoothedBlue.map(applyLogScale),
      ...smoothedLuminance.map(applyLogScale)
    ) * 1.05; // 5% headroom

    if (maxValue === 0) return;

    // Draw exposure zones (Lightroom-style zones)
    const zones = [
      { start: 0, end: 0.05, label: 'Blacks', color: 'rgba(0, 0, 0, 0.15)' },
      { start: 0.05, end: 0.25, label: 'Shadows', color: 'rgba(50, 50, 50, 0.1)' },
      { start: 0.25, end: 0.75, label: 'Midtones', color: 'rgba(128, 128, 128, 0.05)' },
      { start: 0.75, end: 0.95, label: 'Highlights', color: 'rgba(200, 200, 200, 0.1)' },
      { start: 0.95, end: 1.0, label: 'Whites', color: 'rgba(255, 255, 255, 0.15)' },
    ];

    zones.forEach(zone => {
      const startX = zone.start * width;
      const zoneWidth = (zone.end - zone.start) * width;
      ctx.fillStyle = zone.color;
      ctx.fillRect(startX, 0, zoneWidth, height);
    });

    // Draw vertical grid lines (divide stops)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const x = (width / 4) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Draw horizontal grid lines
    for (let i = 1; i < 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const barWidth = width / 256;

    // Helper function to draw smooth channel curve
    const drawChannelCurve = (data: number[], color: string, glowColor: string, opacity: number = 1) => {
      // Draw filled area with gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, color.replace(/[\d.]+\)$/, `${0.3 * opacity})`));
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, height);

      // Draw smooth curve with spline
      for (let i = 0; i < 256; i++) {
        const value = applyLogScale(data[i]);
        const barHeight = (value / maxValue) * height;
        const x = i * barWidth;
        const y = height - barHeight;

        if (i === 0) {
          ctx.lineTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();

      // Draw glowing line on top
      ctx.strokeStyle = glowColor.replace(/[\d.]+\)$/, `${opacity})`);
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 6;
      ctx.shadowColor = glowColor;
      ctx.globalCompositeOperation = 'screen';
      
      ctx.beginPath();
      for (let i = 0; i < 256; i++) {
        const value = applyLogScale(data[i]);
        const barHeight = (value / maxValue) * height;
        const x = i * barWidth;
        const y = height - barHeight;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0;
    };

    // Draw based on display mode
    if (displayMode === 'rgb') {
      // Draw RGB channels with beautiful colors
      drawChannelCurve(smoothedRed, 'rgba(255, 60, 60, 0.3)', 'rgba(255, 80, 80, 0.9)');
      drawChannelCurve(smoothedGreen, 'rgba(60, 255, 60, 0.3)', 'rgba(80, 255, 80, 0.9)');
      drawChannelCurve(smoothedBlue, 'rgba(60, 120, 255, 0.3)', 'rgba(80, 140, 255, 0.9)');
      
      // Draw luminance overlay
      drawChannelCurve(smoothedLuminance, 'rgba(255, 255, 255, 0.2)', 'rgba(255, 255, 255, 0.6)', 0.4);
    } else {
      // Draw only luminance
      drawChannelCurve(smoothedLuminance, 'rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0.9)');
    }

    // Highlight clipping areas
    const clippingThreshold = 0.001;
    
    // Shadow clipping (left side)
    const shadowsClipped = smoothedLuminance.slice(0, 5).some(v => v > clippingThreshold);
    if (shadowsClipped) {
      ctx.fillStyle = showShadowClipping ? 'rgba(0, 100, 255, 0.4)' : 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(0, 0, 3, height);
    }

    // Highlight clipping (right side)
    const highlightsClipped = smoothedLuminance.slice(251, 256).some(v => v > clippingThreshold);
    if (highlightsClipped) {
      ctx.fillStyle = showHighlightClipping ? 'rgba(255, 50, 50, 0.4)' : 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(width - 3, 0, 3, height);
    }

    // Draw border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
  }, [histogram, width, height, displayMode, showShadowClipping, showHighlightClipping, smoothHistogram]);

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.header}>
        {/* Close button */}
        {onClose && (
          <button
            className={styles.closeButton}
            onClick={onClose}
            title="Close histogram"
            aria-label="Close histogram"
          >
            ×
          </button>
        )}
        <span className={styles.title}>Histogram</span>
        <div className={styles.controls}>
          <button
            className={`${styles.modeToggle} ${displayMode === 'rgb' ? styles.active : ''}`}
            onClick={() => setDisplayMode('rgb')}
            title="RGB Mode"
          >
            RGB
          </button>
          <button
            className={`${styles.modeToggle} ${displayMode === 'luminance' ? styles.active : ''}`}
            onClick={() => setDisplayMode('luminance')}
            title="Luminance Mode"
          >
            LUM
          </button>
        </div>
      </div>
      
      <div className={styles.canvasWrapper}>
        {/* Clipping indicators */}
        <button
          className={`${styles.clippingIndicator} ${styles.shadowClipping} ${showShadowClipping ? styles.active : ''}`}
          onClick={toggleShadowClipping}
          title="Toggle shadow clipping warning"
          aria-label="Shadow clipping"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M 0 12 L 6 0 L 12 12 Z" fill="currentColor" />
          </svg>
        </button>
        
        <button
          className={`${styles.clippingIndicator} ${styles.highlightClipping} ${showHighlightClipping ? styles.active : ''}`}
          onClick={toggleHighlightClipping}
          title="Toggle highlight clipping warning"
          aria-label="Highlight clipping"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M 0 12 L 6 0 L 12 12 Z" fill="currentColor" />
          </svg>
        </button>

        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className={styles.canvas}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
        
        {/* Hover readout */}
        {hoverData && (
          <div className={styles.hoverReadout}>
            <div className={styles.readoutLine}>
              <span className={styles.readoutLabel}>Value:</span>
              <span className={styles.readoutValue}>{Math.round(hoverData.value * 255)} ({(hoverData.value * 100).toFixed(1)}%)</span>
            </div>
            <div className={styles.readoutLine}>
              <span className={styles.readoutLabel}>RGB:</span>
              <span className={styles.readoutValue}>
                <span style={{ color: 'rgb(255, 80, 80)' }}>{(hoverData.rgb.r * 100).toFixed(2)}%</span>
                {' '}
                <span style={{ color: 'rgb(80, 255, 80)' }}>{(hoverData.rgb.g * 100).toFixed(2)}%</span>
                {' '}
                <span style={{ color: 'rgb(80, 140, 255)' }}>{(hoverData.rgb.b * 100).toFixed(2)}%</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {!imageData && (
        <div className={styles.placeholder}>No histogram data</div>
      )}
    </div>
  );
};
