/**
 * Export Dialog Component
 * Allows users to export their edited images with various options
 */

import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import {
  exportImageWithAdjustments,
  copyCanvasToClipboard,
  getRecommendedExportSettings,
  estimateExportSize,
  formatFileSize,
  type ExportOptions,
} from '../utils/export';
import './ExportDialog.css';

export interface ExportDialogProps {
  /** Canvas ref to export from */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  
  /** Called when export is complete */
  onExportComplete?: () => void;
  
  /** Called when dialog should close */
  onClose: () => void;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  canvasRef,
  onExportComplete,
  onClose,
}) => {
  const image = useSelector((state: RootState) => state.image.current);
  const adjustments = useSelector((state: RootState) => state.adjustments);
  
  // Calculate final dimensions after crop and rotation
  let finalWidth = image?.width || 0;
  let finalHeight = image?.height || 0;
  
  if (adjustments.crop) {
    finalWidth = adjustments.crop.width;
    finalHeight = adjustments.crop.height;
  }
  
  if (adjustments.rotation === 90 || adjustments.rotation === 270) {
    [finalWidth, finalHeight] = [finalHeight, finalWidth];
  }
  
  const [format, setFormat] = useState<'jpeg' | 'png' | 'webp'>('jpeg');
  const [quality, setQuality] = useState(95);
  const [filename, setFilename] = useState(`pixaro-export-${Date.now()}`);
  const [isExporting, setIsExporting] = useState(false);
  const [preset, setPreset] = useState<'custom' | 'web' | 'print' | 'social'>('custom');

  const estimatedSize = estimateExportSize(finalWidth, finalHeight, format, quality / 100);

  const handlePresetChange = (newPreset: typeof preset) => {
    setPreset(newPreset);
    
    if (newPreset !== 'custom' && image) {
      const recommended = getRecommendedExportSettings(image.width, image.height);
      const settings = recommended[newPreset];
      
      setFormat(settings.format);
      setQuality((settings.quality || 0.95) * 100);
    }
  };

  const handleExport = async () => {
    if (!image) {
      alert('No image to export');
      return;
    }

    setIsExporting(true);

    try {
      const options: ExportOptions = {
        format,
        quality: quality / 100,
        filename,
      };

      // Use the new export function that renders with adjustments
      // image is ProcessedImage which contains the ImageData in .data property
      await exportImageWithAdjustments(image.data, adjustments, options);
      
      console.log('✅ Export complete');
      onExportComplete?.();
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Failed to export image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyToClipboard = async () => {
    if (!canvasRef.current) {
      alert('Canvas not available');
      return;
    }

    try {
      await copyCanvasToClipboard(canvasRef.current);
      alert('Image copied to clipboard!');
    } catch (error) {
      console.error('Copy to clipboard failed:', error);
      alert('Failed to copy to clipboard. Your browser may not support this feature.');
    }
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="export-dialog-overlay" onClick={handleOverlayClick}>
      <div className="export-dialog" role="dialog" aria-labelledby="export-title" aria-modal="true">
        <div className="export-dialog__header">
          <h2 id="export-title" className="export-dialog__title">Export Image</h2>
          <button
            className="export-dialog__close"
            onClick={onClose}
            aria-label="Close export dialog"
          >
            ✕
          </button>
        </div>

        <div className="export-dialog__content">
          {/* Image Info */}
          <div className="export-dialog__info">
            <p>
              <strong>Dimensions:</strong> {finalWidth} × {finalHeight} px
            </p>
            <p>
              <strong>Estimated size:</strong> {formatFileSize(estimatedSize)}
            </p>
          </div>

          {/* Preset Selection */}
          <div className="export-dialog__field">
            <label className="export-dialog__label">Preset</label>
            <div className="export-dialog__presets">
              <button
                className={`export-dialog__preset ${preset === 'custom' ? 'export-dialog__preset--active' : ''}`}
                onClick={() => handlePresetChange('custom')}
              >
                Custom
              </button>
              <button
                className={`export-dialog__preset ${preset === 'web' ? 'export-dialog__preset--active' : ''}`}
                onClick={() => handlePresetChange('web')}
                title="Optimized for web (2048px max, 85% quality)"
              >
                Web
              </button>
              <button
                className={`export-dialog__preset ${preset === 'print' ? 'export-dialog__preset--active' : ''}`}
                onClick={() => handlePresetChange('print')}
                title="High quality for printing (full resolution, 95% quality)"
              >
                Print
              </button>
              <button
                className={`export-dialog__preset ${preset === 'social' ? 'export-dialog__preset--active' : ''}`}
                onClick={() => handlePresetChange('social')}
                title="Optimized for social media (1080px max, 80% quality)"
              >
                Social
              </button>
            </div>
          </div>

          {/* Format Selection */}
          <div className="export-dialog__field">
            <label className="export-dialog__label" htmlFor="export-format">
              Format
            </label>
            <select
              id="export-format"
              className="export-dialog__select"
              value={format}
              onChange={(e) => {
                setFormat(e.target.value as 'jpeg' | 'png' | 'webp');
                setPreset('custom');
              }}
            >
              <option value="jpeg">JPEG (smaller file)</option>
              <option value="png">PNG (lossless)</option>
              <option value="webp">WebP (modern)</option>
            </select>
          </div>

          {/* Quality Slider (for JPEG/WebP) */}
          {format !== 'png' && (
            <div className="export-dialog__field">
              <label className="export-dialog__label" htmlFor="export-quality">
                Quality: {quality}%
              </label>
              <input
                id="export-quality"
                type="range"
                min="60"
                max="100"
                value={quality}
                onChange={(e) => {
                  setQuality(Number(e.target.value));
                  setPreset('custom');
                }}
                className="export-dialog__slider"
              />
              <div className="export-dialog__slider-labels">
                <span>Smaller</span>
                <span>Better</span>
              </div>
            </div>
          )}

          {/* Filename */}
          <div className="export-dialog__field">
            <label className="export-dialog__label" htmlFor="export-filename">
              Filename
            </label>
            <input
              id="export-filename"
              type="text"
              className="export-dialog__input"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="my-photo"
            />
            <span className="export-dialog__filename-ext">.{format}</span>
          </div>
        </div>

        <div className="export-dialog__footer">
          <button
            className="export-dialog__button export-dialog__button--secondary"
            onClick={handleCopyToClipboard}
            disabled={isExporting}
          >
            Copy to Clipboard
          </button>
          <div className="export-dialog__footer-right">
            <button
              className="export-dialog__button export-dialog__button--tertiary"
              onClick={onClose}
              disabled={isExporting}
            >
              Cancel
            </button>
            <button
              className="export-dialog__button export-dialog__button--primary"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? 'Exporting...' : 'Export'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
