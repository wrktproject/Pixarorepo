/**
 * Browser Compatibility Detection
 * Detects browser capabilities and displays warnings for unsupported browsers
 */

export interface BrowserInfo {
  name: string;
  version: number;
  isSupported: boolean;
  missingFeatures: string[];
}

export interface BrowserCapabilities {
  webgl: boolean;
  webgl2: boolean;
  webWorkers: boolean;
  indexedDB: boolean;
  localStorage: boolean;
  canvas: boolean;
  fileAPI: boolean;
  es6: boolean;
}

/**
 * Detect browser name and version
 */
export function detectBrowser(): BrowserInfo {
  const ua = navigator.userAgent;
  let name = 'Unknown';
  let version = 0;

  // Chrome
  if (ua.indexOf('Chrome') > -1 && ua.indexOf('Edg') === -1) {
    name = 'Chrome';
    const match = ua.match(/Chrome\/(\d+)/);
    version = match ? parseInt(match[1], 10) : 0;
  }
  // Edge (Chromium)
  else if (ua.indexOf('Edg') > -1) {
    name = 'Edge';
    const match = ua.match(/Edg\/(\d+)/);
    version = match ? parseInt(match[1], 10) : 0;
  }
  // Firefox
  else if (ua.indexOf('Firefox') > -1) {
    name = 'Firefox';
    const match = ua.match(/Firefox\/(\d+)/);
    version = match ? parseInt(match[1], 10) : 0;
  }
  // Safari
  else if (ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1) {
    name = 'Safari';
    const match = ua.match(/Version\/(\d+)/);
    version = match ? parseInt(match[1], 10) : 0;
  }

  const missingFeatures = checkMissingFeatures();
  const isSupported = isBrowserSupported(name, version, missingFeatures);

  return {
    name,
    version,
    isSupported,
    missingFeatures,
  };
}

/**
 * Check if browser is supported (latest 2 versions)
 */
function isBrowserSupported(
  name: string,
  version: number,
  missingFeatures: string[]
): boolean {
  // If critical features are missing, browser is not supported
  if (missingFeatures.length > 0) {
    return false;
  }

  // Minimum supported versions (approximately latest 2 versions as of 2024)
  const minVersions: Record<string, number> = {
    Chrome: 120, // Latest 2 versions from ~122
    Firefox: 121, // Latest 2 versions from ~123
    Safari: 16, // Latest 2 versions from ~17
    Edge: 120, // Latest 2 versions from ~122
  };

  const minVersion = minVersions[name];
  if (!minVersion) {
    // Unknown browser - check features only
    return missingFeatures.length === 0;
  }

  return version >= minVersion;
}

/**
 * Check for missing critical features
 */
function checkMissingFeatures(): string[] {
  const missing: string[] = [];

  // Check WebGL
  if (!checkWebGL()) {
    missing.push('WebGL');
  }

  // Check Web Workers
  if (!window.Worker) {
    missing.push('Web Workers');
  }

  // Check IndexedDB
  if (!window.indexedDB) {
    missing.push('IndexedDB');
  }

  // Check LocalStorage
  try {
    if (!window.localStorage) {
      missing.push('LocalStorage');
    }
  } catch {
    missing.push('LocalStorage');
  }

  // Check Canvas API
  const canvas = document.createElement('canvas');
  if (!canvas.getContext || !canvas.getContext('2d')) {
    missing.push('Canvas API');
  }

  // Check File API
  if (!window.File || !window.FileReader || !window.Blob) {
    missing.push('File API');
  }

  // Check ES6 support (basic check)
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function('() => {}');
  } catch {
    missing.push('ES6 Arrow Functions');
  }

  return missing;
}

/**
 * Check WebGL support
 */
function checkWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch {
    return false;
  }
}

/**
 * Get all browser capabilities
 */
export function getBrowserCapabilities(): BrowserCapabilities {
  return {
    webgl: checkWebGL(),
    webgl2: checkWebGL2(),
    webWorkers: !!window.Worker,
    indexedDB: !!window.indexedDB,
    localStorage: checkLocalStorage(),
    canvas: checkCanvas(),
    fileAPI: checkFileAPI(),
    es6: checkES6(),
  };
}

function checkWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    return !!gl;
  } catch {
    return false;
  }
}

function checkLocalStorage(): boolean {
  try {
    return !!window.localStorage;
  } catch {
    return false;
  }
}

function checkCanvas(): boolean {
  const canvas = document.createElement('canvas');
  return !!(canvas.getContext && canvas.getContext('2d'));
}

function checkFileAPI(): boolean {
  return !!(window.File && window.FileReader && window.Blob);
}

function checkES6(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function('() => {}');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get user-friendly warning message
 */
export function getCompatibilityWarning(browserInfo: BrowserInfo): string | null {
  if (browserInfo.isSupported) {
    return null;
  }

  if (browserInfo.missingFeatures.length > 0) {
    return `Your browser is missing critical features: ${browserInfo.missingFeatures.join(', ')}. Pixaro may not work correctly. Please update your browser or use a modern browser like Chrome, Firefox, Safari, or Edge.`;
  }

  return `Your browser (${browserInfo.name} ${browserInfo.version}) is outdated. Pixaro requires the latest 2 versions of Chrome, Firefox, Safari, or Edge for optimal performance. Please update your browser.`;
}
