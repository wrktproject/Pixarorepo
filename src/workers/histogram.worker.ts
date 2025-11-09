/**
 * Histogram Worker
 * Calculates RGB histogram from image data without blocking the main thread
 */

export interface HistogramData {
  red: number[];
  green: number[];
  blue: number[];
  luminance: number[];
}

interface HistogramMessage {
  type: 'calculate';
  imageData: ImageData;
}

interface HistogramResponse {
  type: 'result';
  histogram: HistogramData;
}

/**
 * Calculate histogram from image data
 */
function calculateHistogram(imageData: ImageData): HistogramData {
  const { data, width, height } = imageData;
  const pixelCount = width * height;

  // Initialize histogram arrays (256 bins for each channel)
  const red = new Array(256).fill(0);
  const green = new Array(256).fill(0);
  const blue = new Array(256).fill(0);
  const luminance = new Array(256).fill(0);

  // Process each pixel
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Increment color channel bins
    red[r]++;
    green[g]++;
    blue[b]++;

    // Calculate luminance (using standard formula)
    const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    luminance[lum]++;
  }

  // Normalize to percentages
  const normalize = (arr: number[]) => arr.map((val) => val / pixelCount);

  return {
    red: normalize(red),
    green: normalize(green),
    blue: normalize(blue),
    luminance: normalize(luminance),
  };
}

// Worker message handler
self.onmessage = (e: MessageEvent<HistogramMessage>) => {
  const { type, imageData } = e.data;

  if (type === 'calculate') {
    const histogram = calculateHistogram(imageData);

    const response: HistogramResponse = {
      type: 'result',
      histogram,
    };

    self.postMessage(response);
  }
};

// Export empty object for TypeScript
export {};
