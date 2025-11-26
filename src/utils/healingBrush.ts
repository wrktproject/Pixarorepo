/**
 * Healing Brush Implementation
 * Lightroom-style content-aware healing
 * 
 * Key features:
 * - Fills closed shapes completely (not just the border)
 * - Uses proper polygon fill algorithm
 * - Applies texture transfer uniformly across the region
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
  sourcePoint?: { x: number; y: number };  // Absolute source point (preferred)
  sourceOffset?: { x: number; y: number }; // Legacy: offset from centroid
  radius: number;
  feather: number;
  opacity: number;
}

/**
 * Check if a point is inside a polygon using ray casting
 */
function isPointInPolygon(x: number, y: number, polygon: BrushStrokePoint[]): boolean {
  let inside = false;
  const n = polygon.length;
  
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

/**
 * Simplify polygon to reduce point count (Douglas-Peucker algorithm)
 */
function simplifyPolygon(points: BrushStrokePoint[], tolerance: number): BrushStrokePoint[] {
  if (points.length <= 2) return points;
  
  // Find the point with the maximum distance from the line between first and last
  let maxDist = 0;
  let maxIdx = 0;
  
  const first = points[0];
  const last = points[points.length - 1];
  
  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }
  
  if (maxDist > tolerance) {
    const left = simplifyPolygon(points.slice(0, maxIdx + 1), tolerance);
    const right = simplifyPolygon(points.slice(maxIdx), tolerance);
    return [...left.slice(0, -1), ...right];
  }
  
  return [first, last];
}

function perpendicularDistance(point: BrushStrokePoint, lineStart: BrushStrokePoint, lineEnd: BrushStrokePoint): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  
  if (dx === 0 && dy === 0) {
    return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
  }
  
  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
  const nearestX = lineStart.x + t * dx;
  const nearestY = lineStart.y + t * dy;
  
  return Math.sqrt((point.x - nearestX) ** 2 + (point.y - nearestY) ** 2);
}

/**
 * Create a mask that fills the entire interior of a closed stroke
 */
function createFilledMask(
  width: number,
  height: number,
  points: BrushStrokePoint[],
  brushRadius: number,
  feather: number
): { mask: Float32Array; bounds: { minX: number; minY: number; maxX: number; maxY: number } } {
  const mask = new Float32Array(width * height);
  
  // Calculate bounds with padding for feather
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  
  // Add padding for brush radius and feather
  const padding = brushRadius + brushRadius * feather;
  minX = Math.max(0, Math.floor(minX - padding));
  minY = Math.max(0, Math.floor(minY - padding));
  maxX = Math.min(width - 1, Math.ceil(maxX + padding));
  maxY = Math.min(height - 1, Math.ceil(maxY + padding));
  
  // Check if stroke is closed
  const start = points[0];
  const end = points[points.length - 1];
  const closeDist = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
  const isClosed = points.length >= 10 && closeDist < brushRadius * 2;
  
  console.log('Creating mask:', { isClosed, pointCount: points.length, closeDist, brushRadius });
  
  if (isClosed) {
    // CLOSED SHAPE: Fill the entire interior
    // Simplify the polygon for faster point-in-polygon tests
    const simplified = simplifyPolygon(points, brushRadius / 4);
    
    // Close the polygon explicitly
    const polygon = [...simplified];
    if (polygon.length > 0) {
      polygon.push(polygon[0]); // Close the loop
    }
    
    console.log('Filling closed shape with', polygon.length, 'vertices');
    
    // Fill interior using point-in-polygon test
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (isPointInPolygon(x, y, polygon)) {
          // Inside the polygon - full weight
          mask[y * width + x] = 1;
        } else {
          // Outside - check distance to polygon edge for feathering
          let minDistToEdge = Infinity;
          for (let i = 0; i < polygon.length - 1; i++) {
            const dist = distanceToLineSegment(x, y, polygon[i], polygon[i + 1]);
            minDistToEdge = Math.min(minDistToEdge, dist);
          }
          
          // Apply feather on the outside edge
          if (minDistToEdge < brushRadius * feather) {
            const t = minDistToEdge / (brushRadius * feather);
            mask[y * width + x] = 1 - t * t * (3 - 2 * t); // Smoothstep falloff
          }
        }
      }
    }
    
    // Also ensure the stroke path itself is included with brush radius
    for (const p of points) {
      for (let dy = -brushRadius; dy <= brushRadius; dy++) {
        for (let dx = -brushRadius; dx <= brushRadius; dx++) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= brushRadius) {
            const px = Math.round(p.x + dx);
            const py = Math.round(p.y + dy);
            if (px >= 0 && px < width && py >= 0 && py < height) {
              const idx = py * width + px;
              const normalizedDist = dist / brushRadius;
              const falloffStart = 1 - feather;
              let weight = 1;
              if (normalizedDist > falloffStart && feather > 0) {
                const t = (normalizedDist - falloffStart) / feather;
                weight = 1 - t * t * (3 - 2 * t);
              }
              mask[idx] = Math.max(mask[idx], weight);
            }
          }
        }
      }
    }
  } else {
    // OPEN STROKE: Just paint the brush path
    for (const p of points) {
      for (let dy = -brushRadius; dy <= brushRadius; dy++) {
        for (let dx = -brushRadius; dx <= brushRadius; dx++) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= brushRadius) {
            const px = Math.round(p.x + dx);
            const py = Math.round(p.y + dy);
            if (px >= 0 && px < width && py >= 0 && py < height) {
              const idx = py * width + px;
              const normalizedDist = dist / brushRadius;
              const falloffStart = 1 - feather;
              let weight = 1;
              if (normalizedDist > falloffStart && feather > 0) {
                const t = (normalizedDist - falloffStart) / feather;
                weight = 1 - t * t * (3 - 2 * t);
              }
              mask[idx] = Math.max(mask[idx], weight);
            }
          }
        }
      }
    }
  }
  
  // Count filled pixels
  let filledCount = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > 0) filledCount++;
  }
  console.log('Mask created:', filledCount, 'pixels affected');
  
  return { mask, bounds: { minX, minY, maxX, maxY } };
}

/**
 * Distance from point to line segment
 */
function distanceToLineSegment(px: number, py: number, a: BrushStrokePoint, b: BrushStrokePoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  
  if (lengthSq === 0) {
    return Math.sqrt((px - a.x) ** 2 + (py - a.y) ** 2);
  }
  
  let t = ((px - a.x) * dx + (py - a.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  
  const nearestX = a.x + t * dx;
  const nearestY = a.y + t * dy;
  
  return Math.sqrt((px - nearestX) ** 2 + (py - nearestY) ** 2);
}

/**
 * Get centroid of masked region
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
  
  if (sumWeight === 0) {
    return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
  }
  return { x: sumX / sumWeight, y: sumY / sumWeight };
}

/**
 * Calculate mean RGB for a region
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
 * Apply healing: for object removal, copy source pixels directly
 * with edge color matching for seamless integration
 */
function applyRegionHeal(
  imageData: ImageData,
  mask: Float32Array,
  sourceOffset: { x: number; y: number },
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  opacity: number
): void {
  const { width, height, data } = imageData;
  
  // For object removal, we REPLACE pixels with source pixels
  // Calculate edge mean from TARGET boundary (not interior which has the object)
  const edgeMean = calculateEdgeMean(imageData, mask, bounds, width);
  const sourceMean = calculateRegionMean(imageData, mask, sourceOffset.x, sourceOffset.y, bounds);
  
  // Color correction to match edge colors
  const colorCorrection = [
    edgeMean[0] - sourceMean[0],
    edgeMean[1] - sourceMean[1],
    edgeMean[2] - sourceMean[2],
  ];
  
  console.log('Healing region:', { edgeMean, sourceMean, colorCorrection, sourceOffset });
  
  // Apply healing - replace with source pixels, blend at edges
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const maskWeight = mask[y * width + x] * opacity;
      if (maskWeight === 0) continue;
      
      const sx = x + sourceOffset.x;
      const sy = y + sourceOffset.y;
      
      if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;
      
      const targetIdx = (y * width + x) * 4;
      const sourceIdx = (sy * width + sx) * 4;
      
      // Apply stronger color correction at edges, less in center
      const correctionStrength = Math.max(0, 1 - maskWeight * 1.5);
      
      for (let c = 0; c < 3; c++) {
        // Take source pixel with color correction
        const corrected = data[sourceIdx + c] + colorCorrection[c] * correctionStrength;
        const clamped = Math.max(0, Math.min(255, corrected));
        // Blend with original based on mask weight
        data[targetIdx + c] = data[targetIdx + c] * (1 - maskWeight) + clamped * maskWeight;
      }
    }
  }
}

/**
 * Calculate mean color from edge pixels only (where mask weight is low)
 * This gives us the surrounding color without the object we're removing
 */
function calculateEdgeMean(
  imageData: ImageData,
  mask: Float32Array,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  width: number
): number[] {
  const { data } = imageData;
  const sum = [0, 0, 0];
  let count = 0;
  
  // Sample pixels at the edge of the mask (weight between 0.05 and 0.4)
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const weight = mask[y * width + x];
      if (weight > 0.05 && weight < 0.4) {
        const idx = (y * width + x) * 4;
        sum[0] += data[idx];
        sum[1] += data[idx + 1];
        sum[2] += data[idx + 2];
        count++;
      }
    }
  }
  
  if (count === 0) {
    // Fallback: sample outside the bounds
    for (let y = Math.max(0, bounds.minY - 10); y < bounds.minY; y++) {
      for (let x = bounds.minX; x <= bounds.maxX; x++) {
        const idx = (y * width + x) * 4;
        sum[0] += data[idx];
        sum[1] += data[idx + 1];
        sum[2] += data[idx + 2];
        count++;
      }
    }
  }
  
  if (count === 0) return [128, 128, 128];
  
  return [sum[0] / count, sum[1] / count, sum[2] / count];
}

/**
 * Apply cloning: direct copy from source
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
      
      for (let c = 0; c < 4; c++) {
        data[targetIdx + c] = data[targetIdx + c] * (1 - maskWeight) + data[sourceIdx + c] * maskWeight;
      }
    }
  }
}

/**
 * Auto-find a good source region
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
  targetLum /= count || 1;
  
  // Search for similar region
  const searchRadius = radius * 6;
  const minDist = radius * 2;
  let bestX = targetX + minDist, bestY = targetY, bestScore = Infinity;
  
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
    for (let dist = minDist; dist < searchRadius; dist += Math.max(4, radius / 3)) {
      const sx = Math.round(targetX + Math.cos(angle) * dist);
      const sy = Math.round(targetY + Math.sin(angle) * dist);
      
      if (sx - radius < 0 || sx + radius >= width || sy - radius < 0 || sy + radius >= height) continue;
      
      let sourceLum = 0, sCount = 0;
      for (let dy = -radius; dy <= radius; dy += 2) {
        for (let dx = -radius; dx <= radius; dx += 2) {
          if (dx * dx + dy * dy > radius * radius) continue;
          const idx = ((sy + dy) * width + (sx + dx)) * 4;
          sourceLum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          sCount++;
        }
      }
      sourceLum /= sCount || 1;
      
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
 * Main function: Apply brush stroke healing/cloning
 */
export function paintBrushStroke(
  imageData: ImageData,
  points: BrushStrokePoint[],
  options: BrushStrokeOptions
): void {
  if (points.length === 0) return;
  
  const { mode, radius, feather, opacity, sourcePoint } = options;
  let { sourceOffset } = options;
  
  const { width, height } = imageData;
  
  console.log('paintBrushStroke called:', { 
    mode, 
    pointCount: points.length, 
    radius, 
    feather, 
    hasSourcePoint: !!sourcePoint,
    hasSourceOffset: !!sourceOffset 
  });
  
  // Create filled mask
  const { mask, bounds } = createFilledMask(width, height, points, radius, feather);
  
  // Get centroid of the mask (this is the CENTER of the target region)
  const centroid = getMaskCentroid(mask, width, bounds);
  
  console.log('Mask centroid:', centroid, 'bounds:', bounds);
  
  // Calculate source offset from centroid
  if (sourcePoint) {
    // User provided absolute source point - calculate offset from centroid
    sourceOffset = {
      x: sourcePoint.x - Math.round(centroid.x),
      y: sourcePoint.y - Math.round(centroid.y),
    };
    console.log('Source point provided:', sourcePoint, '-> offset from centroid:', sourceOffset);
  } else if (!sourceOffset) {
    // No source provided - auto-find one
    const autoSource = findSourcePatch(imageData, Math.round(centroid.x), Math.round(centroid.y), radius * 2);
    sourceOffset = {
      x: autoSource.x - Math.round(centroid.x),
      y: autoSource.y - Math.round(centroid.y),
    };
    console.log('Auto-selected source:', autoSource, 'offset:', sourceOffset);
  }
  
  // Validate source offset - make sure source region is within bounds
  const sourceRegionValid = 
    bounds.minX + sourceOffset.x >= 0 &&
    bounds.maxX + sourceOffset.x < width &&
    bounds.minY + sourceOffset.y >= 0 &&
    bounds.maxY + sourceOffset.y < height;
  
  if (!sourceRegionValid) {
    console.warn('Source region partially outside image bounds, some pixels may be skipped');
  }
  
  // Apply operation
  if (mode === 'clone') {
    applyRegionClone(imageData, mask, sourceOffset, bounds, opacity);
  } else {
    applyRegionHeal(imageData, mask, sourceOffset, bounds, opacity);
  }
  
  console.log(`Applied ${mode} to region:`, bounds);
}

// Legacy compatibility
export function healPatch(imageData: ImageData, patch: HealingPatch, feather: number = 0.3): void {
  paintBrushStroke(imageData, [{ x: patch.targetX, y: patch.targetY }], {
    mode: 'heal',
    sourceOffset: { x: patch.sourceX - patch.targetX, y: patch.sourceY - patch.targetY },
    radius: patch.radius,
    feather,
    opacity: 1.0,
  });
}

export function clonePatch(imageData: ImageData, patch: HealingPatch, feather: number = 0.3, opacity: number = 1.0): void {
  paintBrushStroke(imageData, [{ x: patch.targetX, y: patch.targetY }], {
    mode: 'clone',
    sourceOffset: { x: patch.sourceX - patch.targetX, y: patch.sourceY - patch.targetY },
    radius: patch.radius,
    feather,
    opacity,
  });
}
