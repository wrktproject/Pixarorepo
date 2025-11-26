/**
 * RemovalToolOverlay Component
 * Interactive overlay for drawing healing/clone brush strokes directly on the image
 * Shows real-time brush cursor and stroke history
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
  onBrushSizeChange?: (size: number) => void;
  completedStrokes?: BrushStroke[]; // Show completed strokes
  sourcePoint?: { x: number; y: number } | null; // External source point
  onSourcePointChange?: (point: { x: number; y: number } | null) => void;
}

export const RemovalToolOverlay: React.FC<RemovalToolOverlayProps> = ({
  canvasRef,
  onStrokeComplete,
  brushMode,
  brushSize,
  feather,
  opacity,
  onBrushSizeChange,
  completedStrokes = [],
  sourcePoint: externalSourcePoint,
  onSourcePointChange,
}) => {
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Array<{ x: number; y: number }>>([]);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [internalSourcePoint, setInternalSourcePoint] = useState<{ x: number; y: number } | null>(null);

  // Use external source point if provided, otherwise use internal
  const sourcePoint = externalSourcePoint ?? internalSourcePoint;
  const setSourcePoint = onSourcePointChange ?? setInternalSourcePoint;

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
        console.log('Source point set:', imageCoords);
        return;
      }

      // Start drawing stroke
      setIsDrawing(true);
      setCurrentStroke([imageCoords]);
    },
    [image, screenToImage, brushMode, setSourcePoint]
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
    if (isDrawing && currentStroke.length > 0) {
      // Create stroke object
      const stroke: BrushStroke = {
        id: `stroke-${Date.now()}`,
        mode: brushMode,
        points: [...currentStroke],
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

      console.log('Completing stroke:', {
        mode: brushMode,
        pointCount: currentStroke.length,
        hasSource: !!sourcePoint,
        sourceOffset: stroke.sourceOffset,
      });

      onStrokeComplete(stroke);
      setCurrentStroke([]);
    }

    setIsDrawing(false);
  }, [isDrawing, currentStroke, sourcePoint, brushMode, brushSize, feather, opacity, onStrokeComplete]);

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
   * Handle wheel event - Ctrl+Scroll to change brush size
   */
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.ctrlKey || !onBrushSizeChange) return;

      e.preventDefault();

      // Calculate size change (negative deltaY = scroll up = increase)
      const delta = -Math.sign(e.deltaY) * 5;
      const newSize = Math.max(10, Math.min(150, brushSize + delta));

      onBrushSizeChange(newSize);
    },
    [brushSize, onBrushSizeChange]
  );

  /**
   * Draw overlay visualization (cursor, source point, strokes)
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

    // Calculate scale for brush size visualization
    const scaleX = rect.width / image.width;
    const scaleY = rect.height / image.height;
    const avgScale = (scaleX + scaleY) / 2;
    const screenBrushSize = brushSize * avgScale;

    // Draw completed strokes (faded to show they're applied)
    completedStrokes.forEach((stroke, strokeIndex) => {
      const strokeOpacity = 0.15 + (strokeIndex / completedStrokes.length) * 0.15;
      ctx.fillStyle = `rgba(100, 200, 100, ${strokeOpacity})`;
      ctx.strokeStyle = `rgba(100, 200, 100, ${strokeOpacity + 0.3})`;
      ctx.lineWidth = 1;

      const strokeBrushSize = stroke.size * avgScale;

      stroke.points.forEach((point) => {
        const screenPos = imageToScreen(point.x, point.y);
        if (screenPos) {
          ctx.beginPath();
          ctx.arc(screenPos.x, screenPos.y, strokeBrushSize / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    });

    // Draw current stroke preview (bright blue)
    if (currentStroke.length > 0) {
      ctx.fillStyle = 'rgba(74, 158, 255, 0.4)';
      ctx.strokeStyle = 'rgba(74, 158, 255, 0.9)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Draw filled circles at each point to show brush coverage
      currentStroke.forEach((point) => {
        const screenPos = imageToScreen(point.x, point.y);
        if (screenPos) {
          ctx.beginPath();
          ctx.arc(screenPos.x, screenPos.y, screenBrushSize / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Draw connecting line
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

    // Draw source point indicator (for clone/heal)
    if (sourcePoint && (brushMode === 'clone' || brushMode === 'heal')) {
      const screenPos = imageToScreen(sourcePoint.x, sourcePoint.y);
      if (screenPos) {
        // Draw outer glow
        ctx.strokeStyle = 'rgba(255, 100, 100, 0.3)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, screenBrushSize / 2 + 3, 0, Math.PI * 2);
        ctx.stroke();

        // Draw main circle
        ctx.strokeStyle = 'rgba(255, 100, 100, 1)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, screenBrushSize / 2, 0, Math.PI * 2);
        ctx.stroke();

        // Draw crosshair
        const size = 15;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(screenPos.x - size, screenPos.y);
        ctx.lineTo(screenPos.x + size, screenPos.y);
        ctx.moveTo(screenPos.x, screenPos.y - size);
        ctx.lineTo(screenPos.x, screenPos.y + size);
        ctx.stroke();

        // Label
        ctx.fillStyle = 'rgba(255, 100, 100, 1)';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.fillText('SOURCE', screenPos.x + screenBrushSize / 2 + 8, screenPos.y + 4);
      }

      // Draw source-to-cursor line when drawing
      if (isDrawing && currentStroke.length > 0 && cursorPos) {
        const sourceScreen = imageToScreen(sourcePoint.x, sourcePoint.y);
        const cursorScreen = imageToScreen(cursorPos.x, cursorPos.y);
        
        if (sourceScreen && cursorScreen) {
          ctx.strokeStyle = 'rgba(255, 200, 100, 0.5)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(sourceScreen.x, sourceScreen.y);
          ctx.lineTo(cursorScreen.x, cursorScreen.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // Draw brush cursor (always show when cursor is in canvas)
    if (cursorPos) {
      const screenPos = imageToScreen(cursorPos.x, cursorPos.y);
      if (screenPos) {
        // Draw outer shadow for visibility on any background
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, screenBrushSize / 2, 0, Math.PI * 2);
        ctx.stroke();

        // Draw main cursor circle
        ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, screenBrushSize / 2, 0, Math.PI * 2);
        ctx.stroke();

        // Draw center crosshair
        const crosshairSize = Math.min(8, screenBrushSize / 4);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(screenPos.x - crosshairSize, screenPos.y);
        ctx.lineTo(screenPos.x + crosshairSize, screenPos.y);
        ctx.moveTo(screenPos.x, screenPos.y - crosshairSize);
        ctx.lineTo(screenPos.x, screenPos.y + crosshairSize);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(screenPos.x - crosshairSize, screenPos.y);
        ctx.lineTo(screenPos.x + crosshairSize, screenPos.y);
        ctx.moveTo(screenPos.x, screenPos.y - crosshairSize);
        ctx.lineTo(screenPos.x, screenPos.y + crosshairSize);
        ctx.stroke();

        // Show "No Source" warning for clone/heal without source point
        if ((brushMode === 'clone' || brushMode === 'heal') && !sourcePoint) {
          ctx.fillStyle = 'rgba(255, 200, 100, 0.9)';
          ctx.font = 'bold 11px system-ui, sans-serif';
          ctx.fillText('Alt+Click to set source', screenPos.x + screenBrushSize / 2 + 8, screenPos.y - 5);
        }
      }
    }
  }, [canvasRef, image, currentStroke, cursorPos, sourcePoint, brushSize, brushMode, imageToScreen, isDrawing, completedStrokes]);

  /**
   * Sync overlay size and position with canvas on resize
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;

    const updateOverlay = () => {
      const rect = canvas.getBoundingClientRect();
      overlay.width = rect.width;
      overlay.height = rect.height;
      
      // Position overlay exactly over canvas
      overlay.style.top = `${rect.top}px`;
      overlay.style.left = `${rect.left}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
    };

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(updateOverlay);
    });

    // Initial positioning
    updateOverlay();
    
    resizeObserver.observe(canvas);
    
    // Also update on scroll/resize since canvas might move
    window.addEventListener('scroll', updateOverlay, true);
    window.addEventListener('resize', updateOverlay);
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('scroll', updateOverlay, true);
      window.removeEventListener('resize', updateOverlay);
    };
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
      onWheel={handleWheel}
      style={{
        cursor: 'none',
        position: 'fixed',
        pointerEvents: 'auto',
      }}
    />
  );
};
