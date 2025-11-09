/**
 * ExportDialog Component
 * Modal dialog for configuring export settings with error handling
 */

import React, { useState, useEffect } from 'react';
import type { ExportDialogProps, ExportSettings, ExportFormat } from '../types/components';
import { useExport } from '../utils/useExport';
import './ExportDialog.css';

export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  onExport,
  currentImage,
}) => {
  const [format, setFormat] = useState<ExportFormat>('jpeg');
  const [quality, setQuality] = useState<number>(90);
  const [width, setWidth] = useState<number>(0);
  const [height, setHeight] = useState<number>(0);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState<boolean>(true);
  const [includeMetadata, setIncludeMetadata] = useState<boolean>(true);

  // Use export hook for handling export process
  const { exportImage, isExporting, progress, error, clearError, cancelExport } = useExport();

  // Initialize dimensions from current image
  useEffect(() => {
    if (currentImage) {
      setWidth(currentImage.width);
      setHeight(currentImage.height);
    }
  }, [currentImage]);

  // Handle width change with aspect ratio lock
  const handleWidthChange = (newWidth: number) => {
    if (!currentImage) return;

    setWidth(newWidth);

    if (maintainAspectRatio) {
      const aspectRatio = currentImage.width / currentImage.height;
      setHeight(Math.round(newWidth / aspectRatio));
    }
  };

  // Handle height change with aspect ratio lock
  const handleHeightChange = (newHeight: number) => {
    if (!currentImage) return;

    setHeight(newHeight);

    if (maintainAspectRatio) {
      const aspectRatio = currentImage.width / currentImage.height;
      setWidth(Math.round(newHeight * aspectRatio));
    }
  };

  // Handle aspect ratio lock toggle
  const handleAspectRatioToggle = () => {
    setMaintainAspectRatio(!maintainAspectRatio);
  };

  // Handle export button click
  const handleExport = async () => {
    const settings: ExportSettings = {
      format,
      quality,
      width,
      height,
      maintainAspectRatio,
      includeMetadata,
    };

    try {
      await exportImage(settings);
      // Close dialog on successful export
      if (!error) {
        onClose();
      }
    } catch (err) {
      // Error is handled by the hook
      console.error('Export failed:', err);
    }
  };

  // Handle retry after error
  const handleRetry = () => {
    clearError();
    handleExport();
  };

  // Handle reduce resolution option
  const handleReduceResolution = () => {
    clearError();
    // Reduce to 50% of current dimensions
    setWidth(Math.floor(width * 0.5));
    setHeight(Math.floor(height * 0.5));
  };

  // Handle cancel during export
  const handleCancel = () => {
    if (isExporting) {
      cancelExport();
    }
    onClose();
  };

  // Reset to original dimensions
  const handleResetDimensions = () => {
    if (currentImage) {
      setWidth(currentImage.width);
      setHeight(currentImage.height);
    }
  };

  if (!isOpen || !currentImage) {
    return null;
  }

  return (
    <div 
      className="export-dialog-overlay" 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-dialog-title"
    >
      <div className="export-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="export-dialog-header">
          <h2 id="export-dialog-title">Export Image</h2>
          <button
            className="export-dialog-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        <div className="export-dialog-content">
          {/* Format Selection */}
          <div className="export-section">
            <label className="export-label" id="format-label">Format</label>
            <div className="export-format-buttons" role="group" aria-labelledby="format-label">
              <button
                className={`export-format-button ${format === 'jpeg' ? 'active' : ''}`}
                onClick={() => setFormat('jpeg')}
                aria-pressed={format === 'jpeg'}
                aria-label="Export as JPEG format"
              >
                JPEG
              </button>
              <button
                className={`export-format-button ${format === 'png' ? 'active' : ''}`}
                onClick={() => setFormat('png')}
                aria-pressed={format === 'png'}
                aria-label="Export as PNG format"
              >
                PNG
              </button>
              <button
                className={`export-format-button ${format === 'tiff' ? 'active' : ''}`}
                onClick={() => setFormat('tiff')}
                aria-pressed={format === 'tiff'}
                aria-label="Export as TIFF format"
              >
                TIFF
              </button>
            </div>
          </div>

          {/* Quality Slider (JPEG only) */}
          {format === 'jpeg' && (
            <div className="export-section">
              <label className="export-label" htmlFor="quality-slider">
                Quality: {quality}
              </label>
              <input
                id="quality-slider"
                type="range"
                min="1"
                max="100"
                step="1"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="export-slider"
                aria-label="JPEG quality"
                aria-valuemin={1}
                aria-valuemax={100}
                aria-valuenow={quality}
                aria-valuetext={`Quality ${quality}`}
              />
              <div className="export-quality-labels" aria-hidden="true">
                <span>Low</span>
                <span>High</span>
              </div>
            </div>
          )}

          {/* Resolution Settings */}
          <div className="export-section">
            <label className="export-label">Resolution</label>
            <div className="export-resolution">
              <div className="export-dimension-input">
                <label htmlFor="export-width">Width</label>
                <input
                  id="export-width"
                  type="number"
                  min="1"
                  max={currentImage.width}
                  value={width}
                  onChange={(e) => handleWidthChange(Number(e.target.value))}
                  className="export-input"
                />
                <span className="export-unit">px</span>
              </div>

              <button
                className={`export-aspect-lock ${maintainAspectRatio ? 'locked' : ''}`}
                onClick={handleAspectRatioToggle}
                aria-label={maintainAspectRatio ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                title={maintainAspectRatio ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
              >
                {maintainAspectRatio ? '🔒' : '🔓'}
              </button>

              <div className="export-dimension-input">
                <label htmlFor="export-height">Height</label>
                <input
                  id="export-height"
                  type="number"
                  min="1"
                  max={currentImage.height}
                  value={height}
                  onChange={(e) => handleHeightChange(Number(e.target.value))}
                  className="export-input"
                />
                <span className="export-unit">px</span>
              </div>
            </div>

            <button
              className="export-reset-button"
              onClick={handleResetDimensions}
            >
              Reset to Original ({currentImage.width} × {currentImage.height})
            </button>
          </div>

          {/* Metadata Preservation */}
          <div className="export-section">
            <label className="export-checkbox-label">
              <input
                type="checkbox"
                checked={includeMetadata}
                onChange={(e) => setIncludeMetadata(e.target.checked)}
                className="export-checkbox"
                aria-label="Preserve EXIF metadata in exported image"
              />
              <span>Preserve EXIF metadata</span>
            </label>
          </div>
        </div>

        {/* Progress Indicator */}
        {isExporting && progress && (
          <div className="export-progress" role="status" aria-live="polite">
            <div 
              className="export-progress-bar"
              role="progressbar"
              aria-valuenow={progress.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Export progress"
            >
              <div
                className="export-progress-fill"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
            <div className="export-progress-text">
              {progress.stage === 'processing' && 'Processing image...'}
              {progress.stage === 'encoding' && 'Encoding image...'}
              {progress.stage === 'complete' && 'Complete!'}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="export-error" role="alert" aria-live="assertive">
            <div className="export-error-message">
              <span className="export-error-icon" aria-hidden="true">⚠️</span>
              <span>{error}</span>
            </div>
            <div className="export-error-actions">
              <button className="export-error-button" onClick={handleRetry} aria-label="Retry export">
                Retry
              </button>
              {error.includes('memory') || error.includes('timeout') ? (
                <button
                  className="export-error-button"
                  onClick={handleReduceResolution}
                  aria-label="Reduce resolution and retry"
                >
                  Reduce Resolution
                </button>
              ) : null}
            </div>
          </div>
        )}

        <div className="export-dialog-footer">
          <button
            className="export-cancel-button"
            onClick={handleCancel}
            disabled={isExporting}
          >
            {isExporting ? 'Cancel Export' : 'Cancel'}
          </button>
          <button
            className="export-confirm-button"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
};
