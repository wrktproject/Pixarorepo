/**
 * Healing Brush Implementation
 * Lightroom-style content-aware healing without external dependencies
 */

export interface HealingMask {
  x: number;
  y: number;
  radius: number;
  feather: number; // 0-1, amount of edge softness
}

export interface HealingPatch {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  radius: number;
}

/**
 * Create a circular mask with soft falloff (Gaussian-like)
 */
function createCircularMask(radius: number, feather: number): Float32Array {
  const size = radius * 2 + 1;
  const mask = new Float32Array(size * size);
  const center = radius;
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > radius) {
        mask[y * size + x] = 0;
      } else {
        // Smooth falloff from center to edge
        const normalizedDist = dist / radius;
        const falloffStart = 1 - feather;
        
        if (normalizedDist < falloffStart) {
          mask[y * size + x] = 1;
        } else {
          // Smooth cubic falloff in the feather region
          const t = (normalizedDist - falloffStart) / feather;
          mask[y * size + x] = 1 - t * t * (3 - 2 * t); // Smoothstep
        }
      }
    }
  }
  
  return mask;
}

/**
 * Calculate luminance of an RGB pixel
 */
function getLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Find a good source patch automatically
 * Looks for nearby areas with similar texture/luminance
 */
export function findSourcePatch(
  imageData: ImageData,
  targetX: number,
  targetY: number,
  radius: number
): { x: number; y: number } {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  
  // Calculate target patch average luminance
  let targetLum = 0;
  let count = 0;
  
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      const px = targetX + x;
      const py = targetY + y;
      
      if (px < 0 || px >= width || py < 0 || py >= height) continue;
      if (x * x + y * y > radius * radius) continue;
      
      const idx = (py * width + px) * 4;
      targetLum += getLuminance(data[idx], data[idx + 1], data[idx + 2]);
      count++;
    }
  }
  targetLum /= count;
  
  // Search in a ring around the target (not too close, not too far)
  const searchRadius = radius * 4;
  const minDist = radius * 2;
  let bestX = targetX + minDist;
  let bestY = targetY;
  let bestScore = Infinity;
  
  const searchStep = Math.max(2, Math.floor(radius / 2));
  
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
    for (let dist = minDist; dist < searchRadius; dist += searchStep) {
      const sx = Math.round(targetX + Math.cos(angle) * dist);
      const sy = Math.round(targetY + Math.sin(angle) * dist);
      
      if (sx - radius < 0 || sx + radius >= width) continue;
      if (sy - radius < 0 || sy + radius >= height) continue;
      
      // Calculate source patch luminance
      let sourceLum = 0;
      let sourceCount = 0;
      
      for (let y = -radius; y <= radius; y++) {
        for (let x = -radius; x <= radius; x++) {
          if (x * x + y * y > radius * radius) continue;
          
          const idx = ((sy + y) * width + (sx + x)) * 4;
          sourceLum += getLuminance(data[idx], data[idx + 1], data[idx + 2]);
          sourceCount++;
        }
      }
      sourceLum /= sourceCount;
      
      // Score based on luminance similarity
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
 * Perform healing brush operation (Lightroom-style)
 * Copies texture from source but matches color/tone to target
 * 
 * Algorithm:
 * 1. Calculate mean RGB for both source and target patches
 * 2. Extract texture: texture = source_pixel - source_mean
 * 3. Recolor texture: healed_pixel = target_mean + texture
 * 4. Blend with mask weight for smooth edges
 */
export function healPatch(
  imageData: ImageData,
  patch: HealingPatch,
  feather: number = 0.3
): void {
  const { sourceX, sourceY, targetX, targetY, radius } = patch;
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  
  // Create circular mask with soft edges
  const maskSize = radius * 2 + 1;
  const mask = createCircularMask(radius, feather);
  
  // Calculate average RGB color for source and target patches
  const sourceMean = [0, 0, 0]; // R, G, B
  const targetMean = [0, 0, 0]; // R, G, B
  let maskSum = 0;
  
  for (let y = 0; y < maskSize; y++) {
    for (let x = 0; x < maskSize; x++) {
      const maskWeight = mask[y * maskSize + x];
      if (maskWeight === 0) continue;
      
      const sx = sourceX - radius + x;
      const sy = sourceY - radius + y;
      const tx = targetX - radius + x;
      const ty = targetY - radius + y;
      
      if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;
      if (tx < 0 || tx >= width || ty < 0 || ty >= height) continue;
      
      const sIdx = (sy * width + sx) * 4;
      const tIdx = (ty * width + tx) * 4;
      
      // Accumulate weighted RGB sums
      for (let c = 0; c < 3; c++) {
        sourceMean[c] += data[sIdx + c] * maskWeight;
        targetMean[c] += data[tIdx + c] * maskWeight;
      }
      maskSum += maskWeight;
    }
  }
  
  // Calculate average colors
  for (let c = 0; c < 3; c++) {
    sourceMean[c] /= maskSum;
    targetMean[c] /= maskSum;
  }
  
  // Apply healing: copy texture from source but recolor to match target
  for (let y = 0; y < maskSize; y++) {
    for (let x = 0; x < maskSize; x++) {
      const maskWeight = mask[y * maskSize + x];
      if (maskWeight === 0) continue;
      
      const sx = sourceX - radius + x;
      const sy = sourceY - radius + y;
      const tx = targetX - radius + x;
      const ty = targetY - radius + y;
      
      if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;
      if (tx < 0 || tx >= width || ty < 0 || ty >= height) continue;
      
      const sIdx = (sy * width + sx) * 4;
      const tIdx = (ty * width + tx) * 4;
      
      // For each RGB channel:
      // 1. Extract texture (high-frequency detail) from source
      // 2. Recolor it using target's mean color (tone/lighting)
      // 3. Blend into target with mask weight
      for (let c = 0; c < 3; c++) {
        const sourceTexture = data[sIdx + c] - sourceMean[c];
        const healedValue = targetMean[c] + sourceTexture;
        const clampedValue = Math.max(0, Math.min(255, healedValue));
        data[tIdx + c] = data[tIdx + c] * (1 - maskWeight) + clampedValue * maskWeight;
      }
    }
  }
}

/**
 * Perform clone stamp operation (exact copy without blending)
 */
export function clonePatch(
  imageData: ImageData,
  patch: HealingPatch,
  feather: number = 0.3
): void {
  const { sourceX, sourceY, targetX, targetY, radius } = patch;
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  
  const maskSize = radius * 2 + 1;
  const mask = createCircularMask(radius, feather);
  
  for (let y = 0; y < maskSize; y++) {
    for (let x = 0; x < maskSize; x++) {
      const maskWeight = mask[y * maskSize + x];
      if (maskWeight === 0) continue;
      
      const sx = sourceX - radius + x;
      const sy = sourceY - radius + y;
      const tx = targetX - radius + x;
      const ty = targetY - radius + y;
      
      if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;
      if (tx < 0 || tx >= width || ty < 0 || ty >= height) continue;
      
      const sIdx = (sy * width + sx) * 4;
      const tIdx = (ty * width + tx) * 4;
      
      // Copy with mask blending
      for (let c = 0; c < 4; c++) {
        data[tIdx + c] = data[tIdx + c] * (1 - maskWeight) + data[sIdx + c] * maskWeight;
      }
    }
  }
}
