/**
 * Autosave Hook
 * Automatically saves library state to LocalStorage
 * Similar to Lightroom's auto-save functionality
 */

import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { saveLibraryToLocalStorage, saveSessionState } from '../utils/persistence';

/**
 * Configuration for autosave behavior
 */
export interface AutosaveConfig {
  /** Delay in ms after last change before saving (debounce) */
  debounceMs?: number;
  
  /** Save session state for crash recovery */
  saveSession?: boolean;
  
  /** Enable console logging */
  verbose?: boolean;
}

const DEFAULT_CONFIG: Required<AutosaveConfig> = {
  debounceMs: 2000, // 2 seconds after last change
  saveSession: true,
  verbose: true,
};

/**
 * Hook to automatically save library and session state
 * 
 * Usage:
 * ```
 * useAutosave({ debounceMs: 3000 });
 * ```
 */
export function useAutosave(config: AutosaveConfig = {}) {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Get state from Redux
  const library = useSelector((state: RootState) => state.library);
  const ui = useSelector((state: RootState) => state.ui);
  
  // Track if initial load has completed
  const hasLoadedRef = useRef(false);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTimeRef = useRef<number>(0);

  /**
   * Debounced save function
   */
  useEffect(() => {
    // Skip autosave if no photos (empty state)
    if (library.photos.length === 0) {
      return;
    }

    // Skip first render (initial load)
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      return;
    }

    // Clear existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Set new timer
    saveTimerRef.current = setTimeout(() => {
      const now = Date.now();
      const timeSinceLastSave = now - lastSaveTimeRef.current;

      // Only save if at least 1 second has passed since last save
      if (timeSinceLastSave < 1000) {
        return;
      }

      // Save library (metadata + adjustments)
      const success = saveLibraryToLocalStorage(library);
      
      if (success) {
        lastSaveTimeRef.current = now;
        
        if (fullConfig.verbose) {
          console.log('💾 Autosaved library:', {
            photoCount: library.photos.length,
            currentPhoto: library.currentPhotoId,
          });
        }
      }

      // Save session state for recovery
      if (fullConfig.saveSession) {
        saveSessionState({
          currentPhotoId: library.currentPhotoId,
          activeTool: ui.activeTool,
          zoom: ui.zoom,
          pan: ui.pan,
        });
      }
    }, fullConfig.debounceMs);

    // Cleanup
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [library, ui, fullConfig.debounceMs, fullConfig.saveSession, fullConfig.verbose]);

  /**
   * Save on page unload (before close/refresh)
   */
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (library.photos.length > 0) {
        saveLibraryToLocalStorage(library);
        
        if (fullConfig.saveSession) {
          saveSessionState({
            currentPhotoId: library.currentPhotoId,
            activeTool: ui.activeTool,
            zoom: ui.zoom,
            pan: ui.pan,
          });
        }
        
        if (fullConfig.verbose) {
          console.log('💾 Saved on page unload');
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [library, ui, fullConfig.saveSession, fullConfig.verbose]);
}

