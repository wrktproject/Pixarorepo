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

// Apply grain effect
vec3 applyGrain(vec3 color, vec2 uv, float amount, float size, float time) {
  if (amount < 0.01) {
    return color;
  }
  
  // Adjust UV based on grain size
  vec2 grainUV = uv;
  
  if (size < 0.5) {
    // Fine grain
    grainUV *= 800.0;
  } else if (size < 1.5) {
    // Medium grain
    grainUV *= 400.0;
  } else {
    // Coarse grain
    grainUV *= 200.0;
  }
  
  // Generate grain noise
  float noise = randomWithTime(floor(grainUV), time);
  
  // Convert to -1 to 1 range
  noise = noise * 2.0 - 1.0;
  
  // Scale by amount
  float normalizedAmount = amount / 100.0;
  noise *= normalizedAmount * 0.15; // Scale down for natural look
  
  // Apply grain
  color += vec3(noise);
  
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

  const timeLocation = uniforms.get('u_time');
  if (timeLocation) {
    gl.uniform1f(timeLocation, time);
  }
}
