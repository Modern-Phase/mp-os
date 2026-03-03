import { describe, it, expect } from 'vitest';
import { getFileLabel, getFileIcon, formatSize } from '@/components/agents/ArtifactCard';
import { FileCode, FileText, File } from 'lucide-react';

/**
 * Unit tests for ArtifactCard helper functions
 * Tests file label resolution, icon mapping, and size formatting
 */

describe('getFileLabel', () => {
  it('should resolve labels from file extension', () => {
    expect(getFileLabel('app.tsx', 'text/plain')).toBe('TypeScript');
    expect(getFileLabel('index.js', 'text/plain')).toBe('JavaScript');
    expect(getFileLabel('main.py', 'text/plain')).toBe('Python');
    expect(getFileLabel('data.json', 'text/plain')).toBe('JSON');
    expect(getFileLabel('style.css', 'text/plain')).toBe('CSS');
    expect(getFileLabel('readme.md', 'text/plain')).toBe('Markdown');
    expect(getFileLabel('config.yaml', 'text/plain')).toBe('YAML');
    expect(getFileLabel('config.yml', 'text/plain')).toBe('YAML');
    expect(getFileLabel('query.sql', 'text/plain')).toBe('SQL');
    expect(getFileLabel('run.sh', 'text/plain')).toBe('Shell');
    expect(getFileLabel('notes.txt', 'text/plain')).toBe('Text');
    expect(getFileLabel('report.csv', 'text/plain')).toBe('CSV');
  });

  it('should fall back to mimeType when extension is unknown', () => {
    expect(getFileLabel('noext', 'text/x-python')).toBe('Python');
    expect(getFileLabel('noext', 'application/json')).toBe('JSON');
    expect(getFileLabel('noext', 'text/html')).toBe('HTML');
  });

  it('should return "File" for unrecognized extension and mimeType', () => {
    expect(getFileLabel('data.xyz', 'application/octet-stream')).toBe('File');
    expect(getFileLabel('noext', 'application/octet-stream')).toBe('File');
  });

  it('should prefer extension over mimeType', () => {
    // Extension says TypeScript, mimeType says plain text
    expect(getFileLabel('app.ts', 'text/plain')).toBe('TypeScript');
  });
});

describe('getFileIcon', () => {
  it('should return FileCode for code files', () => {
    expect(getFileIcon('app.tsx', 'text/plain')).toBe(FileCode);
    expect(getFileIcon('main.py', 'text/plain')).toBe(FileCode);
    expect(getFileIcon('index.js', 'text/plain')).toBe(FileCode);
    expect(getFileIcon('lib.rs', 'text/plain')).toBe(FileCode);
    expect(getFileIcon('main.go', 'text/plain')).toBe(FileCode);
    expect(getFileIcon('style.css', 'text/plain')).toBe(FileCode);
    expect(getFileIcon('page.html', 'text/plain')).toBe(FileCode);
    expect(getFileIcon('query.sql', 'text/plain')).toBe(FileCode);
    expect(getFileIcon('run.sh', 'text/plain')).toBe(FileCode);
  });

  it('should return FileCode for code mimeTypes even without code extension', () => {
    expect(getFileIcon('bundle', 'application/javascript')).toBe(FileCode);
    expect(getFileIcon('bundle', 'text/typescript')).toBe(FileCode);
  });

  it('should return FileText for text/document files', () => {
    expect(getFileIcon('readme.txt', 'text/plain')).toBe(FileText);
    expect(getFileIcon('notes.md', 'text/plain')).toBe(FileText);
    expect(getFileIcon('data.csv', 'text/plain')).toBe(FileText);
    expect(getFileIcon('config.json', 'text/plain')).toBe(FileText);
    expect(getFileIcon('.env', 'text/plain')).toBe(FileText);
  });

  it('should return FileText for text/* mimeTypes with unknown extensions', () => {
    expect(getFileIcon('document.unknown', 'text/plain')).toBe(FileText);
  });

  it('should return File for binary/unknown files', () => {
    expect(getFileIcon('image.png', 'image/png')).toBe(File);
    expect(getFileIcon('archive.zip', 'application/zip')).toBe(File);
    expect(getFileIcon('data.bin', 'application/octet-stream')).toBe(File);
  });
});

describe('formatSize', () => {
  it('should format bytes', () => {
    expect(formatSize(0)).toBe('0 B');
    expect(formatSize(512)).toBe('512 B');
    expect(formatSize(1023)).toBe('1023 B');
  });

  it('should format kilobytes', () => {
    expect(formatSize(1024)).toBe('1.0 KB');
    expect(formatSize(1536)).toBe('1.5 KB');
    expect(formatSize(10240)).toBe('10.0 KB');
    expect(formatSize(500 * 1024)).toBe('500.0 KB');
  });

  it('should format megabytes', () => {
    expect(formatSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatSize(3.2 * 1024 * 1024)).toBe('3.2 MB');
    expect(formatSize(100 * 1024 * 1024)).toBe('100.0 MB');
  });

  it('should handle boundary between KB and MB', () => {
    // Just under 1MB
    expect(formatSize(1024 * 1024 - 1)).toBe('1024.0 KB');
    // Exactly 1MB
    expect(formatSize(1024 * 1024)).toBe('1.0 MB');
  });
});
