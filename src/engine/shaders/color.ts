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

// ============================================================================
// Color Space Conversions
// ============================================================================

// Accurate sRGB to Linear conversion
vec3 srgbToLinear(vec3 srgb) {
  vec3 linear;
  for (int i = 0; i < 3; i++) {
    if (srgb[i] <= 0.04045) {
      linear[i] = srgb[i] / 12.92;
    } else {
      linear[i] = pow((srgb[i] + 0.055) / 1.055, 2.4);
    }
  }
  return linear;
}

// Accurate Linear to sRGB conversion
vec3 linearToSrgb(vec3 linear) {
  vec3 srgb;
  for (int i = 0; i < 3; i++) {
    if (linear[i] <= 0.0031308) {
      srgb[i] = linear[i] * 12.92;
    } else {
      srgb[i] = 1.055 * pow(linear[i], 1.0 / 2.4) - 0.055;
    }
  }
  return srgb;
}

// ============================================================================
// Bradford Chromatic Adaptation (Professional White Balance)
// ============================================================================

const float EPSILON = 1e-8;

// D65 white point (standard daylight)
const vec3 D65_WHITE = vec3(0.9505, 1.0000, 1.0890);

// Bradford cone response matrix
const mat3 bradford = mat3(
   0.8951000,  0.2664000, -0.1614000,
  -0.7502000,  1.7135000,  0.0367000,
   0.0389000, -0.0685000,  1.0296000
);

// Inverse Bradford matrix
const mat3 bradfordInv = mat3(
   0.9869929, -0.1470543,  0.1599627,
   0.4323053,  0.5183603,  0.0492912,
  -0.0085287,  0.0400428,  0.9684867
);

// RGB <-> XYZ conversion matrices
const mat3 rgbToXYZ = mat3(
  0.4124564, 0.3575761, 0.1804375,
  0.2126729, 0.7151522, 0.0721750,
  0.0193339, 0.1191920, 0.9503041
);

const mat3 xyzToRGB = mat3(
   3.2404542, -1.5371385, -0.4985314,
  -0.9692660,  1.8760108,  0.0415560,
   0.0556434, -0.2040259,  1.0572252
);

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

/**
 * Convert color temperature (Kelvin) to XYZ white point
 * Uses Planckian locus approximation
 * Limited to practical photographic range for stability
 */
vec3 temperatureToXYZ(float kelvin) {
  // Limit to practical range for better numerical stability
  kelvin = clamp(kelvin, 2500.0, 25000.0);
  
  float x, y;
  
  // Calculate chromaticity x coordinate
  if (kelvin < 4000.0) {
    x = -0.2661239e9 / pow(kelvin, 3.0) 
        - 0.2343589e6 / pow(kelvin, 2.0) 
        + 0.8776956e3 / kelvin + 0.179910;
  } else {
    x = -3.0258469e9 / pow(kelvin, 3.0) 
        + 2.1070379e6 / pow(kelvin, 2.0) 
        + 0.2226347e3 / kelvin + 0.240390;
  }
  
  // Calculate chromaticity y coordinate
  if (kelvin < 2222.0) {
    y = -1.1063814 * pow(x, 3.0) 
        - 1.34811020 * pow(x, 2.0) 
        + 2.18555832 * x - 0.20219683;
  } else if (kelvin < 4000.0) {
    y = -0.9549476 * pow(x, 3.0) 
        - 1.37418593 * pow(x, 2.0) 
        + 2.09137015 * x - 0.16748867;
  } else {
    y = 3.0817580 * pow(x, 3.0) 
        - 5.87338670 * pow(x, 2.0) 
        + 3.75112997 * x - 0.37001483;
  }
  
  // Convert xy chromaticity to XYZ (Y = 1.0)
  float Y = 1.0;
  float X = (Y / y) * x;
  float Z = (Y / y) * (1.0 - x - y);
  
  return vec3(X, Y, Z);
}

/**
 * Apply Bradford chromatic adaptation transform
 * This is the industry-standard method for white balance
 */
vec3 bradfordAdaptation(vec3 rgb, vec3 sourceWhite, vec3 targetWhite) {
  // Convert white points to cone response domain
  vec3 sourceRho = bradford * sourceWhite;
  vec3 targetRho = bradford * targetWhite;
  
  // Build diagonal adaptation matrix with clamping to prevent extreme values
  // Clamp scale factors to reasonable range (0.33 to 3.0) for stability
  vec3 scale = vec3(
    clamp(targetRho.x / max(sourceRho.x, EPSILON), 0.33, 3.0),
    clamp(targetRho.y / max(sourceRho.y, EPSILON), 0.33, 3.0),
    clamp(targetRho.z / max(sourceRho.z, EPSILON), 0.33, 3.0)
  );
  
  mat3 adapt = mat3(
    scale.x, 0.0, 0.0,
    0.0, scale.y, 0.0,
    0.0, 0.0, scale.z
  );
  
  // Apply adaptation: RGB -> XYZ -> Cone -> Adapt -> Cone^-1 -> XYZ -> RGB
  vec3 xyz = rgbToXYZ * rgb;
  vec3 coneResponse = bradford * xyz;
  vec3 adaptedCone = adapt * coneResponse;
  vec3 adaptedXYZ = bradfordInv * adaptedCone;
  vec3 adaptedRGB = xyzToRGB * adaptedXYZ;
  
  // Clamp output to prevent extreme values (allow some HDR headroom)
  return clamp(adaptedRGB, vec3(0.0), vec3(3.0));
}

/**
 * Apply tint adjustment (green-magenta shift)
 */
vec3 applyTintToWhitePoint(vec3 whitePoint, float tint) {
  // Tint shifts the Y component (green-magenta axis)
  float tintScale = 1.0 + tint * 0.15;
  return vec3(whitePoint.x, whitePoint.y * tintScale, whitePoint.z);
}

/**
 * Apply temperature and tint using simple RGB channel shifts
 * This method is simple, fast, and visually pleasing
 * Temperature range: 2000K (cool/blue) to 50000K (warm/orange)
 * Tint range: -150 (green) to +150 (magenta)
 */

vec3 applyTemperatureAndTint(vec3 linearColor, float temperature, float tint) {
  // Skip if at default D65 (6500K) with no tint
  if (abs(temperature - 6500.0) < 10.0 && abs(tint) < 0.01) {
    return linearColor;
  }
  
  // Normalize temperature: -1 (cool/2500K) to +1 (warm/25000K), centered at 6500K
  float tempNorm = (temperature - 6500.0) / 4000.0;
  tempNorm = clamp(tempNorm, -1.0, 1.0);
  
  // Normalize tint: -1 (green) to +1 (magenta)
  float tintNorm = tint / 150.0;
  
  // Apply temperature as RGB channel adjustments
  vec3 result = linearColor;
  
  if (tempNorm < 0.0) {
    // Cool (blue) temperature: boost blue, reduce red/green
    float cool = -tempNorm;  // 0 to 1
    result.r *= 1.0 - cool * 0.5;  // Reduce red significantly
    result.g *= 1.0 - cool * 0.2;  // Slight reduce green
    result.b *= 1.0 + cool * 0.8;  // Boost blue significantly
  } else {
    // Warm (orange) temperature: boost red/green, reduce blue
    float warm = tempNorm;  // 0 to 1
    result.r *= 1.0 + warm * 0.6;  // Boost red
    result.g *= 1.0 + warm * 0.2;  // Slightly boost green (yellow)
    result.b *= 1.0 - warm * 0.5;  // Reduce blue
  }
  
  // Apply tint (green-magenta axis)
  if (tintNorm > 0.0) {
    // Magenta tint: boost red+blue, reduce green
    result.r *= 1.0 + tintNorm * 0.15;
    result.g *= 1.0 - tintNorm * 0.25;
    result.b *= 1.0 + tintNorm * 0.15;
  } else {
    // Green tint: boost green, reduce red+blue
    float greenTint = -tintNorm;
    result.g *= 1.0 + greenTint * 0.25;
    result.r *= 1.0 - greenTint * 0.1;
    result.b *= 1.0 - greenTint * 0.1;
  }
  
  // Clamp to valid range
  result = max(result, vec3(0.0));
  
  return result;
}

// Apply vibrance (smart saturation: boosts muted colors more)
vec3 applyVibrance(vec3 color, float vibrance) {
  vec3 hsl = rgbToHSL(color);
  
  // Vibrance affects muted colors more than saturated colors
  // At -100: fully desaturate, at +100: add up to +1.0 saturation to muted colors
  float adjustment = vibrance / 100.0;
  
  // Vibrance boosts low-saturation colors more than high-saturation
  // The (1.0 - hsl.y) factor means already-saturated colors are protected
  float satBoost = adjustment * (1.0 - hsl.y);
  hsl.y = clamp(hsl.y + satBoost, 0.0, 1.0);
  
  return hslToRGB(hsl);
}

// Apply saturation (Lightroom-style uniform boost/reduction)
vec3 applySaturation(vec3 color, float saturation) {
  vec3 hsl = rgbToHSL(color);
  
  // Direct mapping: -100 = fully desaturated (B&W), +100 = 2x saturation
  // At -100: adjustment = -1.0, so hsl.y * (1.0 + -1.0) = hsl.y * 0.0 = 0 (B&W) ✓
  // At 0: adjustment = 0.0, so hsl.y * 1.0 = hsl.y (unchanged) ✓
  // At +100: adjustment = +1.0, so hsl.y * 2.0 (doubled saturation) ✓
  float adjustment = saturation / 100.0;
  
  hsl.y = clamp(hsl.y * (1.0 + adjustment), 0.0, 1.0);
  
  return hslToRGB(hsl);
}

void main() {
  vec4 texColor = texture(u_texture, v_texCoord);
  vec3 color = texColor.rgb;
  
  // Input is LINEAR RGB from tonal shader
  // Apply temperature and tint with Bradford chromatic adaptation (stays in linear)
  color = applyTemperatureAndTint(color, u_temperature, u_tint);
  
  // Apply perceptual adjustments (vibrance/saturation)
  // Only convert to sRGB if we actually need to apply these adjustments
  if (abs(u_vibrance) > 0.01 || abs(u_saturation) > 0.01) {
    // Convert to sRGB for perceptual adjustments
    vec3 srgbColor = linearToSrgb(color);
    
    // Apply adjustments in sRGB space
    srgbColor = applyVibrance(srgbColor, u_vibrance);
    srgbColor = applySaturation(srgbColor, u_saturation);
    
    // Convert back to linear
    color = srgbToLinear(srgbColor);
  }
  
  // Clamp to valid range (allow HDR values > 1.0)
  color = max(color, vec3(0.0));
  
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
