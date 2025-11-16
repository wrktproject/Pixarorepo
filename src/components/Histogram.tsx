/**
 * Histogram Component
 * Displays RGB histogram showing tonal distribution
 * Uses Web Worker for calculation to avoid blocking UI
 */

import { useEffect, useRef, useState } from 'react';
import type { HistogramData } from '../workers/histogram.worker';
import styles from './Histogram.module.css';

interface HistogramProps {
  imageData: ImageData | null;
  width?: number;
  height?: number;
}

export const Histogram: React.FC<HistogramProps> = ({
  imageData,
  width = 256,
  height = 100,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const [histogram, setHistogram] = useState<HistogramData | null>(null);

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
   * Render histogram to canvas with improved visuals
   */
  useEffect(() => {
    if (!histogram || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true });

    if (!ctx) return;

    // Clear canvas with dark background
    ctx.fillStyle = 'rgba(15, 15, 15, 0.95)';
    ctx.fillRect(0, 0, width, height);

    // Find max value for scaling with some headroom
    const maxValue = Math.max(
      ...histogram.red,
      ...histogram.green,
      ...histogram.blue
    ) * 1.1; // 10% headroom for better visualization

    if (maxValue === 0) return;

    // Draw grid lines for reference
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw vertical guides (shadows, midtones, highlights)
    for (let i = 1; i < 4; i++) {
      const x = (width / 4) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    const barWidth = width / 256;

    // Helper function to draw smooth channel curve
    const drawChannelCurve = (data: number[], color: string, glowColor: string) => {
      // Draw filled area with gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, height);

      // Draw smooth curve through histogram data
      for (let i = 0; i < 256; i++) {
        const value = data[i];
        const barHeight = (value / maxValue) * height;
        const x = i * barWidth;
        const y = height - barHeight;

        if (i === 0) {
          ctx.lineTo(x, y);
        } else {
          // Smooth curve using quadratic bezier
          const prevX = (i - 1) * barWidth;
          const prevValue = data[i - 1];
          const prevBarHeight = (prevValue / maxValue) * height;
          const prevY = height - prevBarHeight;
          const cpX = (prevX + x) / 2;
          const cpY = (prevY + y) / 2;
          ctx.quadraticCurveTo(prevX, prevY, cpX, cpY);
        }
      }

      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();

      // Draw glowing line on top
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 8;
      ctx.shadowColor = glowColor;
      ctx.globalCompositeOperation = 'screen'; // Additive blending
      
      ctx.beginPath();
      for (let i = 0; i < 256; i++) {
        const value = data[i];
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
      
      // Reset composite operation and shadow
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0;
    };

    // Draw channels with beautiful colors and glow effects
    drawChannelCurve(histogram.red, 'rgba(255, 60, 60, 0.3)', 'rgba(255, 80, 80, 0.9)');
    drawChannelCurve(histogram.green, 'rgba(60, 255, 60, 0.3)', 'rgba(80, 255, 80, 0.9)');
    drawChannelCurve(histogram.blue, 'rgba(60, 120, 255, 0.3)', 'rgba(80, 140, 255, 0.9)');

    // Draw luminosity overlay (white)
    const luminosity = histogram.red.map((r, i) => 
      (r + histogram.green[i] + histogram.blue[i]) / 3
    );
    const maxLum = Math.max(...luminosity) * 1.1;
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 256; i++) {
      const value = luminosity[i];
      const barHeight = (value / maxLum) * height;
      const x = i * barWidth;
      const y = height - barHeight;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw subtle border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
  }, [histogram, width, height]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Histogram</span>
        <div className={styles.legend}>
          <span className={styles.legendItem} style={{ color: 'rgb(255, 80, 80)' }}>●</span>
          <span className={styles.legendItem} style={{ color: 'rgb(80, 255, 80)' }}>●</span>
          <span className={styles.legendItem} style={{ color: 'rgb(80, 140, 255)' }}>●</span>
          <span className={styles.legendItem} style={{ color: 'rgb(255, 255, 255)' }}>◐</span>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={styles.canvas}
      />
      {!imageData && (
        <div className={styles.placeholder}>No histogram data</div>
      )}
    </div>
  );
};
