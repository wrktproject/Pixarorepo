/**
 * EditingPanel Component
 * Main container for all adjustment sections
 */

import React, { Suspense } from 'react';
import { BasicAdjustments } from './BasicAdjustments';
import { ColorAdjustments } from './ColorAdjustments';
import { DetailAdjustments } from './DetailAdjustments';
import { HSLAdjustments } from './HSLAdjustments';
import { EffectsAdjustments } from './EffectsAdjustments';
import { GeometricAdjustments } from './GeometricAdjustments';
import { SettingsAdjustments } from './SettingsAdjustments';
import './EditingPanel.css';

// Lazy load RemovalAdjustments since it uses TensorFlow.js
const RemovalAdjustments = React.lazy(() => 
  import('./RemovalAdjustments').then(module => ({ default: module.RemovalAdjustments }))
);

export const EditingPanel: React.FC = () => {
  return (
    <div className="editing-panel" role="region" aria-label="Editing adjustments panel">
      <div className="editing-panel__header">
        <h2 className="editing-panel__title">Adjustments</h2>
      </div>
      <div className="editing-panel__sections" role="group">
        <BasicAdjustments />
        <ColorAdjustments />
        <DetailAdjustments />
        <HSLAdjustments />
        <EffectsAdjustments />
        <GeometricAdjustments />
        <Suspense fallback={<div className="loading-section">Loading AI tools...</div>}>
          <RemovalAdjustments />
        </Suspense>
        <SettingsAdjustments />
      </div>
    </div>
  );
};
