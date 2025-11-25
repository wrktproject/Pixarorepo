/**
 * Content-Aware Fill Implementation
 * Uses PatchMatch algorithm + Poisson blending for Photoshop-quality results
 */

import { poissonBlend } from './poissonBlending';

/**
 * PatchMatch: Fast approximate nearest neighbor field computation
 * Based on Barnes et al. 2009 paper
 */

export interface PatchMatchOptions {
  patchSize: number; // Size of patches to match (typically 5-9)
  iterations: number; // Number of PatchMatch iterations (typically 4-8)
  searchRadius: number; // Initial search radius
}

interface NearestNeighborField {
  offsetX: number[][]; // Best matching patch X offset for each pixel
  offsetY: number[][]; // Best matching patch Y offset for each pixel
  distance: number[][]; // Distance/error for each match
}

/**
 * Calculate SSD (Sum of Squared Differences) between two patches
 */
function calculatePatchDistance(
  imageData: ImageData,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  patchSize: number,
  mask?: boolean[][]
): number {
  const { data, width, height } = imageData;
  const halfPatch = Math.floor(patchSize / 2);
  let sum = 0;
  let count = 0;

  for (let dy = -halfPatch; dy <= halfPatch; dy++) {
    for (let dx = -halfPatch; dx <= halfPatch; dx++) {
      const px1 = x1 + dx;
      const py1 = y1 + dy;
      const px2 = x2 + dx;
      const py2 = y2 + dy;

      // Skip if out of bounds
      if (px1 < 0 || px1 >= width || py1 < 0 || py1 >= height) continue;
      if (px2 < 0 || px2 >= width || py2 < 0 || py2 >= height) continue;

      // Skip if masked (for target region)
      if (mask && mask[py1] && mask[py1][px1]) continue;

      const idx1 = (py1 * width + px1) * 4;
      const idx2 = (py2 * width + px2) * 4;

      // Calculate RGB distance (skip alpha)
      for (let c = 0; c < 3; c++) {
        const diff = data[idx1 + c] - data[idx2 + c];
        sum += diff * diff;
      }
      count++;
    }
  }

  return count > 0 ? sum / count : Infinity;
}

/**
 * Initialize nearest neighbor field with random offsets
 */
function initializeNNF(
  width: number,
  height: number,
  mask: boolean[][],
  searchRadius: number
): NearestNeighborField {
  const offsetX: number[][] = [];
  const offsetY: number[][] = [];
  const distance: number[][] = [];

  for (let y = 0; y < height; y++) {
    offsetX[y] = [];
    offsetY[y] = [];
    distance[y] = [];

    for (let x = 0; x < width; x++) {
      if (mask[y][x]) {
        // Random offset for masked pixels
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * searchRadius;
        offsetX[y][x] = Math.round(Math.cos(angle) * dist);
        offsetY[y][x] = Math.round(Math.sin(angle) * dist);
        distance[y][x] = Infinity; // Will be calculated in first iteration
      } else {
        // Identity mapping for unmasked pixels
        offsetX[y][x] = 0;
        offsetY[y][x] = 0;
        distance[y][x] = 0;
      }
    }
  }

  return { offsetX, offsetY, distance };
}

/**
 * Propagation step: Check if neighbors have better matches
 */
function propagate(
  imageData: ImageData,
  nnf: NearestNeighborField,
  mask: boolean[][],
  patchSize: number,
  isOddIteration: boolean
): void {
  const { width, height } = imageData;
  const { offsetX, offsetY, distance } = nnf;

  // Alternate scan direction each iteration
  const yStart = isOddIteration ? 0 : height - 1;
  const yEnd = isOddIteration ? height : -1;
  const yStep = isOddIteration ? 1 : -1;
  const xStart = isOddIteration ? 0 : width - 1;
  const xEnd = isOddIteration ? width : -1;
  const xStep = isOddIteration ? 1 : -1;

  for (let y = yStart; y !== yEnd; y += yStep) {
    for (let x = xStart; x !== xEnd; x += xStep) {
      if (!mask[y][x]) continue; // Skip unmasked pixels

      let bestOffsetX = offsetX[y][x];
      let bestOffsetY = offsetY[y][x];
      let bestDist = distance[y][x];

      // Check neighbors (propagation)
      const neighbors = isOddIteration
        ? [{ dx: -1, dy: 0 }, { dx: 0, dy: -1 }] // Left and up
        : [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }];  // Right and down

      for (const { dx, dy } of neighbors) {
        const nx = x + dx;
        const ny = y + dy;

        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

        // Try neighbor's offset
        const candOffsetX = offsetX[ny][nx];
        const candOffsetY = offsetY[ny][nx];
        const candDist = calculatePatchDistance(
          imageData,
          x,
          y,
          x + candOffsetX,
          y + candOffsetY,
          patchSize,
          mask
        );

        if (candDist < bestDist) {
          bestOffsetX = candOffsetX;
          bestOffsetY = candOffsetY;
          bestDist = candDist;
        }
      }

      offsetX[y][x] = bestOffsetX;
      offsetY[y][x] = bestOffsetY;
      distance[y][x] = bestDist;
    }
  }
}

/**
 * Random search step: Try random offsets at exponentially decreasing distances
 */
function randomSearch(
  imageData: ImageData,
  nnf: NearestNeighborField,
  mask: boolean[][],
  patchSize: number,
  searchRadius: number
): void {
  const { width, height } = imageData;
  const { offsetX, offsetY, distance } = nnf;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y][x]) continue;

      let bestOffsetX = offsetX[y][x];
      let bestOffsetY = offsetY[y][x];
      let bestDist = distance[y][x];

      // Exponentially decreasing search radius
      let radius = searchRadius;
      while (radius >= 1) {
        // Random offset within current radius
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * radius;
        const candOffsetX = bestOffsetX + Math.round(Math.cos(angle) * dist);
        const candOffsetY = bestOffsetY + Math.round(Math.sin(angle) * dist);

        // Check if candidate is valid
        const sourceX = x + candOffsetX;
        const sourceY = y + candOffsetY;

        if (sourceX >= 0 && sourceX < width && sourceY >= 0 && sourceY < height) {
          // Don't match to masked regions
          if (!mask[sourceY][sourceX]) {
            const candDist = calculatePatchDistance(
              imageData,
              x,
              y,
              sourceX,
              sourceY,
              patchSize,
              mask
            );

            if (candDist < bestDist) {
              bestOffsetX = candOffsetX;
              bestOffsetY = candOffsetY;
              bestDist = candDist;
            }
          }
        }

        radius *= 0.5; // Exponential decrease
      }

      offsetX[y][x] = bestOffsetX;
      offsetY[y][x] = bestOffsetY;
      distance[y][x] = bestDist;
    }
  }
}

/**
 * Run PatchMatch algorithm to find best matching patches
 */
export function runPatchMatch(
  imageData: ImageData,
  mask: boolean[][],
  options: PatchMatchOptions
): NearestNeighborField {
  const { patchSize, iterations, searchRadius } = options;

  // Initialize with random offsets
  const nnf = initializeNNF(imageData.width, imageData.height, mask, searchRadius);

  // Calculate initial distances
  for (let y = 0; y < imageData.height; y++) {
    for (let x = 0; x < imageData.width; x++) {
      if (mask[y][x]) {
        nnf.distance[y][x] = calculatePatchDistance(
          imageData,
          x,
          y,
          x + nnf.offsetX[y][x],
          y + nnf.offsetY[y][x],
          patchSize,
          mask
        );
      }
    }
  }

  // Iterate: Propagation + Random Search
  for (let iter = 0; iter < iterations; iter++) {
    propagate(imageData, nnf, mask, patchSize, iter % 2 === 0);
    randomSearch(imageData, nnf, mask, patchSize, searchRadius);
  }

  return nnf;
}

/**
 * Fill masked region using PatchMatch results
 */
export function fillWithPatchMatch(
  imageData: ImageData,
  mask: boolean[][],
  nnf: NearestNeighborField
): void {
  const { data, width, height } = imageData;
  const { offsetX, offsetY } = nnf;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y][x]) continue;

      // Get best matching source pixel
      const sourceX = x + offsetX[y][x];
      const sourceY = y + offsetY[y][x];

      if (sourceX >= 0 && sourceX < width && sourceY >= 0 && sourceY < height) {
        const sourceIdx = (sourceY * width + sourceX) * 4;
        const targetIdx = (y * width + x) * 4;

        // Copy RGB values
        for (let c = 0; c < 3; c++) {
          data[targetIdx + c] = data[sourceIdx + c];
        }
      }
    }
  }
}

/**
 * Content-Aware Fill: High-level function
 * Combines PatchMatch with Poisson blending for seamless results
 */
export function contentAwareFill(
  imageData: ImageData,
  maskRegion: { x: number; y: number; width: number; height: number },
  usePoisson: boolean = true
): void {
  const { width, height } = imageData;

  // Create boolean mask
  const mask: boolean[][] = [];
  for (let y = 0; y < height; y++) {
    mask[y] = [];
    for (let x = 0; x < width; x++) {
      mask[y][x] =
        x >= maskRegion.x &&
        x < maskRegion.x + maskRegion.width &&
        y >= maskRegion.y &&
        y < maskRegion.y + maskRegion.height;
    }
  }

  // Run PatchMatch to find best source patches
  const nnf = runPatchMatch(imageData, mask, {
    patchSize: 7,
    iterations: 5,
    searchRadius: Math.max(width, height) / 2,
  });

  // Fill using best matches
  fillWithPatchMatch(imageData, mask, nnf);

  // Apply Poisson blending for seamless integration
  if (usePoisson) {
    poissonBlend(imageData, mask, 50); // 50 iterations for good quality
  }
}

