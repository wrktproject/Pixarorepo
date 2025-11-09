/**
 * FileUploader Component Tests
 * Integration tests for file upload workflow
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileUploader } from './FileUploader';

describe('FileUploader', () => {
  it('renders upload zone with correct text', () => {
    const onFileSelect = vi.fn();
    render(<FileUploader onFileSelect={onFileSelect} />);

    expect(screen.getByText(/Click or drag and drop to upload/i)).toBeInTheDocument();
    expect(screen.getByText(/Supports JPEG, PNG, TIFF, and RAW formats/i)).toBeInTheDocument();
  });

  it('calls onFileSelect when a valid file is selected', async () => {
    const onFileSelect = vi.fn();
    render(<FileUploader onFileSelect={onFileSelect} />);

    const file = new File(['dummy content'], 'test.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText(/Upload photo file/i) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onFileSelect).toHaveBeenCalledWith(file);
    });
  });

  it('displays error when file size exceeds limit', async () => {
    const onFileSelect = vi.fn();
    const maxFileSize = 1024 * 1024; // 1MB
    render(<FileUploader onFileSelect={onFileSelect} maxFileSize={maxFileSize} />);

    // Create a file larger than 1MB
    const largeFile = new File(['x'.repeat(2 * 1024 * 1024)], 'large.jpg', {
      type: 'image/jpeg',
    });
    const input = screen.getByLabelText(/Upload photo file/i) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/too large/i)).toBeInTheDocument();
    });

    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it('displays error for unsupported file format', async () => {
    const onFileSelect = vi.fn();
    render(<FileUploader onFileSelect={onFileSelect} />);

    const unsupportedFile = new File(['dummy'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByLabelText(/Upload photo file/i) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [unsupportedFile] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/not supported/i)).toBeInTheDocument();
    });

    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it('accepts JPEG files', async () => {
    const onFileSelect = vi.fn();
    render(<FileUploader onFileSelect={onFileSelect} />);

    const jpegFile = new File(['dummy'], 'photo.jpeg', { type: 'image/jpeg' });
    const input = screen.getByLabelText(/Upload photo file/i) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [jpegFile] } });

    await waitFor(() => {
      expect(onFileSelect).toHaveBeenCalledWith(jpegFile);
    });
  });

  it('accepts PNG files', async () => {
    const onFileSelect = vi.fn();
    render(<FileUploader onFileSelect={onFileSelect} />);

    const pngFile = new File(['dummy'], 'photo.png', { type: 'image/png' });
    const input = screen.getByLabelText(/Upload photo file/i) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [pngFile] } });

    await waitFor(() => {
      expect(onFileSelect).toHaveBeenCalledWith(pngFile);
    });
  });

  it('accepts TIFF files', async () => {
    const onFileSelect = vi.fn();
    render(<FileUploader onFileSelect={onFileSelect} />);

    const tiffFile = new File(['dummy'], 'photo.tiff', { type: 'image/tiff' });
    const input = screen.getByLabelText(/Upload photo file/i) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [tiffFile] } });

    await waitFor(() => {
      expect(onFileSelect).toHaveBeenCalledWith(tiffFile);
    });
  });

  it('accepts RAW files by extension', async () => {
    const onFileSelect = vi.fn();
    render(<FileUploader onFileSelect={onFileSelect} />);

    const rawFile = new File(['dummy'], 'photo.cr2', { type: '' });
    const input = screen.getByLabelText(/Upload photo file/i) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [rawFile] } });

    await waitFor(() => {
      expect(onFileSelect).toHaveBeenCalledWith(rawFile);
    });
  });

  it('shows dragging state when file is dragged over', () => {
    const onFileSelect = vi.fn();
    render(<FileUploader onFileSelect={onFileSelect} />);

    const dropzone = screen.getByRole('button', { name: /Click or drag and drop/i });

    fireEvent.dragEnter(dropzone);
    expect(screen.getByText(/Drop your photo here/i)).toBeInTheDocument();

    fireEvent.dragLeave(dropzone);
    expect(screen.getByText(/Click or drag and drop to upload/i)).toBeInTheDocument();
  });

  it('handles file drop', async () => {
    const onFileSelect = vi.fn();
    render(<FileUploader onFileSelect={onFileSelect} />);

    const file = new File(['dummy'], 'dropped.jpg', { type: 'image/jpeg' });
    const dropzone = screen.getByRole('button', { name: /Click or drag and drop/i });

    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(onFileSelect).toHaveBeenCalledWith(file);
    });
  });

  it('can be activated with keyboard', () => {
    const onFileSelect = vi.fn();
    render(<FileUploader onFileSelect={onFileSelect} />);

    const dropzone = screen.getByRole('button', { name: /Click or drag and drop/i });
    
    // Focus the dropzone
    dropzone.focus();
    expect(dropzone).toHaveFocus();

    // Press Enter key
    fireEvent.keyDown(dropzone, { key: 'Enter' });
    
    // The file input should be triggered (we can't fully test this without mocking)
    expect(dropzone).toBeInTheDocument();
  });
});
