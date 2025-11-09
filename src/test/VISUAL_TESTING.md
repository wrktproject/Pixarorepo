# Visual Regression Testing Guide

This document outlines the visual regression testing approach for Pixaro's dark theme UI.

## Automated Tests

### Unit Tests (`darkTheme.test.ts`)
- ✅ Background luminance verification (< 20%)
- ✅ Contrast ratio verification (≥ 4.5:1)
- ⚠️ CSS variable definitions (limited in jsdom environment)

### Manual Testing Checklist

#### Dark Theme Colors
- [ ] Background luminance is below 20% (visually dark)
- [ ] Text has minimum 4.5:1 contrast ratio against backgrounds
- [ ] Accent colors (#4a9eff) are clearly visible
- [ ] Canvas surround area is neutral gray (#808080)

#### Layout Structure
- [ ] Three-column layout: sidebar (280px), canvas (flexible), editing panel (320px)
- [ ] Header height is 60px
- [ ] All panels have proper borders and spacing
- [ ] Content doesn't overflow containers

#### Interactive Elements
- [ ] Buttons have visible hover states
- [ ] Buttons have clear focus indicators (2px blue outline)
- [ ] Sliders have smooth transitions
- [ ] All interactive elements respond to keyboard navigation
- [ ] Focus indicators are visible for keyboard users

#### Responsive Breakpoints

##### Desktop (> 1280px)
- [ ] Full three-column layout visible
- [ ] Sidebar: 280px
- [ ] Editing panel: 320px

##### Tablet (1024px - 1280px)
- [ ] Three-column layout with reduced widths
- [ ] Sidebar: 240px
- [ ] Editing panel: 280px

##### Small Tablet (768px - 1024px)
- [ ] Three-column layout with further reduced widths
- [ ] Sidebar: 200px
- [ ] Editing panel: 260px

##### Mobile (< 768px)
- [ ] Stacked layout (single column)
- [ ] Sidebar at top (max-height: 200px)
- [ ] Canvas in middle
- [ ] Editing panel at bottom (max-height: 300px)

#### Component Styling

##### Buttons
- [ ] Default state: dark background with border
- [ ] Hover state: lighter background
- [ ] Active state: translateY(1px)
- [ ] Focus state: 2px blue outline
- [ ] Disabled state: 50% opacity

##### Inputs
- [ ] Dark background (#2a2a2a)
- [ ] Border visible (#333333)
- [ ] Focus state: blue border with shadow
- [ ] Placeholder text is readable

##### Sliders
- [ ] Track is visible (#333333)
- [ ] Thumb is prominent (#e0e0e0)
- [ ] Hover state: white thumb
- [ ] Active state: blue thumb (#4a9eff)
- [ ] Focus state: 2px outline

##### Modals
- [ ] Dark background with border
- [ ] Overlay dims background
- [ ] Close button visible and accessible
- [ ] Smooth animations (slideUp)

#### Accessibility

##### Keyboard Navigation
- [ ] Tab order is logical
- [ ] All interactive elements are focusable
- [ ] Focus indicators are clearly visible
- [ ] Escape key closes modals
- [ ] Enter key activates buttons

##### Screen Reader Support
- [ ] All buttons have aria-labels
- [ ] Form inputs have associated labels
- [ ] Error messages are announced
- [ ] Status updates use aria-live regions

##### Color Contrast
- [ ] Primary text: 11.6:1 contrast ratio
- [ ] Secondary text: 6.5:1 contrast ratio
- [ ] Tertiary text: 4.5:1 contrast ratio
- [ ] All text meets WCAG AA standards

## Testing Tools

### Recommended Tools for Full Visual Testing

1. **Playwright** - End-to-end testing with real browsers
   ```bash
   npm install -D @playwright/test
   npx playwright test
   ```

2. **Percy** - Visual diff testing
   ```bash
   npm install -D @percy/cli @percy/playwright
   npx percy exec -- playwright test
   ```

3. **Lighthouse** - Accessibility and performance audits
   ```bash
   npm install -D lighthouse
   npx lighthouse http://localhost:5173 --view
   ```

4. **axe DevTools** - Accessibility testing
   - Install browser extension
   - Run automated accessibility scan

### Manual Testing Steps

1. **Start Development Server**
   ```bash
   npm run dev
   ```

2. **Test at Different Viewport Sizes**
   - Desktop: 1920x1080
   - Laptop: 1366x768
   - Tablet: 768x1024
   - Mobile: 375x667

3. **Test Keyboard Navigation**
   - Tab through all interactive elements
   - Verify focus indicators are visible
   - Test keyboard shortcuts (Ctrl+Z, Ctrl+Y, Spacebar)

4. **Test with Screen Reader**
   - NVDA (Windows)
   - JAWS (Windows)
   - VoiceOver (macOS)

5. **Test Color Contrast**
   - Use browser DevTools color picker
   - Verify contrast ratios meet WCAG AA (4.5:1)
   - Test with color blindness simulators

## Test Results Documentation

### Screenshots
Capture screenshots of:
- Main application layout (desktop)
- Responsive layouts (tablet, mobile)
- All major UI states (loading, error, success)
- Interactive element states (hover, focus, active)
- Modal dialogs
- Preset manager
- Editing panel sections

### Contrast Ratio Measurements
Document actual contrast ratios:
- Primary text on primary background: ___:1
- Secondary text on primary background: ___:1
- Accent color on primary background: ___:1
- Button text on button background: ___:1

### Browser Compatibility
Test on:
- [ ] Chrome (latest 2 versions)
- [ ] Firefox (latest 2 versions)
- [ ] Safari (latest 2 versions)
- [ ] Edge (latest 2 versions)

## Continuous Integration

For CI/CD pipelines, consider:
1. Automated Playwright tests on PR
2. Percy visual diffs on PR
3. Lighthouse CI for performance/accessibility
4. Automated contrast ratio checks

## Notes

- Visual regression tests should be run before each release
- Update screenshots when intentional UI changes are made
- Document any accessibility issues found and track fixes
- Keep this checklist updated as new components are added
