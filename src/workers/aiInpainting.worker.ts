/**
 * AI Inpainting Worker
 * Handles TensorFlow.js inference for object removal in a separate thread
 */

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import type { WorkerTask, WorkerResponse, AIInpaintTask } from '../types/worker';
import type { RemovalMask } from '../types/adjustments';

let model: tf.GraphModel | null = null;
let isInitialized = false;

/**
 * Initialize TensorFlow.js backend
 */
async function initializeTF(): Promise<void> {
  if (isInitialized) return;

  await tf.ready();
  await tf.setBackend('webgl');
  isInitialized = true;
}

/**
 * Load the inpainting model
 */
async function loadModel(): Promise<void> {
  if (model) return;

  const MODEL_URL = 'https://tfhub.dev/google/tfjs-model/inpaint/1/default/1';
  
  try {
    model = await tf.loadGraphModel(MODEL_URL);
    
    // Warm up with dummy data
    const dummyImage = tf.zeros([1, 256, 256, 3]);
    const dummyMask = tf.zeros([1, 256, 256, 1]);
    const warmup = model.predict({ image: dummyImage, mask: dummyMask }) as tf.Tensor;
    await warmup.data();
    
    dummyImage.dispose();
    dummyMask.dispose();
    warmup.dispose();
  } catch (error) {
    console.error('Failed to load model in worker:', error);
    throw error;
  }
}

/**
 * Preprocess image data for model input
 */
function preprocessImage(
  imageData: ImageData,
  targetSize: number = 512
): tf.Tensor3D {
  return tf.tidy(() => {
    // Convert ImageData to tensor
    let tensor = tf.browser.fromPixels(imageData);
    
    // Resize if needed
    const [height, width] = [imageData.height, imageData.width];
    const maxDim = Math.max(height, width);
    
    if (maxDim > targetSize) {
      const scale = targetSize / maxDim;
      const newHeight = Math.round(height * scale);
      const newWidth = Math.round(width * scale);
      tensor = tf.image.resizeBilinear(tensor, [newHeight, newWidth]);
    }
    
    // Normalize to [0, 1]
    tensor = tensor.div(255.0);
    
    return tensor as tf.Tensor3D;
  });
}

/**
 * Preprocess mask for model input
 */
function preprocessMask(
  mask: RemovalMask,
  imageWidth: number,
  imageHeight: number,
  targetSize: number = 512
): tf.Tensor3D {
  return tf.tidy(() => {
    // Create full-size mask
    const fullMask = new Uint8Array(imageWidth * imageHeight);
    
    // Copy mask data to full-size array
    const { bounds, pixels } = mask;
    for (let y = 0; y < bounds.height; y++) {
      for (let x = 0; x < bounds.width; x++) {
        const srcIdx = y * imageWidth + x;
        const dstIdx = (bounds.y + y) * imageWidth + (bounds.x + x);
        if (dstIdx < fullMask.length && srcIdx < pixels.length) {
          fullMask[dstIdx] = pixels[srcIdx];
        }
      }
    }
    
    // Convert to tensor
    let tensor = tf.tensor3d(fullMask, [imageHeight, imageWidth, 1]);
    
    // Resize if needed
    const maxDim = Math.max(imageHeight, imageWidth);
    if (maxDim > targetSize) {
      const scale = targetSize / maxDim;
      const newHeight = Math.round(imageHeight * scale);
      const newWidth = Math.round(imageWidth * scale);
      tensor = tf.image.resizeBilinear(tensor, [newHeight, newWidth]);
    }
    
    // Normalize to [0, 1]
    tensor = tensor.div(255.0);
    
    return tensor as tf.Tensor3D;
  });
}

/**
 * Postprocess model output back to ImageData
 */
async function postprocessOutput(
  output: tf.Tensor,
  originalWidth: number,
  originalHeight: number
): Promise<ImageData> {
  let tensor = output as tf.Tensor3D;
  
  // Remove batch dimension if present
  if (tensor.rank === 4) {
    tensor = tensor.squeeze([0]) as tf.Tensor3D;
  }
  
  // Resize back to original dimensions
  const [height, width] = [tensor.shape[0], tensor.shape[1]];
  if (height !== originalHeight || width !== originalWidth) {
    const resized = tf.image.resizeBilinear(
      tensor,
      [originalHeight, originalWidth]
    );
    tensor.dispose();
    tensor = resized as tf.Tensor3D;
  }
  
  // Denormalize from [0, 1] to [0, 255]
  const denormalized = tensor.mul(255.0).clipByValue(0, 255);
  tensor.dispose();
  
  // Convert to Uint8ClampedArray
  const data = await denormalized.data();
  denormalized.dispose();
  
  // Create ImageData
  const imageData = new ImageData(
    new Uint8ClampedArray(data),
    originalWidth,
    originalHeight
  );
  
  return imageData;
}

/**
 * Perform inpainting
 */
async function performInpainting(
  imageData: ImageData,
  mask: RemovalMask
): Promise<ImageData> {
  if (!model) {
    await loadModel();
  }

  if (!model) {
    throw new Error('Model not loaded');
  }

  const originalWidth = imageData.width;
  const originalHeight = imageData.height;

  // Preprocess inputs
  const imageTensor = preprocessImage(imageData);
  const maskTensor = preprocessMask(mask, originalWidth, originalHeight);
  
  // Add batch dimension
  const imageBatch = imageTensor.expandDims(0);
  const maskBatch = maskTensor.expandDims(0);
  
  // Run inference
  const output = model.predict({
    image: imageBatch,
    mask: maskBatch,
  }) as tf.Tensor;
  
  // Clean up input tensors
  imageTensor.dispose();
  maskTensor.dispose();
  imageBatch.dispose();
  maskBatch.dispose();
  
  // Postprocess
  const result = await postprocessOutput(output, originalWidth, originalHeight);
  output.dispose();
  
  return result;
}

/**
 * Handle incoming messages
 */
self.onmessage = async (event: MessageEvent<WorkerTask>) => {
  const task = event.data;
  
  try {
    // Initialize TensorFlow.js if needed
    if (!isInitialized) {
      await initializeTF();
    }

    if (task.type === 'ai-inpaint') {
      const { imageData, mask } = (task as AIInpaintTask).payload;
      
      // Perform inpainting
      const result = await performInpainting(imageData, mask);
      
      const response: WorkerResponse<ImageData> = {
        success: true,
        data: result,
      };
      
      self.postMessage(response);
    } else {
      throw new Error(`Unknown task type: ${task.type}`);
    }
  } catch (error) {
    const response: WorkerResponse = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
    
    self.postMessage(response);
  }
};

// Handle errors
self.onerror = (event: string | Event) => {
  console.error('Worker error:', event);
  const errorMessage = typeof event === 'string' 
    ? event 
    : (event as ErrorEvent).message || 'Unknown worker error';
  
  const response: WorkerResponse = {
    success: false,
    error: errorMessage,
  };
  self.postMessage(response);
};
