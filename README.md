# Pixaro

A professional web-based photo editing application built with React, TypeScript, and WebGL. Pixaro provides Lightroom-style editing capabilities directly in your browser with no account required.

## Features

- **Professional Editing Tools**: Exposure, contrast, highlights, shadows, color temperature, HSL adjustments, and more
- **AI-Powered Removal**: Intelligent object and blemish removal using TensorFlow.js
- **Non-Destructive Editing**: All edits are applied in real-time without modifying the original image
- **Preset System**: 20+ built-in presets plus custom preset creation
- **Multiple Format Support**: JPEG, PNG, TIFF, and RAW formats (CR2, NEF, ARW, DNG)
- **WebGL Acceleration**: Hardware-accelerated image processing for smooth real-time previews
- **Dark Theme UI**: Professional dark interface optimized for photo editing
- **Undo/Redo**: Full edit history with up to 50 actions
- **Privacy First**: All processing happens locally in your browser - no uploads to servers

## Quick Start

### Prerequisites

- Node.js 18+ and npm (or yarn/pnpm)
- Modern web browser with WebGL 2.0 support (Chrome, Firefox, Safari, Edge - latest 2 versions)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd pixaro
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to `http://localhost:5173`

## Available Scripts

### Development

- `npm run dev` - Start development server with hot module replacement
- `npm run preview` - Preview production build locally

### Building

- `npm run build` - Build optimized production bundle
- `npm run build:analyze` - Build and open bundle analyzer to inspect chunk sizes

### Code Quality

- `npm run lint` - Run ESLint to check for code issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check if code is properly formatted

### Testing

- `npm run test` - Run all tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run test:ui` - Open Vitest UI for interactive testing

## Project Structure

```
pixaro/
├── src/
│   ├── components/        # React UI components
│   │   ├── Canvas.tsx     # Main image display with WebGL rendering
│   │   ├── EditingPanel.tsx  # Adjustment controls container
│   │   ├── PresetManager.tsx # Preset management UI
│   │   ├── RemovalTool.tsx   # AI-powered removal tool
│   │   └── ...
│   ├── engine/            # WebGL image processing engine
│   │   ├── imageProcessor.ts  # Core processing pipeline
│   │   ├── shaderUtils.ts     # WebGL shader management
│   │   ├── textureManager.ts  # GPU texture handling
│   │   └── ...
│   ├── store/             # Redux state management
│   │   ├── index.ts       # Store configuration
│   │   ├── imageSlice.ts  # Image state
│   │   ├── adjustmentsSlice.ts  # Adjustment parameters
│   │   ├── historySlice.ts      # Undo/redo history
│   │   └── ...
│   ├── workers/           # Web Workers for CPU-intensive tasks
│   │   ├── workerPool.ts  # Worker pool management
│   │   ├── rawDecoder.worker.ts  # RAW file decoding
│   │   └── aiInpainting.worker.ts  # AI removal processing
│   ├── utils/             # Helper functions and utilities
│   ├── types/             # TypeScript type definitions
│   ├── hooks/             # Custom React hooks
│   ├── data/              # Static data (presets, etc.)
│   ├── test/              # Test files
│   ├── App.tsx            # Main application component
│   └── main.tsx           # Application entry point
├── public/                # Static assets
├── dist/                  # Production build output (generated)
├── .kiro/                 # Kiro spec files
├── vite.config.ts         # Vite configuration
├── tsconfig.json          # TypeScript configuration
└── package.json           # Project dependencies and scripts
```

## Environment Variables

Pixaro currently runs entirely client-side and does not require environment variables for core functionality. Optional configuration:

### Ad Integration (Optional)

If you want to enable advertising:

Create a `.env` file in the root directory:

```env
# Google AdSense Publisher ID (optional)
VITE_ADSENSE_PUBLISHER_ID=ca-pub-xxxxxxxxxxxxxxxx

# Ad Unit IDs (optional)
VITE_AD_SIDEBAR_SLOT=1234567890
VITE_AD_BOTTOM_SLOT=0987654321
```

### Analytics (Optional)

```env
# Google Analytics Measurement ID (optional)
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

**Note**: All environment variables must be prefixed with `VITE_` to be accessible in the application.

## Technology Stack

### Core Technologies

- **React 19** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool and dev server
- **Redux Toolkit** - State management
- **React Router** - Client-side routing

### Image Processing

- **WebGL 2.0** - GPU-accelerated image processing
- **Canvas API** - Image decoding and export
- **Web Workers** - Non-blocking CPU-intensive operations
- **TensorFlow.js** - AI-powered removal tool

### Development Tools

- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Vitest** - Unit and integration testing
- **Testing Library** - React component testing

## Browser Compatibility

Pixaro requires a modern browser with WebGL 2.0 support:

- Chrome 56+ ✅
- Firefox 51+ ✅
- Safari 15+ ✅
- Edge 79+ ✅

**Note**: If WebGL is unavailable, Pixaro will automatically fall back to Canvas API processing with reduced performance.

## Performance Optimization

Pixaro is optimized for performance:

- **Code Splitting**: Separate chunks for vendor libraries, image processing, and AI modules
- **Lazy Loading**: AI models and non-critical features load on demand
- **Preview Downscaling**: Real-time adjustments use downscaled previews (max 2048px)
- **Worker Pool**: Parallel processing for CPU-intensive tasks
- **Texture Caching**: GPU memory optimization with LRU cache
- **Bundle Size**: Optimized chunks with tree-shaking and minification

## Building for Production

### Standard Build

```bash
npm run build
```

This creates an optimized production build in the `dist/` directory with:
- Minified JavaScript and CSS
- Code splitting for optimal caching
- Asset optimization
- Console statements removed

### Analyzing Bundle Size

```bash
npm run build:analyze
```

This generates a visual report of your bundle composition, helping identify optimization opportunities.

### Build Output

The production build includes:
- `dist/index.html` - Entry HTML file
- `dist/assets/js/` - JavaScript chunks
- `dist/assets/images/` - Optimized images
- `dist/assets/fonts/` - Font files
- `dist/stats.html` - Bundle analyzer report

## Deployment

Pixaro is a static web application and can be deployed to any static hosting service. Deployment configuration files are included for major platforms.

### Recommended Platforms

- **Vercel** - Zero-config deployment with automatic HTTPS (see `vercel.json`)
- **Netlify** - Continuous deployment from Git (see `netlify.toml`)
- **Cloudflare Pages** - Global CDN with edge caching (see `_headers` and `_redirects`)
- **GitHub Pages** - Free hosting for public repositories

### Quick Deploy

1. Build the production bundle:
```bash
npm run build
```

2. Deploy the `dist/` directory to your hosting platform

3. The included configuration files automatically handle:
   - SPA routing (all routes redirect to `index.html`)
   - Gzip/Brotli compression
   - Cache headers for optimal performance
   - Security headers (CSP, X-Frame-Options, etc.)
   - HTTPS enforcement

### Detailed Instructions

See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive deployment guides including:
- Platform-specific setup instructions
- Environment variable configuration
- Custom domain setup
- Performance optimization
- Troubleshooting tips
- CI/CD setup

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Run `npm run format` before committing
- Ensure `npm run lint` passes
- Add tests for new features
- Follow existing code patterns

## License

[Add your license here]

## Acknowledgments

- Built with [React](https://react.dev/)
- Image processing powered by [WebGL](https://www.khronos.org/webgl/)
- AI removal using [TensorFlow.js](https://www.tensorflow.org/js)
- Icons from [Your icon source]

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

---

**Note**: Pixaro processes all images locally in your browser. No images are uploaded to any server, ensuring complete privacy.
