/**
 * AI Model Loader
 * Handles lazy loading of TensorFlow.js inpainting model with retry logic
 */

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';

interface ModelLoadState {
  model: tf.GraphModel | null;
  isLoading: boolean;
  error: Error | null;
  loadAttempts: number;
}

const MAX_LOAD_ATTEMPTS = 3;
const MODEL_URL = 'https://tfhub.dev/google/tfjs-model/inpaint/1/default/1';

// Global state for model loading
const modelState: ModelLoadState = {
  model: null,
  isLoading: false,
  error: null,
  loadAttempts: 0,
};

/**
 * Load the inpainting model with retry logic
 * @param onProgress Optional callback for loading progress
 * @returns Promise resolving to the loaded model
 */
export async function loadInpaintingModel(
  onProgress?: (progress: number) => void
): Promise<tf.GraphModel> {
  // Return cached model if already loaded
  if (modelState.model) {
    return modelState.model;
  }

  // Wait if already loading
  if (modelState.isLoading) {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (modelState.model) {
          clearInterval(checkInterval);
          resolve(modelState.model);
        } else if (modelState.error && !modelState.isLoading) {
          clearInterval(checkInterval);
          reject(modelState.error);
        }
      }, 100);
    });
  }

  modelState.isLoading = true;
  modelState.error = null;

  // Ensure WebGL backend is ready
  await tf.ready();
  await tf.setBackend('webgl');

  let lastError: Error | null = null;

  // Retry loop
  while (modelState.loadAttempts < MAX_LOAD_ATTEMPTS) {
    try {
      modelState.loadAttempts++;

      if (onProgress) {
        onProgress(0);
      }

      // Load model with progress tracking
      const model = await tf.loadGraphModel(MODEL_URL, {
        onProgress: (fraction: number) => {
          if (onProgress) {
            onProgress(fraction * 100);
          }
        },
      });

      // Warm up the model with a dummy inference
      const dummyInput = tf.zeros([1, 256, 256, 3]);
      const dummyMask = tf.zeros([1, 256, 256, 1]);
      const warmupResult = model.predict({
        image: dummyInput,
        mask: dummyMask,
      }) as tf.Tensor;
      
      await warmupResult.data();
      
      // Clean up
      dummyInput.dispose();
      dummyMask.dispose();
      warmupResult.dispose();

      modelState.model = model;
      modelState.isLoading = false;
      modelState.error = null;

      if (onProgress) {
        onProgress(100);
      }

      return model;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(
        `Model load attempt ${modelState.loadAttempts} failed:`,
        lastError
      );

      // Wait before retry (exponential backoff)
      if (modelState.loadAttempts < MAX_LOAD_ATTEMPTS) {
        const waitTime = Math.pow(2, modelState.loadAttempts) * 1000;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  // All attempts failed
  modelState.isLoading = false;
  modelState.error = lastError || new Error('Failed to load AI model');
  throw modelState.error;
}

/**
 * Check if model is currently loaded
 */
export function isModelLoaded(): boolean {
  return modelState.model !== null;
}

/**
 * Check if model is currently loading
 */
export function isModelLoading(): boolean {
  return modelState.isLoading;
}

/**
 * Get current load attempts count
 */
export function getLoadAttempts(): number {
  return modelState.loadAttempts;
}

/**
 * Reset model state (for testing)
 */
export function resetModelState(): void {
  if (modelState.model) {
    modelState.model.dispose();
  }
  modelState.model = null;
  modelState.isLoading = false;
  modelState.error = null;
  modelState.loadAttempts = 0;
}

/**
 * Unload the model to free memory
 */
export function unloadModel(): void {
  if (modelState.model) {
    modelState.model.dispose();
    modelState.model = null;
  }
}
