/**
 * EditingPanel Component Tests
 * Tests for editing panel components including slider updates, section expand/collapse, and Redux integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import adjustmentsReducer from '../store/adjustmentsSlice';
import uiReducer from '../store/uiSlice';
import imageReducer from '../store/imageSlice';
import historyReducer from '../store/historySlice';
import presetReducer from '../store/presetSlice';
import { EditingPanel } from './EditingPanel';
import { BasicAdjustments } from './BasicAdjustments';
import { CollapsibleSection } from './CollapsibleSection';
import { SliderControl } from './SliderControl';

// Helper to create a test store
const createTestStore = () => {
  return configureStore({
    reducer: {
      adjustments: adjustmentsReducer,
      ui: uiReducer,
      image: imageReducer,
      history: historyReducer,
      presets: presetReducer,
    },
  });
};

describe('EditingPanel', () => {
  it('renders all adjustment sections', () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <EditingPanel />
      </Provider>
    );

    expect(screen.getByText('Adjustments')).toBeInTheDocument();
    expect(screen.getByText('Basic')).toBeInTheDocument();
    expect(screen.getByText('Color')).toBeInTheDocument();
    expect(screen.getByText('Detail')).toBeInTheDocument();
    expect(screen.getByText('HSL / Color')).toBeInTheDocument();
    expect(screen.getByText('Effects')).toBeInTheDocument();
  });
});

describe('CollapsibleSection', () => {
  it('renders with title and children', () => {
    render(
      <CollapsibleSection title="Test Section">
        <div>Test Content</div>
      </CollapsibleSection>
    );

    expect(screen.getByText('Test Section')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('expands by default when defaultExpanded is true', () => {
    render(
      <CollapsibleSection title="Test Section" defaultExpanded={true}>
        <div>Test Content</div>
      </CollapsibleSection>
    );

    const button = screen.getByRole('button', { name: /Test Section/i });
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('collapses by default when defaultExpanded is false', () => {
    render(
      <CollapsibleSection title="Test Section" defaultExpanded={false}>
        <div>Test Content</div>
      </CollapsibleSection>
    );

    const button = screen.getByRole('button', { name: /Test Section/i });
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles expanded state when clicked', () => {
    render(
      <CollapsibleSection title="Test Section" defaultExpanded={true}>
        <div>Test Content</div>
      </CollapsibleSection>
    );

    const button = screen.getByRole('button', { name: /Test Section/i });
    
    expect(button).toHaveAttribute('aria-expanded', 'true');
    
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('toggles with keyboard Enter key', () => {
    render(
      <CollapsibleSection title="Test Section" defaultExpanded={true}>
        <div>Test Content</div>
      </CollapsibleSection>
    );

    const button = screen.getByRole('button', { name: /Test Section/i });
    
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles with keyboard Space key', () => {
    render(
      <CollapsibleSection title="Test Section" defaultExpanded={true}>
        <div>Test Content</div>
      </CollapsibleSection>
    );

    const button = screen.getByRole('button', { name: /Test Section/i });
    
    fireEvent.keyDown(button, { key: ' ' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('SliderControl', () => {
  it('renders with label and value', () => {
    const onChange = () => {};
    render(
      <SliderControl
        label="Test Slider"
        value={50}
        min={0}
        max={100}
        step={1}
        onChange={onChange}
      />
    );

    expect(screen.getByText('Test Slider')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('displays value with correct precision', () => {
    const onChange = () => {};
    render(
      <SliderControl
        label="Exposure"
        value={2.5}
        min={-5}
        max={5}
        step={0.01}
        precision={2}
        onChange={onChange}
      />
    );

    expect(screen.getByText('2.50')).toBeInTheDocument();
  });

  it('displays value with unit', () => {
    const onChange = () => {};
    render(
      <SliderControl
        label="Temperature"
        value={6500}
        min={2000}
        max={50000}
        step={50}
        unit="K"
        onChange={onChange}
      />
    );

    expect(screen.getByText('6500K')).toBeInTheDocument();
  });

  it('calls onChange when slider value changes', () => {
    let currentValue = 50;
    const onChange = (value: number) => {
      currentValue = value;
    };
    
    const { rerender } = render(
      <SliderControl
        label="Test Slider"
        value={currentValue}
        min={0}
        max={100}
        step={1}
        onChange={onChange}
      />
    );

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '75' } });
    
    expect(currentValue).toBe(75);
    
    rerender(
      <SliderControl
        label="Test Slider"
        value={currentValue}
        min={0}
        max={100}
        step={1}
        onChange={onChange}
      />
    );
    
    expect(screen.getByText('75')).toBeInTheDocument();
  });

  it('shows warning when value exceeds threshold', () => {
    const onChange = () => {};
    render(
      <SliderControl
        label="Sharpening"
        value={120}
        min={0}
        max={150}
        step={1}
        onChange={onChange}
        warning="High values may cause artifacts"
      />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/High values may cause artifacts/i)).toBeInTheDocument();
  });

  it('does not show warning when value is below threshold', () => {
    const onChange = () => {};
    render(
      <SliderControl
        label="Sharpening"
        value={50}
        min={0}
        max={150}
        step={1}
        onChange={onChange}
        warning="High values may cause artifacts"
      />
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('BasicAdjustments Redux Integration', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it('displays current adjustment values from Redux', () => {
    render(
      <Provider store={store}>
        <BasicAdjustments />
      </Provider>
    );

    // Check initial values (should be 0 for most adjustments)
    const sliders = screen.getAllByRole('slider');
    expect(sliders.length).toBeGreaterThan(0);
  });

  it('updates Redux state when slider changes', () => {
    render(
      <Provider store={store}>
        <BasicAdjustments />
      </Provider>
    );

    const exposureSlider = screen.getByLabelText(/Exposure slider/i);
    fireEvent.change(exposureSlider, { target: { value: '2' } });

    const state = store.getState();
    expect(state.adjustments.exposure).toBe(2);
  });

  it('clamps values within valid range', () => {
    render(
      <Provider store={store}>
        <BasicAdjustments />
      </Provider>
    );

    const exposureSlider = screen.getByLabelText(/Exposure slider/i);
    
    // Try to set value above max
    fireEvent.change(exposureSlider, { target: { value: '10' } });
    
    const state = store.getState();
    expect(state.adjustments.exposure).toBe(5); // Should be clamped to max
  });
});
