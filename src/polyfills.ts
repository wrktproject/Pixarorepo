/**
 * Polyfills for CommonJS compatibility
 * Some dependencies expect CommonJS globals that don't exist in ES modules
 */

// Polyfill for require() - used by some CommonJS dependencies
// This is a no-op that prevents errors but doesn't actually load modules
if (typeof window !== 'undefined') {
  (window as any).require = function(id: string) {
    // Silently return empty object - these are optional dependencies
    return {};
  };
}

// Ensure global is defined
if (typeof window !== 'undefined' && typeof (window as any).global === 'undefined') {
  (window as any).global = window;
}

// Ensure process.env is defined
if (typeof window !== 'undefined' && typeof (window as any).process === 'undefined') {
  (window as any).process = { env: {} };
}

export {};
