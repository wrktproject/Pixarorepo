# Task 13: Quality Preservation Architecture

## Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Export Flow                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  ExportDialog (UI)                                           │
│  - Collects export settings (format, quality, dimensions)   │
│  - Shows progress and errors                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  useExport Hook                                              │
│  - Manages export state                                      │
│  - Coordinates between UI and processor                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  ExportProcessor                                             │
│  - Scales image if needed                                    │
│  - Calls ExportRenderer for high-quality processing          │
│  - Encodes to desired format (JPEG/PNG/TIFF)                │
│  - Triggers download                                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  ExportRenderer (NEW)                                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 1. Create OffscreenCanvas at full resolution         │  │
│  │ 2. Initialize WebGL2 context                         │  │
│  │ 3. Create ShaderPipeline in 'export' mode            │  │
│  │ 4. Load image (no downscaling)                       │  │
│  │ 5. Render with all adjustments (16-bit float)       │  │
│  │ 6. Apply dithering pass                              │  │
│  │ 7. Read pixels from GPU                              │  │
│  │ 8. Flip vertically and return ImageData             │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  ShaderPipeline (Enhanced)                                   │
│  - Quality mode: 'preview' or 'export'                      │
│  - Export mode: full resolution, no downscaling             │
│  - Uses RGBA16F textures for intermediate passes            │
│  - Minimizes color space conversions                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Shader Passes (Linear RGB, 16-bit float)                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Base: sRGB → Linear RGB                              │  │
│  │ Geometric: Crop & Rotation                           │  │
│  │ Tonal: Exposure, Contrast, Highlights, Shadows       │  │
│  │ Color: Temperature, Tint, Vibrance, Saturation       │  │
│  │ HSL: Per-channel adjustments                         │  │
│  │ Clarity: Multi-pass blur & composite                 │  │
│  │ Detail: Sharpening & noise reduction                 │  │
│  │ Effects: Vignette & grain                            │  │
│  │ Output: Tone mapping & Linear RGB → sRGB            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  DitheringShader (NEW)                                       │
│  - Applies 8x8 Bayer matrix dithering                       │
│  - Reduces banding when converting float → 8-bit            │
│  - Configurable strength (0.0 to 1.0)                       │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Quality Preservation Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│ Input: sRGB ImageData (8-bit)                                │
│ Example: [255, 128, 64, 255] per pixel                       │
└──────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ Upload to GPU Texture (RGBA8)                                │
│ - Stored as normalized 8-bit values                          │
│ - No conversion yet                                           │
└──────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ Base Shader: sRGB → Linear RGB                               │
│ - Accurate sRGB transfer function                            │
│ - Output: Float values in linear space                       │
│ - Example: [1.0, 0.212, 0.027, 1.0]                         │
└──────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ Intermediate Passes (RGBA16F Textures)                       │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ Pass 1: Geometric (crop, rotation)                     │   │
│ │   ↓ RGBA16F texture                                    │   │
│ │ Pass 2: Tonal (exposure, contrast, etc.)               │   │
│ │   ↓ RGBA16F texture                                    │   │
│ │ Pass 3: Color (temperature, tint, saturation)          │   │
│ │   ↓ RGBA16F texture                                    │   │
│ │ Pass 4: HSL (per-channel adjustments)                  │   │
│ │   ↓ RGBA16F texture                                    │   │
│ │ Pass 5: Clarity (multi-pass blur)                      │   │
│ │   ↓ RGBA16F texture                                    │   │
│ │ Pass 6: Detail (sharpening, noise reduction)           │   │
│ │   ↓ RGBA16F texture                                    │   │
│ │ Pass 7: Effects (vignette, grain)                      │   │
│ │   ↓ RGBA16F texture                                    │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ Benefits:                                                     │
│ - 16-bit float: ~65,000 levels per channel vs 256 in 8-bit  │
│ - Preserves dynamic range (values can exceed 1.0)           │
│ - No precision loss between passes                           │
│ - Smooth gradients without banding                           │
└──────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ Output Shader: Tone Mapping & Linear RGB → sRGB             │
│ - ACES tone mapping for HDR content                          │
│ - Accurate sRGB transfer function                            │
│ - Clamp to [0, 1] range                                      │
│ - Output: Float values in sRGB space                         │
└──────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ Dithering Shader: Apply Bayer Matrix                         │
│ - 8x8 Bayer matrix for ordered dithering                     │
│ - Adds small noise pattern to break up banding               │
│ - Strength: 0.5 (balanced)                                   │
│ - Output: Float values with dither applied                   │
└──────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ Read Pixels: Float → 8-bit                                   │
│ - GPU converts float to 8-bit with dithering                 │
│ - Dithering reduces quantization artifacts                   │
│ - Result: Smooth gradients in 8-bit output                   │
└──────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ Output: sRGB ImageData (8-bit, high quality)                 │
│ - Ready for encoding to JPEG/PNG/TIFF                        │
│ - Minimal banding thanks to dithering                        │
│ - Accurate colors thanks to minimal conversions              │
└──────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Separate Export Renderer
**Decision**: Create dedicated `ExportRenderer` class instead of reusing preview pipeline

**Rationale**:
- Export has different requirements (quality over speed)
- Allows using OffscreenCanvas without affecting main canvas
- Cleaner separation of concerns
- Easier to test and maintain

**Trade-offs**:
- ✅ Better quality control
- ✅ No impact on preview performance
- ❌ Slightly more code to maintain

### 2. 16-bit Float Textures
**Decision**: Use RGBA16F for all intermediate textures in export mode

**Rationale**:
- Preserves full dynamic range (HDR support)
- Prevents precision loss between passes
- Eliminates banding in gradients
- Industry standard for high-quality processing

**Trade-offs**:
- ✅ Professional-grade quality
- ✅ Supports RAW images
- ❌ 2x memory usage vs 8-bit
- ❌ Requires WebGL2 (fallback to RGBA8)

### 3. Bayer Matrix Dithering
**Decision**: Use 8x8 Bayer matrix for ordered dithering

**Rationale**:
- Efficient (no random number generation)
- Predictable pattern
- Well-established technique
- Good balance of quality and performance

**Trade-offs**:
- ✅ Eliminates banding artifacts
- ✅ Fast (single shader pass)
- ❌ Visible pattern in flat areas (mitigated by low strength)

### 4. Single Color Space Conversion
**Decision**: Convert only at input (sRGB→Linear) and output (Linear→sRGB)

**Rationale**:
- Minimizes rounding errors
- Faster processing
- Simpler to reason about
- Industry best practice

**Trade-offs**:
- ✅ Better color accuracy
- ✅ Fewer GPU operations
- ❌ Requires careful shader design

### 5. OffscreenCanvas for Export
**Decision**: Use OffscreenCanvas instead of main canvas for export

**Rationale**:
- Doesn't interfere with preview
- Can render at different resolution
- Better resource isolation
- Cleaner architecture

**Trade-offs**:
- ✅ No impact on UI
- ✅ Better error handling
- ❌ Requires modern browser
- ❌ Slightly more complex setup

## Performance Characteristics

### Memory Usage
```
Preview Mode (2048px max):
- Source texture: 2048 × 1536 × 4 bytes = 12.6 MB
- 8 intermediate textures (RGBA16F): 8 × 12.6 MB × 2 = 201.6 MB
- Total: ~214 MB

Export Mode (6000px full res):
- Source texture: 6000 × 4000 × 4 bytes = 96 MB
- 8 intermediate textures (RGBA16F): 8 × 96 MB × 2 = 1,536 MB
- Total: ~1,632 MB (1.6 GB)

Note: Framebuffer pooling reuses textures to reduce memory pressure
```

### Processing Time
```
Preview (2048px):
- All passes: ~16ms (60 FPS)
- With dithering: ~18ms (55 FPS)

Export (6000px):
- All passes: ~150ms
- With dithering: ~170ms
- Total export time: ~2-3 seconds (including encoding)

Acceptable for export use case (quality over speed)
```

### GPU Requirements
```
Minimum:
- WebGL2 support
- EXT_color_buffer_float extension (for RGBA16F)
- ~2 GB VRAM for large exports

Fallback:
- RGBA8 textures if float16 not supported
- Still better than Canvas 2D processing
```

## Testing Strategy

### Unit Tests
1. **Export Renderer Initialization**
   - Creates OffscreenCanvas
   - Initializes WebGL2 context
   - Sets up shader pipeline

2. **Full Resolution Rendering**
   - Verifies no downscaling
   - Checks output dimensions
   - Validates pixel data

3. **Dithering Application**
   - Enables/disables dithering
   - Configures strength
   - Verifies shader execution

4. **Error Handling**
   - WebGL context creation failure
   - GPU sync timeout
   - Memory allocation errors

### Integration Tests
1. **End-to-End Export**
   - Load image → Apply adjustments → Export
   - Verify file format
   - Check file size

2. **Quality Comparison**
   - Compare with previous export method
   - Measure banding artifacts
   - Verify color accuracy

3. **Performance Testing**
   - Measure export time for various sizes
   - Monitor memory usage
   - Check GPU utilization

## Future Enhancements

### Short Term
1. **Configurable Dithering**
   - UI control for dither strength
   - Option to disable dithering
   - Different dithering algorithms

2. **Export Presets**
   - Save/load export settings
   - Quick access to common formats
   - Batch export support

### Long Term
1. **16-bit PNG Export**
   - Support for 16-bit PNG format
   - Preserve full dynamic range
   - Useful for professional workflows

2. **Color Profile Support**
   - Embed ICC profiles
   - Convert between color spaces
   - Support for wide gamut displays

3. **Tile-based Export**
   - Process very large images in tiles
   - Reduce memory requirements
   - Enable gigapixel exports

## Conclusion

The quality preservation implementation provides professional-grade export quality through:
- 16-bit float processing pipeline
- Full resolution rendering
- Bayer matrix dithering
- Minimal color space conversions
- Proper dynamic range preservation

This architecture balances quality, performance, and maintainability while providing a solid foundation for future enhancements.
