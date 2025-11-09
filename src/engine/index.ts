// Image Processing Engine
// This folder contains WebGL-based image processing logic and shader management

export { WebGLContextManager } from './webglContext';
export type { WebGLContextConfig } from './webglContext';

export { TextureManager } from './textureManager';
export type { TextureConfig } from './textureManager';

export { FramebufferManager } from './framebufferManager';
export type { FramebufferConfig } from './framebufferManager';

export { ShaderCompiler } from './shaderUtils';
export type { ShaderProgram } from './shaderUtils';

export { ShaderPipeline } from './shaderPipeline';

export { ShaderPipelineErrorHandler } from './shaderPipelineErrorHandler';
export type { RenderMode, ErrorHandlerConfig, RenderResult } from './shaderPipelineErrorHandler';

export { CanvasFallbackRenderer } from './canvasFallback';

export * from './colorUtils';

// Shader modules
export * from './shaders/base';
export * from './shaders/tonal';
export * from './shaders/color';
export * from './shaders/hsl';
export * from './shaders/detail';
export * from './shaders/effects';

// Shader warm-up
export { warmupShaders, areShadersWarmedUp } from './shaderWarmup';
export type { WarmupConfig } from './shaderWarmup';
