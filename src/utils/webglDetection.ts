/**
 * WebGL Detection and Capability Checking
 * Detects WebGL support and provides fallback information
 */

export interface WebGLCapabilities {
  isSupported: boolean;
  version: 'webgl2' | 'webgl1' | 'none';
  maxTextureSize: number;
  maxRenderbufferSize: number;
  hasFloatTextures: boolean;
  hasColorBufferFloat: boolean;
  renderer: string;
  vendor: string;
}

export function detectWebGLCapabilities(): WebGLCapabilities {
  const canvas = document.createElement('canvas');
  
  // Try WebGL2 first
  let gl: WebGL2RenderingContext | WebGLRenderingContext | null = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
  let version: 'webgl2' | 'webgl1' | 'none' = 'none';
  
  if (gl) {
    version = 'webgl2';
  } else {
    // Try WebGL1
    const gl1 = canvas.getContext('webgl') as WebGLRenderingContext | null;
    const gl1Exp = canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
    gl = gl1 || gl1Exp;
    if (gl) {
      version = 'webgl1';
    }
  }

  if (!gl) {
    return {
      isSupported: false,
      version: 'none',
      maxTextureSize: 0,
      maxRenderbufferSize: 0,
      hasFloatTextures: false,
      hasColorBufferFloat: false,
      renderer: 'Unknown',
      vendor: 'Unknown',
    };
  }

  // Get capabilities
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = debugInfo
    ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
    : gl.getParameter(gl.RENDERER);
  const vendor = debugInfo
    ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
    : gl.getParameter(gl.VENDOR);

  // Check for float texture support
  const hasFloatTextures = version === 'webgl2' || !!gl.getExtension('OES_texture_float');
  const hasColorBufferFloat = version === 'webgl2' || !!gl.getExtension('WEBGL_color_buffer_float');

  const capabilities: WebGLCapabilities = {
    isSupported: true,
    version,
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    maxRenderbufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
    hasFloatTextures,
    hasColorBufferFloat,
    renderer: renderer || 'Unknown',
    vendor: vendor || 'Unknown',
  };

  // Clean up
  const loseContext = gl.getExtension('WEBGL_lose_context');
  if (loseContext) {
    loseContext.loseContext();
  }

  return capabilities;
}

export function isWebGLSupported(): boolean {
  const capabilities = detectWebGLCapabilities();
  return capabilities.isSupported;
}

export function getWebGLWarningMessage(capabilities: WebGLCapabilities): string | null {
  if (!capabilities.isSupported) {
    return 'WebGL is not supported in your browser. The application will use a slower Canvas-based renderer.';
  }

  if (capabilities.version === 'webgl1') {
    return 'WebGL 2 is not available. Using WebGL 1 with reduced performance.';
  }

  if (capabilities.maxTextureSize < 4096) {
    return 'Your GPU has limited texture size support. Large images may not render correctly.';
  }

  return null;
}
