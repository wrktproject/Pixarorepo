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
   * Render histogram to canvas
   */
  useEffect(() => {
    if (!histogram || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Find max value for scaling
    const maxValue = Math.max(
      ...histogram.red,
      ...histogram.green,
      ...histogram.blue
    );

    if (maxValue === 0) return;

    // Draw histogram bars
    const barWidth = width / 256;

    // Helper function to draw a channel
    const drawChannel = (data: number[], color: string, alpha: number) => {
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;

      for (let i = 0; i < 256; i++) {
        const value = data[i];
        const barHeight = (value / maxValue) * height;
        const x = i * barWidth;
        const y = height - barHeight;

        ctx.fillRect(x, y, barWidth, barHeight);
      }
    };

    // Draw channels with transparency for blending
    drawChannel(histogram.red, '#ff0000', 0.5);
    drawChannel(histogram.green, '#00ff00', 0.5);
    drawChannel(histogram.blue, '#0000ff', 0.5);

    // Reset alpha
    ctx.globalAlpha = 1.0;

    // Draw border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);
  }, [histogram, width, height]);

  return (
    <div className={styles.container}>
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
