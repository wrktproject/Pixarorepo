/**
 * Canvas Component
 * Main display area for image rendering with WebGL
 * Handles zoom, pan, and real-time adjustment preview
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { store, setZoom, setPan, resetView, setShowComparison, toggleHistogram, setRenderedImageData, setAllAdjustments, addToHistory } from '../store';
import { ShaderPipelineErrorHandler } from '../engine/shaderPipelineErrorHandler';
import type { RenderMode } from '../engine/shaderPipelineErrorHandler';
import { Histogram } from './Histogram';
import { CropTool } from './CropTool';
import { ErrorNotification } from './ErrorNotification';
import type { PixaroError } from '../types/errors';
import styles from './Canvas.module.css';

export interface CanvasProps {
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

export const Canvas: React.FC<CanvasProps> = ({ canvasRef: externalCanvasRef }) => {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = externalCanvasRef || internalCanvasRef;
  const containerRef = useRef<HTMLDivElement>(null);
  const errorHandlerRef = useRef<ShaderPipelineErrorHandler | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Redux state
  const dispatch = useDispatch();
  const image = useSelector((state: RootState) => state.image.current);
  const originalImage = useSelector((state: RootState) => state.image.original);
  const adjustments = useSelector((state: RootState) => state.adjustments);
  const zoom = useSelector((state: RootState) => state.ui.zoom);
  const pan = useSelector((state: RootState) => state.ui.pan);
  const showComparison = useSelector((state: RootState) => state.ui.showComparison);
  const showHistogram = useSelector((state: RootState) => state.ui.showHistogram);
  const activeTool = useSelector((state: RootState) => state.ui.activeTool);
  const enableToneMapping = useSelector((state: RootState) => state.ui.enableToneMapping);
  const qualityMode = useSelector((state: RootState) => state.ui.qualityMode);

  // Local state for interaction
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isDragOver, setIsDragOver] = useState(false); // For preset drag-and-drop
  const lastHistogramUpdate = useRef<number>(0);

  // Get rendered image data from Redux
  const renderedImageData = useSelector((state: RootState) => state.ui.renderedImageData);


  // Error handling state (Requirement 10.5)
  const [currentError, setCurrentError] = useState<PixaroError | null>(null);
  const [renderMode, setRenderMode] = useState<RenderMode>('webgl');

  /**
   * Initialize rendering pipeline with error handling
   * Requirement 10.1, 10.2, 10.3, 10.4, 10.5: Comprehensive error handling
   */
  useEffect(() => {
    if (!canvasRef.current) return;

    try {
      // Initialize shader pipeline with error handler
      // Requirement 10.1, 10.2, 10.3, 10.4, 10.5
      // WebGL is required for Lightroom-quality editing (no Canvas 2D fallback)
      errorHandlerRef.current = new ShaderPipelineErrorHandler(canvasRef.current, {
        enableCanvas2DFallback: false, // WebGL required for professional quality
        logErrors: true,
        onError: (error: PixaroError) => {
          // Requirement 10.5: Display user-friendly error messages
          setCurrentError(error);
          console.error('Rendering error:', error);
        },
        onFallback: (mode: RenderMode, reason: string) => {
          // Requirement 10.2, 10.4: Track fallback mode
          setRenderMode(mode);
          console.warn(`Fallback to ${mode}: ${reason}`);
        },
      });

      // Set initial render mode
      setRenderMode(errorHandlerRef.current.getCurrentMode());

      console.log('Rendering pipeline initialized with error handling');

    } catch (error) {
      console.error('Failed to initialize rendering pipeline:', error);
      setCurrentError(error as PixaroError);
    }

    return () => {
      // Cleanup
      if (errorHandlerRef.current) {
        errorHandlerRef.current.dispose();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
    };
  }, []);

  /**
   * Handle WebGL context loss and restoration
   */
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      console.warn('WebGL context lost - preventing default to allow restoration');
    };

    const handleContextRestored = () => {
      console.log('WebGL context restored - reinitializing pipeline');

      try {
        // Dispose old pipeline
        if (errorHandlerRef.current) {
          errorHandlerRef.current.dispose();
        }

        // Reinitialize pipeline
        errorHandlerRef.current = new ShaderPipelineErrorHandler(canvas, {
          enableCanvas2DFallback: false,
          logErrors: true,
          onError: (error: PixaroError) => {
            setCurrentError(error);
            console.error('Rendering error:', error);
          },
          onFallback: (mode: RenderMode, reason: string) => {
            setRenderMode(mode);
            console.warn(`Fallback to ${mode}: ${reason}`);
          },
        });

        // Reload image if we have one
        if (image) {
          const result = errorHandlerRef.current.loadImage(image.data);
          if (result.success) {
            console.log('Image reloaded after context restoration');
            // Trigger a re-render by updating state
            setRenderMode(errorHandlerRef.current.getCurrentMode());
          }
        }
      } catch (error) {
        console.error('Failed to restore WebGL context:', error);
        setCurrentError(error as PixaroError);
      }
    };

    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, [image]);

  /**
   * Load image into pipeline when image changes
   */
  useEffect(() => {
    if (!image || !errorHandlerRef.current) return;

    console.log('🔄 Canvas: Image effect triggered', {
      width: image.width,
      height: image.height,
      dataSize: image.data.data.length,
    });

    try {
      const result = errorHandlerRef.current.loadImage(image.data);
      
      if (!result.success && result.error) {
        setCurrentError(result.error);
      } else {
        console.log('📸 New image loaded into WebGL:', {
          width: image.width,
          height: image.height,
          aspect: (image.width / image.height).toFixed(3),
          crop: adjustments.crop,
          rotation: adjustments.rotation,
        });
        
        // Fit to screen on initial load
        handleFitToScreen();
        
        // Force immediate canvas resize with new image dimensions
        // This ensures the canvas is properly sized BEFORE rendering
        if (canvasRef.current && containerRef.current) {
          const container = containerRef.current;
          const canvas = canvasRef.current;
          const dpr = window.devicePixelRatio || 1;
          
          const containerWidth = container.clientWidth;
          const containerHeight = container.clientHeight;
          
          // IMPORTANT: Use the NEW image dimensions, ignoring adjustments during initial load
          // Adjustments will be applied in the next render cycle once everything is synced
          let effectiveWidth = image.width;
          let effectiveHeight = image.height;
          
          console.log('  Using full image dimensions for initial load:', effectiveWidth, 'x', effectiveHeight);
          
          const imageAspect = effectiveWidth / effectiveHeight;
          const containerAspect = containerWidth / containerHeight;

          let canvasDisplayWidth, canvasDisplayHeight;
          if (imageAspect > containerAspect) {
            canvasDisplayWidth = containerWidth;
            canvasDisplayHeight = containerWidth / imageAspect;
          } else {
            canvasDisplayHeight = containerHeight;
            canvasDisplayWidth = containerHeight * imageAspect;
          }

          console.log('  Canvas sized:', {
            display: `${canvasDisplayWidth.toFixed(0)}x${canvasDisplayHeight.toFixed(0)}`,
            buffer: `${Math.floor(canvasDisplayWidth * dpr)}x${Math.floor(canvasDisplayHeight * dpr)}`,
          });

          canvas.style.width = `${canvasDisplayWidth}px`;
          canvas.style.height = `${canvasDisplayHeight}px`;

          const newWidth = Math.floor(canvasDisplayWidth * dpr);
          const newHeight = Math.floor(canvasDisplayHeight * dpr);
          
          canvas.width = newWidth;
          canvas.height = newHeight;
        }
      }
    } catch (error) {
      console.error('Failed to load image:', error);
      setCurrentError(error as PixaroError);
    }
    // Depend on image object and its dimensions to ensure re-load when switching photos
    // Note: render() is called separately by the render effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, image?.width, image?.height]);

  /**
   * Render loop - applies adjustments and renders to canvas
   * Requirement 13.1, 13.2: Uses RenderScheduler for batching and requestAnimationFrame
   */
  const render = useCallback(() => {
    if (!errorHandlerRef.current || !canvasRef.current) return;

    try {
      // Determine which image to show (original or edited)
      const imageToShow = showComparison ? originalImage : image;

      if (!imageToShow) return;

      console.log('🎨 Rendering image:', {
        dimensions: `${imageToShow.width}x${imageToShow.height}`,
        dataSize: imageToShow.data.data.length,
        showComparison,
      });

      // When crop tool is active, don't apply crop to the render (only show overlay)
      // But DO apply straighten so user can see the rotation while cropping
      let adjustmentsToRender = activeTool === 'crop' 
        ? { ...adjustments, crop: null }
        : adjustments;
      
      // Validate crop before rendering - prevent mismatched crop from previous photo
      if (adjustmentsToRender.crop && imageToShow) {
        const cropValid = (
          adjustmentsToRender.crop.width <= imageToShow.width &&
          adjustmentsToRender.crop.height <= imageToShow.height &&
          adjustmentsToRender.crop.x >= 0 &&
          adjustmentsToRender.crop.y >= 0 &&
          adjustmentsToRender.crop.x + adjustmentsToRender.crop.width <= imageToShow.width &&
          adjustmentsToRender.crop.y + adjustmentsToRender.crop.height <= imageToShow.height
        );
        
        if (!cropValid) {
          console.warn('⚠️ Invalid crop in render, removing it:', {
            crop: adjustmentsToRender.crop,
            image: { width: imageToShow.width, height: imageToShow.height },
          });
          adjustmentsToRender = { ...adjustmentsToRender, crop: null };
        }
      }

      // If showing comparison, we need to reload the original
      if (showComparison && originalImage) {
        // For comparison mode, render original without adjustments
        // We'll create a temporary adjustment state with all values at default
        const defaultAdjustments = {
          ...adjustmentsToRender,
          exposure: 0,
          contrast: 0,
          highlights: 0,
          shadows: 0,
          whites: 0,
          blacks: 0,
          temperature: 6500,
          tint: 0,
          vibrance: 0,
          saturation: 0,
          sharpening: 0,
          clarity: 0,
          noiseReductionLuma: 0,
          noiseReductionColor: 0,
          vignette: { amount: 0, midpoint: 50, feather: 50 },
          grain: { amount: 0, size: 'medium' as const, roughness: 50 },
        };
        // RenderScheduler will batch and optimize this render call
        const result = errorHandlerRef.current.render(originalImage.data, defaultAdjustments);
        
        if (!result.success && result.error) {
          setCurrentError(result.error);
        }
      } else {
        // Render with current adjustments (excluding crop if tool is active)
        // RenderScheduler will batch and optimize this render call
        const result = errorHandlerRef.current.render(imageToShow.data, adjustmentsToRender);
        
        if (!result.success && result.error) {
          setCurrentError(result.error);
        }
      }

      // Extract rendered canvas data for histogram (only when histogram is visible)
      // Throttle to max 2 updates per second for performance
      if (showHistogram) {
        const now = Date.now();
        if (now - lastHistogramUpdate.current > 500) {
          lastHistogramUpdate.current = now;
          requestAnimationFrame(() => {
            if (canvasRef.current && errorHandlerRef.current) {
              const canvas = canvasRef.current;
              const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
              if (gl) {
                try {
                  // Use a downsampled version for histogram (256x256 max) for performance
                  const maxSize = 256;
                  const scale = Math.min(1, maxSize / Math.max(canvas.width, canvas.height));
                  const sampledWidth = Math.floor(canvas.width * scale);
                  const sampledHeight = Math.floor(canvas.height * scale);
                  
                  // Read pixels at reduced resolution
                  const pixels = new Uint8ClampedArray(sampledWidth * sampledHeight * 4);
                  
                  // Read directly without flipping for better performance
                  // Histogram doesn't care about orientation
                  gl.readPixels(0, 0, sampledWidth, sampledHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
                  
                  const imageData = new ImageData(pixels, sampledWidth, sampledHeight);
                  dispatch(setRenderedImageData(imageData));
                } catch (err) {
                  console.warn('Failed to read WebGL canvas for histogram:', err);
                }
              }
            }
          });
        }
      }
    } catch (error) {
      console.error('Render error:', error);
      setCurrentError(error as PixaroError);
    }
  }, [adjustments, image, originalImage, showComparison, activeTool, showHistogram]);

  /**
   * Trigger render when adjustments or comparison mode changes
   * Requirement 13.2: RenderScheduler automatically batches multiple changes
   */
  useEffect(() => {
    if (!image) return;

    console.log('📸 Canvas render effect triggered:', {
      imageDimensions: `${image.width}x${image.height}`,
      exposure: adjustments.exposure,
      contrast: adjustments.contrast,
      saturation: adjustments.saturation,
      temperature: adjustments.temperature,
      showComparison,
      crop: adjustments.crop,
    });

    // RenderScheduler handles requestAnimationFrame and batching internally
    // Multiple rapid calls to render() will be batched into a single frame
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjustments, showComparison, image]);


  /**
   * Update pipeline settings when UI settings change
   * Task 18: Update UI to reflect new capabilities
   */
  useEffect(() => {
    if (!errorHandlerRef.current) return;

    // Update tone mapping setting
    errorHandlerRef.current.setToneMappingEnabled(enableToneMapping);

    // Update quality mode
    errorHandlerRef.current.setQualityMode(qualityMode);

    // Re-render with new settings
    if (image) {
      render();
    }
  }, [enableToneMapping, qualityMode, image, render]);

  /**
   * Handle canvas resize
   * IMPORTANT: Account for device pixel ratio for high-quality display on Retina/high-DPI screens
   */
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current || !image) return;

      const container = containerRef.current;
      const canvas = canvasRef.current;
      const dpr = window.devicePixelRatio || 1; // Account for high-DPI displays (Retina, 4K, etc.)

      // Calculate size to fit image in container while maintaining aspect ratio
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      // Calculate effective dimensions for CSS display
      // This determines the aspect ratio of the canvas display
      let effectiveWidth = image.width;
      let effectiveHeight = image.height;
      
      // Apply crop dimensions if crop exists and crop tool is NOT active and NOT showing comparison
      if (adjustments.crop && activeTool !== 'crop' && !showComparison) {
        // Validate crop belongs to this image before using it
        const cropValid = (
          adjustments.crop.width <= image.width &&
          adjustments.crop.height <= image.height &&
          adjustments.crop.x >= 0 &&
          adjustments.crop.y >= 0 &&
          adjustments.crop.x + adjustments.crop.width <= image.width &&
          adjustments.crop.y + adjustments.crop.height <= image.height
        );
        
        if (cropValid) {
          effectiveWidth = adjustments.crop.width;
          effectiveHeight = adjustments.crop.height;
        } else {
          // Crop is invalid for this image (likely from a previous photo)
          // Use full image dimensions instead
          console.warn('⚠️ Invalid crop in handleResize, using full image dimensions:', {
            crop: adjustments.crop,
            image: { width: image.width, height: image.height },
          });
        }
      }
      
      // NOTE: Straighten rotation does NOT expand the canvas
      // The rotation happens in shader space, showing the original image dimensions
      // Black edges from rotation are visible until user crops them out
      // This mimics Adobe Lightroom's behavior
      
      // Account for 90° rotation: swap dimensions
      const rotation90 = adjustments.rotation || 0;
      if (rotation90 === 90 || rotation90 === 270) {
        [effectiveWidth, effectiveHeight] = [effectiveHeight, effectiveWidth];
      }
      
      const imageAspect = effectiveWidth / effectiveHeight;
      const containerAspect = containerWidth / containerHeight;

      let canvasDisplayWidth, canvasDisplayHeight;
      if (imageAspect > containerAspect) {
        // Image is wider than container
        canvasDisplayWidth = containerWidth;
        canvasDisplayHeight = containerWidth / imageAspect;
      } else {
        // Image is taller than container
        canvasDisplayHeight = containerHeight;
        canvasDisplayWidth = containerHeight * imageAspect;
      }

      // Set CSS display size (what user sees)
      canvas.style.width = `${canvasDisplayWidth}px`;
      canvas.style.height = `${canvasDisplayHeight}px`;

      // Set actual buffer size (scaled by device pixel ratio for sharpness)
      // Buffer should match display size (not original image) to show the whole image
      const newWidth = Math.floor(canvasDisplayWidth * dpr);
      const newHeight = Math.floor(canvasDisplayHeight * dpr);
      
      if (canvas.width !== newWidth || canvas.height !== newHeight) {
        canvas.width = newWidth;
        canvas.height = newHeight;
        // Re-render after resize
        render();
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [render, image, image?.width, image?.height, adjustments.rotation, adjustments.crop, adjustments.straighten, activeTool, showComparison]);

  /**
   * Handle mouse wheel for zoom
   */
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();

      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = zoom * delta;

      dispatch(setZoom(newZoom));
    },
    [zoom, dispatch]
  );

  /**
   * Handle mouse down for pan start
   */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return; // Only left click

      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    },
    [pan]
  );

  /**
   * Handle mouse move for panning
   */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isPanning) return;

      const newPan = {
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      };

      dispatch(setPan(newPan));
    },
    [isPanning, panStart, dispatch]
  );

  /**
   * Handle mouse up to end panning
   */
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  /**
   * Handle mouse leave to end panning
   */
  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
  }, []);

  /**
   * Fit image to screen
   */
  const handleFitToScreen = useCallback(() => {
    if (!canvasRef.current || !containerRef.current || !errorHandlerRef.current) return;

    // Set zoom to 1.0 (100% actual size)
    dispatch(setZoom(1.0));
    dispatch(setPan({ x: 0, y: 0 }));
  }, [dispatch]);

  /**
   * Reset view to 100% zoom
   */
  const handleResetView = useCallback(() => {
    dispatch(resetView());
  }, [dispatch]);

  /**
   * Show "before" image while button is held down
   */
  const handleComparisonMouseDown = useCallback(() => {
    dispatch(setShowComparison(true));
  }, [dispatch]);

  const handleComparisonMouseUp = useCallback(() => {
    dispatch(setShowComparison(false));
  }, [dispatch]);

  /**
   * Toggle histogram display
   */
  const handleToggleHistogram = useCallback(() => {
    dispatch(toggleHistogram());
  }, [dispatch]);


  /**
   * Handle preset drag-and-drop onto canvas
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const presetId = e.dataTransfer.getData('text/plain');
    if (presetId) {
      // Get preset from Redux state
      const allPresets = [
        ...(store.getState() as RootState).presets.builtIn,
        ...(store.getState() as RootState).presets.custom,
      ];
      const preset = allPresets.find(p => p.id === presetId);
      
      if (preset) {
        // Add current state to history before applying preset
        dispatch(addToHistory(adjustments));
        // Apply the preset
        dispatch(setAllAdjustments(preset.adjustments));
      }
    }
  }, [dispatch, adjustments]);

  // Keyboard shortcuts are now handled centrally by useKeyboardShortcuts hook

  return (
    <div 
      ref={containerRef} 
      className={`${styles.container} ${isDragOver ? styles.dragOver : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        role="img"
        aria-label={image ? "Photo being edited" : "No photo loaded"}
        style={{
          cursor: isPanning ? 'grabbing' : 'grab',
          transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
        }}
      />

      {/* View controls */}
      <div className={styles.controls} role="toolbar" aria-label="View controls">
        <button
          className={styles.controlButton}
          onClick={handleFitToScreen}
          title="Fit to screen"
          aria-label="Fit image to screen"
        >
          Fit
        </button>
        <button
          className={styles.controlButton}
          onClick={handleResetView}
          title="Reset view (100%)"
          aria-label="Reset view to 100%"
        >
          100%
        </button>
        <span className={styles.zoomDisplay} aria-label={`Current zoom: ${Math.round(zoom * 100)}%`}>
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* Comparison controls */}
      {image && (
        <div className={styles.comparisonControls} role="toolbar" aria-label="Comparison controls">
          <button
            className={`${styles.controlButtonSmall} ${showComparison ? styles.active : ''}`}
            onMouseDown={handleComparisonMouseDown}
            onMouseUp={handleComparisonMouseUp}
            onMouseLeave={handleComparisonMouseUp}
            title="Hold to show before (Spacebar)"
            aria-label="Hold to show original image"
            aria-pressed={showComparison}
          >
            Before
          </button>
          <button
            className={`${styles.controlButtonSmall} ${showHistogram ? styles.active : ''}`}
            onClick={handleToggleHistogram}
            title="Toggle histogram"
            aria-label="Toggle histogram display"
            aria-pressed={showHistogram}
          >
            Histogram
          </button>
        </div>
      )}

      {/* Histogram display */}
      {image && showHistogram && (
        <div className={styles.histogramContainer} role="region" aria-label="Image histogram">
          <Histogram imageData={renderedImageData} width={200} height={85} />
        </div>
      )}

      {/* Crop tool overlay */}
      {activeTool === 'crop' && <CropTool />}

      {!image && (
        <div className={styles.placeholder}>
          <p>No image loaded</p>
          <p className={styles.placeholderHint}>Upload an image to start editing</p>
        </div>
      )}

      {/* Error Notification - Requirement 10.5 */}
      <ErrorNotification
        error={currentError}
        renderMode={renderMode}
        onDismiss={() => setCurrentError(null)}
        autoHideDuration={5000}
      />
    </div>
  );
};
