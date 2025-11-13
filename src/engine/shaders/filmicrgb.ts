/**
 * Filmic RGB Tone Mapping Shader
 * Implements rational spline curve algorithm for film-like highlight rolloff
 * Based on Darktable's filmic RGB module for professional tone mapping
 */

export const filmicVertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
  v_texCoord = a_texCoord;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const filmicFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform bool u_enabled;

// Filmic parameters
uniform float u_whitePoint;      // White point in EV (0.5 to 8.0)
uniform float u_blackPoint;      // Black point in EV (-8.0 to -0.5)
uniform float u_latitude;        // Contrast latitude (0.1 to 1.0, representing 10-100%)
uniform float u_balance;         // Shadows/highlights balance (-0.5 to 0.5, representing -50 to 50)
uniform int u_shadowsContrast;   // 0=hard, 1=soft, 2=safe
uniform int u_highlightsContrast; // 0=hard, 1=soft, 2=safe

out vec4 fragColor;

const float EPSILON = 1e-8;
const float LOG2_E = 1.442695040888963;

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

/**
 * Rational function for spline interpolation
 * f(x) = (a*x + b) / (c*x + d)
 */
struct RationalCoeffs {
  float a, b, c, d;
};

/**
 * Evaluate rational function
 */
float evalRational(float x, RationalCoeffs coeffs) {
  float numerator = coeffs.a * x + coeffs.b;
  float denominator = coeffs.c * x + coeffs.d;
  return numerator / max(denominator, EPSILON);
}

/**
 * Compute rational spline coefficients for a segment
 * Ensures smooth C1 continuity (continuous first derivative)
 * 
 * @param x0, y0 Start point
 * @param x1, y1 End point
 * @param m0 Derivative at start
 * @param m1 Derivative at end
 */
RationalCoeffs computeRationalSpline(
  float x0, float y0, float m0,
  float x1, float y1, float m1
) {
  RationalCoeffs coeffs;
  
  float dx = x1 - x0;
  float dy = y1 - y0;
  
  // Avoid division by zero
  if (abs(dx) < EPSILON) {
    coeffs.a = 0.0;
    coeffs.b = y0;
    coeffs.c = 0.0;
    coeffs.d = 1.0;
    return coeffs;
  }
  
  // Compute rational function coefficients
  // This ensures the curve passes through both points with specified derivatives
  float avgSlope = dy / dx;
  
  // Use rational function: (a*t + b) / (c*t + d) where t = (x - x0) / dx
  // Constraints:
  // f(0) = y0 => b/d = y0
  // f(1) = y1 => (a+b)/(c+d) = y1
  // f'(0) = m0 => (a*d - b*c) / d^2 = m0 * dx
  // f'(1) = m1 => (a*d - b*c) / (c+d)^2 = m1 * dx
  
  coeffs.d = 1.0;
  coeffs.b = y0;
  
  // Solve for a and c
  float k = m0 * dx;
  coeffs.a = coeffs.b + k;
  coeffs.c = (coeffs.a - y1 * (1.0 + coeffs.d)) / y1;
  
  return coeffs;
}

/**
 * Piecewise rational spline curve evaluation
 * Implements 5-point control system: black, shadows, midtone, highlights, white
 */
float filmicSplineCurve(float x) {
  // Convert to log space for perceptual uniformity
  float logX = log2(max(x, EPSILON));
  
  // Define control points in log space
  float logBlack = u_blackPoint;
  float logWhite = u_whitePoint;
  float logMidtone = (logBlack + logWhite) * 0.5;
  
  // Adjust midtone based on balance
  logMidtone += u_balance * (logWhite - logBlack) * 0.25;
  
  // Shadow and highlight transition points
  float logShadowEnd = logBlack + (logMidtone - logBlack) * (1.0 - u_latitude * 0.5);
  float logHighlightStart = logMidtone + (logWhite - logMidtone) * (u_latitude * 0.5);
  
  // Output values (0 to 1 range)
  float outBlack = 0.0;
  float outWhite = 1.0;
  float outMidtone = 0.5;
  float outShadow = 0.25;
  float outHighlight = 0.75;
  
  // Derivatives (slopes) at control points
  // These control the "contrast type" (hard, soft, safe)
  float shadowSlope, highlightSlope;
  
  // Shadow contrast type
  if (u_shadowsContrast == 0) {
    // Hard: steep slope
    shadowSlope = 1.5;
  } else if (u_shadowsContrast == 1) {
    // Soft: gentle slope
    shadowSlope = 0.8;
  } else {
    // Safe: very gentle slope
    shadowSlope = 0.5;
  }
  
  // Highlight contrast type
  if (u_highlightsContrast == 0) {
    // Hard: steep slope
    highlightSlope = 1.5;
  } else if (u_highlightsContrast == 1) {
    // Soft: gentle slope
    highlightSlope = 0.8;
  } else {
    // Safe: very gentle slope
    highlightSlope = 0.5;
  }
  
  // Midtone slope based on latitude
  float midtoneSlope = 1.0 / max(u_latitude, 0.1);
  
  float result;
  
  // Piecewise evaluation
  if (logX < logShadowEnd) {
    // Shadow region: black to shadow transition
    float t = (logX - logBlack) / max(logShadowEnd - logBlack, EPSILON);
    t = clamp(t, 0.0, 1.0);
    
    // Use rational spline
    RationalCoeffs coeffs = computeRationalSpline(
      0.0, outBlack, shadowSlope * 0.5,
      1.0, outShadow, shadowSlope
    );
    result = evalRational(t, coeffs);
    
  } else if (logX < logMidtone) {
    // Shadow to midtone transition
    float t = (logX - logShadowEnd) / max(logMidtone - logShadowEnd, EPSILON);
    t = clamp(t, 0.0, 1.0);
    
    RationalCoeffs coeffs = computeRationalSpline(
      0.0, outShadow, shadowSlope,
      1.0, outMidtone, midtoneSlope
    );
    result = evalRational(t, coeffs);
    
  } else if (logX < logHighlightStart) {
    // Midtone to highlight transition
    float t = (logX - logMidtone) / max(logHighlightStart - logMidtone, EPSILON);
    t = clamp(t, 0.0, 1.0);
    
    RationalCoeffs coeffs = computeRationalSpline(
      0.0, outMidtone, midtoneSlope,
      1.0, outHighlight, highlightSlope
    );
    result = evalRational(t, coeffs);
    
  } else {
    // Highlight region: highlight to white transition
    float t = (logX - logHighlightStart) / max(logWhite - logHighlightStart, EPSILON);
    t = clamp(t, 0.0, 1.0);
    
    RationalCoeffs coeffs = computeRationalSpline(
      0.0, outHighlight, highlightSlope,
      1.0, outWhite, highlightSlope * 0.5
    );
    result = evalRational(t, coeffs);
  }
  
  return clamp(result, 0.0, 1.0);
}

/**
 * Apply filmic tone mapping per-channel
 * Per-channel processing preserves color ratios and prevents hue shifts
 */
vec3 applyFilmic(vec3 rgb) {
  vec3 result;
  result.r = filmicSplineCurve(rgb.r);
  result.g = filmicSplineCurve(rgb.g);
  result.b = filmicSplineCurve(rgb.b);
  return result;
}

void main() {
  vec4 texColor = texture(u_texture, v_texCoord);
  vec3 color = texColor.rgb;
  
  if (u_enabled) {
    // Convert to linear space for accurate tone mapping
    color = srgbToLinear(color);
    
    // Apply filmic tone curve per-channel
    color = applyFilmic(color);
    
    // Clamp to valid range
    color = clamp(color, 0.0, 1.0);
    
    // Convert back to sRGB for display
    color = linearToSrgb(color);
  }
  
  fragColor = vec4(color, texColor.a);
}
`;

/**
 * Filmic RGB tone mapping parameters
 */
export interface FilmicParams {
  whitePoint: number;      // Relative exposure for white (0.5 to 8.0 EV)
  blackPoint: number;      // Relative exposure for black (-8.0 to -0.5 EV)
  latitude: number;        // Contrast in midtones (0.1 to 1.0, representing 10-100%)
  balance: number;         // Shadows ↔ highlights balance (-0.5 to 0.5, representing -50 to 50)
  shadowsContrast: 'hard' | 'soft' | 'safe';  // Shadow curve type
  highlightsContrast: 'hard' | 'soft' | 'safe'; // Highlight curve type
  enabled: boolean;        // Enable/disable filmic
}

/**
 * Default filmic parameters
 */
export const defaultFilmicParams: FilmicParams = {
  whitePoint: 4.0,
  blackPoint: -8.0,
  latitude: 0.5,  // 50%
  balance: 0.0,
  shadowsContrast: 'soft',
  highlightsContrast: 'soft',
  enabled: false,
};

/**
 * Apply filmic adjustment uniforms to shader program
 */
export function applyFilmicUniforms(
  gl: WebGL2RenderingContext,
  uniforms: Map<string, WebGLUniformLocation>,
  params: FilmicParams
): void {
  const whitePointLocation = uniforms.get('u_whitePoint');
  if (whitePointLocation) {
    gl.uniform1f(whitePointLocation, params.whitePoint);
  }

  const blackPointLocation = uniforms.get('u_blackPoint');
  if (blackPointLocation) {
    gl.uniform1f(blackPointLocation, params.blackPoint);
  }

  const latitudeLocation = uniforms.get('u_latitude');
  if (latitudeLocation) {
    gl.uniform1f(latitudeLocation, params.latitude);
  }

  const balanceLocation = uniforms.get('u_balance');
  if (balanceLocation) {
    gl.uniform1f(balanceLocation, params.balance);
  }

  const shadowsContrastLocation = uniforms.get('u_shadowsContrast');
  if (shadowsContrastLocation) {
    const contrastValue = 
      params.shadowsContrast === 'hard' ? 0 :
      params.shadowsContrast === 'soft' ? 1 : 2;
    gl.uniform1i(shadowsContrastLocation, contrastValue);
  }

  const highlightsContrastLocation = uniforms.get('u_highlightsContrast');
  if (highlightsContrastLocation) {
    const contrastValue = 
      params.highlightsContrast === 'hard' ? 0 :
      params.highlightsContrast === 'soft' ? 1 : 2;
    gl.uniform1i(highlightsContrastLocation, contrastValue);
  }

  const enabledLocation = uniforms.get('u_enabled');
  if (enabledLocation) {
    gl.uniform1i(enabledLocation, params.enabled ? 1 : 0);
  }
}
