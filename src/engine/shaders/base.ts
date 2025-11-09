/**
 * Base Shader
 * Simple shader for texture loading and display
 */

export const baseVertexShader = `#version 300 es
precision highp float;

// Vertex attributes
in vec2 a_position;
in vec2 a_texCoord;

// Output to fragment shader
out vec2 v_texCoord;

void main() {
  // Flip Y coordinate for image textures (0,0 at top-left in images, bottom-left in OpenGL)
  v_texCoord = vec2(a_texCoord.x, 1.0 - a_texCoord.y);
  
  // Convert position to clip space
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const baseFragmentShader = `#version 300 es
precision highp float;

// Input from vertex shader
in vec2 v_texCoord;

// Uniforms
uniform sampler2D u_texture;

// Output
out vec4 fragColor;

void main() {
  // Sample the texture
  fragColor = texture(u_texture, v_texCoord);
}
`;

/**
 * Create a full-screen quad for rendering
 */
export function createQuadGeometry(gl: WebGL2RenderingContext): {
  positionBuffer: WebGLBuffer;
  texCoordBuffer: WebGLBuffer;
  vao: WebGLVertexArrayObject;
} {
  // Create VAO
  const vao = gl.createVertexArray();
  if (!vao) {
    throw new Error('Failed to create VAO');
  }
  gl.bindVertexArray(vao);

  // Position buffer (full-screen quad)
  const positions = new Float32Array([
    -1.0, -1.0,  // Bottom-left
     1.0, -1.0,  // Bottom-right
    -1.0,  1.0,  // Top-left
     1.0,  1.0,  // Top-right
  ]);

  const positionBuffer = gl.createBuffer();
  if (!positionBuffer) {
    throw new Error('Failed to create position buffer');
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

  // Texture coordinate buffer
  // Standard texture coordinates (will be flipped in base shader if needed)
  const texCoords = new Float32Array([
    0.0, 0.0,  // Bottom-left
    1.0, 0.0,  // Bottom-right
    0.0, 1.0,  // Top-left
    1.0, 1.0,  // Top-right
  ]);

  const texCoordBuffer = gl.createBuffer();
  if (!texCoordBuffer) {
    throw new Error('Failed to create texCoord buffer');
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

  gl.bindVertexArray(null);

  return { positionBuffer, texCoordBuffer, vao };
}

/**
 * Setup vertex attributes for quad rendering
 */
export function setupQuadAttributes(
  gl: WebGL2RenderingContext,
  vao: WebGLVertexArrayObject,
  positionBuffer: WebGLBuffer,
  texCoordBuffer: WebGLBuffer,
  positionLocation: number,
  texCoordLocation: number
): void {
  gl.bindVertexArray(vao);

  // Position attribute
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  // Texture coordinate attribute
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.enableVertexAttribArray(texCoordLocation);
  gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

  gl.bindVertexArray(null);
}

/**
 * Render a full-screen quad
 */
export function renderQuad(gl: WebGL2RenderingContext, vao: WebGLVertexArrayObject): void {
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.bindVertexArray(null);
}
