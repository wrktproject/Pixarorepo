# Preset System Documentation

## Overview

The preset management system provides a complete solution for applying and managing photo editing presets in Pixaro. It includes 24 built-in presets covering common editing styles and supports custom user-created presets with browser storage persistence.

## Features

- **24 Built-in Presets**: Professional presets covering various styles (Portrait, Landscape, Black & White, Vintage, etc.)
- **Custom Presets**: Users can save their current adjustments as custom presets
- **Browser Storage**: Custom presets are automatically persisted to localStorage
- **Preset Application**: Apply presets with a single click (< 200ms)
- **Undo/Redo Integration**: Preset applications are added to the undo history
- **Validation**: Preset names are validated and duplicate names are prevented
- **Delete Custom Presets**: Users can delete their custom presets

## Built-in Presets

The system includes 24 professionally crafted presets:

1. **Portrait** - Optimized for portrait photography with skin tone enhancement
2. **Landscape** - Enhanced colors and clarity for landscape photos
3. **Black & White** - Classic monochrome conversion with contrast
4. **Vintage** - Retro look with faded colors and grain
5. **Vibrant** - Boosted colors and contrast for eye-catching images
6. **Matte** - Soft, faded look with lifted blacks
7. **Dramatic** - High contrast with deep shadows and vignette
8. **Soft** - Gentle, dreamy look with reduced clarity
9. **Cool** - Cool color temperature with blue tones
10. **Warm** - Warm color temperature with golden tones
11. **Golden Hour** - Sunset-inspired warm tones
12. **High Contrast B&W** - Dramatic black and white with strong contrast
13. **Faded** - Washed-out, vintage-inspired look
14. **Cinematic** - Film-like color grading with vignette
15. **Bright & Airy** - Light, airy look with lifted shadows
16. **Moody** - Dark, atmospheric look with deep shadows
17. **Sunset** - Warm, vibrant sunset colors
18. **Natural** - Subtle enhancements maintaining natural look
19. **Food** - Optimized for food photography with warm tones
20. **Urban** - High contrast, desaturated look for cityscapes
21. **Pastel** - Soft, pastel color palette
22. **Autumn** - Warm fall colors with enhanced oranges and yellows
23. **Summer** - Bright, vibrant summer colors
24. **Night** - Optimized for low-light photography

## Usage

### Initialization

Initialize presets when your app starts:

```typescript
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { initializePresets } from './utils/initializePresets';

function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    initializePresets(dispatch);
  }, [dispatch]);

  // ... rest of your app
}
```

### Display Presets

Add the PresetManager component to your UI:

```typescript
import { PresetManager } from './components/PresetManager';

function EditingPanel() {
  return (
    <div>
      {/* Other editing controls */}
      <PresetManager />
    </div>
  );
}
```

### Apply Presets Programmatically

```typescript
import { useDispatch, useSelector } from 'react-redux';
import { applyPreset } from './utils/presetUtils';
import type { RootState } from './store';

function MyComponent() {
  const dispatch = useDispatch();
  const currentAdjustments = useSelector((state: RootState) => state.adjustments);
  const presets = useSelector((state: RootState) => state.presets);

  const handleApplyPreset = () => {
    const preset = presets.builtIn[0]; // Apply first built-in preset
    applyPreset(preset, dispatch, currentAdjustments);
  };

  return <button onClick={handleApplyPreset}>Apply Preset</button>;
}
```

### Save Custom Presets

```typescript
import { useDispatch, useSelector } from 'react-redux';
import { saveCustomPreset } from './store/presetSlice';
import { createPresetFromAdjustments } from './utils/presetUtils';

function SavePresetButton() {
  const dispatch = useDispatch();
  const currentAdjustments = useSelector((state: RootState) => state.adjustments);

  const handleSave = () => {
    const presetData = createPresetFromAdjustments('My Preset', currentAdjustments);
    dispatch(saveCustomPreset({
      name: presetData.name,
      adjustments: presetData.adjustments,
    }));
  };

  return <button onClick={handleSave}>Save Preset</button>;
}
```

## Architecture

### Components

- **PresetManager**: Main UI component for displaying and managing presets
- **Built-in Presets Grid**: Displays all 24 built-in presets
- **Custom Presets Grid**: Displays user-created presets with delete buttons
- **Save Modal**: Dialog for naming and saving new presets

### State Management

- **presetSlice**: Redux slice managing preset state
  - `builtIn`: Array of built-in presets
  - `custom`: Array of custom presets (persisted to localStorage)
  - `isLoading`: Loading state flag

### Utilities

- **presetUtils.ts**: Helper functions for applying and validating presets
- **initializePresets.ts**: Initialization function for loading presets on app startup
- **builtInPresets.ts**: Definitions of all 24 built-in presets

### Storage

Custom presets are stored in localStorage under the key `pixaro_custom_presets`. The storage includes:
- Automatic save on preset creation
- Automatic load on app initialization
- Error handling for quota exceeded
- Graceful fallback if localStorage is unavailable

## Performance

- Preset application completes within 200ms (requirement met)
- Built-in presets are loaded once at app startup
- Custom presets are loaded from localStorage on initialization
- Preset thumbnails use placeholder letters to avoid image loading overhead

## Testing

The preset system includes comprehensive tests:

- **presetSlice.test.ts**: Tests for Redux state management
- **presetUtils.test.ts**: Tests for utility functions
- **PresetManager.test.tsx**: Tests for UI component

Run tests with:
```bash
npm test -- src/store/presetSlice.test.ts src/utils/presetUtils.test.ts src/components/PresetManager.test.tsx
```

## Future Enhancements

Potential improvements for future versions:

1. **Preset Thumbnails**: Generate actual thumbnail previews of presets
2. **Preset Categories**: Organize presets into categories (Portrait, Landscape, etc.)
3. **Preset Search**: Search and filter presets by name or style
4. **Preset Import/Export**: Share presets between users
5. **Preset Ratings**: Allow users to rate and favorite presets
6. **Cloud Sync**: Sync custom presets across devices (requires backend)
