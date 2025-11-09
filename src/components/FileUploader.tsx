/**
 * FileUploader Component
 * Handles file upload with drag-and-drop support and file validation
 */

import React, { useCallback, useState, useRef } from 'react';
import { ErrorCode, PixaroError } from '../types/errors';
import type { FileUploaderProps } from '../types/components';
import './FileUploader.css';

const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
const DEFAULT_ACCEPTED_FORMATS = [
  'image/jpeg',
  'image/png',
  'image/tiff',
  // RAW formats
  'image/x-canon-cr2',
  'image/x-nikon-nef',
  'image/x-sony-arw',
  'image/x-adobe-dng',
];

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFileSelect,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  acceptedFormats = DEFAULT_ACCEPTED_FORMATS,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback(
    (file: File): boolean => {
      setError(null);

      // Check file size
      if (file.size > maxFileSize) {
        const maxSizeMB = Math.round(maxFileSize / (1024 * 1024));
        const error = new PixaroError({
          code: ErrorCode.FILE_TOO_LARGE,
          message: `File size exceeds ${maxSizeMB}MB limit`,
          severity: 'error',
          recoverable: true,
          userMessage: `The selected file is too large. Please choose a file smaller than ${maxSizeMB}MB.`,
          details: { fileSize: file.size, maxFileSize },
        });
        setError(error.userMessage);
        return false;
      }

      // Check file format
      const fileExtension = file.name.toLowerCase().split('.').pop();
      const isFormatSupported =
        acceptedFormats.includes(file.type) ||
        (fileExtension &&
          ['jpg', 'jpeg', 'png', 'tiff', 'tif', 'cr2', 'nef', 'arw', 'dng'].includes(
            fileExtension
          ));

      if (!isFormatSupported) {
        const error = new PixaroError({
          code: ErrorCode.UNSUPPORTED_FORMAT,
          message: `Unsupported file format: ${file.type}`,
          severity: 'error',
          recoverable: true,
          userMessage: 'This file format is not supported. Please upload a JPEG, PNG, TIFF, or RAW file.',
          details: { fileType: file.type, fileName: file.name },
        });
        setError(error.userMessage);
        return false;
      }

      return true;
    },
    [maxFileSize, acceptedFormats]
  );

  const handleFileSelect = useCallback(
    (file: File) => {
      if (validateFile(file)) {
        onFileSelect(file);
      }
    },
    [validateFile, onFileSelect]
  );

  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files && files.length > 0) {
        handleFileSelect(files[0]);
      }
      // Reset input value to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleFileSelect]
  );

  const handleDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);

      const files = event.dataTransfer.files;
      if (files && files.length > 0) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="file-uploader">
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFormats.join(',')}
        onChange={handleFileInputChange}
        className="file-uploader__input"
        aria-label="Upload photo file"
      />
      <div
        className={`file-uploader__dropzone ${isDragging ? 'file-uploader__dropzone--dragging' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        aria-label="Click or drag and drop to upload photo"
      >
        <div className="file-uploader__content">
          <svg
            className="file-uploader__icon"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p className="file-uploader__text">
            {isDragging ? 'Drop your photo here' : 'Click or drag and drop to upload'}
          </p>
          <p className="file-uploader__hint">
            Supports JPEG, PNG, TIFF, and RAW formats (max {Math.round(maxFileSize / (1024 * 1024))}MB)
          </p>
        </div>
      </div>
      {error && (
        <div className="file-uploader__error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
};
