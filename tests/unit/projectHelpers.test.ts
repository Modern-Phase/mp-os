import { describe, it, expect, vi, afterEach } from 'vitest'

/**
 * Unit tests for pure helpers extracted from _layout.projects.tsx (lines 109-128).
 * These are inline (not exported), so we duplicate them here for testing.
 */

// ── Helpers (mirrored from _layout.projects.tsx) ──

function computeProgress(tasks: { status: string }[]): number {
  if (tasks.length === 0) return 0
  const done = tasks.filter((t) => t.status === 'done').length
  return Math.round((done / tasks.length) * 100)
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ')
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ── Tests ──

describe('computeProgress', () => {
  it('returns 0 for empty array', () => {
    expect(computeProgress([])).toBe(0)
  })

  it('returns 0 when no tasks are done', () => {
    expect(computeProgress([{ status: 'todo' }, { status: 'in_progress' }])).toBe(0)
  })

  it('returns 100 when all tasks are done', () => {
    expect(computeProgress([{ status: 'done' }, { status: 'done' }])).toBe(100)
  })

  it('returns 33 for 1 of 3 done', () => {
    expect(computeProgress([
      { status: 'done' },
      { status: 'todo' },
      { status: 'todo' },
    ])).toBe(33)
  })

  it('returns 67 for 2 of 3 done', () => {
    expect(computeProgress([
      { status: 'done' },
      { status: 'done' },
      { status: 'todo' },
    ])).toBe(67)
  })

  it('returns 50 for 1 of 2 done', () => {
    expect(computeProgress([
      { status: 'done' },
      { status: 'todo' },
    ])).toBe(50)
  })
})

describe('formatAction', () => {
  it('replaces underscores with spaces', () => {
    expect(formatAction('created_task')).toBe('created task')
  })

  it('replaces multiple underscores', () => {
    expect(formatAction('assigned_agent_to_project')).toBe('assigned agent to project')
  })

  it('returns unchanged string when no underscores', () => {
    expect(formatAction('comment')).toBe('comment')
  })

  it('handles empty string', () => {
    expect(formatAction('')).toBe('')
  })
})

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  const NOW = 1700000000000

  function setNow() {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  }

  it('returns "just now" for < 1 minute ago', () => {
    setNow()
    expect(formatRelativeTime(NOW - 30_000)).toBe('just now')
  })

  it('returns "just now" for exactly 0 diff', () => {
    setNow()
    expect(formatRelativeTime(NOW)).toBe('just now')
  })

  it('returns "1m ago" at exactly 1 minute', () => {
    setNow()
    expect(formatRelativeTime(NOW - 60_000)).toBe('1m ago')
  })

  it('returns "5m ago" for 5 minutes', () => {
    setNow()
    expect(formatRelativeTime(NOW - 5 * 60_000)).toBe('5m ago')
  })

  it('returns "1h ago" at exactly 60 minutes', () => {
    setNow()
    expect(formatRelativeTime(NOW - 60 * 60_000)).toBe('1h ago')
  })

  it('returns "2h ago" for 2 hours', () => {
    setNow()
    expect(formatRelativeTime(NOW - 2 * 60 * 60_000)).toBe('2h ago')
  })

  it('returns "1d ago" at exactly 24 hours', () => {
    setNow()
    expect(formatRelativeTime(NOW - 24 * 60 * 60_000)).toBe('1d ago')
  })

  it('returns "2d ago" for 2 days', () => {
    setNow()
    expect(formatRelativeTime(NOW - 2 * 24 * 60 * 60_000)).toBe('2d ago')
  })
})
