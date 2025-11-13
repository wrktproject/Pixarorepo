/**
 * Shader Library Index
 * 
 * Central export point for all shader modules and utilities.
 * 
 * @module shaders
 * @version 1.0.0
 */

// Base shaders
export * from './base';

// Adjustment shaders
export * from './tonal';
export * from './color';
export * from './detail';
export * from './effects';
export * from './hsl';
export * from './geometric';
export * from './output';
export * from './chromatic';

// Multi-pass shaders
export * from './gaussianBlur';
export * from './clarityComposite';

// Shader composition system (from parent directory)
export {
  ShaderComposer,
  shaderComposer,
  composeShader,
  createShaderWithIncludes,
  type ShaderModule,
  type CompositionOptions,
} from '../shaderComposer';
