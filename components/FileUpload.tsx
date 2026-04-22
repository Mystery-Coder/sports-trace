'use client';

import { useCallback, useState, useRef } from 'react';
import { Upload, FileVideo, FileImage, X } from 'lucide-react';

interface FileUploadProps {
  onFileSelected: (file: File) => void;
  accept?: string;
  maxSizeMB?: number;
}

export default function FileUpload({
  onFileSelected,
  accept = 'image/*,video/*',
  maxSizeMB = 50,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);

      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`File too large. Maximum size is ${maxSizeMB}MB.`);
        return;
      }

      const isValid =
        file.type.startsWith('image/') || file.type.startsWith('video/');
      if (!isValid) {
        setError('Invalid file type. Please upload an image or video.');
        return;
      }

      setSelectedFile(file);
      onFileSelected(file);
    },
    [onFileSelected, maxSizeMB]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const clearFile = () => {
    setSelectedFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const fileIcon = selectedFile?.type.startsWith('video/') ? FileVideo : FileImage;
  const FileIcon = fileIcon;

  return (
    <div>
      {!selectedFile ? (
        <div
          className={`upload-zone ${isDragging ? 'active' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />

          <div className="flex flex-col items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: isDragging
                  ? 'rgba(0, 240, 255, 0.15)'
                  : 'rgba(0, 240, 255, 0.06)',
                border: '1px solid rgba(0, 240, 255, 0.15)',
                transition: 'all 0.3s ease',
              }}
            >
              <Upload
                size={28}
                style={{ color: isDragging ? 'var(--st-cyan)' : 'var(--st-text-secondary)' }}
              />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--st-text-primary)' }}>
                Drop your media file here
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--st-text-secondary)' }}>
                or click to browse · Images & Videos · Max {maxSizeMB}MB
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="glass-card p-5 flex items-center gap-4"
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'rgba(0, 240, 255, 0.08)',
              border: '1px solid rgba(0, 240, 255, 0.15)',
            }}
          >
            <FileIcon size={22} style={{ color: 'var(--st-cyan)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium truncate"
              style={{ color: 'var(--st-text-primary)' }}
            >
              {selectedFile.name}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--st-text-secondary)' }}>
              {selectedFile.type} · {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearFile();
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors"
          >
            <X size={16} style={{ color: 'var(--st-text-secondary)' }} />
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 text-xs font-medium" style={{ color: 'var(--st-red)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
