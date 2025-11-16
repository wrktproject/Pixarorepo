/**
 * White Balance Shader with Bradford Chromatic Adaptation
 * Implements professional white balance using Bradford transform
 * Based on Darktable's chromatic adaptation module
 */

export const whiteBalanceVertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
  v_texCoord = a_texCoord;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const whiteBalanceFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform float u_temperature;     // Color temperature in Kelvin (2000-25000)
uniform float u_tint;            // Green-magenta shift (-1.0 to 1.0)
uniform bool u_enabled;          // Enable/disable white balance

out vec4 fragColor;

const float EPSILON = 1e-8;

// D65 white point (standard daylight)
const vec3 D65_WHITE = vec3(0.9505, 1.0000, 1.0890);

// ============================================================================
// sRGB <-> Linear RGB Conversions
// ============================================================================

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
// RGB <-> XYZ Conversions
// ============================================================================

vec3 linearRGBToXYZ_D65(vec3 rgb) {
  mat3 matrix = mat3(
    0.4124564, 0.3575761, 0.1804375,
    0.2126729, 0.7151522, 0.0721750,
    0.0193339, 0.1191920, 0.9503041
  );
  return matrix * rgb;
}

vec3 xyzD65ToLinearRGB(vec3 xyz) {
  mat3 matrix = mat3(
     3.2404542, -1.5371385, -0.4985314,
    -0.9692660,  1.8760108,  0.0415560,
     0.0556434, -0.2040259,  1.0572252
  );
  return matrix * xyz;
}

// ============================================================================
// Temperature to XYZ White Point Conversion
// ============================================================================

/**
 * Convert color temperature (Kelvin) to XYZ white point
 * Uses Planckian locus approximation for accurate color temperature
 * Supports range 2000K - 25000K
 */
vec3 temperatureToXYZ(float kelvin) {
  kelvin = clamp(kelvin, 2000.0, 25000.0);
  
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

// ============================================================================
// Bradford Chromatic Adaptation Transform
// ============================================================================

/**
 * Apply Bradford chromatic adaptation transform
 * Industry-standard method for white balance adjustment
 * 
 * @param rgb - Linear RGB color
 * @param sourceWhite - Source white point in XYZ
 * @param targetWhite - Target white point in XYZ
 * @return Adapted linear RGB color
 */
vec3 bradfordAdaptation(vec3 rgb, vec3 sourceWhite, vec3 targetWhite) {
  // Bradford cone response matrix
  mat3 bradford = mat3(
     0.8951000,  0.2664000, -0.1614000,
    -0.7502000,  1.7135000,  0.0367000,
     0.0389000, -0.0685000,  1.0296000
  );
  
  // Inverse Bradford matrix
  mat3 bradfordInv = mat3(
     0.9869929, -0.1470543,  0.1599627,
     0.4323053,  0.5183603,  0.0492912,
    -0.0085287,  0.0400428,  0.9684867
  );
  
  // Convert white points to cone response domain
  vec3 sourceRho = bradford * sourceWhite;
  vec3 targetRho = bradford * targetWhite;
  
  // Build diagonal adaptation matrix
  // Avoid division by zero
  vec3 scale = vec3(
    targetRho.x / max(sourceRho.x, EPSILON),
    targetRho.y / max(sourceRho.y, EPSILON),
    targetRho.z / max(sourceRho.z, EPSILON)
  );
  
  mat3 adapt = mat3(
    scale.x, 0.0, 0.0,
    0.0, scale.y, 0.0,
    0.0, 0.0, scale.z
  );
  
  // Apply adaptation: RGB -> XYZ -> Cone -> Adapt -> Cone -> XYZ -> RGB
  vec3 xyz = linearRGBToXYZ_D65(rgb);
  vec3 coneResponse = bradford * xyz;
  vec3 adaptedCone = adapt * coneResponse;
  vec3 adaptedXYZ = bradfordInv * adaptedCone;
  
  return xyzD65ToLinearRGB(adaptedXYZ);
}

/**
 * Apply tint adjustment (green-magenta shift)
 * Modifies the white point along the green-magenta axis
 * 
 * @param whitePoint - Base white point in XYZ
 * @param tint - Tint amount (-1.0 to 1.0)
 * @return Adjusted white point
 */
vec3 applyTint(vec3 whitePoint, float tint) {
  // Tint shifts the Y component (green-magenta axis)
  // Positive tint = more green, negative tint = more magenta
  float tintScale = 1.0 + tint * 0.15;
  
  return vec3(
    whitePoint.x,
    whitePoint.y * tintScale,
    whitePoint.z
  );
}

/**
 * Apply white balance with temperature and tint
 * Complete white balance adjustment pipeline
 */
vec3 applyWhiteBalance(vec3 rgb, float temperature, float tint) {
  // Calculate target white point from temperature
  vec3 targetWhite = temperatureToXYZ(temperature);
  
  // Apply tint adjustment
  targetWhite = applyTint(targetWhite, tint);
  
  // Apply Bradford chromatic adaptation
  // Source is D65 (standard daylight), target is user-specified
  return bradfordAdaptation(rgb, D65_WHITE, targetWhite);
}

void main() {
  vec4 texColor = texture(u_texture, v_texCoord);
  vec3 color = texColor.rgb;
  
  if (u_enabled) {
    // Convert to linear space for accurate white balance
    color = srgbToLinear(color);
    
    // Apply white balance with Bradford adaptation
    color = applyWhiteBalance(color, u_temperature, u_tint);
    
    // Clamp to valid range (allow values > 1.0 for HDR pipeline)
    color = max(color, vec3(0.0));
    
    // IMPORTANT: Keep in Linear space! Output shader will convert to sRGB
  }
  
  fragColor = vec4(color, texColor.a);
}
`;


/**
 * White balance adjustment parameters
 */
export interface WhiteBalanceParams {
  temperature: number;  // Color temperature in Kelvin (2000-25000)
  tint: number;         // Green-magenta shift (-1.0 to 1.0)
  enabled: boolean;     // Enable/disable white balance
}

/**
 * Default white balance parameters
 */
export const defaultWhiteBalanceParams: WhiteBalanceParams = {
  temperature: 6500,  // D65 daylight
  tint: 0.0,
  enabled: true,
};

/**
 * Preset illuminants for common lighting conditions
 */
export const WhiteBalancePresets = {
  daylight: { temperature: 6500, tint: 0.0, name: 'Daylight (D65)' },
  cloudy: { temperature: 7500, tint: 0.0, name: 'Cloudy' },
  shade: { temperature: 8000, tint: 0.0, name: 'Shade' },
  tungsten: { temperature: 3200, tint: 0.0, name: 'Tungsten' },
  fluorescent: { temperature: 4000, tint: 0.15, name: 'Fluorescent' },
  flash: { temperature: 5500, tint: 0.0, name: 'Flash' },
  auto: { temperature: 6500, tint: 0.0, name: 'Auto' },
} as const;

/**
 * Apply white balance uniforms to shader program
 */
export function applyWhiteBalanceUniforms(
  gl: WebGL2RenderingContext,
  uniforms: Map<string, WebGLUniformLocation>,
  params: WhiteBalanceParams
): void {
  const temperatureLocation = uniforms.get('u_temperature');
  if (temperatureLocation) {
    gl.uniform1f(temperatureLocation, params.temperature);
  }

  const tintLocation = uniforms.get('u_tint');
  if (tintLocation) {
    gl.uniform1f(tintLocation, params.tint);
  }

  const enabledLocation = uniforms.get('u_enabled');
  if (enabledLocation) {
    gl.uniform1i(enabledLocation, params.enabled ? 1 : 0);
  }
}
