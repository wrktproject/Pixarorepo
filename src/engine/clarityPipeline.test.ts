/**
 * Tests for Clarity Pipeline
 * 
 * Note: Full integration tests require WebGL context which is not available in test environment.
 * These tests verify the module structure and exports.
 */

import { describe, it, expect } from 'vitest';
import { ClarityPipeline } from './clarityPipeline';

describe('ClarityPipeline', () => {
  it('should export ClarityPipeline class', () => {
    expect(ClarityPipeline).toBeDefined();
    expect(typeof ClarityPipeline).toBe('function');
  });

  it('should have required methods', () => {
    expect(ClarityPipeline.prototype.applyClarity).toBeDefined();
    expect(ClarityPipeline.prototype.setBlurRadius).toBeDefined();
    expect(ClarityPipeline.prototype.dispose).toBeDefined();
  });
});
