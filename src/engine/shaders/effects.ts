/**
 * Effects Shader
 * Handles vignette and grain effects
 */

export const effectsVertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
  v_texCoord = a_texCoord;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const effectsFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform float u_vignetteAmount;   // -100.0 to +100.0
uniform float u_vignetteMidpoint; // 0.0 to 100.0
uniform float u_vignetteFeather;  // 0.0 to 100.0
uniform float u_grainAmount;      // 0.0 to 100.0
uniform float u_grainSize;        // 0: fine, 1: medium, 2: coarse
uniform float u_grainRoughness;   // 0.0 to 100.0 (clumping)
uniform float u_time;             // For grain randomness

out vec4 fragColor;

// Random number generator
float random(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

// Improved random with time
float randomWithTime(vec2 co, float time) {
  return fract(sin(dot(co + time, vec2(12.9898, 78.233))) * 43758.5453);
}

// Apply vignette effect
vec3 applyVignette(vec3 color, vec2 uv, float amount, float midpoint, float feather) {
  if (abs(amount) < 0.01) {
    return color;
  }
  
  // Calculate distance from center
  vec2 center = vec2(0.5, 0.5);
  vec2 diff = uv - center;
  
  // Adjust for aspect ratio (assuming square for simplicity)
  float dist = length(diff);
  
  // Normalize parameters
  float normalizedMidpoint = midpoint / 100.0;
  float normalizedFeather = max(feather / 100.0, 0.01);
  float normalizedAmount = amount / 100.0;
  
  // Calculate vignette mask
  float vignette = smoothstep(
    normalizedMidpoint,
    normalizedMidpoint + normalizedFeather,
    dist
  );
  
  // Apply vignette
  if (normalizedAmount > 0.0) {
    // Darken edges
    color *= 1.0 - vignette * normalizedAmount;
  } else {
    // Lighten edges (inverse vignette)
    color += vignette * abs(normalizedAmount);
  }
  
  return color;
}

// Apply realistic film grain (Lightroom-quality)
vec3 applyGrain(vec3 color, vec2 uv, float amount, float size, float roughness, float time) {
  if (amount < 0.01) {
    return color;
  }
  
  // Step 1 & 2: Generate base noise scaled by grain size
  float grainScale;
  if (size < 0.5) {
    grainScale = 800.0; // Fine grain
  } else if (size < 1.5) {
    grainScale = 400.0; // Medium grain
  } else {
    grainScale = 200.0; // Coarse grain
  }
  
  vec2 grainUV = uv * grainScale;
  
  // Primary noise layer
  float noise1 = randomWithTime(floor(grainUV), time);
  
  // Step 4: Add roughness (clumping) with second noise layer at different frequency
  float noise2 = randomWithTime(floor(grainUV * 0.5), time);
  float normalizedRoughness = roughness / 100.0;
  float roughNoise = mix(noise1, noise2, normalizedRoughness);
  
  // Step 3: Modulate by luminance (more grain in shadows, less in highlights)
  float lum = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
  float lumFactor = pow(1.0 - lum, 0.7); // More grain in dark areas
  
  // Step 5: Center noise around 0 and multiply by amount
  float normalizedAmount = amount / 100.0;
  float grain = (roughNoise - 0.5) * normalizedAmount * 0.25;
  
  // Step 6: Add grain to image (additive, modulated by luminance)
  color.rgb += grain * lumFactor;
  
  return color;
}

void main() {
  vec4 texColor = texture(u_texture, v_texCoord);
  vec3 color = texColor.rgb;
  
  // Apply vignette
  color = applyVignette(
    color,
    v_texCoord,
    u_vignetteAmount,
    u_vignetteMidpoint,
    u_vignetteFeather
  );
  
  // Apply grain
  color = applyGrain(
    color,
    v_texCoord,
    u_grainAmount,
    u_grainSize,
    u_grainRoughness,
    u_time
  );
  
  // Clamp to valid range
  color = clamp(color, 0.0, 1.0);
  
  fragColor = vec4(color, texColor.a);
}
`;

/**
 * Effects adjustment parameters
 */
export interface EffectsAdjustments {
  vignette: {
    amount: number;   // -100 to +100
    midpoint: number; // 0 to 100
    feather: number;  // 0 to 100
  };
  grain: {
    amount: number;   // 0 to 100
    size: 'fine' | 'medium' | 'coarse';
    roughness: number; // 0 to 100
  };
}

/**
 * Convert grain size to numeric value
 */
function grainSizeToNumber(size: 'fine' | 'medium' | 'coarse'): number {
  switch (size) {
    case 'fine':
      return 0.0;
    case 'medium':
      return 1.0;
    case 'coarse':
      return 2.0;
  }
}

/**
 * Apply effects adjustment uniforms to shader program
 */
export function applyEffectsUniforms(
  gl: WebGL2RenderingContext,
  uniforms: Map<string, WebGLUniformLocation>,
  adjustments: EffectsAdjustments,
  time: number = 0
): void {
  const vignetteAmountLocation = uniforms.get('u_vignetteAmount');
  if (vignetteAmountLocation) {
    gl.uniform1f(vignetteAmountLocation, adjustments.vignette.amount);
  }

  const vignetteMidpointLocation = uniforms.get('u_vignetteMidpoint');
  if (vignetteMidpointLocation) {
    gl.uniform1f(vignetteMidpointLocation, adjustments.vignette.midpoint);
  }

  const vignetteFeatherLocation = uniforms.get('u_vignetteFeather');
  if (vignetteFeatherLocation) {
    gl.uniform1f(vignetteFeatherLocation, adjustments.vignette.feather);
  }

  const grainAmountLocation = uniforms.get('u_grainAmount');
  if (grainAmountLocation) {
    gl.uniform1f(grainAmountLocation, adjustments.grain.amount);
  }

  const grainSizeLocation = uniforms.get('u_grainSize');
  if (grainSizeLocation) {
    gl.uniform1f(grainSizeLocation, grainSizeToNumber(adjustments.grain.size));
  }

  const grainRoughnessLocation = uniforms.get('u_grainRoughness');
  if (grainRoughnessLocation) {
    gl.uniform1f(grainRoughnessLocation, adjustments.grain.roughness);
  }

  const timeLocation = uniforms.get('u_time');
  if (timeLocation) {
    gl.uniform1f(timeLocation, time);
  }
}
