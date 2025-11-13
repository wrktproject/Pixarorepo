/**
 * Color Space Conversion Library
 * 
 * Professional-grade color space conversions for scene-referred image processing.
 * 
 * @module colorspaces
 * @version 1.0.0
 */

// Export all color space conversion shaders
export { colorSpaceShaderLib, Illuminants, temperatureToXYZ, temperatureToWhitePointGLSL } from './colorspaces';
export type { ColorXYZ, ColorLab, ColorLCH, ColorRGB } from './colorspaces';

// Export DT UCS 2022 color space
export { dtUCSShaderLib, defaultColorBalanceParams } from './dtucs';
export type { ColorDTUCS, ColorBalanceZone, ColorBalanceParams } from './dtucs';

// Export JzAzBz color space
export { jzAzBzShaderLib, defaultSaturationParams, degreesToRadians, radiansToDegrees } from './jzazbz';
export type { ColorJzAzBz, ColorJzCzHz, SaturationParams } from './jzazbz';

/**
 * Combined shader library with all color space conversions
 * Include this in your shader programs to access all color space functions
 */
export const allColorSpaceShadersGLSL = `
// ============================================================================
// Complete Color Space Conversion Library
// ============================================================================

${colorSpaceShaderLib}

${dtUCSShaderLib}

${jzAzBzShaderLib}
`;

// Re-export for convenience
import { colorSpaceShaderLib } from './colorspaces';
import { dtUCSShaderLib } from './dtucs';
import { jzAzBzShaderLib } from './jzazbz';
