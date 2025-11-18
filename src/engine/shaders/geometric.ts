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
uniform float u_rotationAngle; // in radians (straighten angle)
uniform float u_rotation90; // in radians (0, 90, 180, 270)
uniform bool u_flipHorizontal;
uniform bool u_flipVertical;
uniform bool u_hasCrop;

// Rotate a point around center with aspect ratio correction
// This ensures rotation doesn't distort non-square images
vec2 rotate(vec2 point, vec2 center, float angle, float aspectRatio) {
  float s = sin(-angle); // Inverted angle for texture space rotation
  float c = cos(-angle);
  
  // Translate point to origin
  point -= center;
  
  // Correct for aspect ratio: expand to square space
  point.x *= aspectRatio;
  
  // Rotate in square space
  vec2 rotated = vec2(
    point.x * c - point.y * s,
    point.x * s + point.y * c
  );
  
  // Correct back from square space
  rotated.x /= aspectRatio;
  
  // Translate back
  return rotated + center;
}

void main() {
  vec2 texCoord = v_texCoord;
  
  // Calculate aspect ratio for rotation correction
  float aspectRatio = u_imageSize.x / u_imageSize.y;
  
  // Apply crop FIRST (map output to crop region)
  // This defines what part of the image we're looking at
  if (u_hasCrop) {
    texCoord = u_cropBounds.xy + texCoord * u_cropBounds.zw;
  }
  
  // Apply straighten rotation (rotate the lookup within crop)
  // This rotates the image while keeping the crop rectangle axis-aligned
  if (abs(u_rotationAngle) > 0.001) {
    vec2 center = vec2(0.5, 0.5);
    texCoord = rotate(texCoord, center, u_rotationAngle, aspectRatio);
  }
  
  // Apply 90-degree rotation
  if (abs(u_rotation90) > 0.001) {
    vec2 center = vec2(0.5, 0.5);
    texCoord = rotate(texCoord, center, u_rotation90, aspectRatio);
  }
  
  // Apply flip transformations
  if (u_flipHorizontal) {
    texCoord.x = 1.0 - texCoord.x;
  }
  if (u_flipVertical) {
    texCoord.y = 1.0 - texCoord.y;
  }
  
  // Check if texture coordinate is within bounds
  if (texCoord.x < 0.0 || texCoord.x > 1.0 || texCoord.y < 0.0 || texCoord.y > 1.0) {
    // Outside bounds - render black (happens when rotation causes edges to show)
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  
  // Sample texture with high quality filtering
  fragColor = texture(u_texture, texCoord);
}
`;

export interface GeometricUniforms {
  imageSize: { width: number; height: number };
  cropBounds: CropBounds | null;
  rotationAngle: number; // straighten angle in degrees (-45 to 45)
  rotation90: number; // 90-degree rotation (0, 90, 180, 270)
  flipHorizontal: boolean;
  flipVertical: boolean;
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

  // Straighten angle (convert degrees to radians)
  const rotationLocation = uniforms.get('u_rotationAngle');
  if (rotationLocation) {
    const radians = (params.rotationAngle * Math.PI) / 180;
    gl.uniform1f(rotationLocation, radians);
  }

  // 90-degree rotation (convert degrees to radians)
  const rotation90Location = uniforms.get('u_rotation90');
  if (rotation90Location) {
    const radians = (params.rotation90 * Math.PI) / 180;
    gl.uniform1f(rotation90Location, radians);
  }

  // Flip transformations
  const flipHorizontalLocation = uniforms.get('u_flipHorizontal');
  if (flipHorizontalLocation) {
    gl.uniform1i(flipHorizontalLocation, params.flipHorizontal ? 1 : 0);
  }

  const flipVerticalLocation = uniforms.get('u_flipVertical');
  if (flipVerticalLocation) {
    gl.uniform1i(flipVerticalLocation, params.flipVertical ? 1 : 0);
  }

  // Crop bounds
  const hasCropLocation = uniforms.get('u_hasCrop');
  const cropBoundsLocation = uniforms.get('u_cropBounds');

  if (params.cropBounds && hasCropLocation && cropBoundsLocation) {
    gl.uniform1i(hasCropLocation, 1);

    // Normalize crop bounds to 0-1 range
    const normalizedX = params.cropBounds.x / params.imageSize.width;
    // WebGL texture coordinates have Y=0 at bottom, but our crop has Y=0 at top
    // So we need to flip the Y coordinate
    const normalizedY = 1.0 - (params.cropBounds.y + params.cropBounds.height) / params.imageSize.height;
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
