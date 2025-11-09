/**
 * Geometric Transformation Shader
 * Handles crop and rotation transformations
 */

import type { CropBounds } from '../../types/adjustments';

export const geometricVertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

export const geometricFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_texture;
uniform vec2 u_imageSize;
uniform vec4 u_cropBounds; // x, y, width, height (normalized 0-1)
uniform float u_rotationAngle; // in radians
uniform bool u_hasCrop;

// Rotate a point around center
vec2 rotate(vec2 point, vec2 center, float angle) {
  float s = sin(angle);
  float c = cos(angle);
  
  // Translate point to origin
  point -= center;
  
  // Rotate
  vec2 rotated = vec2(
    point.x * c - point.y * s,
    point.x * s + point.y * c
  );
  
  // Translate back
  return rotated + center;
}

void main() {
  vec2 texCoord = v_texCoord;
  
  // Apply rotation first (around center)
  if (abs(u_rotationAngle) > 0.001) {
    vec2 center = vec2(0.5, 0.5);
    texCoord = rotate(texCoord, center, u_rotationAngle);
  }
  
  // Apply crop
  if (u_hasCrop) {
    // Map from crop bounds to full texture
    texCoord = u_cropBounds.xy + texCoord * u_cropBounds.zw;
  }
  
  // Check if texture coordinate is within bounds
  if (texCoord.x < 0.0 || texCoord.x > 1.0 || texCoord.y < 0.0 || texCoord.y > 1.0) {
    // Outside bounds - render black
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  
  // Sample texture
  fragColor = texture(u_texture, texCoord);
}
`;

export interface GeometricUniforms {
  imageSize: { width: number; height: number };
  cropBounds: CropBounds | null;
  rotationAngle: number; // in degrees
}

/**
 * Apply geometric transformation uniforms
 */
export function applyGeometricUniforms(
  gl: WebGL2RenderingContext,
  uniforms: Map<string, WebGLUniformLocation>,
  params: GeometricUniforms
): void {
  // Image size
  const imageSizeLocation = uniforms.get('u_imageSize');
  if (imageSizeLocation) {
    gl.uniform2f(imageSizeLocation, params.imageSize.width, params.imageSize.height);
  }

  // Rotation angle (convert degrees to radians)
  const rotationLocation = uniforms.get('u_rotationAngle');
  if (rotationLocation) {
    const radians = (params.rotationAngle * Math.PI) / 180;
    gl.uniform1f(rotationLocation, radians);
  }

  // Crop bounds
  const hasCropLocation = uniforms.get('u_hasCrop');
  const cropBoundsLocation = uniforms.get('u_cropBounds');

  if (params.cropBounds && hasCropLocation && cropBoundsLocation) {
    gl.uniform1i(hasCropLocation, 1);

    // Normalize crop bounds to 0-1 range
    const normalizedX = params.cropBounds.x / params.imageSize.width;
    const normalizedY = params.cropBounds.y / params.imageSize.height;
    const normalizedWidth = params.cropBounds.width / params.imageSize.width;
    const normalizedHeight = params.cropBounds.height / params.imageSize.height;

    gl.uniform4f(
      cropBoundsLocation,
      normalizedX,
      normalizedY,
      normalizedWidth,
      normalizedHeight
    );
  } else if (hasCropLocation) {
    gl.uniform1i(hasCropLocation, 0);
  }
}
