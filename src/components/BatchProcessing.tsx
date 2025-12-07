/**
 * Batch Processing Component
 * Allows users to select multiple photos and apply actions to all at once
 */

import React, { useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { updatePhotoAdjustments } from '../store';
import { createInitialAdjustmentState } from '../store/initialState';
import { exportImageWithAdjustments, type ExportOptions } from '../utils/export';
import './BatchProcessing.css';

interface BatchProcessingProps {
  isOpen: boolean;
  onClose: () => void;
}

type BatchAction = 'export' | 'apply-preset' | 'copy-adjustments' | 'reset';

interface ExportProgress {
  current: number;
  total: number;
  currentFileName: string;
  errors: string[];
}

export const BatchProcessing: React.FC<BatchProcessingProps> = ({ isOpen, onClose }) => {
  const dispatch = useDispatch();
  const photos = useSelector((state: RootState) => state.library.photos);
  const currentPhotoId = useSelector((state: RootState) => state.library.currentPhotoId);
  const currentAdjustments = useSelector((state: RootState) => state.adjustments);
  
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<BatchAction>('export');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  
  // Export options
  const [exportFormat, setExportFormat] = useState<'jpeg' | 'png' | 'webp'>('jpeg');
  const [exportQuality, setExportQuality] = useState(90);
  const [exportPrefix, setExportPrefix] = useState('pixaro-batch');

  const handleTogglePhoto = useCallback((photoId: string) => {
    setSelectedPhotoIds(prev => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedPhotoIds.size === photos.length) {
      setSelectedPhotoIds(new Set());
    } else {
      setSelectedPhotoIds(new Set(photos.map(p => p.id)));
    }
  }, [photos, selectedPhotoIds.size]);

  const handleBatchExport = async () => {
    const selectedPhotos = photos.filter(p => selectedPhotoIds.has(p.id));
    if (selectedPhotos.length === 0) return;

    setIsProcessing(true);
    setProgress({ current: 0, total: selectedPhotos.length, currentFileName: '', errors: [] });

    const errors: string[] = [];

    for (let i = 0; i < selectedPhotos.length; i++) {
      const photo = selectedPhotos[i];
      const filename = `${exportPrefix}-${i + 1}`;
      
      setProgress(prev => ({
        ...prev!,
        current: i,
        currentFileName: filename,
      }));

      try {
        const options: ExportOptions = {
          format: exportFormat,
          quality: exportQuality / 100,
          filename,
        };

        // Export with the photo's own adjustments
        await exportImageWithAdjustments(photo.original.data, photo.adjustments, options);
        
        // Small delay between exports to prevent browser overload
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        const errorMsg = `Failed to export ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    setProgress(prev => ({
      ...prev!,
      current: selectedPhotos.length,
      errors,
    }));

    setIsProcessing(false);
  };

  const handleCopyAdjustments = () => {
    if (!currentPhotoId || selectedPhotoIds.size === 0) return;

    const selectedPhotos = photos.filter(p => selectedPhotoIds.has(p.id) && p.id !== currentPhotoId);
    
    for (const photo of selectedPhotos) {
      dispatch(updatePhotoAdjustments({
        id: photo.id,
        adjustments: currentAdjustments,
      }));
    }

    onClose();
  };

  const handleResetAdjustments = () => {
    if (selectedPhotoIds.size === 0) return;

    const resetAdjustments = createInitialAdjustmentState();

    for (const photoId of selectedPhotoIds) {
      dispatch(updatePhotoAdjustments({
        id: photoId,
        adjustments: resetAdjustments,
      }));
    }

    onClose();
  };

  const handleExecuteAction = async () => {
    switch (action) {
      case 'export':
        await handleBatchExport();
        break;
      case 'copy-adjustments':
        handleCopyAdjustments();
        break;
      case 'reset':
        handleResetAdjustments();
        break;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="batch-processing-overlay" onClick={onClose}>
      <div className="batch-processing" onClick={e => e.stopPropagation()}>
        <div className="batch-processing__header">
          <h2>Batch Processing</h2>
          <button className="batch-processing__close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="batch-processing__content">
          {/* Photo Selection */}
          <div className="batch-processing__selection">
            <div className="batch-processing__selection-header">
              <span>Select Photos ({selectedPhotoIds.size} of {photos.length})</span>
              <button 
                className="batch-processing__select-all"
                onClick={handleSelectAll}
              >
                {selectedPhotoIds.size === photos.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            
            <div className="batch-processing__photos">
              {photos.map(photo => (
                <div
                  key={photo.id}
                  className={`batch-processing__photo ${selectedPhotoIds.has(photo.id) ? 'batch-processing__photo--selected' : ''}`}
                  onClick={() => handleTogglePhoto(photo.id)}
                >
                  <img src={photo.thumbnail} alt="" />
                  <div className="batch-processing__photo-check">
                    {selectedPhotoIds.has(photo.id) && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  {photo.id === currentPhotoId && (
                    <span className="batch-processing__photo-current">Current</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Action Selection */}
          <div className="batch-processing__actions">
            <h3>Action</h3>
            <div className="batch-processing__action-buttons">
              <button
                className={`batch-processing__action-btn ${action === 'export' ? 'batch-processing__action-btn--active' : ''}`}
                onClick={() => setAction('export')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export All
              </button>
              
              <button
                className={`batch-processing__action-btn ${action === 'copy-adjustments' ? 'batch-processing__action-btn--active' : ''}`}
                onClick={() => setAction('copy-adjustments')}
                disabled={!currentPhotoId}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy Adjustments
              </button>
              
              <button
                className={`batch-processing__action-btn ${action === 'reset' ? 'batch-processing__action-btn--active' : ''}`}
                onClick={() => setAction('reset')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                Reset All
              </button>
            </div>
          </div>

          {/* Action-specific options */}
          {action === 'export' && (
            <div className="batch-processing__options">
              <h3>Export Options</h3>
              
              <div className="batch-processing__option">
                <label>Format</label>
                <select 
                  value={exportFormat} 
                  onChange={e => setExportFormat(e.target.value as 'jpeg' | 'png' | 'webp')}
                >
                  <option value="jpeg">JPEG</option>
                  <option value="png">PNG</option>
                  <option value="webp">WebP</option>
                </select>
              </div>
              
              <div className="batch-processing__option">
                <label>Quality: {exportQuality}%</label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={exportQuality}
                  onChange={e => setExportQuality(Number(e.target.value))}
                />
              </div>
              
              <div className="batch-processing__option">
                <label>Filename Prefix</label>
                <input
                  type="text"
                  value={exportPrefix}
                  onChange={e => setExportPrefix(e.target.value)}
                  placeholder="pixaro-batch"
                />
              </div>
            </div>
          )}

          {action === 'copy-adjustments' && (
            <div className="batch-processing__info">
              <p>
                Copy adjustments from the current photo to all selected photos.
                This will overwrite existing adjustments on the selected photos.
              </p>
            </div>
          )}

          {action === 'reset' && (
            <div className="batch-processing__info batch-processing__info--warning">
              <p>
                ⚠️ This will reset all adjustments on the selected photos to their default values.
                This action cannot be undone.
              </p>
            </div>
          )}

          {/* Progress indicator */}
          {progress && (
            <div className="batch-processing__progress">
              <div className="batch-processing__progress-bar">
                <div 
                  className="batch-processing__progress-fill"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <span className="batch-processing__progress-text">
                {progress.current === progress.total 
                  ? `Complete! Exported ${progress.total} photos`
                  : `Exporting ${progress.currentFileName}... (${progress.current + 1}/${progress.total})`
                }
              </span>
              {progress.errors.length > 0 && (
                <div className="batch-processing__errors">
                  {progress.errors.map((error, i) => (
                    <p key={i} className="batch-processing__error">{error}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="batch-processing__footer">
          <button className="batch-processing__cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="batch-processing__execute"
            onClick={handleExecuteAction}
            disabled={selectedPhotoIds.size === 0 || isProcessing}
          >
            {isProcessing ? 'Processing...' : `Apply to ${selectedPhotoIds.size} Photos`}
          </button>
        </div>
      </div>
    </div>
  );
};
