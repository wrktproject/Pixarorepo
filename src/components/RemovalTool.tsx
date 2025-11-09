/**
 * Removal Tool Component
 * Brush-based selection tool for AI-powered object removal
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { setBrushSize } from '../store/uiSlice';
import type { RemovalMask } from '../types/adjustments';
import './RemovalTool.css';

interface RemovalToolProps {
  imageData: ImageData | null;
  onMaskComplete: (mask: RemovalMask) => void;
  isProcessing: boolean;
}

interface BrushStroke {
  x: number;
  y: number;
}

export const RemovalTool: React.FC<RemovalToolProps> = ({
  imageData,
  onMaskComplete,
  isProcessing,
}) => {
  const dispatch = useDispatch();
  const brushSize = useSelector((state: RootState) => state.ui.brushSize);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<BrushStroke[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<BrushStroke[]>([]);
  const [hasMask, setHasMask] = useState(false);

  // Initialize canvases
  useEffect(() => {
    if (!imageData || !canvasRef.current || !maskCanvasRef.current) return;

    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;

    canvas.width = imageData.width;
    canvas.height = imageData.height;
    maskCanvas.width = imageData.width;
    maskCanvas.height = imageData.height;

    // Draw image on display canvas
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.putImageData(imageData, 0, 0);
    }

    // Clear mask canvas
    const maskCtx = maskCanvas.getContext('2d');
    if (maskCtx) {
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    }
  }, [imageData]);

  // Redraw all strokes
  const redrawStrokes = useCallback(() => {
    if (!canvasRef.current || !maskCanvasRef.current || !imageData) return;

    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');

    if (!ctx || !maskCtx) return;

    // Clear and redraw image
    ctx.putImageData(imageData, 0, 0);

    // Clear mask
    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);

    // Draw all strokes
    const allStrokes = [...strokes, ...(currentStroke.length > 0 ? [currentStroke] : [])];
    
    allStrokes.forEach((stroke) => {
      if (stroke.length === 0) return;

      // Draw on display canvas (semi-transparent red)
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      stroke.forEach((point) => {
        ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();

      // Draw on mask canvas (white on black)
      maskCtx.strokeStyle = 'white';
      maskCtx.lineWidth = brushSize;
      maskCtx.lineCap = 'round';
      maskCtx.lineJoin = 'round';

      maskCtx.beginPath();
      maskCtx.moveTo(stroke[0].x, stroke[0].y);
      stroke.forEach((point) => {
        maskCtx.lineTo(point.x, point.y);
      });
      maskCtx.stroke();
    });

    setHasMask(allStrokes.length > 0);
  }, [imageData, strokes, currentStroke, brushSize]);

  // Redraw when strokes or brush size changes
  useEffect(() => {
    redrawStrokes();
  }, [redrawStrokes]);

  const getCanvasCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement>
  ): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isProcessing) return;
    
    setIsDrawing(true);
    const coords = getCanvasCoordinates(e);
    setCurrentStroke([coords]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || isProcessing) return;

    const coords = getCanvasCoordinates(e);
    setCurrentStroke((prev) => [...prev, coords]);
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;

    setIsDrawing(false);
    if (currentStroke.length > 0) {
      setStrokes((prev) => [...prev, currentStroke]);
      setCurrentStroke([]);
    }
  };

  const handleMouseLeave = () => {
    if (isDrawing) {
      handleMouseUp();
    }
  };

  const handleClear = () => {
    setStrokes([]);
    setCurrentStroke([]);
    setHasMask(false);
    redrawStrokes();
  };

  const handleUndo = () => {
    if (strokes.length > 0) {
      setStrokes((prev) => prev.slice(0, -1));
    }
  };

  const handleApply = () => {
    if (!maskCanvasRef.current || !hasMask) return;

    const maskCanvas = maskCanvasRef.current;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return;

    // Get mask image data
    const maskImageData = maskCtx.getImageData(
      0,
      0,
      maskCanvas.width,
      maskCanvas.height
    );

    // Convert to grayscale mask (use alpha channel)
    const maskPixels = new Uint8Array(maskCanvas.width * maskCanvas.height);
    for (let i = 0; i < maskImageData.data.length; i += 4) {
      // Use red channel (all channels should be the same for grayscale)
      maskPixels[i / 4] = maskImageData.data[i];
    }

    // Calculate bounds
    let minX = maskCanvas.width;
    let minY = maskCanvas.height;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < maskCanvas.height; y++) {
      for (let x = 0; x < maskCanvas.width; x++) {
        const idx = y * maskCanvas.width + x;
        if (maskPixels[idx] > 0) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    // Add padding
    const padding = Math.ceil(brushSize / 2);
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(maskCanvas.width - 1, maxX + padding);
    maxY = Math.min(maskCanvas.height - 1, maxY + padding);

    const mask: RemovalMask = {
      pixels: maskPixels,
      bounds: {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      },
    };

    onMaskComplete(mask);
  };

  const handleBrushSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setBrushSize(Number(e.target.value)));
  };

  return (
    <div className="removal-tool">
      <div className="removal-tool-controls">
        <div className="brush-size-control">
          <label htmlFor="brush-size">Brush Size: {brushSize}px</label>
          <input
            id="brush-size"
            type="range"
            min="5"
            max="200"
            value={brushSize}
            onChange={handleBrushSizeChange}
            disabled={isProcessing}
          />
        </div>
        
        <div className="removal-tool-buttons">
          <button
            onClick={handleUndo}
            disabled={strokes.length === 0 || isProcessing}
            className="tool-button"
          >
            Undo Stroke
          </button>
          <button
            onClick={handleClear}
            disabled={!hasMask || isProcessing}
            className="tool-button"
          >
            Clear
          </button>
          <button
            onClick={handleApply}
            disabled={!hasMask || isProcessing}
            className="tool-button primary"
          >
            {isProcessing ? 'Processing...' : 'Apply Removal'}
          </button>
        </div>
      </div>

      <div className="removal-tool-canvas-container">
        <canvas
          ref={canvasRef}
          className="removal-tool-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />
        <canvas
          ref={maskCanvasRef}
          className="removal-tool-mask-canvas"
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
};
