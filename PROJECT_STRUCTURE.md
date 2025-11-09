# Pixaro Project Structure

## Overview
Pixaro is a web-based photo editing application built with React, TypeScript, and Vite.

## Technology Stack
- **Framework**: React 19 with TypeScript
- **State Management**: Redux Toolkit
- **Routing**: React Router DOM
- **Build Tool**: Vite
- **Linting**: ESLint
- **Formatting**: Prettier

## Folder Structure

```
pixaro/
├── src/
│   ├── components/     # React UI components
│   ├── engine/         # WebGL image processing engine
│   ├── store/          # Redux store and slices
│   ├── workers/        # Web Workers for CPU-intensive tasks
│   ├── utils/          # Helper functions and utilities
│   ├── types/          # TypeScript type definitions
│   └── assets/         # Static assets (images, fonts, etc.)
├── public/             # Public static files
├── .kiro/              # Kiro spec files
└── dist/               # Production build output
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

## Build Configuration

The Vite build is configured with code splitting:
- **vendor chunk**: React, Redux, React Router dependencies
- **image-processing chunk**: Image processing engine code
- **ai chunk**: TensorFlow.js and AI-related dependencies (when installed)

## TypeScript Configuration

TypeScript is configured in strict mode with:
- ES2022 target
- Strict type checking enabled
- No unused locals/parameters
- No fallthrough cases in switch statements

## Code Quality

- **ESLint**: Configured with React and TypeScript rules
- **Prettier**: Configured for consistent code formatting
- **TypeScript**: Strict mode enabled for type safety
