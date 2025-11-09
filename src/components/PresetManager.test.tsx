/**
 * PresetManager Component Tests
 * Tests for preset display and management UI
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { PresetManager } from './PresetManager';
import presetReducer from '../store/presetSlice';
import adjustmentsReducer from '../store/adjustmentsSlice';
import { createInitialAdjustmentState } from '../store/initialState';
import type { Preset } from '../types/store';

// Mock the applyPreset utility
vi.mock('../utils/presetUtils', async () => {
  const actual = await vi.importActual('../utils/presetUtils');
  return {
    ...actual,
    applyPreset: vi.fn(),
  };
});

describe('PresetManager', () => {
  const createTestStore = (initialPresets: { builtIn?: Preset[]; custom?: Preset[] } = {}) => {
    return configureStore({
      reducer: {
        presets: presetReducer,
        adjustments: adjustmentsReducer,
      },
      preloadedState: {
        presets: {
          builtIn: initialPresets.builtIn || [],
          custom: initialPresets.custom || [],
          isLoading: false,
        },
        adjustments: createInitialAdjustmentState(),
      },
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should render preset manager with header', () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <PresetManager />
      </Provider>
    );

    expect(screen.getByText('Presets')).toBeInTheDocument();
    expect(screen.getByText('Save as Preset')).toBeInTheDocument();
  });

  it('should display built-in presets', () => {
    const builtInPresets: Preset[] = [
      {
        id: 'preset1',
        name: 'Portrait',
        isBuiltIn: true,
        adjustments: createInitialAdjustmentState(),
      },
      {
        id: 'preset2',
        name: 'Landscape',
        isBuiltIn: true,
        adjustments: createInitialAdjustmentState(),
      },
    ];

    const store = createTestStore({ builtIn: builtInPresets });
    render(
      <Provider store={store}>
        <PresetManager />
      </Provider>
    );

    expect(screen.getByText('Built-in')).toBeInTheDocument();
    expect(screen.getByText('Portrait')).toBeInTheDocument();
    expect(screen.getByText('Landscape')).toBeInTheDocument();
  });

  it('should display custom presets separately', () => {
    const customPresets: Preset[] = [
      {
        id: 'custom1',
        name: 'My Preset',
        isBuiltIn: false,
        adjustments: createInitialAdjustmentState(),
      },
    ];

    const store = createTestStore({ custom: customPresets });
    render(
      <Provider store={store}>
        <PresetManager />
      </Provider>
    );

    expect(screen.getByText('Custom')).toBeInTheDocument();
    expect(screen.getByText('My Preset')).toBeInTheDocument();
  });

  it('should show delete button only for custom presets', () => {
    const builtInPresets: Preset[] = [
      {
        id: 'preset1',
        name: 'Portrait',
        isBuiltIn: true,
        adjustments: createInitialAdjustmentState(),
      },
    ];

    const customPresets: Preset[] = [
      {
        id: 'custom1',
        name: 'My Preset',
        isBuiltIn: false,
        adjustments: createInitialAdjustmentState(),
      },
    ];

    const store = createTestStore({ builtIn: builtInPresets, custom: customPresets });
    render(
      <Provider store={store}>
        <PresetManager />
      </Provider>
    );

    const deleteButtons = screen.getAllByTitle('Delete preset');
    expect(deleteButtons).toHaveLength(1);
  });

  it('should open save modal when clicking Save as Preset button', () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <PresetManager />
      </Provider>
    );

    const saveButton = screen.getByText('Save as Preset');
    fireEvent.click(saveButton);

    expect(screen.getByText('Save Preset')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter preset name')).toBeInTheDocument();
  });

  it('should close modal when clicking Cancel', () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <PresetManager />
      </Provider>
    );

    fireEvent.click(screen.getByText('Save as Preset'));
    expect(screen.getByText('Save Preset')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Save Preset')).not.toBeInTheDocument();
  });

  it('should validate preset name on save', async () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <PresetManager />
      </Provider>
    );

    fireEvent.click(screen.getByText('Save as Preset'));

    const saveButton = screen.getByRole('button', { name: /^Save$/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Preset name cannot be empty')).toBeInTheDocument();
    });
  });

  it('should save custom preset with valid name', async () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <PresetManager />
      </Provider>
    );

    fireEvent.click(screen.getByText('Save as Preset'));

    const input = screen.getByPlaceholderText('Enter preset name');
    fireEvent.change(input, { target: { value: 'New Preset' } });

    const saveButton = screen.getByRole('button', { name: /^Save$/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.queryByText('Save Preset')).not.toBeInTheDocument();
    });

    // Verify preset was added to store
    const state = store.getState();
    expect(state.presets.custom).toHaveLength(1);
    expect(state.presets.custom[0].name).toBe('New Preset');
  });

  it('should show error for duplicate preset name', async () => {
    const existingPresets: Preset[] = [
      {
        id: 'preset1',
        name: 'Existing Preset',
        isBuiltIn: true,
        adjustments: createInitialAdjustmentState(),
      },
    ];

    const store = createTestStore({ builtIn: existingPresets });
    render(
      <Provider store={store}>
        <PresetManager />
      </Provider>
    );

    fireEvent.click(screen.getByText('Save as Preset'));

    const input = screen.getByPlaceholderText('Enter preset name');
    fireEvent.change(input, { target: { value: 'Existing Preset' } });

    const saveButton = screen.getByRole('button', { name: /^Save$/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('A preset with this name already exists')).toBeInTheDocument();
    });
  });

  it('should delete custom preset with confirmation', async () => {
    const customPresets: Preset[] = [
      {
        id: 'custom1',
        name: 'My Preset',
        isBuiltIn: false,
        adjustments: createInitialAdjustmentState(),
      },
    ];

    const store = createTestStore({ custom: customPresets });
    
    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <Provider store={store}>
        <PresetManager />
      </Provider>
    );

    const deleteButton = screen.getByTitle('Delete preset');
    fireEvent.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete this preset?');

    await waitFor(() => {
      const state = store.getState();
      expect(state.presets.custom).toHaveLength(0);
    });

    confirmSpy.mockRestore();
  });

  it('should not delete preset if confirmation is cancelled', () => {
    const customPresets: Preset[] = [
      {
        id: 'custom1',
        name: 'My Preset',
        isBuiltIn: false,
        adjustments: createInitialAdjustmentState(),
      },
    ];

    const store = createTestStore({ custom: customPresets });
    
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <Provider store={store}>
        <PresetManager />
      </Provider>
    );

    const deleteButton = screen.getByTitle('Delete preset');
    fireEvent.click(deleteButton);

    const state = store.getState();
    expect(state.presets.custom).toHaveLength(1);

    confirmSpy.mockRestore();
  });
});
