/**
 * RemovalToolOverlay Component
 * Lightroom-style spot healing overlay with outlined strokes and source markers
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import './RemovalToolOverlay.css';

export interface BrushStroke {
  id: string;
  mode: 'clone' | 'heal' | 'content-aware';
  points: Array<{ x: number; y: number }>;
  sourceOffset?: { x: number; y: number };
  sourcePoint?: { x: number; y: number }; // Actual source location
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
  completedStrokes?: BrushStroke[];
  sourcePoint?: { x: number; y: number } | null;
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
      
      const canvasX = screenX - rect.left;
      const canvasY = screenY - rect.top;

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
   * Convert image coordinates to screen coordinates
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
   * Calculate the center point of a stroke
   */
  const getStrokeCenter = useCallback((points: Array<{ x: number; y: number }>): { x: number; y: number } => {
    if (points.length === 0) return { x: 0, y: 0 };
    
    const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return {
      x: sum.x / points.length,
      y: sum.y / points.length,
    };
  }, []);

  /**
   * Handle mouse down
   */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!image) return;

      const imageCoords = screenToImage(e.clientX, e.clientY);
      if (!imageCoords) return;

      // Alt+Click sets source point
      if (e.altKey && (brushMode === 'clone' || brushMode === 'heal')) {
        setSourcePoint(imageCoords);
        console.log('Source point set:', imageCoords);
        return;
      }

      setIsDrawing(true);
      setCurrentStroke([imageCoords]);
    },
    [image, screenToImage, brushMode, setSourcePoint]
  );

  /**
   * Handle mouse move
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
   * Handle mouse up
   */
  const handleMouseUp = useCallback(() => {
    if (isDrawing && currentStroke.length > 0) {
      const strokeCenter = getStrokeCenter(currentStroke);
      
      // Calculate source point for this stroke
      let strokeSourcePoint: { x: number; y: number } | undefined;
      let strokeSourceOffset: { x: number; y: number } | undefined;
      
      if (sourcePoint) {
        strokeSourcePoint = { ...sourcePoint };
        strokeSourceOffset = {
          x: sourcePoint.x - strokeCenter.x,
          y: sourcePoint.y - strokeCenter.y,
        };
      }

      const stroke: BrushStroke = {
        id: `stroke-${Date.now()}`,
        mode: brushMode,
        points: [...currentStroke],
        sourceOffset: strokeSourceOffset,
        sourcePoint: strokeSourcePoint,
        size: brushSize,
        feather,
        opacity,
      };

      console.log('Completing stroke:', {
        mode: brushMode,
        pointCount: currentStroke.length,
        center: strokeCenter,
        sourcePoint: strokeSourcePoint,
      });

      onStrokeComplete(stroke);
      setCurrentStroke([]);
    }

    setIsDrawing(false);
  }, [isDrawing, currentStroke, sourcePoint, brushMode, brushSize, feather, opacity, onStrokeComplete, getStrokeCenter]);

  /**
   * Handle mouse leave
   */
  const handleMouseLeave = useCallback(() => {
    setCursorPos(null);
    if (isDrawing) {
      setIsDrawing(false);
      setCurrentStroke([]);
    }
  }, [isDrawing]);

  /**
   * Handle wheel for brush size
   */
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.ctrlKey || !onBrushSizeChange) return;
      e.preventDefault();
      const delta = -Math.sign(e.deltaY) * 5;
      const newSize = Math.max(10, Math.min(200, brushSize + delta));
      onBrushSizeChange(newSize);
    },
    [brushSize, onBrushSizeChange]
  );

  /**
   * Draw a stroke outline (Lightroom-style white outline)
   */
  const drawStrokeOutline = useCallback((
    ctx: CanvasRenderingContext2D,
    points: Array<{ x: number; y: number }>,
    size: number,
    avgScale: number,
    isActive: boolean = false
  ) => {
    if (points.length === 0) return;

    const screenBrushSize = size * avgScale;
    
    // Create a path that encompasses all the brush strokes
    ctx.beginPath();
    
    if (points.length === 1) {
      // Single point - draw a circle
      const screenPos = imageToScreen(points[0].x, points[0].y);
      if (screenPos) {
        ctx.arc(screenPos.x, screenPos.y, screenBrushSize / 2, 0, Math.PI * 2);
      }
    } else {
      // Multiple points - draw rounded path
      // First pass: draw filled circles to create the shape
      ctx.save();
      
      // Create a temporary canvas for the mask
      points.forEach((point) => {
        const screenPos = imageToScreen(point.x, point.y);
        if (screenPos) {
          ctx.moveTo(screenPos.x + screenBrushSize / 2, screenPos.y);
          ctx.arc(screenPos.x, screenPos.y, screenBrushSize / 2, 0, Math.PI * 2);
        }
      });
      
      ctx.restore();
    }

    // Draw the white outline
    ctx.strokeStyle = isActive ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = isActive ? 2.5 : 2;
    ctx.stroke();
    
    // Subtle fill
    ctx.fillStyle = isActive ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)';
    ctx.fill();
  }, [imageToScreen]);

  /**
   * Draw a blue source marker (circular pin like Lightroom)
   */
  const drawSourceMarker = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    isActive: boolean = false
  ) => {
    const screenPos = imageToScreen(x, y);
    if (!screenPos) return;

    const radius = isActive ? 14 : 12;
    const innerRadius = isActive ? 4 : 3;

    // Outer blue circle
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? 'rgba(66, 133, 244, 1)' : 'rgba(66, 133, 244, 0.9)';
    ctx.fill();
    
    // White border
    ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // White center dot
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, innerRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.fill();
  }, [imageToScreen]);

  /**
   * Draw connecting line between stroke center and source
   */
  const drawConnectionLine = useCallback((
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  ) => {
    const fromScreen = imageToScreen(fromX, fromY);
    const toScreen = imageToScreen(toX, toY);
    if (!fromScreen || !toScreen) return;

    ctx.beginPath();
    ctx.moveTo(fromScreen.x, fromScreen.y);
    ctx.lineTo(toScreen.x, toScreen.y);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [imageToScreen]);

  /**
   * Main drawing effect
   */
  useEffect(() => {
    const overlay = overlayRef.current;
    const canvas = canvasRef.current;
    if (!overlay || !canvas || !image) return;

    const rect = canvas.getBoundingClientRect();
    overlay.width = rect.width;
    overlay.height = rect.height;

    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const scaleX = rect.width / image.width;
    const scaleY = rect.height / image.height;
    const avgScale = (scaleX + scaleY) / 2;

    // Draw completed strokes (Lightroom-style)
    completedStrokes.forEach((stroke) => {
      // Draw stroke outline
      drawStrokeOutline(ctx, stroke.points, stroke.size, avgScale, false);
      
      // Draw source marker and connection line
      if (stroke.sourcePoint && (stroke.mode === 'clone' || stroke.mode === 'heal')) {
        const center = getStrokeCenter(stroke.points);
        drawConnectionLine(ctx, center.x, center.y, stroke.sourcePoint.x, stroke.sourcePoint.y);
        drawSourceMarker(ctx, stroke.sourcePoint.x, stroke.sourcePoint.y, false);
      }
    });

    // Draw current stroke being drawn
    if (currentStroke.length > 0) {
      drawStrokeOutline(ctx, currentStroke, brushSize, avgScale, true);
      
      // Draw connection to source if set
      if (sourcePoint && (brushMode === 'clone' || brushMode === 'heal')) {
        const center = getStrokeCenter(currentStroke);
        drawConnectionLine(ctx, center.x, center.y, sourcePoint.x, sourcePoint.y);
      }
    }

    // Draw the active source point marker (if set)
    if (sourcePoint && (brushMode === 'clone' || brushMode === 'heal')) {
      drawSourceMarker(ctx, sourcePoint.x, sourcePoint.y, true);
    }

    // Draw brush cursor
    if (cursorPos && !isDrawing) {
      const screenPos = imageToScreen(cursorPos.x, cursorPos.y);
      if (screenPos) {
        const screenBrushSize = brushSize * avgScale;

        // Cursor circle
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, screenBrushSize / 2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Center crosshair
        const crossSize = 6;
        ctx.beginPath();
        ctx.moveTo(screenPos.x - crossSize, screenPos.y);
        ctx.lineTo(screenPos.x + crossSize, screenPos.y);
        ctx.moveTo(screenPos.x, screenPos.y - crossSize);
        ctx.lineTo(screenPos.x, screenPos.y + crossSize);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Show hint if no source is set
        if ((brushMode === 'clone' || brushMode === 'heal') && !sourcePoint) {
          ctx.fillStyle = 'rgba(255, 200, 100, 0.9)';
          ctx.font = 'bold 11px system-ui, sans-serif';
          ctx.fillText('Alt+Click to set source', screenPos.x + screenBrushSize / 2 + 10, screenPos.y);
        }
      }
    }
  }, [canvasRef, image, currentStroke, cursorPos, sourcePoint, brushSize, brushMode, 
      imageToScreen, isDrawing, completedStrokes, drawStrokeOutline, drawSourceMarker, 
      drawConnectionLine, getStrokeCenter]);

  /**
   * Sync overlay position with canvas
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;

    const updateOverlay = () => {
      const rect = canvas.getBoundingClientRect();
      overlay.width = rect.width;
      overlay.height = rect.height;
      overlay.style.top = `${rect.top}px`;
      overlay.style.left = `${rect.left}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
    };

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(updateOverlay);
    });

    updateOverlay();
    resizeObserver.observe(canvas);
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
