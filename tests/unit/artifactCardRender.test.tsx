import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Unit tests for ArtifactCard React component rendering
 * Tests that artifact cards display correct info and handle edge cases
 */

// Mock convex/react
vi.mock('convex/react', () => ({
  useConvex: vi.fn(() => ({
    query: vi.fn().mockResolvedValue({ content: 'mock content' }),
  })),
}));

// Mock the Convex API module
vi.mock('~/convex/_generated/api', () => ({
  api: {
    agentSync: {
      getAgentFileById: 'getAgentFileById',
    },
  },
}));

import { ArtifactCard, ArtifactPanelProvider } from '@/components/agents/ArtifactCard';

function renderWithProvider(ui: React.ReactElement) {
  return render(<ArtifactPanelProvider>{ui}</ArtifactPanelProvider>);
}

const sampleArtifacts = [
  {
    fileId: 'file1',
    filename: 'hello.py',
    path: '/workspace/hello.py',
    mimeType: 'text/x-python',
    sizeBytes: 256,
  },
  {
    fileId: 'file2',
    filename: 'config.json',
    path: '/workspace/config.json',
    mimeType: 'application/json',
    sizeBytes: 1536,
  },
  {
    fileId: 'file3',
    filename: 'app.tsx',
    path: '/workspace/src/app.tsx',
    mimeType: 'text/x-typescript',
    sizeBytes: 3.2 * 1024 * 1024,
  },
];

describe('ArtifactCard', () => {
  it('should render nothing when artifacts is empty', () => {
    const { container } = renderWithProvider(<ArtifactCard artifacts={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('should render nothing when artifacts is null-ish', () => {
    const { container } = renderWithProvider(<ArtifactCard artifacts={null as any} />);
    expect(container.innerHTML).toBe('');
  });

  it('should render one card per artifact', () => {
    renderWithProvider(<ArtifactCard artifacts={sampleArtifacts} />);

    expect(screen.getByText('hello.py')).toBeInTheDocument();
    expect(screen.getByText('config.json')).toBeInTheDocument();
    expect(screen.getByText('app.tsx')).toBeInTheDocument();
  });

  it('should display file type labels', () => {
    renderWithProvider(<ArtifactCard artifacts={sampleArtifacts} />);

    expect(screen.getByText(/Python/)).toBeInTheDocument();
    expect(screen.getByText(/JSON/)).toBeInTheDocument();
    expect(screen.getByText(/TypeScript/)).toBeInTheDocument();
  });

  it('should render a Download button for each artifact', () => {
    renderWithProvider(<ArtifactCard artifacts={sampleArtifacts} />);

    const downloadButtons = screen.getAllByRole('button', { name: /download/i });
    expect(downloadButtons).toHaveLength(3);
  });

  it('should render a single artifact correctly', () => {
    renderWithProvider(
      <ArtifactCard
        artifacts={[
          {
            fileId: 'single',
            filename: 'script.sh',
            path: '/workspace/script.sh',
            mimeType: 'text/x-shellscript',
            sizeBytes: 42,
          },
        ]}
      />,
    );

    expect(screen.getByText('script.sh')).toBeInTheDocument();
    expect(screen.getByText(/Shell/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /download/i })).toHaveLength(1);
  });
});
