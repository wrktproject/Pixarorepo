# Advanced Shader Pipeline - Documentation Index

## Overview

Complete documentation for the Pixaro advanced shader pipeline system. This index helps you find the right documentation for your needs.

**Version**: 2.0.0  
**Last Updated**: November 2024

---

## Quick Navigation

### For New Users
1. Start with [Quick Start Guide](#quick-start-guide)
2. Read [Core Concepts](#core-concepts)
3. Try [Basic Examples](#examples)

### For Developers
1. Read [Developer Guide](./DEVELOPER_GUIDE.md)
2. Review [Architecture Documentation](./SHADER_ARCHITECTURE.md)
3. Check [API Reference](#api-reference)

### For Migrating
1. Read [Migration Guide](./MIGRATION_GUIDE.md)
2. Review [API Changes](#api-changes)
3. Test with [Migration Checklist](#migration-checklist)

### For Troubleshooting
1. Check [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. Review [Common Issues](#common-issues)
3. Use [Debugging Tools](#debugging-tools)

---

## Documentation Structure

### 📚 Core Documentation

#### [Requirements Document](./requirements.md)
- User stories and acceptance criteria
- EARS-compliant requirements
- Glossary of terms
- **Audience**: Product managers, QA, developers

#### [Design Document](./design.md)
- Architecture overview
- Component design
- Data models
- Implementation strategy
- **Audience**: Architects, senior developers

#### [Implementation Tasks](./tasks.md)
- Step-by-step implementation plan
- Task breakdown with requirements mapping
- Progress tracking
- **Audience**: Developers, project managers

---

### 🏗️ Architecture Documentation

#### [Shader Architecture](./SHADER_ARCHITECTURE.md)
- High-level architecture
- Component interactions
- Rendering pipeline flow
- Color space management
- Multi-pass rendering
- **Audience**: Architects, senior developers

#### [Task 10: Preview Downscaling](./TASK_10_ARCHITECTURE.md)
- Downscaling implementation
- Quality modes
- Performance optimization
- **Audience**: Developers

#### [Task 11: Real-time Rendering](./TASK_11_ARCHITECTURE.md)
- Render scheduler design
- Batching and frame skipping
- Performance monitoring
- **Audience**: Developers

#### [Task 13: Quality Preservation](./TASK_13_ARCHITECTURE.md)
- Float texture usage
- Dithering implementation
- Export quality
- **Audience**: Developers

---

### 👨‍💻 Developer Documentation

#### [Developer Guide](./DEVELOPER_GUIDE.md) ⭐
**Complete guide for developers working with the pipeline**
- Quick start
- Core concepts
- Architecture deep dive
- Working with shaders
- Performance optimization
- Extending the pipeline
- Testing and debugging
- Best practices
- API reference
- **Audience**: All developers

#### [Shader Library README](../../engine/shaders/README.md)
- Shader module system
- Available modules
- Creating new modules
- Usage examples
- Best practices
- **Audience**: Shader developers

#### [Shader Conventions](../../engine/shaders/SHADER_CONVENTIONS.md)
- Naming conventions
- Code style
- Documentation standards
- **Audience**: Shader developers

#### [Shader Usage Guide](../../engine/shaders/USAGE_GUIDE.md)
- Practical examples
- Common patterns
- Tips and tricks
- **Audience**: Developers

#### [Shader Quick Reference](../../engine/shaders/QUICK_REFERENCE.md)
- Function reference
- Quick lookup
- **Audience**: All developers

---

### 🔄 Migration Documentation

#### [Migration Guide](./MIGRATION_GUIDE.md) ⭐
**Complete guide for migrating from old pipeline**
- What's changed
- Prerequisites
- Step-by-step migration
- API changes
- Adjustment value mapping
- Testing your migration
- Rollback strategy
- Common issues
- **Audience**: Developers migrating from old pipeline

---

### 🐛 Troubleshooting Documentation

#### [Troubleshooting Guide](./TROUBLESHOOTING.md) ⭐
**Comprehensive troubleshooting resource**
- Common issues
- Error messages
- Performance problems
- Visual artifacts
- Browser-specific issues
- Debugging tools
- FAQ
- **Audience**: All developers

---

### 📊 Performance Documentation

#### [Performance Profiling](../../engine/PERFORMANCE_PROFILING.md)
- Profiling system overview
- Performance metrics
- Optimization strategies
- Performance targets
- Dashboard usage
- **Audience**: Performance engineers, developers

---

### 🎨 Adjustment Documentation

#### [Adjustment Calibration](./ADJUSTMENT_CALIBRATION.md)
- Calibration methodology
- Range definitions
- Lightroom comparison
- Test cases
- **Audience**: QA, developers

#### [Adjustment Quick Reference](./ADJUSTMENT_QUICK_REFERENCE.md)
- Quick lookup for adjustment ranges
- Default values
- **Audience**: All developers

#### [Calibration Test Cases](./CALIBRATION_TEST_CASES.md)
- Test scenarios
- Expected results
- Validation criteria
- **Audience**: QA, developers

---

### 📝 Task Summaries

#### [Task 10 Summary](./TASK_10_SUMMARY.md)
Preview downscaling implementation summary

#### [Task 11 Summary](./TASK_11_SUMMARY.md)
Real-time rendering optimization summary

#### [Task 13 Summary](./TASK_13_SUMMARY.md)
Quality preservation implementation summary

#### [Task 14 Summary](./TASK_14_SUMMARY.md)
Shader composition system summary

#### [Task 15 Summary](./TASK_15_TEST_SUMMARY.md)
Comprehensive testing summary

#### [Task 16 Summary](./TASK_16_SUMMARY.md)
Adjustment calibration summary

#### [Task 17 Summary](./TASK_17_SUMMARY.md)
Performance profiling summary

#### [Task 18 Summary](./TASK_18_SUMMARY.md)
UI updates summary

---

## Documentation by Role

### Frontend Developer
**Start here:**
1. [Developer Guide](./DEVELOPER_GUIDE.md) - Complete development guide
2. [Quick Start](#quick-start) - Get up and running
3. [API Reference](#api-reference) - API documentation
4. [Troubleshooting Guide](./TROUBLESHOOTING.md) - Fix issues

**Then explore:**
- [Shader Library README](../../engine/shaders/README.md)
- [Performance Profiling](../../engine/PERFORMANCE_PROFILING.md)
- [Adjustment Quick Reference](./ADJUSTMENT_QUICK_REFERENCE.md)

### Graphics Programmer
**Start here:**
1. [Shader Architecture](./SHADER_ARCHITECTURE.md) - Architecture overview
2. [Design Document](./design.md) - Detailed design
3. [Shader Conventions](../../engine/shaders/SHADER_CONVENTIONS.md) - Coding standards

**Then explore:**
- [Shader Library README](../../engine/shaders/README.md)
- [Shader Usage Guide](../../engine/shaders/USAGE_GUIDE.md)
- [Developer Guide](./DEVELOPER_GUIDE.md) - Extending the pipeline

### QA Engineer
**Start here:**
1. [Requirements Document](./requirements.md) - What to test
2. [Calibration Test Cases](./CALIBRATION_TEST_CASES.md) - Test scenarios
3. [Troubleshooting Guide](./TROUBLESHOOTING.md) - Known issues

**Then explore:**
- [Adjustment Calibration](./ADJUSTMENT_CALIBRATION.md)
- [Performance Profiling](../../engine/PERFORMANCE_PROFILING.md)

### Product Manager
**Start here:**
1. [Requirements Document](./requirements.md) - Feature requirements
2. [Implementation Tasks](./tasks.md) - Implementation status
3. [Shader Architecture](./SHADER_ARCHITECTURE.md) - High-level overview

### DevOps Engineer
**Start here:**
1. [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common issues
2. [Performance Profiling](../../engine/PERFORMANCE_PROFILING.md) - Monitoring
3. [Browser-Specific Issues](#browser-issues) - Deployment considerations

---

## Documentation by Task

### Setting Up the Pipeline
1. [Developer Guide - Quick Start](./DEVELOPER_GUIDE.md#quick-start)
2. [Migration Guide - Prerequisites](./MIGRATION_GUIDE.md#prerequisites)

### Creating Custom Shaders
1. [Developer Guide - Working with Shaders](./DEVELOPER_GUIDE.md#working-with-shaders)
2. [Shader Library README](../../engine/shaders/README.md)
3. [Shader Conventions](../../engine/shaders/SHADER_CONVENTIONS.md)

### Optimizing Performance
1. [Developer Guide - Performance Optimization](./DEVELOPER_GUIDE.md#performance-optimization)
2. [Performance Profiling](../../engine/PERFORMANCE_PROFILING.md)
3. [Troubleshooting Guide - Performance Problems](./TROUBLESHOOTING.md#performance-problems)

### Debugging Issues
1. [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. [Developer Guide - Testing and Debugging](./DEVELOPER_GUIDE.md#testing-and-debugging)
3. [Common Issues](#common-issues)

### Migrating from Old Pipeline
1. [Migration Guide](./MIGRATION_GUIDE.md) - Complete migration guide
2. [API Changes](#api-changes)
3. [Troubleshooting Guide - Common Issues](./TROUBLESHOOTING.md#common-issues)

### Extending the Pipeline
1. [Developer Guide - Extending the Pipeline](./DEVELOPER_GUIDE.md#extending-the-pipeline)
2. [Shader Architecture](./SHADER_ARCHITECTURE.md)
3. [Design Document](./design.md)

---

## Quick Reference

### Key Concepts

**Color Space Management**
- Input: sRGB (8-bit) → Linear RGB (float)
- Processing: All operations in linear space
- Output: Linear RGB → sRGB (8-bit)
- See: [Developer Guide - Color Space Management](./DEVELOPER_GUIDE.md#color-space-management)

**Multi-Pass Rendering**
- 9 shader passes with intermediate framebuffers
- RGBA16F textures for quality preservation
- Dirty flag optimization for performance
- See: [Shader Architecture - Multi-Pass Rendering](./SHADER_ARCHITECTURE.md#multi-pass-rendering)

**Performance Optimization**
- Render scheduler with batching
- Frame skipping for slow renders
- Texture and framebuffer pooling
- Preview downscaling
- See: [Performance Profiling](../../engine/PERFORMANCE_PROFILING.md)

### Common Tasks

**Load and Render Image**
```typescript
pipeline.loadImage(imageData);
pipeline.render(adjustments);
```
See: [Developer Guide - Quick Start](./DEVELOPER_GUIDE.md#quick-start)

**Export at Full Resolution**
```typescript
const exportRenderer = new ExportRenderer(contextManager);
const result = await exportRenderer.renderForExport(imageData, adjustments);
```
See: [Developer Guide - Export](./DEVELOPER_GUIDE.md#export)

**Monitor Performance**
```typescript
const profile = pipeline.getPerformanceProfile();
const recommendations = pipeline.getPerformanceRecommendations();
```
See: [Performance Profiling](../../engine/PERFORMANCE_PROFILING.md)

**Handle Errors**
```typescript
const errorHandler = new ShaderPipelineErrorHandler(contextManager);
const result = errorHandler.handleError(error, { imageData, adjustments, canvas });
```
See: [Troubleshooting Guide](./TROUBLESHOOTING.md)

---

## API Reference

### Core Classes

**ShaderPipeline**
- Main pipeline orchestrator
- See: [Developer Guide - API Reference](./DEVELOPER_GUIDE.md#api-reference)

**ShaderComposer**
- Shader composition system
- See: [Shader Library README](../../engine/shaders/README.md)

**RenderScheduler**
- Render optimization
- See: [Task 11 Architecture](./TASK_11_ARCHITECTURE.md)

**PerformanceProfiler**
- Performance monitoring
- See: [Performance Profiling](../../engine/PERFORMANCE_PROFILING.md)

**ExportRenderer**
- High-quality export
- See: [Task 13 Architecture](./TASK_13_ARCHITECTURE.md)

---

## Examples

### Basic Usage
See: [Developer Guide - Quick Start](./DEVELOPER_GUIDE.md#quick-start)

### React Integration
See: [Developer Guide - React Integration](./DEVELOPER_GUIDE.md#react-integration)

### Custom Shader Pass
See: [Developer Guide - Creating a New Shader Pass](./DEVELOPER_GUIDE.md#creating-a-new-shader-pass)

### Multi-Pass Effect
See: [Developer Guide - Creating Multi-Pass Effects](./DEVELOPER_GUIDE.md#creating-multi-pass-effects)

### Performance Monitoring
See: [Performance Profiling - Usage](../../engine/PERFORMANCE_PROFILING.md#usage)

---

## Testing Documentation

### Unit Tests
- Shader compilation tests
- Color space conversion tests
- Exposure calculation tests
- Edge case tests
- See: [Task 15 Summary](./TASK_15_TEST_SUMMARY.md)

### Performance Tests
- Frame rate benchmarks
- Memory usage tests
- Shader pass timing
- See: [Performance Profiling](../../engine/PERFORMANCE_PROFILING.md)

### Integration Tests
- End-to-end rendering tests
- Browser compatibility tests
- Error handling tests
- See: [Task 15 Summary](./TASK_15_TEST_SUMMARY.md)

---

## Contributing

### Adding Documentation
1. Follow existing structure
2. Use clear headings and sections
3. Include code examples
4. Add to this index
5. Update version and date

### Documentation Standards
- Use Markdown format
- Include table of contents for long documents
- Add code examples with syntax highlighting
- Link to related documentation
- Keep examples up to date

---

## Version History

### Version 2.0.0 (November 2024)
- Complete rewrite of shader pipeline
- Added comprehensive documentation
- Migration guide for old pipeline
- Performance profiling system
- Troubleshooting guide

### Version 1.0.0 (Initial Release)
- Basic shader pipeline
- Limited documentation

---

## Support

### Getting Help
1. Check [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. Review [FAQ](#faq)
3. Search [GitHub Issues](https://github.com/your-repo/issues)
4. Ask in Slack: #pixaro-dev
5. Email: dev-support@pixaro.com

### Reporting Issues
Include:
- Browser and version
- WebGL version and renderer
- Performance profile
- Steps to reproduce
- Expected vs actual behavior

See: [Troubleshooting Guide - Getting Help](./TROUBLESHOOTING.md#getting-help)

---

## Additional Resources

### External Resources
- [WebGL 2.0 Specification](https://www.khronos.org/registry/webgl/specs/latest/2.0/)
- [GLSL ES 3.00 Specification](https://www.khronos.org/registry/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf)
- [Color Science Resources](https://www.color.org/)

### Tools
- [Spector.js](https://spector.babylonjs.com/) - WebGL inspector
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/) - Performance profiling
- [WebGL Report](https://webglreport.com/) - Check WebGL support

---

**Last Updated**: November 2024  
**Version**: 2.0.0  
**Maintainer**: Pixaro Development Team
