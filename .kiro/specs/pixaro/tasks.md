# Implementation Plan

- [x] 1. Set up project structure and core dependencies





  - Initialize Vite + React + TypeScript project with proper configuration
  - Install core dependencies: Redux Toolkit, React Router, CSS Modules
  - Configure build settings for code splitting (vendor, image-processing, ai chunks)
  - Set up ESLint, Prettier, and TypeScript strict mode
  - Create folder structure: /components, /engine, /store, /workers, /utils, /types
  - _Requirements: 13.1, 13.4, 13.5_

- [x] 2. Implement core type definitions and interfaces





  - Define AdjustmentState interface with all editing parameters
  - Define ProcessedImage, ImageMetadata, and ImageState types
  - Define component prop interfaces (Canvas, EditingPanel, controls)
  - Define WorkerTask and WorkerPool interfaces
  - Define error types and ErrorCode enum
  - _Requirements: All requirements (foundational)_

- [x] 3. Create Redux store and state management




  - [x] 3.1 Set up Redux store with slices for image, adjustments, ui, history, presets


    - Configure Redux Toolkit store with proper middleware
    - Create imageSlice for managing original and current image state
    - Create adjustmentsSlice with initial values for all parameters
    - Create uiSlice for managing active section, zoom, pan, tool state
    - Create historySlice implementing undo/redo with 50-action limit
    - Create presetSlice for managing built-in and custom presets
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_
  - [x] 3.2 Write unit tests for Redux reducers and actions


    - Test adjustment value updates and clamping
    - Test undo/redo history management
    - Test preset save/load/delete operations
    - _Requirements: 11.1, 11.2, 11.3_

- [x] 4. Build image upload and file handling system





  - [x] 4.1 Create FileUploader component with drag-and-drop support


    - Implement file input with accept attribute for supported formats
    - Add drag-and-drop zone with visual feedback
    - Validate file size (max 50MB) and display error for oversized files
    - Dispatch file to image loading pipeline
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 4.2 Implement image decoder for JPEG, PNG, TIFF formats


    - Use Canvas API to decode standard formats
    - Extract ImageData and dimensions
    - Parse EXIF metadata using exif-js or similar library
    - Preserve color profile information
    - Handle corrupted files with appropriate error messages
    - _Requirements: 1.1, 1.2, 1.4_
  - [x] 4.3 Set up Web Worker for RAW file decoding


    - Create worker script for RAW processing
    - Integrate WASM-based RAW decoder (libraw or dcraw.js)
    - Implement worker communication protocol for decode tasks
    - Handle RAW formats: CR2, NEF, ARW, DNG
    - _Requirements: 1.2_
  - [x] 4.4 Write integration tests for file upload workflow


    - Test successful upload of various formats
    - Test file size validation
    - Test error handling for corrupted files
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 5. Implement WebGL-based image processing engine





  - [x] 5.1 Create WebGL context manager and texture handling


    - Initialize WebGL2 context with error handling and fallback
    - Implement texture creation and disposal utilities
    - Create framebuffer management for multi-pass rendering
    - Implement texture caching with LRU eviction
    - Add WebGL context lost/restored event handlers
    - _Requirements: 2.3, 3.4, 4.5_
  - [x] 5.2 Write base shader for texture loading and display


    - Create vertex shader for quad rendering
    - Create fragment shader for basic texture sampling
    - Implement shader compilation and linking utilities
    - Add shader error handling and logging
    - _Requirements: 2.3, 3.4_
  - [x] 5.3 Implement tonal adjustment shader


    - Write fragment shader for exposure, contrast, highlights, shadows, whites, blacks
    - Use proper color space conversions (sRGB to linear)
    - Implement efficient GPU-based calculations
    - Add uniform bindings for adjustment parameters
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [x] 5.4 Implement color adjustment shader


    - Write fragment shader for temperature (Kelvin to RGB conversion)
    - Implement tint adjustment in LAB color space
    - Add vibrance (selective saturation) algorithm
    - Add saturation adjustment
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 5.5 Implement HSL adjustment shader


    - Write fragment shader for selective color adjustments
    - Implement hue range detection for 8 color channels
    - Add hue, saturation, and luminance modifications per channel
    - Optimize for real-time performance
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 5.6 Implement detail adjustment shader


    - Write sharpening algorithm using unsharp mask technique
    - Implement clarity using local contrast enhancement
    - Add luminance noise reduction using bilateral filtering
    - Add color noise reduction
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 5.7 Implement effects shader


    - Write vignette effect with amount, midpoint, and feather controls
    - Implement grain effect with size variations (fine, medium, coarse)
    - Add proper blending for natural-looking effects
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_
  - [x] 5.8 Create shader pipeline orchestrator


    - Implement multi-pass rendering system
    - Chain shaders in correct order: base → tonal → color → HSL → detail → effects
    - Add dirty flagging to skip unchanged shader passes
    - Implement preview downscaling (max 2048px) for performance
    - _Requirements: 2.3, 3.4, 4.5, 14.5_
  - [x] 5.9 Write unit tests for shader utilities and calculations


    - Test color space conversion functions
    - Test adjustment value mapping
    - Test texture management
    - _Requirements: 2.5, 3.5_



- [x] 6. Build Canvas component for image display


  - [x] 6.1 Create Canvas component with WebGL rendering


    - Set up canvas element with proper sizing
    - Initialize WebGL context and connect to processing engine
    - Implement render loop that applies current adjustments
    - Add zoom and pan controls (mouse wheel, drag)
    - Implement fit-to-screen and reset view functions
    - _Requirements: 2.3, 3.4, 4.5, 14.5_
  - [x] 6.2 Add comparison mode (before/after toggle)


    - Implement button and keyboard shortcut (spacebar) for toggle
    - Switch between original and edited image within 100ms
    - Add split-view mode showing both versions side-by-side
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_
  - [x] 6.3 Implement histogram display


    - Calculate RGB histogram from current image data
    - Use Web Worker for histogram calculation to avoid blocking
    - Render histogram using Canvas 2D API
    - Update histogram in real-time as adjustments change
    - _Requirements: 2.4_
  - [x] 6.4 Write integration tests for Canvas component


    - Test rendering with various adjustments
    - Test zoom and pan functionality
    - Test comparison mode toggle
    - _Requirements: 2.3, 12.1, 12.2_

- [x] 7. Create editing panel UI components





  - [x] 7.1 Build collapsible section container component


    - Create accordion-style sections for different adjustment categories
    - Implement expand/collapse animations
    - Persist section state in Redux
    - Style with dark theme colors
    - _Requirements: 9.3_
  - [x] 7.2 Create slider control component


    - Build reusable slider with label, value display, and unit
    - Implement smooth dragging with proper value clamping
    - Add keyboard support (arrow keys for fine adjustment)
    - Display current value with appropriate precision
    - Style with high contrast for dark theme
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 14.1, 14.3_
  - [x] 7.3 Build Basic adjustments section


    - Add sliders for exposure (-5 to +5, step 0.01)
    - Add sliders for contrast, highlights, shadows, whites, blacks (-100 to +100)
    - Connect sliders to Redux adjustments state
    - Trigger canvas re-render on value changes
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 7.4 Build Color adjustments section


    - Add temperature slider (2000K to 50000K, step 50)
    - Add tint slider (-150 to +150)
    - Add vibrance and saturation sliders (-100 to +100)
    - Connect to Redux and trigger updates
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 7.5 Build Detail adjustments section


    - Add sharpening slider (0 to 150) with warning above 100
    - Add clarity slider (-100 to +100)
    - Add luminance and color noise reduction sliders (0 to 100)
    - Connect to Redux and trigger updates
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [x] 7.6 Build HSL adjustments section


    - Create 8 color channel groups (Red, Orange, Yellow, Green, Aqua, Blue, Purple, Magenta)
    - Add hue, saturation, luminance sliders for each channel (-100 to +100)
    - Implement collapsible sub-sections for each color
    - Connect to Redux and trigger updates
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [x] 7.7 Build Effects section


    - Add vignette amount slider (-100 to +100)
    - Add vignette midpoint and feather sliders
    - Add grain amount slider (0 to 100)
    - Add grain size dropdown (fine, medium, coarse)
    - Connect to Redux and trigger updates
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_
  - [x] 7.8 Write component tests for editing panel


    - Test slider value updates
    - Test section expand/collapse
    - Test Redux integration
    - _Requirements: 9.3_

- [x] 8. Implement crop and straighten tools





  - [x] 8.1 Create crop tool component


    - Implement draggable crop overlay with corner and edge handles
    - Add aspect ratio presets (1:1, 4:3, 16:9, original, freeform)
    - Display composition grid overlays (rule of thirds)
    - Store crop bounds in Redux adjustments state
    - Apply crop transformation in processing engine
    - _Requirements: 5.1, 5.2, 5.4_
  - [x] 8.2 Create straighten tool component


    - Add angle slider (-45 to +45 degrees, step 0.1)
    - Implement visual rotation preview
    - Display grid overlay for alignment reference
    - Apply rotation transformation maintaining quality
    - _Requirements: 5.3, 5.4, 5.5_
  - [x] 8.3 Write integration tests for geometric tools


    - Test crop bounds calculation
    - Test aspect ratio constraints
    - Test rotation angle application
    - _Requirements: 5.1, 5.3_



- [x] 9. Build preset management system


  - [x] 9.1 Create built-in presets


    - Define 20+ preset configurations covering common styles
    - Include presets like: Portrait, Landscape, Black & White, Vintage, Vibrant, Matte, etc.
    - Store presets as AdjustmentState objects
    - Generate thumbnail previews for each preset
    - _Requirements: 7.1_
  - [x] 9.2 Implement preset application logic


    - Create function to apply preset adjustments to current state
    - Ensure application completes within 200ms
    - Add preset to undo history
    - Trigger canvas re-render
    - _Requirements: 7.2_
  - [x] 9.3 Build PresetManager component


    - Display grid of preset thumbnails with names
    - Implement click handler to apply presets
    - Add "Save as Preset" button to save current adjustments
    - Show modal for naming custom presets
    - Display custom presets separately from built-in
    - Add delete button for custom presets only
    - _Requirements: 7.1, 7.2, 7.3, 7.5_
  - [x] 9.4 Implement browser storage for custom presets


    - Use LocalStorage to persist custom presets
    - Implement save, load, and delete operations
    - Handle storage quota exceeded errors
    - Load custom presets on app initialization
    - _Requirements: 7.3, 7.4_
  - [x] 9.5 Write tests for preset system


    - Test preset application
    - Test custom preset save/load/delete
    - Test LocalStorage integration
    - _Requirements: 7.2, 7.3, 7.4, 7.5_

- [x] 10. Implement AI-powered removal tool




  - [x] 10.1 Set up TensorFlow.js and load inpainting model


    - Install @tensorflow/tfjs and @tensorflow/tfjs-backend-webgl
    - Implement lazy loading of AI model (only when tool first used)
    - Use pre-trained inpainting model (LaMa or similar architecture)
    - Add loading indicator during model download
    - Handle model loading failures with retry logic (max 3 attempts)
    - _Requirements: 15.2, 15.3, 15.5_
  - [x] 10.2 Create brush-based selection tool


    - Implement canvas overlay for brush drawing
    - Add adjustable brush size slider (5 to 200 pixels)
    - Draw brush strokes to create removal mask
    - Store mask as Uint8Array with bounds
    - Add clear and undo buttons for mask editing
    - _Requirements: 15.1_
  - [x] 10.3 Implement AI inpainting in Web Worker


    - Create worker for running TensorFlow.js inference
    - Pass image data and mask to worker
    - Run inpainting model to generate fill content
    - Return processed image data to main thread
    - Implement timeout handling (5 seconds max)
    - _Requirements: 15.2, 15.3, 15.5_
  - [x] 10.4 Add spot removal mode optimization


    - Detect small masks (under 500 pixels)
    - Use faster processing path for spot removal
    - Ensure processing completes within 500ms
    - Apply result to canvas and add to history
    - _Requirements: 15.4_
  - [x] 10.5 Integrate removal tool into UI


    - Add removal tool button to activate tool mode
    - Display brush size control when tool is active
    - Show progress indicator during processing
    - Add removal operations to undo history
    - Store removal operations in adjustments state
    - _Requirements: 15.1, 15.2, 15.5_
  - [x] 10.6 Write integration tests for removal tool


    - Test mask creation and editing
    - Test AI processing workflow
    - Test spot removal optimization
    - _Requirements: 15.1, 15.2, 15.4_

- [x] 11. Create export functionality





  - [x] 11.1 Build ExportDialog component


    - Create modal dialog with export settings
    - Add format selector (JPEG, PNG, TIFF)
    - Add quality slider for JPEG (1 to 100)
    - Add resolution inputs with aspect ratio lock
    - Add metadata preservation checkbox
    - Style with dark theme
    - _Requirements: 8.1, 8.2, 8.3, 8.5_
  - [x] 11.2 Implement full-resolution export rendering


    - Create Web Worker for export processing
    - Apply all adjustments at original resolution (not preview size)
    - Render using Canvas API for export (not WebGL)
    - Handle large images without memory issues
    - Implement progress tracking for long exports
    - _Requirements: 8.3, 8.4_
  - [x] 11.3 Implement format-specific export logic


    - JPEG: Apply quality compression, embed EXIF if requested
    - PNG: Lossless compression, preserve transparency
    - TIFF: Uncompressed or LZW compression
    - Generate Blob from canvas data
    - Trigger browser download with proper filename
    - _Requirements: 8.1, 8.2, 8.4, 8.5_
  - [x] 11.4 Add export error handling


    - Handle timeout for exports exceeding 5 seconds
    - Handle out-of-memory errors gracefully
    - Display user-friendly error messages
    - Provide option to retry or reduce resolution
    - _Requirements: 8.4_
  - [x] 11.5 Write integration tests for export workflow


    - Test export in different formats
    - Test quality settings
    - Test metadata preservation
    - _Requirements: 8.1, 8.2, 8.5_

- [x] 12. Implement undo/redo system




  - [x] 12.1 Create history middleware for Redux


    - Intercept adjustment actions and update history state
    - Maintain past, present, and future arrays
    - Limit history to 50 actions maximum
    - Implement history pruning when limit exceeded
    - _Requirements: 11.1_
  - [x] 12.2 Add undo/redo action handlers


    - Create undo action that moves present to future and restores from past
    - Create redo action that moves present to past and restores from future
    - Ensure canvas updates within 100ms after undo/redo
    - _Requirements: 11.2, 11.3_
  - [x] 12.3 Implement keyboard shortcuts


    - Add Ctrl+Z (Cmd+Z on Mac) for undo
    - Add Ctrl+Y (Cmd+Shift+Z on Mac) for redo
    - Prevent default browser behavior
    - Display current history position indicator
    - _Requirements: 11.4, 11.5_
  - [x] 12.4 Write tests for history system


    - Test undo/redo with multiple actions
    - Test history limit enforcement
    - Test keyboard shortcuts
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [x] 13. Build dark theme UI and layout




  - [x] 13.1 Create CSS custom properties for dark theme


    - Define color palette with background luminance below 20%
    - Define text colors with 4.5:1 contrast ratio minimum
    - Define accent colors for interactive elements
    - Define spacing and sizing variables
    - _Requirements: 9.1, 9.2_
  - [x] 13.2 Implement main application layout


    - Create three-column layout: sidebar (left), canvas (center), editing panel (right)
    - Make layout responsive for different screen sizes
    - Use CSS Grid for main structure
    - Add neutral gray (#808080) surrounding canvas area
    - Ensure all controls accessible within 2 clicks
    - _Requirements: 9.3, 9.4, 9.5_
  - [x] 13.3 Style all UI components with dark theme


    - Apply dark theme to all buttons, sliders, inputs
    - Add hover and focus states with proper contrast
    - Implement smooth transitions for interactive elements
    - Add focus indicators for keyboard navigation
    - _Requirements: 9.1, 9.2_
  - [x] 13.4 Perform visual regression testing


    - Capture screenshots of all major UI states
    - Test responsive breakpoints
    - Verify contrast ratios
    - _Requirements: 9.1, 9.2_

- [x] 14. Integrate advertising system




  - [x] 14.1 Set up ad container components


    - Create AdContainer component with lazy loading
    - Position one ad in sidebar-bottom (300x250)
    - Position one ad in bottom-bar (728x90)
    - Ensure ads positioned outside Canvas and Editing Panel
    - _Requirements: 10.1, 10.2_
  - [x] 14.2 Implement ad refresh logic


    - Track user activity (mouse/keyboard input)
    - Pause ad refresh when user active within last 30 seconds
    - Set minimum refresh interval of 30 seconds
    - Implement different intervals for different positions
    - _Requirements: 10.5_
  - [x] 14.3 Integrate Google AdSense or similar network


    - Add ad network script with lazy loading
    - Configure ad units with proper IDs
    - Implement ad blocker detection (graceful handling)
    - Ensure no pop-ups or auto-playing audio
    - _Requirements: 10.3, 10.4_
  - [x] 14.4 Test ad integration



    - Verify ads don't interfere with editing controls
    - Test refresh pause during active editing
    - Verify maximum 2 ads displayed simultaneously
    - Test keyboard shortcuts still work with ads present
    - _Requirements: 10.1, 10.2, 10.4, 10.5_

- [x] 15. Implement error handling and user feedback





  - [x] 15.1 Create error boundary components


    - Wrap main app sections in error boundaries
    - Display user-friendly error messages
    - Provide recovery options (reload, reset)
    - Log errors to console in development
    - _Requirements: 1.3, 4.4_
  - [x] 15.2 Add loading indicators


    - Show spinner during image upload
    - Show progress bar during AI processing
    - Show loading state during export
    - Display estimated time for long operations
    - _Requirements: 1.1, 8.4, 15.5_
  - [x] 15.3 Implement toast notifications


    - Create toast component for success/error messages
    - Show notifications for: file uploaded, preset saved, export complete, errors
    - Auto-dismiss after 3-5 seconds
    - Allow manual dismissal
    - _Requirements: 1.3, 7.3, 8.4_
  - [x] 15.4 Add WebGL fallback handling


    - Detect WebGL support on initialization
    - Fall back to Canvas API if WebGL unavailable
    - Display warning about reduced performance
    - Ensure all features still functional
    - _Requirements: 13.4_
-

- [x] 16. Optimize performance and implement caching



  - [x] 16.1 Implement preview downscaling


    - Downscale images to max 2048px for preview rendering
    - Store both original and preview versions
    - Use preview for all real-time adjustments
    - Switch to original only for export
    - _Requirements: 2.3, 3.4, 4.5_
  - [x] 16.2 Add shader compilation caching


    - Cache compiled shader programs
    - Reuse shaders across renders
    - Implement shader warm-up on app load
    - _Requirements: 2.3, 3.4_
  - [x] 16.3 Implement texture memory management


    - Track GPU memory usage
    - Dispose unused textures promptly
    - Implement LRU cache for processed images
    - Add memory pressure handling
    - _Requirements: 2.3, 3.4_
  - [x] 16.4 Optimize Web Worker usage


    - Create worker pool with 2-4 workers
    - Implement task queue for worker jobs
    - Use transferable objects to minimize copying
    - Reuse workers instead of creating new ones
    - _Requirements: 8.4, 15.2_
  - [x] 16.5 Perform performance profiling


    - Measure initial load time (target < 3s)
    - Measure time to interactive (target < 4s)
    - Measure adjustment preview latency (target < 100ms)
    - Measure export time for various sizes
    - Identify and optimize bottlenecks
    - _Requirements: 13.5, 2.3, 3.4, 8.4_

- [x] 17. Add accessibility features




  - [x] 17.1 Implement keyboard navigation


    - Add tab order for all interactive elements
    - Implement keyboard shortcuts for common actions
    - Add shortcut reference panel (accessible via '?' key)
    - Ensure all features accessible without mouse
    - _Requirements: 11.4_
  - [x] 17.2 Add ARIA labels and screen reader support


    - Add aria-label to all buttons and controls
    - Add aria-live regions for status updates
    - Add role attributes where appropriate
    - Test with screen readers (NVDA, JAWS)
    - _Requirements: 9.2_
  - [x] 17.3 Ensure focus indicators and contrast


    - Add visible focus indicators to all interactive elements
    - Verify 4.5:1 contrast ratio for all text
    - Test with keyboard-only navigation
    - _Requirements: 9.2_
- [x] 18. Create multi-photo library view




- [ ] 18. Create multi-photo library view

  - [x] 18.1 Implement photo library component


    - Display thumbnail grid of uploaded photos
    - Allow selecting photo to edit
    - Show current photo indicator
    - Persist library in session (not across page reloads)
    - _Requirements: 1.5_
  - [x] 18.2 Add photo switching functionality


    - Allow switching between photos without losing edits
    - Store adjustment state per photo
    - Update canvas when switching photos
    - _Requirements: 1.5_

- [x] 19. Final integration and polish




  - [x] 19.1 Integrate all components into main App


    - Wire up FileUploader, Canvas, EditingPanel, PresetManager
    - Connect all Redux slices
    - Implement routing if needed
    - Add keyboard shortcut handlers at app level
    - _Requirements: All requirements_
  - [x] 19.2 Implement responsive design


    - Test layout on various screen sizes
    - Adjust layout for tablets and mobile devices
    - Ensure touch-friendly controls on mobile
    - _Requirements: 13.4_
  - [x] 19.3 Add browser compatibility checks


    - Test on Chrome, Firefox, Safari, Edge (latest 2 versions)
    - Add polyfills if needed
    - Display warning for unsupported browsers
    - _Requirements: 13.4_
  - [x] 19.4 Optimize bundle size


    - Analyze bundle with Vite build analyzer
    - Implement code splitting for large dependencies
    - Lazy load non-critical features
    - Minimize and compress assets
    - _Requirements: 13.5_
  - [x] 19.5 Perform end-to-end testing


    - Test complete workflow: upload → edit → export
    - Test preset application across multiple photos
    - Test undo/redo with complex edit sequences
    - Test AI removal tool workflow
    - Test ad integration behavior
    - _Requirements: All requirements_

- [x] 20. Documentation and deployment preparation





  - [x] 20.1 Create README with setup instructions


    - Document project structure
    - Add development setup steps
    - List available scripts
    - Document environment variables
    - _Requirements: 13.1_
  - [x] 20.2 Configure production build


    - Set up Vite production configuration
    - Enable compression (gzip/brotli)
    - Configure asset optimization
    - Set up source maps for debugging
    - _Requirements: 13.5_
  - [x] 20.3 Prepare deployment configuration


    - Create deployment config for Vercel/Netlify/Cloudflare Pages
    - Set up CDN configuration
    - Configure caching headers
    - Set up analytics (optional)
    - _Requirements: 13.1, 13.5_
