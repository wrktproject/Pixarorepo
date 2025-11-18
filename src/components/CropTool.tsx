/**
 * CropTool Component
 * Provides draggable crop overlay with real-time preview
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { setCropPreview } from '../store/adjustmentsSlice';
import type { CropBounds } from '../types/adjustments';
import './CropTool.css';

type DragHandle =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'
  | 'move'
  | null;

export const CropTool: React.FC = () => {
  const dispatch = useDispatch();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Redux state
  const image = useSelector((state: RootState) => state.image.current);
  const cropBounds = useSelector((state: RootState) => state.adjustments.crop);
  const activeTool = useSelector((state: RootState) => state.ui.activeTool);
  const showGrid = useSelector((state: RootState) => state.ui.showGrid);

  // Local state
  const [isDragging, setIsDragging] = useState(false);
  const [dragHandle, setDragHandle] = useState<DragHandle>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragStartBounds, setDragStartBounds] = useState<CropBounds | null>(null);
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const [canvasRect, setCanvasRect] = useState<DOMRect | null>(null);
  // Local preview bounds for smooth dragging (only sync to Redux on mouse up)
  const [previewBounds, setPreviewBounds] = useState<CropBounds | null>(null);

  // Find the canvas element
  useEffect(() => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      setCanvasElement(canvas);
    }
  }, []);

  // Update canvas rect when zoom/pan changes or window resizes
  useEffect(() => {
    if (!canvasElement) return;

    const updateCanvasRect = () => {
      const rect = canvasElement.getBoundingClientRect();
      setCanvasRect(rect);
    };

    updateCanvasRect();
    window.addEventListener('resize', updateCanvasRect);
    window.addEventListener('scroll', updateCanvasRect, true);
    
    // Use ResizeObserver to track canvas size changes (more efficient than RAF)
    const resizeObserver = new ResizeObserver(updateCanvasRect);
    resizeObserver.observe(canvasElement);
    
    // Also observe parent container changes
    const parent = canvasElement.parentElement;
    if (parent) {
      resizeObserver.observe(parent);
    }

    return () => {
      window.removeEventListener('resize', updateCanvasRect);
      window.removeEventListener('scroll', updateCanvasRect, true);
      resizeObserver.disconnect();
    };
  }, [canvasElement]);

  // Initialize crop bounds when tool is activated
  // ALWAYS reset to full image, regardless of any rotation
  useEffect(() => {
    if (activeTool === 'crop' && image) {
      // Reset to full image bounds - user can manually adjust
      // Use preview so it doesn't add to history yet
      const initialBounds: CropBounds = {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
        aspectRatio: null, // Free-form by default
      };
      dispatch(setCropPreview(initialBounds));
    }
  }, [activeTool, image, dispatch]);

  // Convert image coordinates to screen coordinates
  const imageToScreen = useCallback((x: number, y: number): { x: number; y: number } => {
    if (!canvasRect || !image) return { x: 0, y: 0 };
    
    // The canvas is sized to fit the image while maintaining aspect ratio
    // Crop works in original image space - rotation is handled by shader
    const effectiveWidth = image.width;
    const effectiveHeight = image.height;
    
    const imageAspect = effectiveWidth / effectiveHeight;
    const canvasAspect = canvasRect.width / canvasRect.height;
    
    let displayWidth, displayHeight, offsetX, offsetY;
    
    if (imageAspect > canvasAspect) {
      // Image is wider - letterboxed vertically
      displayWidth = canvasRect.width;
      displayHeight = canvasRect.width / imageAspect;
      offsetX = 0;
      offsetY = (canvasRect.height - displayHeight) / 2;
    } else {
      // Image is taller - pillarboxed horizontally
      displayHeight = canvasRect.height;
      displayWidth = canvasRect.height * imageAspect;
      offsetX = (canvasRect.width - displayWidth) / 2;
      offsetY = 0;
    }
    
    // Scale based on original image dimensions
    const scaleX = displayWidth / effectiveWidth;
    const scaleY = displayHeight / effectiveHeight;
    
    // Convert from image coords to screen coords
    return {
      x: x * scaleX + offsetX,
      y: y * scaleY + offsetY,
    };
  }, [canvasRect, image]);

  const handleMouseDown = useCallback((e: React.MouseEvent, handle: DragHandle) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!cropBounds || !canvasRect) return;

    setIsDragging(true);
    setDragHandle(handle);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragStartBounds({ ...cropBounds });
  }, [cropBounds, canvasRect]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragStartBounds || !canvasRect || !image) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    // Convert screen delta to image delta
    // Crop works in original image space - rotation is handled by shader
    const effectiveWidth = image.width;
    const effectiveHeight = image.height;
    
    const imageAspect = effectiveWidth / effectiveHeight;
    const canvasAspect = canvasRect.width / canvasRect.height;
    
    let displayWidth, displayHeight;
    
    if (imageAspect > canvasAspect) {
      displayWidth = canvasRect.width;
      displayHeight = canvasRect.width / imageAspect;
    } else {
      displayHeight = canvasRect.height;
      displayWidth = canvasRect.height * imageAspect;
    }
    
    const scaleX = displayWidth / effectiveWidth;
    const scaleY = displayHeight / effectiveHeight;
    
    const imageDeltaX = deltaX / scaleX;
    const imageDeltaY = deltaY / scaleY;

    let newBounds = { ...dragStartBounds };

    if (dragHandle === 'move') {
      // Move the entire crop area
      newBounds.x = Math.max(0, Math.min(image.width - dragStartBounds.width, dragStartBounds.x + imageDeltaX));
      newBounds.y = Math.max(0, Math.min(image.height - dragStartBounds.height, dragStartBounds.y + imageDeltaY));
    } else if (dragHandle) {
      // Resize crop area
      const minSize = 50;
      
      // Determine if this is a corner handle (maintains aspect ratio) or edge handle (free resize)
      const isCornerHandle = dragHandle.length === 2; // 'nw', 'ne', 'sw', 'se'
      // Edge handles (single char: 'n', 's', 'e', 'w') resize freely without aspect ratio constraint
      
      // Handle horizontal resizing
      if (dragHandle.includes('w')) {
        const newX = Math.max(0, dragStartBounds.x + imageDeltaX);
        const newWidth = dragStartBounds.width + (dragStartBounds.x - newX);
        if (newWidth >= minSize) {
          newBounds.x = newX;
          newBounds.width = newWidth;
        }
      } else if (dragHandle.includes('e')) {
        newBounds.width = Math.min(image.width - dragStartBounds.x, Math.max(minSize, dragStartBounds.width + imageDeltaX));
      }

      // Handle vertical resizing
      if (dragHandle.includes('n')) {
        const newY = Math.max(0, dragStartBounds.y + imageDeltaY);
        const newHeight = dragStartBounds.height + (dragStartBounds.y - newY);
        if (newHeight >= minSize) {
          newBounds.y = newY;
          newBounds.height = newHeight;
        }
      } else if (dragHandle.includes('s')) {
        newBounds.height = Math.min(image.height - dragStartBounds.y, Math.max(minSize, dragStartBounds.height + imageDeltaY));
      }

      // Maintain aspect ratio ONLY for corner handles (if aspect ratio is set)
      if (dragStartBounds.aspectRatio && isCornerHandle) {
        const currentRatio = newBounds.width / newBounds.height;
        if (Math.abs(currentRatio - dragStartBounds.aspectRatio) > 0.01) {
          // For corner handles, adjust both dimensions to maintain aspect ratio
          if (dragHandle.includes('e') || dragHandle.includes('w')) {
            newBounds.height = newBounds.width / dragStartBounds.aspectRatio;
            // Adjust y position for top corners
            if (dragHandle.includes('n')) {
              newBounds.y = dragStartBounds.y + dragStartBounds.height - newBounds.height;
            }
          } else {
            newBounds.width = newBounds.height * dragStartBounds.aspectRatio;
            // Adjust x position for left corners
            if (dragHandle.includes('w')) {
              newBounds.x = dragStartBounds.x + dragStartBounds.width - newBounds.width;
            }
          }
        }
      }
      // Edge handles ignore aspect ratio - they resize freely
    }

    // Clamp bounds to image
    newBounds.x = Math.max(0, Math.min(image.width - newBounds.width, newBounds.x));
    newBounds.y = Math.max(0, Math.min(image.height - newBounds.height, newBounds.y));
    newBounds.width = Math.min(image.width - newBounds.x, newBounds.width);
    newBounds.height = Math.min(image.height - newBounds.y, newBounds.height);

    // Update local preview instantly for smooth dragging (no Redux dispatch until mouse up)
    setPreviewBounds(newBounds);
  }, [isDragging, dragHandle, dragStart, dragStartBounds, canvasRect, image]);

  const handleMouseUp = useCallback(() => {
    // Commit the preview bounds to Redux when drag ends
    if (previewBounds) {
      dispatch(setCropPreview(previewBounds));
    }
    setIsDragging(false);
    setDragHandle(null);
    setPreviewBounds(null);
  }, [previewBounds, dispatch]);

  // Add global mouse event listeners
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

  // Don't render if tool is not active or we don't have the necessary data
  if (activeTool !== 'crop' || !image || !canvasRect) {
    return null;
  }

  // Use preview bounds during dragging for instant feedback, otherwise use Redux bounds
  const displayBounds = previewBounds || cropBounds;
  
  if (!displayBounds) {
    return null;
  }

  // Calculate crop rectangle position and size in screen coordinates
  const topLeft = imageToScreen(displayBounds.x, displayBounds.y);
  const bottomRight = imageToScreen(displayBounds.x + displayBounds.width, displayBounds.y + displayBounds.height);
  const screenWidth = bottomRight.x - topLeft.x;
  const screenHeight = bottomRight.y - topLeft.y;

  return (
    <div 
      ref={overlayRef}
      className="crop-tool__overlay-container"
      style={{
        position: 'fixed',
        left: canvasRect.left,
        top: canvasRect.top,
        width: canvasRect.width,
        height: canvasRect.height,
        pointerEvents: 'none',
      }}
    >
      {/* Crop rectangle with darkened outside via box-shadow */}
      <div
        className="crop-tool__overlay"
        style={{
          left: topLeft.x,
          top: topLeft.y,
          width: screenWidth,
          height: screenHeight,
        }}
        onMouseDown={(e) => handleMouseDown(e, 'move')}
      >
        {/* Composition grid */}
        {showGrid && (
          <div className="crop-tool__grid">
            {/* Rule of thirds lines */}
            <div className="crop-tool__grid-line crop-tool__grid-line--v1" />
            <div className="crop-tool__grid-line crop-tool__grid-line--v2" />
            <div className="crop-tool__grid-line crop-tool__grid-line--h1" />
            <div className="crop-tool__grid-line crop-tool__grid-line--h2" />
          </div>
        )}

        {/* Resize handles */}
        <div className="crop-tool__handle crop-tool__handle--nw" onMouseDown={(e) => handleMouseDown(e, 'nw')} />
        <div className="crop-tool__handle crop-tool__handle--n" onMouseDown={(e) => handleMouseDown(e, 'n')} />
        <div className="crop-tool__handle crop-tool__handle--ne" onMouseDown={(e) => handleMouseDown(e, 'ne')} />
        <div className="crop-tool__handle crop-tool__handle--e" onMouseDown={(e) => handleMouseDown(e, 'e')} />
        <div className="crop-tool__handle crop-tool__handle--se" onMouseDown={(e) => handleMouseDown(e, 'se')} />
        <div className="crop-tool__handle crop-tool__handle--s" onMouseDown={(e) => handleMouseDown(e, 's')} />
        <div className="crop-tool__handle crop-tool__handle--sw" onMouseDown={(e) => handleMouseDown(e, 'sw')} />
        <div className="crop-tool__handle crop-tool__handle--w" onMouseDown={(e) => handleMouseDown(e, 'w')} />
      </div>
    </div>
  );
};
