/**
 * useExport Hook
 * React hook for managing export functionality
 */

import { useState, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import type { ExportSettings } from '../types/components';
import {
  ExportProcessor,
  downloadBlob,
  generateFilename,
  type ExportProgress,
} from './exportProcessor';

export interface ExportState {
  isExporting: boolean;
  progress: ExportProgress | null;
  error: string | null;
}

export function useExport() {
  const [exportState, setExportState] = useState<ExportState>({
    isExporting: false,
    progress: null,
    error: null,
  });

  const processorRef = useRef<ExportProcessor | null>(null);

  // Get state from Redux
  const originalImage = useSelector((state: RootState) => state.image.original);
  const adjustments = useSelector((state: RootState) => state.adjustments);
  const metadata = useSelector((state: RootState) => state.image.metadata);

  /**
   * Export image with given settings
   */
  const exportImage = useCallback(
    async (settings: ExportSettings) => {
      if (!originalImage) {
        setExportState({
          isExporting: false,
          progress: null,
          error: 'No image loaded',
        });
        return;
      }

      // Create processor
      if (!processorRef.current) {
        processorRef.current = new ExportProcessor();
      }

      setExportState({
        isExporting: true,
        progress: { stage: 'processing', progress: 0 },
        error: null,
      });

      try {
        // Export image
        const blob = await processorRef.current.exportImage(
          originalImage,
          adjustments,
          settings,
          metadata,
          (progress) => {
            setExportState((prev) => ({
              ...prev,
              progress,
            }));
          }
        );

        // Generate filename
        const filename = generateFilename(
          settings.format,
          metadata?.format ? `image.${metadata.format}` : undefined
        );

        // Trigger download
        downloadBlob(blob, filename);

        // Update state
        setExportState({
          isExporting: false,
          progress: { stage: 'complete', progress: 100 },
          error: null,
        });
      } catch (error) {
        setExportState({
          isExporting: false,
          progress: null,
          error: error instanceof Error ? error.message : 'Export failed',
        });
      }
    },
    [originalImage, adjustments, metadata]
  );

  /**
   * Cancel ongoing export
   */
  const cancelExport = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.cancel();
    }

    setExportState({
      isExporting: false,
      progress: null,
      error: null,
    });
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setExportState((prev) => ({
      ...prev,
      error: null,
    }));
  }, []);

  return {
    exportImage,
    cancelExport,
    clearError,
    ...exportState,
  };
}
