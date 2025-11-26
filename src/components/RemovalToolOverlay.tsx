/**
 * RemovalToolOverlay Component
 * Lightroom-style spot healing overlay with smooth outlined strokes and source markers
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
  sourcePoint?: { x: number; y: number };
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

  const getStrokeCenter = useCallback((points: Array<{ x: number; y: number }>): { x: number; y: number } => {
    if (points.length === 0) return { x: 0, y: 0 };
    const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / points.length, y: sum.y / points.length };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!image) return;
      const imageCoords = screenToImage(e.clientX, e.clientY);
      if (!imageCoords) return;

      if (e.altKey && (brushMode === 'clone' || brushMode === 'heal')) {
        setSourcePoint(imageCoords);
        return;
      }

      setIsDrawing(true);
      setCurrentStroke([imageCoords]);
    },
    [image, screenToImage, brushMode, setSourcePoint]
  );

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

  const handleMouseUp = useCallback(() => {
    if (isDrawing && currentStroke.length > 0) {
      const strokeCenter = getStrokeCenter(currentStroke);
      
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

      onStrokeComplete(stroke);
      setCurrentStroke([]);
    }
    setIsDrawing(false);
  }, [isDrawing, currentStroke, sourcePoint, brushMode, brushSize, feather, opacity, onStrokeComplete, getStrokeCenter]);

  const handleMouseLeave = useCallback(() => {
    setCursorPos(null);
    if (isDrawing) {
      setIsDrawing(false);
      setCurrentStroke([]);
    }
  }, [isDrawing]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.ctrlKey || !onBrushSizeChange) return;
      e.preventDefault();
      const delta = -Math.sign(e.deltaY) * 10;
      const newSize = Math.max(20, Math.min(300, brushSize + delta));
      onBrushSizeChange(newSize);
    },
    [brushSize, onBrushSizeChange]
  );

  /**
   * Draw a smooth stroke outline using thick line with round caps
   * This creates the Lightroom-style smooth outlined shape
   */
  const drawSmoothStrokeOutline = useCallback((
    ctx: CanvasRenderingContext2D,
    points: Array<{ x: number; y: number }>,
    size: number,
    avgScale: number,
    isActive: boolean = false
  ) => {
    if (points.length === 0) return;

    const screenBrushSize = size * avgScale;
    
    // Convert points to screen coordinates
    const screenPoints: Array<{ x: number; y: number }> = [];
    for (const point of points) {
      const screenPos = imageToScreen(point.x, point.y);
      if (screenPos) {
        screenPoints.push(screenPos);
      }
    }
    
    if (screenPoints.length === 0) return;

    ctx.save();
    
    // Draw the thick stroke path (this creates the filled shape)
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = screenBrushSize;
    
    if (screenPoints.length === 1) {
      // Single point - draw as arc
      ctx.arc(screenPoints[0].x, screenPoints[0].y, screenBrushSize / 2, 0, Math.PI * 2);
    } else {
      // Smooth curve through points using quadratic bezier
      ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
      
      for (let i = 1; i < screenPoints.length - 1; i++) {
        const xc = (screenPoints[i].x + screenPoints[i + 1].x) / 2;
        const yc = (screenPoints[i].y + screenPoints[i + 1].y) / 2;
        ctx.quadraticCurveTo(screenPoints[i].x, screenPoints[i].y, xc, yc);
      }
      
      // Last point
      if (screenPoints.length > 1) {
        const last = screenPoints[screenPoints.length - 1];
        ctx.lineTo(last.x, last.y);
      }
    }
    
    // Stroke with thick line to create the shape
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.0)'; // Invisible, just for shape
    ctx.stroke();
    
    // Now we need to draw the outline of this thick stroke
    // We'll use a compositing trick: draw the thick stroke, then draw outline
    
    ctx.restore();
    ctx.save();
    
    // Draw filled shape first (subtle fill)
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = screenBrushSize;
    
    if (screenPoints.length === 1) {
      ctx.arc(screenPoints[0].x, screenPoints[0].y, screenBrushSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.03)';
      ctx.fill();
    } else {
      ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
      for (let i = 1; i < screenPoints.length - 1; i++) {
        const xc = (screenPoints[i].x + screenPoints[i + 1].x) / 2;
        const yc = (screenPoints[i].y + screenPoints[i + 1].y) / 2;
        ctx.quadraticCurveTo(screenPoints[i].x, screenPoints[i].y, xc, yc);
      }
      if (screenPoints.length > 1) {
        ctx.lineTo(screenPoints[screenPoints.length - 1].x, screenPoints[screenPoints.length - 1].y);
      }
      ctx.strokeStyle = isActive ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.03)';
      ctx.stroke();
    }
    
    ctx.restore();
    
    // Draw the white outline border
    ctx.save();
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = screenBrushSize + 3; // Slightly larger for outer edge
    
    if (screenPoints.length === 1) {
      ctx.arc(screenPoints[0].x, screenPoints[0].y, screenBrushSize / 2 + 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = isActive ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = isActive ? 2.5 : 2;
      ctx.stroke();
    } else {
      ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
      for (let i = 1; i < screenPoints.length - 1; i++) {
        const xc = (screenPoints[i].x + screenPoints[i + 1].x) / 2;
        const yc = (screenPoints[i].y + screenPoints[i + 1].y) / 2;
        ctx.quadraticCurveTo(screenPoints[i].x, screenPoints[i].y, xc, yc);
      }
      if (screenPoints.length > 1) {
        ctx.lineTo(screenPoints[screenPoints.length - 1].x, screenPoints[screenPoints.length - 1].y);
      }
      
      // Draw as thick stroke, then draw outline on top
      ctx.strokeStyle = 'rgba(0, 0, 0, 0)';
      ctx.lineWidth = screenBrushSize;
      ctx.stroke();
      
      // Redraw just the outline
      ctx.beginPath();
      ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
      for (let i = 1; i < screenPoints.length - 1; i++) {
        const xc = (screenPoints[i].x + screenPoints[i + 1].x) / 2;
        const yc = (screenPoints[i].y + screenPoints[i + 1].y) / 2;
        ctx.quadraticCurveTo(screenPoints[i].x, screenPoints[i].y, xc, yc);
      }
      if (screenPoints.length > 1) {
        ctx.lineTo(screenPoints[screenPoints.length - 1].x, screenPoints[screenPoints.length - 1].y);
      }
      ctx.strokeStyle = isActive ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = screenBrushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Use shadow to create outline effect
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      
      // First, draw the filled stroke shape (transparent)
      ctx.beginPath();
      ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
      for (let i = 1; i < screenPoints.length - 1; i++) {
        const xc = (screenPoints[i].x + screenPoints[i + 1].x) / 2;
        const yc = (screenPoints[i].y + screenPoints[i + 1].y) / 2;
        ctx.quadraticCurveTo(screenPoints[i].x, screenPoints[i].y, xc, yc);
      }
      if (screenPoints.length > 1) {
        ctx.lineTo(screenPoints[screenPoints.length - 1].x, screenPoints[screenPoints.length - 1].y);
      }
      ctx.lineWidth = screenBrushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = isActive ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.04)';
      ctx.stroke();
      
      // Then draw the outline on top
      ctx.beginPath();
      ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
      for (let i = 1; i < screenPoints.length - 1; i++) {
        const xc = (screenPoints[i].x + screenPoints[i + 1].x) / 2;
        const yc = (screenPoints[i].y + screenPoints[i + 1].y) / 2;
        ctx.quadraticCurveTo(screenPoints[i].x, screenPoints[i].y, xc, yc);
      }
      if (screenPoints.length > 1) {
        ctx.lineTo(screenPoints[screenPoints.length - 1].x, screenPoints[screenPoints.length - 1].y);
      }
      ctx.lineWidth = screenBrushSize + (isActive ? 3 : 2.5);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0)';
      ctx.shadowColor = isActive ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.85)';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      
      // Actually draw outline by stroking with smaller width on top
      ctx.stroke();
      
      // Clear shadow and draw proper outline
      ctx.shadowColor = 'transparent';
      ctx.beginPath();
      ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
      for (let i = 1; i < screenPoints.length - 1; i++) {
        const xc = (screenPoints[i].x + screenPoints[i + 1].x) / 2;
        const yc = (screenPoints[i].y + screenPoints[i + 1].y) / 2;
        ctx.quadraticCurveTo(screenPoints[i].x, screenPoints[i].y, xc, yc);
      }
      if (screenPoints.length > 1) {
        ctx.lineTo(screenPoints[screenPoints.length - 1].x, screenPoints[screenPoints.length - 1].y);
      }
      ctx.lineWidth = screenBrushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = isActive ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = isActive ? 2.5 : 2;
      ctx.stroke();
      
      ctx.restore();
    }
    
    ctx.restore();
  }, [imageToScreen]);

  /**
   * Draw blue source marker
   */
  const drawSourceMarker = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    isActive: boolean = false
  ) => {
    const screenPos = imageToScreen(x, y);
    if (!screenPos) return;

    const radius = isActive ? 16 : 14;
    const innerRadius = isActive ? 4 : 3;

    // Outer blue circle with gradient
    const gradient = ctx.createRadialGradient(
      screenPos.x, screenPos.y, 0,
      screenPos.x, screenPos.y, radius
    );
    gradient.addColorStop(0, 'rgba(66, 133, 244, 1)');
    gradient.addColorStop(1, 'rgba(52, 108, 200, 1)');
    
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // White border
    ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // White center dot
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, innerRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.fill();
  }, [imageToScreen]);

  /**
   * Draw connecting line
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
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [imageToScreen]);

  /**
   * Main render
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

    // Draw completed strokes
    completedStrokes.forEach((stroke) => {
      drawSmoothStrokeOutline(ctx, stroke.points, stroke.size, avgScale, false);
      
      if (stroke.sourcePoint && (stroke.mode === 'clone' || stroke.mode === 'heal')) {
        const center = getStrokeCenter(stroke.points);
        drawConnectionLine(ctx, center.x, center.y, stroke.sourcePoint.x, stroke.sourcePoint.y);
        drawSourceMarker(ctx, stroke.sourcePoint.x, stroke.sourcePoint.y, false);
      }
    });

    // Draw current stroke
    if (currentStroke.length > 0) {
      drawSmoothStrokeOutline(ctx, currentStroke, brushSize, avgScale, true);
      
      if (sourcePoint && (brushMode === 'clone' || brushMode === 'heal')) {
        const center = getStrokeCenter(currentStroke);
        drawConnectionLine(ctx, center.x, center.y, sourcePoint.x, sourcePoint.y);
      }
    }

    // Draw active source marker
    if (sourcePoint && (brushMode === 'clone' || brushMode === 'heal')) {
      drawSourceMarker(ctx, sourcePoint.x, sourcePoint.y, true);
    }

    // Draw brush cursor
    if (cursorPos && !isDrawing) {
      const screenPos = imageToScreen(cursorPos.x, cursorPos.y);
      if (screenPos) {
        const screenBrushSize = brushSize * avgScale;

        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, screenBrushSize / 2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const crossSize = 6;
        ctx.beginPath();
        ctx.moveTo(screenPos.x - crossSize, screenPos.y);
        ctx.lineTo(screenPos.x + crossSize, screenPos.y);
        ctx.moveTo(screenPos.x, screenPos.y - crossSize);
        ctx.lineTo(screenPos.x, screenPos.y + crossSize);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();

        if ((brushMode === 'clone' || brushMode === 'heal') && !sourcePoint) {
          ctx.fillStyle = 'rgba(255, 200, 100, 0.9)';
          ctx.font = 'bold 12px system-ui, sans-serif';
          ctx.fillText('Alt+Click to set source', screenPos.x + screenBrushSize / 2 + 12, screenPos.y + 4);
        }
      }
    }
  }, [canvasRef, image, currentStroke, cursorPos, sourcePoint, brushSize, brushMode, 
      imageToScreen, isDrawing, completedStrokes, drawSmoothStrokeOutline, drawSourceMarker, 
      drawConnectionLine, getStrokeCenter]);

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

    const resizeObserver = new ResizeObserver(() => requestAnimationFrame(updateOverlay));
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
      style={{ cursor: 'none', position: 'fixed', pointerEvents: 'auto' }}
    />
  );
};
