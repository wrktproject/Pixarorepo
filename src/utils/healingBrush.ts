/**
 * Healing Brush Implementation
 * Lightroom-style content-aware healing
 * 
 * Key difference from naive approach:
 * - Heals entire regions at once, not overlapping stamps
 * - Creates a mask from the brush stroke
 * - Calculates mean colors for entire source/target regions
 * - Applies texture transfer uniformly
 */

export interface HealingPatch {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  radius: number;
}

export interface BrushStrokePoint {
  x: number;
  y: number;
}

export interface BrushStrokeOptions {
  mode: 'clone' | 'heal';
  sourceOffset?: { x: number; y: number };
  radius: number;
  feather: number;
  opacity: number;
}

/**
 * Create a mask from brush stroke points
 * Returns a Float32Array where each pixel has a weight 0-1
 */
function createMaskFromStroke(
  width: number,
  height: number,
  points: BrushStrokePoint[],
  brushRadius: number,
  feather: number
): { mask: Float32Array; bounds: { minX: number; minY: number; maxX: number; maxY: number } } {
  const mask = new Float32Array(width * height);
  
  // Calculate bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x - brushRadius);
    minY = Math.min(minY, p.y - brushRadius);
    maxX = Math.max(maxX, p.x + brushRadius);
    maxY = Math.max(maxY, p.y + brushRadius);
  }
  
  // Clamp to image bounds
  minX = Math.max(0, Math.floor(minX));
  minY = Math.max(0, Math.floor(minY));
  maxX = Math.min(width - 1, Math.ceil(maxX));
  maxY = Math.min(height - 1, Math.ceil(maxY));
  
  // Fill mask based on distance to stroke
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      // Find minimum distance to any stroke point
      let minDist = Infinity;
      for (const p of points) {
        const dist = Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2);
        minDist = Math.min(minDist, dist);
      }
      
      // Calculate weight based on distance and feather
      if (minDist <= brushRadius) {
        const normalizedDist = minDist / brushRadius;
        const falloffStart = 1 - feather;
        
        if (normalizedDist < falloffStart) {
          mask[y * width + x] = 1;
        } else {
          // Smooth falloff
          const t = (normalizedDist - falloffStart) / feather;
          mask[y * width + x] = 1 - t * t * (3 - 2 * t);
        }
      }
    }
  }
  
  return { mask, bounds: { minX, minY, maxX, maxY } };
}

/**
 * Check if a stroke forms a closed shape and fill it
 */
function fillClosedShape(
  mask: Float32Array,
  width: number,
  height: number,
  points: BrushStrokePoint[],
  brushRadius: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): void {
  if (points.length < 10) return;
  
  // Check if closed (end near start)
  const start = points[0];
  const end = points[points.length - 1];
  const dist = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
  
  if (dist > brushRadius) return; // Not closed
  
  // Use scanline fill algorithm
  // First, create edge list from points
  const edges: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (let i = 0; i < points.length - 1; i++) {
    edges.push({ x1: points[i].x, y1: points[i].y, x2: points[i + 1].x, y2: points[i + 1].y });
  }
  // Close the shape
  edges.push({ x1: end.x, y1: end.y, x2: start.x, y2: start.y });
  
  // Scanline fill
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    const intersections: number[] = [];
    
    for (const edge of edges) {
      const { x1, y1, x2, y2 } = edge;
      
      // Check if scanline intersects this edge
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        // Calculate x intersection
        const t = (y - y1) / (y2 - y1);
        const x = x1 + t * (x2 - x1);
        intersections.push(x);
      }
    }
    
    // Sort intersections
    intersections.sort((a, b) => a - b);
    
    // Fill between pairs
    for (let i = 0; i < intersections.length - 1; i += 2) {
      const xStart = Math.max(bounds.minX, Math.ceil(intersections[i]));
      const xEnd = Math.min(bounds.maxX, Math.floor(intersections[i + 1]));
      
      for (let x = xStart; x <= xEnd; x++) {
        mask[y * width + x] = 1;
      }
    }
  }
}

/**
 * Get centroid (center) of masked region
 */
function getMaskCentroid(
  mask: Float32Array,
  width: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): { x: number; y: number } {
  let sumX = 0, sumY = 0, sumWeight = 0;
  
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const weight = mask[y * width + x];
      if (weight > 0) {
        sumX += x * weight;
        sumY += y * weight;
        sumWeight += weight;
      }
    }
  }
  
  if (sumWeight === 0) return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
  return { x: sumX / sumWeight, y: sumY / sumWeight };
}

/**
 * Calculate mean RGB for a region defined by mask
 */
function calculateRegionMean(
  imageData: ImageData,
  mask: Float32Array,
  offsetX: number,
  offsetY: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): [number, number, number] {
  const { width, height, data } = imageData;
  const mean: [number, number, number] = [0, 0, 0];
  let totalWeight = 0;
  
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const weight = mask[y * width + x];
      if (weight === 0) continue;
      
      const sx = x + offsetX;
      const sy = y + offsetY;
      
      if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;
      
      const idx = (sy * width + sx) * 4;
      mean[0] += data[idx] * weight;
      mean[1] += data[idx + 1] * weight;
      mean[2] += data[idx + 2] * weight;
      totalWeight += weight;
    }
  }
  
  if (totalWeight > 0) {
    mean[0] /= totalWeight;
    mean[1] /= totalWeight;
    mean[2] /= totalWeight;
  }
  
  return mean;
}

/**
 * Apply healing to a region
 * This is the core algorithm that makes it work like Lightroom:
 * 1. Calculate mean colors for both source and target regions (using the mask)
 * 2. For each pixel in the mask:
 *    - Get source pixel
 *    - Extract texture: texture = source_pixel - source_mean
 *    - Recolor: healed = target_mean + texture
 *    - Blend with target based on mask weight
 */
function applyRegionHeal(
  imageData: ImageData,
  mask: Float32Array,
  sourceOffset: { x: number; y: number },
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  opacity: number
): void {
  const { width, height, data } = imageData;
  
  // Calculate mean colors for source and target regions
  const targetMean = calculateRegionMean(imageData, mask, 0, 0, bounds);
  const sourceMean = calculateRegionMean(imageData, mask, sourceOffset.x, sourceOffset.y, bounds);
  
  // Apply healing
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const maskWeight = mask[y * width + x] * opacity;
      if (maskWeight === 0) continue;
      
      const sx = x + sourceOffset.x;
      const sy = y + sourceOffset.y;
      
      if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;
      
      const targetIdx = (y * width + x) * 4;
      const sourceIdx = (sy * width + sx) * 4;
      
      // For each color channel
      for (let c = 0; c < 3; c++) {
        // Extract texture from source (high-frequency detail)
        const texture = data[sourceIdx + c] - sourceMean[c];
        
        // Apply texture to target mean (recolor)
        const healed = targetMean[c] + texture;
        
        // Clamp and blend
        const clampedHealed = Math.max(0, Math.min(255, healed));
        data[targetIdx + c] = data[targetIdx + c] * (1 - maskWeight) + clampedHealed * maskWeight;
      }
    }
  }
}

/**
 * Apply cloning to a region (direct copy)
 */
function applyRegionClone(
  imageData: ImageData,
  mask: Float32Array,
  sourceOffset: { x: number; y: number },
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  opacity: number
): void {
  const { width, height, data } = imageData;
  
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const maskWeight = mask[y * width + x] * opacity;
      if (maskWeight === 0) continue;
      
      const sx = x + sourceOffset.x;
      const sy = y + sourceOffset.y;
      
      if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;
      
      const targetIdx = (y * width + x) * 4;
      const sourceIdx = (sy * width + sx) * 4;
      
      // Direct copy with blending
      for (let c = 0; c < 4; c++) {
        data[targetIdx + c] = data[targetIdx + c] * (1 - maskWeight) + data[sourceIdx + c] * maskWeight;
      }
    }
  }
}

/**
 * Find a good source patch automatically
 */
export function findSourcePatch(
  imageData: ImageData,
  targetX: number,
  targetY: number,
  radius: number
): { x: number; y: number } {
  const { width, height, data } = imageData;
  
  // Calculate target luminance
  let targetLum = 0, count = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const px = targetX + dx, py = targetY + dy;
      if (px < 0 || px >= width || py < 0 || py >= height) continue;
      const idx = (py * width + px) * 4;
      targetLum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      count++;
    }
  }
  targetLum /= count;
  
  // Search for similar region
  const searchRadius = radius * 4;
  const minDist = radius * 2;
  let bestX = targetX + minDist, bestY = targetY, bestScore = Infinity;
  
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
    for (let dist = minDist; dist < searchRadius; dist += Math.max(2, radius / 2)) {
      const sx = Math.round(targetX + Math.cos(angle) * dist);
      const sy = Math.round(targetY + Math.sin(angle) * dist);
      
      if (sx - radius < 0 || sx + radius >= width || sy - radius < 0 || sy + radius >= height) continue;
      
      let sourceLum = 0, sCount = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy > radius * radius) continue;
          const idx = ((sy + dy) * width + (sx + dx)) * 4;
          sourceLum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          sCount++;
        }
      }
      sourceLum /= sCount;
      
      const score = Math.abs(sourceLum - targetLum);
      if (score < bestScore) {
        bestScore = score;
        bestX = sx;
        bestY = sy;
      }
    }
  }
  
  return { x: bestX, y: bestY };
}

/**
 * Main function: Apply brush stroke as a single healed region
 * This is the key to getting Lightroom-quality results
 */
export function paintBrushStroke(
  imageData: ImageData,
  points: BrushStrokePoint[],
  options: BrushStrokeOptions
): void {
  if (points.length === 0) return;
  
  const { mode, radius, feather, opacity } = options;
  let { sourceOffset } = options;
  
  const { width, height } = imageData;
  
  // Create mask from the entire brush stroke
  const { mask, bounds } = createMaskFromStroke(width, height, points, radius, feather);
  
  // Check if it's a closed shape and fill interior
  fillClosedShape(mask, width, height, points, radius, bounds);
  
  // Get centroid of the masked region
  const centroid = getMaskCentroid(mask, width, bounds);
  
  // Auto-find source if not provided
  if (!sourceOffset) {
    const autoSource = findSourcePatch(imageData, Math.round(centroid.x), Math.round(centroid.y), radius);
    sourceOffset = {
      x: autoSource.x - Math.round(centroid.x),
      y: autoSource.y - Math.round(centroid.y),
    };
    console.log('Auto-selected source:', autoSource, 'offset:', sourceOffset);
  }
  
  // Apply the appropriate operation to the entire region at once
  if (mode === 'clone') {
    applyRegionClone(imageData, mask, sourceOffset, bounds, opacity);
  } else {
    applyRegionHeal(imageData, mask, sourceOffset, bounds, opacity);
  }
  
  console.log(`Applied ${mode} to region:`, bounds, 'with offset:', sourceOffset);
}

// Legacy exports for compatibility
export function healPatch(
  imageData: ImageData,
  patch: HealingPatch,
  feather: number = 0.3
): void {
  const points = [{ x: patch.targetX, y: patch.targetY }];
  paintBrushStroke(imageData, points, {
    mode: 'heal',
    sourceOffset: { x: patch.sourceX - patch.targetX, y: patch.sourceY - patch.targetY },
    radius: patch.radius,
    feather,
    opacity: 1.0,
  });
}

export function clonePatch(
  imageData: ImageData,
  patch: HealingPatch,
  feather: number = 0.3,
  opacity: number = 1.0
): void {
  const points = [{ x: patch.targetX, y: patch.targetY }];
  paintBrushStroke(imageData, points, {
    mode: 'clone',
    sourceOffset: { x: patch.sourceX - patch.targetX, y: patch.sourceY - patch.targetY },
    radius: patch.radius,
    feather,
    opacity,
  });
}
