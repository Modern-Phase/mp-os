import { describe, it, expect, vi, afterEach } from 'vitest'

// Mock modules that pull in Convex server code or Clerk/Router hooks
vi.mock('@cvx/schema', () => ({
  CURRENCIES: { USD: 'usd', EUR: 'eur' },
}))
vi.mock('@clerk/clerk-react', () => ({ useClerk: vi.fn() }))
vi.mock('@tanstack/react-router', () => ({
  useNavigate: vi.fn(),
  useRouter: vi.fn(),
}))

import { cn, callAll, getLocaleCurrency } from '@/utils/misc'

describe('cn()', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('ignores falsy values', () => {
    expect(cn('foo', false && 'bar', undefined, null, 'baz')).toBe('foo baz')
  })

  it('resolves Tailwind conflicts (last wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('handles empty inputs', () => {
    expect(cn()).toBe('')
    expect(cn('')).toBe('')
  })

  it('handles conditional object syntax', () => {
    expect(cn({ 'text-red-500': true, 'text-blue-500': false })).toBe('text-red-500')
  })
})

describe('callAll()', () => {
  it('calls all functions with the same args', () => {
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    callAll(fn1, fn2)('a', 'b')
    expect(fn1).toHaveBeenCalledWith('a', 'b')
    expect(fn2).toHaveBeenCalledWith('a', 'b')
  })

  it('skips undefined entries', () => {
    const fn1 = vi.fn()
    callAll(fn1, undefined, undefined)('x')
    expect(fn1).toHaveBeenCalledWith('x')
  })

  it('handles all-undefined without throwing', () => {
    expect(() => callAll(undefined, undefined)('x')).not.toThrow()
  })

  it('handles empty call', () => {
    expect(() => callAll()()).not.toThrow()
  })
})

describe('getLocaleCurrency()', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns usd when navigator.languages includes "en-US"', () => {
    vi.stubGlobal('navigator', { languages: ['en-US', 'en'] })
    expect(getLocaleCurrency()).toBe('usd')
  })

  it('returns eur when navigator.languages does not include "en-US"', () => {
    vi.stubGlobal('navigator', { languages: ['de-DE', 'de'] })
    expect(getLocaleCurrency()).toBe('eur')
  })

  it('returns eur for empty languages array', () => {
    vi.stubGlobal('navigator', { languages: [] })
    expect(getLocaleCurrency()).toBe('eur')
  })
})
