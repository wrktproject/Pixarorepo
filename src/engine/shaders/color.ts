/**
 * Color Adjustment Shader
 * Handles temperature, tint, vibrance, and saturation
 */

export const colorVertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
  v_texCoord = a_texCoord;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const colorFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform float u_temperature;   // 2000.0 to 50000.0 Kelvin
uniform float u_tint;          // -150.0 to +150.0
uniform float u_vibrance;      // -100.0 to +100.0
uniform float u_saturation;    // -100.0 to +100.0

out vec4 fragColor;

// Lightroom-style temperature matrices
const vec3 warmMatrix = vec3(1.05, 1.02, 0.95);
const vec3 coolMatrix = vec3(0.95, 1.01, 1.05);

// Tint matrices (magenta/green shift)
const vec3 magentaMatrix = vec3(1.02, 0.98, 1.02);
const vec3 greenMatrix = vec3(0.98, 1.02, 0.98);

// RGB to HSL conversion
vec3 rgbToHSL(vec3 rgb) {
  float maxC = max(max(rgb.r, rgb.g), rgb.b);
  float minC = min(min(rgb.r, rgb.g), rgb.b);
  float delta = maxC - minC;
  
  vec3 hsl;
  hsl.z = (maxC + minC) / 2.0; // Lightness
  
  if (delta == 0.0) {
    hsl.x = 0.0; // Hue
    hsl.y = 0.0; // Saturation
  } else {
    hsl.y = hsl.z < 0.5 
      ? delta / (maxC + minC)
      : delta / (2.0 - maxC - minC);
    
    if (rgb.r == maxC) {
      hsl.x = (rgb.g - rgb.b) / delta + (rgb.g < rgb.b ? 6.0 : 0.0);
    } else if (rgb.g == maxC) {
      hsl.x = (rgb.b - rgb.r) / delta + 2.0;
    } else {
      hsl.x = (rgb.r - rgb.g) / delta + 4.0;
    }
    hsl.x /= 6.0;
  }
  
  return hsl;
}

// Helper for HSL to RGB
float hueToRGB(float p, float q, float t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
  if (t < 1.0/2.0) return q;
  if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
  return p;
}

// HSL to RGB conversion
vec3 hslToRGB(vec3 hsl) {
  if (hsl.y == 0.0) {
    return vec3(hsl.z);
  }
  
  float q = hsl.z < 0.5 
    ? hsl.z * (1.0 + hsl.y)
    : hsl.z + hsl.y - hsl.z * hsl.y;
  float p = 2.0 * hsl.z - q;
  
  vec3 rgb;
  rgb.r = hueToRGB(p, q, hsl.x + 1.0/3.0);
  rgb.g = hueToRGB(p, q, hsl.x);
  rgb.b = hueToRGB(p, q, hsl.x - 1.0/3.0);
  
  return rgb;
}

// Apply temperature (Lightroom-style)
vec3 applyTemperature(vec3 color, float temp) {
  // Normalize to -1..+1 range
  float t = (temp - 6500.0) / 4500.0;
  t = clamp(t, -1.0, 1.0);
  
  // Reduce intensity by 60% for more subtle color shifts
  t *= 0.4;
  
  vec3 tempMatrix = mix(coolMatrix, warmMatrix, (t + 1.0) * 0.5);
  return color * tempMatrix;
}

// Apply tint (magenta/green)
vec3 applyTint(vec3 color, float tint) {
  float t = tint / 150.0; // Normalize to -1..+1
  
  // Reduce intensity by 60% for more subtle color shifts
  t *= 0.4;
  
  vec3 tintMatrix = mix(greenMatrix, magentaMatrix, (t + 1.0) * 0.5);
  return color * tintMatrix;
}

// Apply vibrance (Lightroom-style: boosts muted colors more)
vec3 applyVibrance(vec3 color, float vibrance) {
  vec3 hsl = rgbToHSL(color);
  
  // Reduce intensity by 50% for more subtle adjustments
  float adjustment = (vibrance / 100.0) * 0.5;
  
  // Vibrance boosts low-saturation colors more than high-saturation
  float satBoost = adjustment * (1.0 - hsl.y);
  hsl.y = clamp(hsl.y + satBoost, 0.0, 1.0);
  
  return hslToRGB(hsl);
}

// Apply saturation (uniform boost/reduction)
vec3 applySaturation(vec3 color, float saturation) {
  vec3 hsl = rgbToHSL(color);
  
  // Reduce intensity by 50% for more subtle adjustments
  float adjustment = (saturation / 100.0) * 0.5;
  
  hsl.y = clamp(hsl.y * (1.0 + adjustment), 0.0, 1.0);
  
  return hslToRGB(hsl);
}

void main() {
  vec4 texColor = texture(u_texture, v_texCoord);
  vec3 color = texColor.rgb;
  
  // Apply temperature (warm/cool)
  color = applyTemperature(color, u_temperature);
  
  // Apply tint (magenta/green)
  color = applyTint(color, u_tint);
  
  // Apply vibrance (smart saturation)
  color = applyVibrance(color, u_vibrance);
  
  // Apply saturation (uniform)
  color = applySaturation(color, u_saturation);
  
  // Clamp to valid range
  color = clamp(color, 0.0, 1.0);
  
  fragColor = vec4(color, texColor.a);
}
`;

/**
 * Color adjustment parameters
 */
export interface ColorAdjustments {
  temperature: number;
  tint: number;
  vibrance: number;
  saturation: number;
}

/**
 * Apply color adjustment uniforms to shader program
 */
export function applyColorUniforms(
  gl: WebGL2RenderingContext,
  uniforms: Map<string, WebGLUniformLocation>,
  adjustments: ColorAdjustments
): void {
  const temperatureLocation = uniforms.get('u_temperature');
  if (temperatureLocation) {
    gl.uniform1f(temperatureLocation, adjustments.temperature);
  }

  const tintLocation = uniforms.get('u_tint');
  if (tintLocation) {
    gl.uniform1f(tintLocation, adjustments.tint);
  }

  const vibranceLocation = uniforms.get('u_vibrance');
  if (vibranceLocation) {
    gl.uniform1f(vibranceLocation, adjustments.vibrance);
  }

  const saturationLocation = uniforms.get('u_saturation');
  if (saturationLocation) {
    gl.uniform1f(saturationLocation, adjustments.saturation);
  }
}
