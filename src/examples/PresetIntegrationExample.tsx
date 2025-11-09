/**
 * Preset Integration Example
 * Example showing how to integrate the preset system into the main app
 */

import { useEffect } from 'react';
import { Provider, useDispatch } from 'react-redux';
import { store } from '../store';
import { PresetManager } from '../components/PresetManager';
import { initializePresets } from '../utils/initializePresets';
import type { AppDispatch } from '../store';

/**
 * Component that initializes presets on mount
 */
const PresetInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    // Initialize built-in and custom presets on app startup
    initializePresets(dispatch);
  }, [dispatch]);

  return <>{children}</>;
};

/**
 * Example App Component showing preset integration
 */
export const PresetIntegrationExample: React.FC = () => {
  return (
    <Provider store={store}>
      <PresetInitializer>
        <div style={{ padding: '2rem' }}>
          <h1>Preset Management Example</h1>
          <p>This example shows how to integrate the preset system into your app.</p>
          
          {/* The PresetManager component displays and manages presets */}
          <PresetManager />
        </div>
      </PresetInitializer>
    </Provider>
  );
};

/**
 * Integration Steps:
 * 
 * 1. Wrap your app with Redux Provider:
 *    <Provider store={store}>
 *      <App />
 *    </Provider>
 * 
 * 2. Initialize presets on app startup:
 *    useEffect(() => {
 *      initializePresets(dispatch);
 *    }, [dispatch]);
 * 
 * 3. Add PresetManager component to your editing panel:
 *    <PresetManager />
 * 
 * 4. The preset system will:
 *    - Load 24 built-in presets
 *    - Restore custom presets from localStorage
 *    - Allow users to apply presets with one click
 *    - Allow users to save current adjustments as custom presets
 *    - Allow users to delete custom presets
 *    - Automatically persist custom presets to localStorage
 */
