/**
 * Performance Dashboard Component
 * Displays real-time performance metrics and profiling data
 * Requirement 17: Performance profiling and optimization
 */

import { useEffect, useState } from 'react';
import type { PerformanceProfile } from '../engine/performanceProfiler';
import styles from './PerformanceDashboard.module.css';

interface PerformanceDashboardProps {
  getProfile: () => PerformanceProfile;
  getRecommendations: () => string[];
  onReset?: () => void;
  onExport?: () => string;
  visible?: boolean;
}

export function PerformanceDashboard({
  getProfile,
  getRecommendations,
  onReset,
  onExport,
  visible = false,
}: PerformanceDashboardProps) {
  const [profile, setProfile] = useState<PerformanceProfile | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!visible) return;

    const updateProfile = () => {
      setProfile(getProfile());
      setRecommendations(getRecommendations());
    };

    // Update every second
    updateProfile();
    const interval = setInterval(updateProfile, 1000);

    return () => clearInterval(interval);
  }, [visible, getProfile, getRecommendations]);

  if (!visible || !profile) {
    return null;
  }

  const handleReset = () => {
    if (onReset) {
      onReset();
      setProfile(getProfile());
    }
  };

  const handleExport = () => {
    if (onExport) {
      const json = onExport();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `performance-profile-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const fpsColor =
    profile.render.currentFPS >= profile.render.targetFPS * 0.9
      ? 'good'
      : profile.render.currentFPS >= profile.render.targetFPS * 0.5
        ? 'warning'
        : 'critical';

  const poolHitRatio =
    profile.framebuffers.poolHits + profile.framebuffers.poolMisses > 0
      ? (profile.framebuffers.poolHits /
          (profile.framebuffers.poolHits + profile.framebuffers.poolMisses)) *
        100
      : 0;

  const textureReuseRatio =
    profile.textureUploads.count > 0
      ? (profile.textureUploads.reusedTextures / profile.textureUploads.count) * 100
      : 0;

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <h3>Performance Dashboard</h3>
        <div className={styles.actions}>
          <button onClick={() => setExpanded(!expanded)} className={styles.toggleButton}>
            {expanded ? '▼' : '▶'}
          </button>
          <button onClick={handleReset} className={styles.actionButton}>
            Reset
          </button>
          <button onClick={handleExport} className={styles.actionButton}>
            Export
          </button>
        </div>
      </div>

      <div className={styles.summary}>
        <div className={`${styles.metric} ${styles[fpsColor]}`}>
          <span className={styles.label}>FPS</span>
          <span className={styles.value}>{profile.render.currentFPS.toFixed(1)}</span>
          <span className={styles.target}>/ {profile.render.targetFPS}</span>
        </div>

        <div className={styles.metric}>
          <span className={styles.label}>Frame Time</span>
          <span className={styles.value}>{profile.render.averageFrameTime.toFixed(2)}ms</span>
        </div>

        <div className={styles.metric}>
          <span className={styles.label}>GPU Memory</span>
          <span className={styles.value}>{profile.gpuMemoryUsageMB.toFixed(1)}MB</span>
        </div>

        <div className={styles.metric}>
          <span className={styles.label}>Dropped Frames</span>
          <span className={styles.value}>{profile.render.droppedFrames}</span>
        </div>
      </div>

      {expanded && (
        <div className={styles.details}>
          <div className={styles.section}>
            <h4>Render Statistics</h4>
            <div className={styles.stats}>
              <div className={styles.stat}>
                <span>Total Renders:</span>
                <span>{profile.render.totalRenders}</span>
              </div>
              <div className={styles.stat}>
                <span>Redundant Renders:</span>
                <span>{profile.render.redundantRenders}</span>
              </div>
              <div className={styles.stat}>
                <span>Min Frame Time:</span>
                <span>{profile.render.minFrameTime.toFixed(2)}ms</span>
              </div>
              <div className={styles.stat}>
                <span>Max Frame Time:</span>
                <span>{profile.render.maxFrameTime.toFixed(2)}ms</span>
              </div>
            </div>
          </div>

          {profile.shaderPasses.size > 0 && (
            <div className={styles.section}>
              <h4>Shader Passes</h4>
              <div className={styles.passes}>
                {Array.from(profile.shaderPasses.values())
                  .sort((a, b) => b.averageExecutionTime - a.averageExecutionTime)
                  .map((pass) => (
                    <div key={pass.name} className={styles.pass}>
                      <span className={styles.passName}>{pass.name}</span>
                      <span className={styles.passTime}>
                        {pass.averageExecutionTime.toFixed(2)}ms
                      </span>
                      <span className={styles.passCalls}>
                        {pass.callCount} calls, {pass.skippedCount} skipped
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className={styles.section}>
            <h4>Texture Uploads</h4>
            <div className={styles.stats}>
              <div className={styles.stat}>
                <span>Total Uploads:</span>
                <span>{profile.textureUploads.count}</span>
              </div>
              <div className={styles.stat}>
                <span>Total Data:</span>
                <span>{(profile.textureUploads.totalBytes / (1024 * 1024)).toFixed(2)}MB</span>
              </div>
              <div className={styles.stat}>
                <span>Average Time:</span>
                <span>{profile.textureUploads.averageTime.toFixed(2)}ms</span>
              </div>
              <div className={styles.stat}>
                <span>Reuse Ratio:</span>
                <span>{textureReuseRatio.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h4>Framebuffers</h4>
            <div className={styles.stats}>
              <div className={styles.stat}>
                <span>Pool Hits:</span>
                <span>{profile.framebuffers.poolHits}</span>
              </div>
              <div className={styles.stat}>
                <span>Pool Misses:</span>
                <span>{profile.framebuffers.poolMisses}</span>
              </div>
              <div className={styles.stat}>
                <span>Pool Hit Ratio:</span>
                <span>{poolHitRatio.toFixed(1)}%</span>
              </div>
              <div className={styles.stat}>
                <span>Active:</span>
                <span>{profile.framebuffers.activeFramebuffers}</span>
              </div>
            </div>
          </div>

          {recommendations.length > 0 && (
            <div className={styles.section}>
              <h4>Recommendations</h4>
              <ul className={styles.recommendations}>
                {recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
