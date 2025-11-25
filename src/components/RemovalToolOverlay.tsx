/**
 * RemovalToolOverlay Component
 * Interactive overlay for drawing healing/clone brush strokes directly on the image
 * Handles mouse/touch events, visual feedback, and real-time preview
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import './RemovalToolOverlay.css';

export interface BrushStroke {
  id: string;
  mode: 'clone' | 'heal' | 'content-aware';
  points: Array<{ x: number; y: number }>;
  sourceOffset?: { x: number; y: number }; // For clone/heal
  size: number;
  feather: number;
  opacity: number;
}

interface RemovalToolOverlayProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onStrokeComplete: (stroke: BrushStroke) => void;
  brushMode: 'clone' | 'heal' | 'content-aware';
  brushSize: number;
  feather: number;
  opacity: number;
}

export const RemovalToolOverlay: React.FC<RemovalToolOverlayProps> = ({
  canvasRef,
  onStrokeComplete,
  brushMode,
  brushSize,
  feather,
  opacity,
}) => {
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Array<{ x: number; y: number }>>([]);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [sourcePoint, setSourcePoint] = useState<{ x: number; y: number } | null>(null);
  const [isSettingSource, setIsSettingSource] = useState(false);

  const image = useSelector((state: RootState) => state.image.current);

  /**
   * Convert screen coordinates to image coordinates
   */
  const screenToImage = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } | null => {
      if (!canvasRef.current || !image) return null;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      
      // Convert screen position to canvas position
      const canvasX = screenX - rect.left;
      const canvasY = screenY - rect.top;

      // Convert canvas position to image coordinates
      const scaleX = image.width / rect.width;
      const scaleY = image.height / rect.height;

      return {
        x: Math.round(canvasX * scaleX),
        y: Math.round(canvasY * scaleY),
      };
    },
    [canvasRef, image]
  );

  /**
   * Convert image coordinates to screen coordinates (for drawing overlay)
   */
  const imageToScreen = useCallback(
    (imageX: number, imageY: number): { x: number; y: number } | null => {
      if (!canvasRef.current || !overlayRef.current || !image) return null;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      
      const scaleX = rect.width / image.width;
      const scaleY = rect.height / image.height;

      return {
        x: imageX * scaleX,
        y: imageY * scaleY,
      };
    },
    [canvasRef, image]
  );

  /**
   * Handle mouse down - start drawing or set source point
   */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!image) return;

      const imageCoords = screenToImage(e.clientX, e.clientY);
      if (!imageCoords) return;

      // Alt+Click sets source point for clone/heal
      if (e.altKey && (brushMode === 'clone' || brushMode === 'heal')) {
        setSourcePoint(imageCoords);
        setIsSettingSource(true);
        return;
      }

      // Start drawing stroke
      setIsDrawing(true);
      setCurrentStroke([imageCoords]);
    },
    [image, screenToImage, brushMode]
  );

  /**
   * Handle mouse move - add to stroke or update cursor
   */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const imageCoords = screenToImage(e.clientX, e.clientY);
      if (!imageCoords) return;

      setCursorPos(imageCoords);

      if (isDrawing) {
        setCurrentStroke((prev) => [...prev, imageCoords]);
      }
    },
    [screenToImage, isDrawing]
  );

  /**
   * Handle mouse up - complete stroke
   */
  const handleMouseUp = useCallback(() => {
    if (isSettingSource) {
      setIsSettingSource(false);
      return;
    }

    if (isDrawing && currentStroke.length > 0) {
      // Create stroke object
      const stroke: BrushStroke = {
        id: `stroke-${Date.now()}`,
        mode: brushMode,
        points: currentStroke,
        sourceOffset: sourcePoint
          ? {
              x: sourcePoint.x - currentStroke[0].x,
              y: sourcePoint.y - currentStroke[0].y,
            }
          : undefined,
        size: brushSize,
        feather,
        opacity,
      };

      onStrokeComplete(stroke);
      setCurrentStroke([]);
    }

    setIsDrawing(false);
  }, [isDrawing, isSettingSource, currentStroke, sourcePoint, brushMode, brushSize, feather, opacity, onStrokeComplete]);

  /**
   * Handle mouse leave - cancel drawing
   */
  const handleMouseLeave = useCallback(() => {
    setCursorPos(null);
    if (isDrawing) {
      setIsDrawing(false);
      setCurrentStroke([]);
    }
  }, [isDrawing]);

  /**
   * Draw overlay visualization (cursor, source point, current stroke)
   */
  useEffect(() => {
    const overlay = overlayRef.current;
    const canvas = canvasRef.current;
    if (!overlay || !canvas || !image) return;

    // Match overlay size to canvas
    const rect = canvas.getBoundingClientRect();
    overlay.width = rect.width;
    overlay.height = rect.height;

    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, overlay.width, overlay.height);

    // Draw current stroke preview
    if (currentStroke.length > 0) {
      ctx.strokeStyle = 'rgba(74, 158, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      currentStroke.forEach((point, i) => {
        const screenPos = imageToScreen(point.x, point.y);
        if (!screenPos) return;

        if (i === 0) {
          ctx.moveTo(screenPos.x, screenPos.y);
        } else {
          ctx.lineTo(screenPos.x, screenPos.y);
        }
      });
      ctx.stroke();
    }

    // Draw source point (for clone/heal)
    if (sourcePoint && (brushMode === 'clone' || brushMode === 'heal')) {
      const screenPos = imageToScreen(sourcePoint.x, sourcePoint.y);
      if (screenPos) {
        // Draw crosshair
        ctx.strokeStyle = 'rgba(255, 100, 100, 0.9)';
        ctx.lineWidth = 2;
        const size = 10;
        
        ctx.beginPath();
        ctx.moveTo(screenPos.x - size, screenPos.y);
        ctx.lineTo(screenPos.x + size, screenPos.y);
        ctx.moveTo(screenPos.x, screenPos.y - size);
        ctx.lineTo(screenPos.x, screenPos.y + size);
        ctx.stroke();

        // Draw circle
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, brushSize / 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Draw brush cursor
    if (cursorPos && !isDrawing) {
      const screenPos = imageToScreen(cursorPos.x, cursorPos.y);
      if (screenPos) {
        ctx.strokeStyle = isSettingSource
          ? 'rgba(255, 100, 100, 0.7)'
          : 'rgba(74, 158, 255, 0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);

        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, brushSize / 2, 0, Math.PI * 2);
        ctx.stroke();

        ctx.setLineDash([]);
      }
    }
  }, [canvasRef, image, currentStroke, cursorPos, sourcePoint, brushSize, brushMode, imageToScreen, isDrawing, isSettingSource]);

  /**
   * Sync overlay size with canvas on resize
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver(() => {
      // Trigger redraw on next frame
      requestAnimationFrame(() => {
        if (overlayRef.current) {
          const rect = canvas.getBoundingClientRect();
          overlayRef.current.width = rect.width;
          overlayRef.current.height = rect.height;
        }
      });
    });

    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, [canvasRef]);

  if (!image) return null;

  return (
    <canvas
      ref={overlayRef}
      className="removal-tool-overlay"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{
        cursor: isSettingSource ? 'crosshair' : 'none',
      }}
    />
  );
};

