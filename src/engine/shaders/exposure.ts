/**
 * Exposure Shader with Highlight Preservation
 * Implements scene-referred exposure adjustment with highlight reconstruction
 * Based on Darktable's exposure module for professional exposure control
 */

export const exposureVertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
  v_texCoord = a_texCoord;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const exposureFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform float u_exposure;                    // EV adjustment (-10 to 10)
uniform float u_blackPoint;                  // Black level (0.0 to 0.1)
uniform bool u_highlightReconstruction;      // Enable highlight recovery
uniform float u_reconstructionThreshold;     // Threshold for clipping detection (0.9 to 1.0)
uniform bool u_enabled;                      // Enable/disable exposure

out vec4 fragColor;

const float EPSILON = 1e-8;

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
 * Apply EV-based exposure scaling
 * Works in linear RGB space for physically accurate results
 * 
 * @param rgb Linear RGB values
 * @param ev Exposure value in stops
 * @return Exposure-adjusted linear RGB
 */
vec3 applyExposureScaling(vec3 rgb, float ev) {
  // EV-based scaling: multiply by 2^EV
  float scale = pow(2.0, ev);
  return rgb * scale;
}

/**
 * Apply black point adjustment
 * Subtracts black level and normalizes
 * 
 * @param rgb Linear RGB values
 * @param blackPoint Black level (0.0 to 0.1)
 * @return Black point adjusted RGB
 */
vec3 applyBlackPoint(vec3 rgb, float blackPoint) {
  // Subtract black point and normalize
  vec3 adjusted = max(rgb - blackPoint, 0.0);
  
  // Normalize to maintain range
  if (blackPoint < 1.0) {
    adjusted = adjusted / (1.0 - blackPoint);
  }
  
  return adjusted;
}

/**
 * Reconstruct clipped highlights using color ratios
 * Attempts to recover detail in blown-out channels
 * 
 * @param rgb Linear RGB values (potentially clipped)
 * @param threshold Clipping detection threshold
 * @return Reconstructed RGB with recovered highlights
 */
vec3 reconstructHighlights(vec3 rgb, float threshold) {
  // Find maximum channel value
  float maxChannel = max(max(rgb.r, rgb.g), rgb.b);
  
  // If no clipping, return original
  if (maxChannel <= threshold) {
    return rgb;
  }
  
  // Calculate color ratios from unclipped channels
  // Use the minimum channel as reference (least likely to be clipped)
  float minChannel = min(min(rgb.r, rgb.g), rgb.b);
  
  // Calculate average ratio for reconstruction
  vec3 ratios = rgb / max(maxChannel, EPSILON);
  float avgRatio = (ratios.r + ratios.g + ratios.b) / 3.0;
  
  // Blend factor: 0 at threshold, 1 at threshold + 1.0
  float blendStart = threshold;
  float blendEnd = threshold + 1.0;
  float blend = smoothstep(blendStart, blendEnd, maxChannel);
  
  // Reconstruct by blending toward average ratio
  // This preserves hue while recovering clipped channels
  vec3 reconstructed = mix(rgb, vec3(avgRatio * maxChannel), blend);
  
  // Additional refinement: use color ratios from less clipped channels
  // If one channel is significantly less clipped, use it as reference
  float midChannel = rgb.r + rgb.g + rgb.b - maxChannel - minChannel;
  
  if (midChannel < threshold && maxChannel > threshold) {
    // Use mid channel ratios for better reconstruction
    vec3 midRatios = rgb / max(midChannel, EPSILON);
    float midBlend = smoothstep(threshold, threshold + 0.5, maxChannel);
    reconstructed = mix(reconstructed, midRatios * midChannel, midBlend * 0.5);
  }
  
  return reconstructed;
}

/**
 * Apply exposure with highlight preservation
 * Complete exposure adjustment pipeline
 */
vec3 applyExposure(vec3 rgb, float exposure, float blackPoint, 
                   bool highlightReconstruction, float reconstructionThreshold) {
  // Step 1: Apply linear exposure scaling in scene-referred space
  vec3 exposed = applyExposureScaling(rgb, exposure);
  
  // Step 2: Apply black point adjustment
  exposed = applyBlackPoint(exposed, blackPoint);
  
  // Step 3: Highlight reconstruction (if enabled)
  if (highlightReconstruction) {
    exposed = reconstructHighlights(exposed, reconstructionThreshold);
  }
  
  return exposed;
}

void main() {
  vec4 texColor = texture(u_texture, v_texCoord);
  vec3 color = texColor.rgb;
  
  if (u_enabled) {
    // Convert to linear space for accurate exposure adjustment
    color = srgbToLinear(color);
    
    // Apply exposure with highlight preservation
    color = applyExposure(color, u_exposure, u_blackPoint, 
                         u_highlightReconstruction, u_reconstructionThreshold);
    
    // Clamp to valid range (allow values > 1.0 for HDR pipeline)
    color = max(color, 0.0);
    
    // IMPORTANT: Keep in Linear space! Output shader will convert to sRGB
  }
  
  fragColor = vec4(color, texColor.a);
}
`;

/**
 * Exposure adjustment parameters
 */
export interface ExposureParams {
  exposure: number;                    // EV adjustment (-10 to 10)
  blackPoint: number;                  // Black level (0.0 to 0.1)
  highlightReconstruction: boolean;    // Enable highlight recovery
  reconstructionThreshold: number;     // Threshold for clipping detection (0.9 to 1.0)
  enabled: boolean;                    // Enable/disable exposure
}

/**
 * Default exposure parameters
 */
export const defaultExposureParams: ExposureParams = {
  exposure: 0.0,
  blackPoint: 0.0,
  highlightReconstruction: false,
  reconstructionThreshold: 0.95,
  enabled: true,
};

/**
 * Apply exposure adjustment uniforms to shader program
 */
export function applyExposureUniforms(
  gl: WebGL2RenderingContext,
  uniforms: Map<string, WebGLUniformLocation>,
  params: ExposureParams
): void {
  const exposureLocation = uniforms.get('u_exposure');
  if (exposureLocation) {
    gl.uniform1f(exposureLocation, params.exposure);
  }

  const blackPointLocation = uniforms.get('u_blackPoint');
  if (blackPointLocation) {
    gl.uniform1f(blackPointLocation, params.blackPoint);
  }

  const highlightReconstructionLocation = uniforms.get('u_highlightReconstruction');
  if (highlightReconstructionLocation) {
    gl.uniform1i(highlightReconstructionLocation, params.highlightReconstruction ? 1 : 0);
  }

  const reconstructionThresholdLocation = uniforms.get('u_reconstructionThreshold');
  if (reconstructionThresholdLocation) {
    gl.uniform1f(reconstructionThresholdLocation, params.reconstructionThreshold);
  }

  const enabledLocation = uniforms.get('u_enabled');
  if (enabledLocation) {
    gl.uniform1i(enabledLocation, params.enabled ? 1 : 0);
  }
}
