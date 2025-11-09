/**
 * Canvas Component
 * Main display area for image rendering with WebGL
 * Handles zoom, pan, and real-time adjustment preview
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { setZoom, setPan, resetView, toggleComparison, toggleHistogram } from '../store';
import { ShaderPipelineErrorHandler } from '../engine/shaderPipelineErrorHandler';
import type { RenderMode } from '../engine/shaderPipelineErrorHandler';
import { Histogram } from './Histogram';
import { CropTool } from './CropTool';
import { PerformanceIndicator } from './PerformanceIndicator';
import { ErrorNotification } from './ErrorNotification';
import type { PerformanceStats } from '../engine/renderScheduler';
import type { PixaroError } from '../types/errors';
import styles from './Canvas.module.css';

export const Canvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
  const [splitPosition] = useState(50); // For split-view mode (percentage) - TODO: implement drag to adjust
  const [isSplitView, setIsSplitView] = useState(false);

  // Performance monitoring state (Requirement 13.4)
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats | null>(null);
  const [showPerformanceDetails, setShowPerformanceDetails] = useState(false);
  const performanceUpdateIntervalRef = useRef<number | null>(null);

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
      if (performanceUpdateIntervalRef.current) {
        clearInterval(performanceUpdateIntervalRef.current);
      }
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
            render();
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
  }, [image, render]);

  /**
   * Load image into pipeline when image changes
   */
  useEffect(() => {
    if (!image || !errorHandlerRef.current) return;

    try {
      const result = errorHandlerRef.current.loadImage(image.data);
      
      if (!result.success && result.error) {
        setCurrentError(result.error);
      } else {
        console.log('Image loaded into pipeline');
        // Fit to screen on initial load
        handleFitToScreen();
      }
    } catch (error) {
      console.error('Failed to load image:', error);
      setCurrentError(error as PixaroError);
    }
  }, [image]);

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

      // If showing comparison, we need to reload the original
      if (showComparison && originalImage) {
        // For comparison mode, render original without adjustments
        // We'll create a temporary adjustment state with all values at default
        const defaultAdjustments = {
          ...adjustments,
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
          grain: { amount: 0, size: 'medium' as const },
        };
        // RenderScheduler will batch and optimize this render call
        const result = errorHandlerRef.current.render(originalImage.data, defaultAdjustments);
        
        if (!result.success && result.error) {
          setCurrentError(result.error);
        }
      } else {
        // Render with current adjustments
        // RenderScheduler will batch and optimize this render call
        const result = errorHandlerRef.current.render(imageToShow.data, adjustments);
        
        if (!result.success && result.error) {
          setCurrentError(result.error);
        }
      }
    } catch (error) {
      console.error('Render error:', error);
      setCurrentError(error as PixaroError);
    }
  }, [adjustments, image, originalImage, showComparison]);

  /**
   * Trigger render when adjustments or comparison mode changes
   * Requirement 13.2: RenderScheduler automatically batches multiple changes
   */
  useEffect(() => {
    if (!image) return;

    // RenderScheduler handles requestAnimationFrame and batching internally
    // Multiple rapid calls to render() will be batched into a single frame
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjustments, showComparison, image]);

  /**
   * Update performance stats periodically
   * Requirement 13.4: Performance indicator for low FPS
   */
  useEffect(() => {
    if (!errorHandlerRef.current) return;

    // Update performance stats every 500ms
    performanceUpdateIntervalRef.current = window.setInterval(() => {
      if (errorHandlerRef.current && errorHandlerRef.current.isWebGLAvailable()) {
        const metrics = errorHandlerRef.current.getPerformanceMetrics();
        if (metrics) {
          const fps = errorHandlerRef.current.getFPS();
          // Convert to PerformanceStats format
          const stats: PerformanceStats = {
            currentFPS: fps,
            averageFPS: fps, // Use current FPS as average for now
            lastFrameTime: metrics.lastFrameTime,
            averageFrameTime: metrics.averageFrameTime,
            droppedFrames: 0, // Not tracked in legacy metrics
            totalFrames: metrics.frameCount,
            isLowPerformance: errorHandlerRef.current.isLowPerformance(),
          };
          setPerformanceStats(stats);
        }
      }
    }, 500);

    return () => {
      if (performanceUpdateIntervalRef.current) {
        clearInterval(performanceUpdateIntervalRef.current);
      }
    };
  }, []);

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
   */
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current || !image) return;

      const container = containerRef.current;
      const canvas = canvasRef.current;

      // Calculate size to fit image in container while maintaining aspect ratio
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const imageAspect = image.width / image.height;
      const containerAspect = containerWidth / containerHeight;

      let canvasWidth, canvasHeight;
      if (imageAspect > containerAspect) {
        // Image is wider than container
        canvasWidth = containerWidth;
        canvasHeight = containerWidth / imageAspect;
      } else {
        // Image is taller than container
        canvasHeight = containerHeight;
        canvasWidth = containerHeight * imageAspect;
      }

      // Only resize if dimensions actually changed (avoid unnecessary re-renders)
      const newWidth = Math.floor(canvasWidth);
      const newHeight = Math.floor(canvasHeight);
      
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
  }, [render, image]);

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

    const container = containerRef.current;
    const { width: imageWidth, height: imageHeight } =
      errorHandlerRef.current.getPreviewDimensions();

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Calculate zoom to fit
    const zoomX = containerWidth / imageWidth;
    const zoomY = containerHeight / imageHeight;
    const fitZoom = Math.min(zoomX, zoomY) * 0.95; // 95% to add some padding

    dispatch(setZoom(fitZoom));
    dispatch(setPan({ x: 0, y: 0 }));
  }, [dispatch]);

  /**
   * Reset view to 100% zoom
   */
  const handleResetView = useCallback(() => {
    dispatch(resetView());
  }, [dispatch]);

  /**
   * Toggle comparison mode
   */
  const handleToggleComparison = useCallback(() => {
    dispatch(toggleComparison());
  }, [dispatch]);

  /**
   * Toggle split-view mode
   */
  const handleToggleSplitView = useCallback(() => {
    setIsSplitView((prev) => !prev);
  }, []);

  /**
   * Toggle histogram display
   */
  const handleToggleHistogram = useCallback(() => {
    dispatch(toggleHistogram());
  }, [dispatch]);

  /**
   * Toggle performance details display
   * Requirement 13.4: Show detailed performance stats
   */
  const handleTogglePerformanceDetails = useCallback(() => {
    setShowPerformanceDetails((prev) => !prev);
  }, []);

  // Keyboard shortcuts are now handled centrally by useKeyboardShortcuts hook

  return (
    <div ref={containerRef} className={styles.container}>
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
          clipPath: isSplitView ? `inset(0 ${100 - splitPosition}% 0 0)` : undefined,
        }}
      />

      {/* Split view divider */}
      {isSplitView && (
        <div
          className={styles.splitDivider}
          style={{ left: `${splitPosition}%` }}
        >
          <div className={styles.splitHandle} />
        </div>
      )}

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
            className={`${styles.controlButton} ${showComparison ? styles.active : ''}`}
            onClick={handleToggleComparison}
            title="Toggle before/after (Spacebar)"
            aria-label="Toggle before and after comparison"
            aria-pressed={showComparison}
          >
            {showComparison ? 'Before' : 'After'}
          </button>
          <button
            className={`${styles.controlButton} ${isSplitView ? styles.active : ''}`}
            onClick={handleToggleSplitView}
            title="Toggle split view"
            aria-label="Toggle split view mode"
            aria-pressed={isSplitView}
          >
            Split
          </button>
          <button
            className={`${styles.controlButton} ${showHistogram ? styles.active : ''}`}
            onClick={handleToggleHistogram}
            title="Toggle histogram"
            aria-label="Toggle histogram display"
            aria-pressed={showHistogram}
          >
            Histogram
          </button>
          <button
            className={`${styles.controlButton} ${showPerformanceDetails ? styles.active : ''}`}
            onClick={handleTogglePerformanceDetails}
            title="Toggle performance stats"
            aria-label="Toggle performance statistics display"
            aria-pressed={showPerformanceDetails}
          >
            FPS
          </button>
        </div>
      )}

      {/* Performance Indicator - Requirement 13.4 */}
      {image && (
        <PerformanceIndicator
          stats={performanceStats}
          showDetails={showPerformanceDetails}
          position="top-right"
        />
      )}

      {/* Histogram display */}
      {image && showHistogram && (
        <div className={styles.histogramContainer} role="region" aria-label="Image histogram">
          <Histogram imageData={image.data} width={256} height={100} />
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
