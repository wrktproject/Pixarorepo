# Quick Start: New Features

## 🎉 What's New

Your Pixaro app now has **three powerful new features** inspired by darktable!

---

## 1. 🌈 Chromatic Aberration Correction

### What It Does
Fixes color fringing at image edges caused by lens imperfections. You'll see red/green/blue halos especially on wide-angle shots or at image corners.

### How to Use

```typescript
import { chromaticVertexShader, chromaticFragmentShader, applyChromaticUniforms } from './engine/shaders/chromatic';

// In your pipeline or shader system:
const chromaticParams = {
  enabled: true,
  strength: 0.5,  // Positive corrects typical CA, negative for reverse
};

applyChromaticUniforms(gl, uniforms, chromaticParams);
```

### UI Integration Example

```tsx
// Add to your Effects or Lens Correction panel
<Slider
  label="Chromatic Aberration"
  value={chromaticAberration.strength * 100}
  onChange={(value) => updateCA({ strength: value / 100 })}
  min={-100}
  max={100}
  step={1}
  tooltip="Correct color fringing at edges"
/>
```

---

## 2. 🎨 Enhanced Sigmoid Tone Mapping

### What's New
- **Two processing modes**: Per-Channel (more contrast) or RGB Ratio (better hue preservation)
- **Hue Preservation slider**: Blend between modes for perfect control

### How to Use

```typescript
const sigmoidParams = {
  enabled: true,
  contrast: 1.5,
  skew: 0.0,
  middleGrey: 0.1845,
  mode: 'rgb-ratio',      // NEW! or 'per-channel'
  huePreservation: 0.7,   // NEW! 0.0 to 1.0
};
```

### When to Use Which Mode

**Per-Channel Mode** (default):
- More local contrast
- Punchier images
- May shift hues slightly
- Best for: B&W, landscapes, high-contrast scenes

**RGB Ratio Mode**:
- Preserves original hues
- Smoother transitions
- May slightly desaturate
- Best for: Portraits, skin tones, color-critical work

**Hue Preservation** (blend):
- 0% = Pure per-channel
- 50% = Balanced blend
- 100% = Pure RGB ratio

### UI Integration Example

```tsx
// Add to your Tone Mapping panel
<Select
  label="Sigmoid Mode"
  value={sigmoid.mode}
  onChange={(mode) => updateSigmoid({ mode })}
  options={[
    { value: 'per-channel', label: 'Per Channel (Contrast)' },
    { value: 'rgb-ratio', label: 'RGB Ratio (Hue Preserve)' }
  ]}
/>

<Slider
  label="Hue Preservation"
  value={sigmoid.huePreservation * 100}
  onChange={(value) => updateSigmoid({ huePreservation: value / 100 })}
  min={0}
  max={100}
  step={1}
  tooltip="0% = more contrast, 100% = preserve colors"
/>
```

---

## 3. 📊 Updated Type System

All your TypeScript types are automatically updated!

### New Types Available

```typescript
import type { 
  ChromaticAberrationSettings,
  SigmoidMode 
} from './types/adjustments';

// Chromatic aberration
const ca: ChromaticAberrationSettings = {
  enabled: false,
  strength: 0.0,
};

// Enhanced sigmoid
const sigmoid: SigmoidSettings = {
  enabled: true,
  contrast: 1.0,
  skew: 0.0,
  middleGrey: 0.1845,
  mode: 'per-channel',    // or 'rgb-ratio'
  huePreservation: 0.0,
};
```

---

## 🚀 Complete Integration Example

### 1. Import Shaders

```typescript
// In your shader pipeline file
import {
  chromaticVertexShader,
  chromaticFragmentShader,
  applyChromaticUniforms,
  type ChromaticParams,
} from './engine/shaders/chromatic';

import {
  sigmoidVertexShader,
  sigmoidFragmentShader,
  applySigmoidUniforms,
  type SigmoidParams,
} from './engine/shaders/sigmoid';
```

### 2. Add to Pipeline

```typescript
class ImagePipeline {
  private chromaticProgram: ShaderProgram | null = null;
  
  initializeShaders() {
    // Compile chromatic aberration shader
    this.chromaticProgram = compileShaderProgram(
      gl,
      chromaticVertexShader,
      chromaticFragmentShader
    );
    
    // ... existing shaders ...
  }
  
  render(adjustments: AdjustmentState) {
    // Apply chromatic aberration correction (before tone mapping)
    if (adjustments.chromaticAberration.enabled) {
      this.applyChromatic(adjustments.chromaticAberration);
    }
    
    // Apply sigmoid with new modes
    if (adjustments.sigmoid.enabled) {
      this.applySigmoid(adjustments.sigmoid);
    }
  }
}
```

### 3. Create UI Components

```tsx
// ChromaticAberrationControl.tsx
export function ChromaticAberrationControl() {
  const dispatch = useDispatch();
  const ca = useSelector(state => state.adjustments.chromaticAberration);
  
  return (
    <div className="control-group">
      <h3>Lens Correction</h3>
      
      <Toggle
        label="Chromatic Aberration"
        checked={ca.enabled}
        onChange={(enabled) => 
          dispatch(updateChromaticAberration({ enabled }))
        }
      />
      
      <Slider
        label="Strength"
        value={ca.strength * 100}
        onChange={(value) => 
          dispatch(updateChromaticAberration({ strength: value / 100 }))
        }
        min={-100}
        max={100}
        step={1}
        disabled={!ca.enabled}
      />
    </div>
  );
}

// EnhancedSigmoidControl.tsx
export function EnhancedSigmoidControl() {
  const dispatch = useDispatch();
  const sigmoid = useSelector(state => state.adjustments.sigmoid);
  
  return (
    <div className="control-group">
      <h3>Sigmoid Tone Mapping</h3>
      
      {/* Existing controls */}
      <Slider label="Contrast" {...} />
      <Slider label="Skew" {...} />
      
      {/* NEW CONTROLS */}
      <Select
        label="Mode"
        value={sigmoid.mode}
        onChange={(mode) => dispatch(updateSigmoid({ mode }))}
        options={[
          { value: 'per-channel', label: 'Per Channel' },
          { value: 'rgb-ratio', label: 'RGB Ratio' }
        ]}
        tooltip="Per Channel = contrast, RGB Ratio = hue preservation"
      />
      
      <Slider
        label="Hue Preservation"
        value={sigmoid.huePreservation * 100}
        onChange={(value) => 
          dispatch(updateSigmoid({ huePreservation: value / 100 }))
        }
        min={0}
        max={100}
        step={1}
        tooltip="Blend between modes"
      />
    </div>
  );
}
```

### 4. Update Redux Actions

```typescript
// In adjustmentsSlice.ts
import { createSlice } from '@reduxjs/toolkit';

const adjustmentsSlice = createSlice({
  name: 'adjustments',
  initialState: createInitialAdjustmentState(),
  reducers: {
    // NEW: Chromatic aberration
    updateChromaticAberration: (state, action) => {
      state.chromaticAberration = {
        ...state.chromaticAberration,
        ...action.payload,
      };
    },
    
    // ENHANCED: Sigmoid with new parameters
    updateSigmoid: (state, action) => {
      state.sigmoid = {
        ...state.sigmoid,
        ...action.payload,
      };
    },
  },
});

export const { 
  updateChromaticAberration, 
  updateSigmoid 
} = adjustmentsSlice.actions;
```

---

## 🧪 Testing

All features include comprehensive tests:

```bash
# Test chromatic aberration
npm test -- src/engine/shaders/chromatic.test.ts

# Test sigmoid (existing tests auto-updated)
npm test -- src/engine/shaders/sigmoid.test.ts
```

---

## 📸 Example Workflows

### Workflow 1: Portrait with CA
```typescript
// Step 1: Correct chromatic aberration
chromaticAberration: {
  enabled: true,
  strength: 0.3,  // Subtle correction
}

// Step 2: Tone map with hue preservation
sigmoid: {
  enabled: true,
  mode: 'rgb-ratio',      // Preserve skin tones
  huePreservation: 0.8,   // Strong hue preservation
  contrast: 1.3,
}
```

### Workflow 2: Landscape with Punch
```typescript
// Step 1: No CA (landscape lens is good)
chromaticAberration: {
  enabled: false,
}

// Step 2: Punchy tone mapping
sigmoid: {
  enabled: true,
  mode: 'per-channel',    // More local contrast
  huePreservation: 0.3,   // Some hue shift OK
  contrast: 1.8,
}
```

### Workflow 3: Wide-Angle Architecture
```typescript
// Step 1: Strong CA correction
chromaticAberration: {
  enabled: true,
  strength: 0.7,  // Wide-angle lenses need more
}

// Step 2: Balanced tone mapping
sigmoid: {
  enabled: true,
  mode: 'per-channel',
  huePreservation: 0.5,   // Balanced blend
  contrast: 1.5,
}
```

---

## 🎯 Pro Tips

### Chromatic Aberration:
1. **Check corners first** - CA is always worst at image edges
2. **Zoom to 100%** - CA is subtle, you need to zoom in
3. **Start at 0.5** - Then adjust up or down
4. **Can go negative** - If overcorrected, use negative values

### Sigmoid Mode Selection:
1. **Portraits → RGB Ratio** - Preserves skin tones
2. **Landscapes → Per Channel** - More punch and depth
3. **Product Photos → RGB Ratio** - Accurate colors
4. **B&W → Per Channel** - Maximum local contrast

### Hue Preservation:
1. **Start at 0%** - See maximum contrast
2. **Move to 100%** - See maximum hue preservation
3. **Find sweet spot** - Usually 30-70% works best
4. **Per-image basis** - Each photo is different

---

## 🔧 Troubleshooting

### "Chromatic aberration not working"
- Check if `enabled: true`
- Make sure strength is non-zero
- Verify shader is in pipeline before tone mapping
- CA is subtle - zoom to 100% to see it

### "Sigmoid mode toggle not changing anything"
- Check if contrast is very low (< 0.5)
- Try different images - some don't show mode differences
- Compare at 100% zoom
- Make sure both modes are implemented in uniforms

### "Types not found"
- Restart TypeScript server
- Run `npm run build` to regenerate types
- Check imports match new interface names

---

## 📚 Further Reading

- [DARKTABLE_COMPARISON.md](./DARKTABLE_COMPARISON.md) - Full darktable comparison
- [IMPLEMENTATION_RECOMMENDATIONS.md](./IMPLEMENTATION_RECOMMENDATIONS.md) - Implementation details
- [ENHANCEMENTS_COMPLETED.md](./ENHANCEMENTS_COMPLETED.md) - What was built

---

## ✨ Enjoy!

You now have professional-grade chromatic aberration correction and advanced sigmoid tone mapping - features that match desktop professional software like darktable and Lightroom!

Happy editing! 📷✨

