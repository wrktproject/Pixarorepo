/**
 * Color Utility Functions
 * Reusable color space conversion and calculation functions
 */

/**
 * Convert sRGB to linear color space
 */
export function srgbToLinear(srgb: number): number {
  return Math.pow(srgb, 2.2);
}

/**
 * Convert linear to sRGB color space
 */
export function linearToSrgb(linear: number): number {
  return Math.pow(linear, 1.0 / 2.2);
}

/**
 * Convert sRGB color array to linear
 */
export function srgbToLinearArray(srgb: number[]): number[] {
  return srgb.map(srgbToLinear);
}

/**
 * Convert linear color array to sRGB
 */
export function linearToSrgbArray(linear: number[]): number[] {
  return linear.map(linearToSrgb);
}

/**
 * Calculate luminance from RGB values
 */
export function getLuminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Convert Kelvin temperature to RGB multiplier
 */
export function kelvinToRGB(kelvin: number): { r: number; g: number; b: number } {
  const temp = kelvin / 100.0;
  let r: number, g: number, b: number;

  // Red
  if (temp <= 66.0) {
    r = 1.0;
  } else {
    const rTemp = temp - 60.0;
    r = 1.292936186 * Math.pow(rTemp, -0.1332047592);
    r = Math.max(0.0, Math.min(1.0, r));
  }

  // Green
  if (temp <= 66.0) {
    g = 0.39008157876 * Math.log(temp) - 0.631841444;
  } else {
    const gTemp = temp - 60.0;
    g = 1.129890861 * Math.pow(gTemp, -0.0755148492);
  }
  g = Math.max(0.0, Math.min(1.0, g));

  // Blue
  if (temp >= 66.0) {
    b = 1.0;
  } else if (temp <= 19.0) {
    b = 0.0;
  } else {
    const bTemp = temp - 10.0;
    b = 0.543206789 * Math.log(bTemp) - 1.196254089;
    b = Math.max(0.0, Math.min(1.0, b));
  }

  return { r, g, b };
}

/**
 * RGB to HSL conversion
 */
export function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2.0;

  if (delta > 0.0001) {
    // Calculate saturation
    if (l < 0.5) {
      s = delta / (max + min);
    } else {
      s = delta / (2.0 - max - min);
    }

    // Calculate hue
    if (r >= max) {
      h = (g - b) / delta;
    } else if (g >= max) {
      h = 2.0 + (b - r) / delta;
    } else {
      h = 4.0 + (r - g) / delta;
    }

    h /= 6.0;
    if (h < 0.0) h += 1.0;
  }

  return { h, s, l };
}

/**
 * HSL to RGB conversion
 */
export function hslToRgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
  if (s < 0.0001) {
    return { r: l, g: l, b: l };
  }

  const q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  const p = 2.0 * l - q;

  const hueToRgb = (t: number): number => {
    if (t < 0.0) t += 1.0;
    if (t > 1.0) t -= 1.0;

    if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
    if (t < 0.5) return q;
    if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
    return p;
  };

  return {
    r: hueToRgb(h + 1.0 / 3.0),
    g: hueToRgb(h),
    b: hueToRgb(h - 1.0 / 3.0),
  };
}

/**
 * Calculate saturation of a color
 */
export function getSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (max > 0.0) {
    return delta / max;
  }
  return 0.0;
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Map adjustment value from one range to another
 */
export function mapAdjustmentValue(
  value: number,
  fromMin: number,
  fromMax: number,
  toMin: number,
  toMax: number
): number {
  const normalized = (value - fromMin) / (fromMax - fromMin);
  return toMin + normalized * (toMax - toMin);
}
