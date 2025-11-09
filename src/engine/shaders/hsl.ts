/**
 * HSL Adjustment Shader
 * Handles selective color adjustments for 8 color channels
 */

export const hslVertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
  v_texCoord = a_texCoord;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const hslFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;

// HSL adjustments for 8 color channels
// Red, Orange, Yellow, Green, Aqua, Blue, Purple, Magenta
uniform vec3 u_red;      // hue, saturation, luminance
uniform vec3 u_orange;
uniform vec3 u_yellow;
uniform vec3 u_green;
uniform vec3 u_aqua;
uniform vec3 u_blue;
uniform vec3 u_purple;
uniform vec3 u_magenta;

out vec4 fragColor;

// RGB to HSL conversion
vec3 rgbToHsl(vec3 rgb) {
  float maxVal = max(max(rgb.r, rgb.g), rgb.b);
  float minVal = min(min(rgb.r, rgb.g), rgb.b);
  float delta = maxVal - minVal;
  
  float h = 0.0;
  float s = 0.0;
  float l = (maxVal + minVal) / 2.0;
  
  if (delta > 0.0001) {
    // Calculate saturation
    if (l < 0.5) {
      s = delta / (maxVal + minVal);
    } else {
      s = delta / (2.0 - maxVal - minVal);
    }
    
    // Calculate hue
    if (rgb.r >= maxVal) {
      h = (rgb.g - rgb.b) / delta;
    } else if (rgb.g >= maxVal) {
      h = 2.0 + (rgb.b - rgb.r) / delta;
    } else {
      h = 4.0 + (rgb.r - rgb.g) / delta;
    }
    
    h /= 6.0;
    if (h < 0.0) h += 1.0;
  }
  
  return vec3(h, s, l);
}

// HSL to RGB conversion
vec3 hslToRgb(vec3 hsl) {
  float h = hsl.x;
  float s = hsl.y;
  float l = hsl.z;
  
  if (s < 0.0001) {
    return vec3(l);
  }
  
  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float p = 2.0 * l - q;
  
  float r = h + 1.0/3.0;
  float g = h;
  float b = h - 1.0/3.0;
  
  if (r < 0.0) r += 1.0;
  if (r > 1.0) r -= 1.0;
  if (g < 0.0) g += 1.0;
  if (g > 1.0) g -= 1.0;
  if (b < 0.0) b += 1.0;
  if (b > 1.0) b -= 1.0;
  
  vec3 rgb;
  
  // Red
  if (r < 1.0/6.0) {
    rgb.r = p + (q - p) * 6.0 * r;
  } else if (r < 0.5) {
    rgb.r = q;
  } else if (r < 2.0/3.0) {
    rgb.r = p + (q - p) * (2.0/3.0 - r) * 6.0;
  } else {
    rgb.r = p;
  }
  
  // Green
  if (g < 1.0/6.0) {
    rgb.g = p + (q - p) * 6.0 * g;
  } else if (g < 0.5) {
    rgb.g = q;
  } else if (g < 2.0/3.0) {
    rgb.g = p + (q - p) * (2.0/3.0 - g) * 6.0;
  } else {
    rgb.g = p;
  }
  
  // Blue
  if (b < 1.0/6.0) {
    rgb.b = p + (q - p) * 6.0 * b;
  } else if (b < 0.5) {
    rgb.b = q;
  } else if (b < 2.0/3.0) {
    rgb.b = p + (q - p) * (2.0/3.0 - b) * 6.0;
  } else {
    rgb.b = p;
  }
  
  return rgb;
}

// Calculate color channel mask based on hue
float getChannelMask(float hue, float targetHue, float range) {
  float dist = abs(hue - targetHue);
  
  // Handle hue wrapping (0 and 1 are the same)
  if (dist > 0.5) {
    dist = 1.0 - dist;
  }
  
  // Smooth falloff
  return smoothstep(range, 0.0, dist);
}

// Apply HSL adjustments for a specific color channel
vec3 applyChannelAdjustment(vec3 hsl, float mask, vec3 adjustment) {
  if (mask < 0.001) {
    return hsl;
  }
  
  // Unpack adjustment (normalized from -100 to +100)
  float hueShift = adjustment.x / 100.0;
  float satAdjust = adjustment.y / 100.0;
  float lumAdjust = adjustment.z / 100.0;
  
  // Apply adjustments with mask
  hsl.x += hueShift * mask * 0.1; // Hue shift (scaled down)
  hsl.y += satAdjust * mask * hsl.y; // Saturation (relative)
  hsl.z += lumAdjust * mask * 0.2; // Luminance (scaled)
  
  // Wrap hue
  if (hsl.x < 0.0) hsl.x += 1.0;
  if (hsl.x > 1.0) hsl.x -= 1.0;
  
  // Clamp saturation and luminance
  hsl.y = clamp(hsl.y, 0.0, 1.0);
  hsl.z = clamp(hsl.z, 0.0, 1.0);
  
  return hsl;
}

void main() {
  vec4 texColor = texture(u_texture, v_texCoord);
  vec3 color = texColor.rgb;
  
  // Convert to HSL
  vec3 hsl = rgbToHsl(color);
  float hue = hsl.x;
  
  // Define hue ranges for each color channel (0-1 range)
  // Red: 0.0 (0°)
  // Orange: 0.083 (30°)
  // Yellow: 0.167 (60°)
  // Green: 0.333 (120°)
  // Aqua: 0.5 (180°)
  // Blue: 0.667 (240°)
  // Purple: 0.75 (270°)
  // Magenta: 0.917 (330°)
  
  float range = 0.1; // Range for each color channel
  
  // Calculate masks for each channel
  float redMask = getChannelMask(hue, 0.0, range);
  float orangeMask = getChannelMask(hue, 0.083, range);
  float yellowMask = getChannelMask(hue, 0.167, range);
  float greenMask = getChannelMask(hue, 0.333, range);
  float aquaMask = getChannelMask(hue, 0.5, range);
  float blueMask = getChannelMask(hue, 0.667, range);
  float purpleMask = getChannelMask(hue, 0.75, range);
  float magentaMask = getChannelMask(hue, 0.917, range);
  
  // Apply adjustments for each channel
  hsl = applyChannelAdjustment(hsl, redMask, u_red);
  hsl = applyChannelAdjustment(hsl, orangeMask, u_orange);
  hsl = applyChannelAdjustment(hsl, yellowMask, u_yellow);
  hsl = applyChannelAdjustment(hsl, greenMask, u_green);
  hsl = applyChannelAdjustment(hsl, aquaMask, u_aqua);
  hsl = applyChannelAdjustment(hsl, blueMask, u_blue);
  hsl = applyChannelAdjustment(hsl, purpleMask, u_purple);
  hsl = applyChannelAdjustment(hsl, magentaMask, u_magenta);
  
  // Convert back to RGB
  color = hslToRgb(hsl);
  
  // Clamp to valid range
  color = clamp(color, 0.0, 1.0);
  
  fragColor = vec4(color, texColor.a);
}
`;

/**
 * HSL adjustment for a single color channel
 */
export interface ChannelAdjustment {
  hue: number;        // -100 to +100
  saturation: number; // -100 to +100
  luminance: number;  // -100 to +100
}

/**
 * HSL adjustments for all 8 color channels
 */
export interface HSLAdjustments {
  red: ChannelAdjustment;
  orange: ChannelAdjustment;
  yellow: ChannelAdjustment;
  green: ChannelAdjustment;
  aqua: ChannelAdjustment;
  blue: ChannelAdjustment;
  purple: ChannelAdjustment;
  magenta: ChannelAdjustment;
}

/**
 * Apply HSL adjustment uniforms to shader program
 */
export function applyHSLUniforms(
  gl: WebGL2RenderingContext,
  uniforms: Map<string, WebGLUniformLocation>,
  adjustments: HSLAdjustments
): void {
  const channels = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'] as const;
  
  for (const channel of channels) {
    const location = uniforms.get(`u_${channel}`);
    if (location) {
      const adj = adjustments[channel];
      gl.uniform3f(location, adj.hue, adj.saturation, adj.luminance);
    }
  }
}
