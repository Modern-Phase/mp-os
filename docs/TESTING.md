# Testing Guide

This document describes the testing strategy and conventions for the MP AI Starter Kit.

## Overview

We use a multi-layered testing approach:

1. **Unit Tests** - Test individual functions and components in isolation
2. **Integration Tests** - Test how different parts work together
3. **E2E Tests** - Test complete user flows in a real browser

## Tech Stack

- **Unit/Integration Tests**: [Vitest](https://vitest.dev/) - Fast, ESM-first test framework
- **E2E Tests**: [Playwright](https://playwright.dev/) - Cross-browser automation
- **Testing Library**: [@testing-library/react](https://testing-library.com/react) - Component testing utilities

## Running Tests

### Unit Tests

```bash
# Run tests in watch mode (default)
npm test

# Run tests once
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### E2E Tests

```bash
# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Debug E2E tests
npm run test:e2e:debug
```

### All Tests

```bash
# Run all tests (unit + E2E)
npm run test:all
```

## Test Organization

```
tests/
  ├── unit/           # Unit tests for functions and utilities
  ├── integration/    # Integration tests for API endpoints
  ├── e2e/            # End-to-end tests for user flows
  └── setup.ts        # Test environment setup
```

## Writing Unit Tests

### Example: Testing a utility function

```typescript
import { describe, it, expect } from 'vitest';

describe('chunkText', () => {
  it('should handle empty text', () => {
    expect(chunkText('')).toEqual([]);
  });

  it('should create single chunk for small text', () => {
    const text = 'This is a short text';
    const chunks = chunkText(text, 1000);
    expect(chunks).toHaveLength(1);
  });
});
```

### Example: Testing a React component

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Button } from '@/ui/button';

describe('Button', () => {
  it('should render with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should handle click events', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    await userEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
```

## Writing E2E Tests

### Example: Testing auth flow

```typescript
import { test, expect } from '@playwright/test';

test('should redirect to login when accessing protected routes', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/.*login/);
});
```

### Example: Testing document upload

```typescript
test('should upload and process a document', async ({ page }) => {
  // Navigate to documents page
  await page.goto('/dashboard/documents');

  // Click on a collection
  await page.click('text="Default"');

  // Upload a file
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles('tests/fixtures/sample.pdf');

  // Wait for processing
  await expect(page.locator('text="Completed"')).toBeVisible({ timeout: 30000 });
});
```

## Testing Best Practices

### 1. Test Behavior, Not Implementation

❌ **Bad**: Testing implementation details
```typescript
it('should call setState with value', () => {
  // Testing internal component state
});
```

✅ **Good**: Testing user-visible behavior
```typescript
it('should display error message when form is invalid', () => {
  // Testing what the user sees
});
```

### 2. Use Descriptive Test Names

❌ **Bad**: Vague test names
```typescript
it('works', () => { });
it('test 1', () => { });
```

✅ **Good**: Clear, descriptive names
```typescript
it('should reject usernames shorter than 3 characters', () => { });
it('should display success message after subscription update', () => { });
```

### 3. Arrange-Act-Assert Pattern

```typescript
it('should calculate total price correctly', () => {
  // Arrange: Set up test data
  const items = [{ price: 10 }, { price: 20 }];

  // Act: Execute the function
  const total = calculateTotal(items);

  // Assert: Verify the result
  expect(total).toBe(30);
});
```

### 4. Test Edge Cases

Always test:
- Empty/null/undefined inputs
- Boundary values (min/max)
- Error conditions
- Loading states
- Network failures (for integration tests)

### 5. Keep Tests Isolated

Each test should be independent and not rely on other tests:

```typescript
// Use beforeEach to reset state
beforeEach(() => {
  cleanup();
  resetMocks();
});
```

### 6. Use Test Fixtures

Store test data in fixture files:

```
tests/
  └── fixtures/
      ├── sample.pdf
      ├── sample.jpg
      └── mockData.ts
```

```typescript
import { mockUser } from '../fixtures/mockData';

it('should display user profile', () => {
  render(<Profile user={mockUser} />);
  // ...
});
```

## Coverage Goals

We aim for:
- **70%+ line coverage** for critical paths
- **100% coverage** for:
  - Authentication logic
  - Billing/payment processing
  - Data validation
  - RAG search pipeline

## CI/CD Integration

Tests run automatically on:
- Every push to `main` or `develop`
- Every pull request
- Before deployment

See `.github/workflows/test.yml` for the full CI configuration.

## Debugging Tests

### Debugging Unit Tests

```bash
# Run specific test file
npm test -- validators.test.ts

# Run tests matching pattern
npm test -- --grep="username"

# Run in debug mode (Node debugger)
node --inspect-brk node_modules/.bin/vitest
```

### Debugging E2E Tests

```bash
# Run with headed browser
npm run test:e2e -- --headed

# Debug mode (pauses on each step)
npm run test:e2e:debug

# Run specific test
npm run test:e2e -- auth.spec.ts
```

### Viewing Test UI

Vitest UI provides a nice interface for running and debugging tests:

```bash
npm run test:ui
```

Playwright UI is great for seeing what's happening in E2E tests:

```bash
npm run test:e2e:ui
```

## Mocking

### Mocking Convex Queries/Mutations

```typescript
import { vi } from 'vitest';

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));
```

### Mocking External APIs

```typescript
import { vi } from 'vitest';

global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: async () => ({ data: 'mock data' }),
  })
);
```

## Performance Testing

For performance-critical functions, use benchmarks:

```typescript
import { bench } from 'vitest';

bench('chunkText with large input', () => {
  const text = 'word '.repeat(10000);
  chunkText(text);
});
```

## Accessibility Testing

E2E tests should include accessibility checks:

```typescript
test('should be keyboard navigable', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  // Verify focus is on the expected element
});
```

## Common Issues

### Tests timing out

Increase timeout for slow operations:

```typescript
test('slow operation', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.result')).toBeVisible({ timeout: 30000 });
});
```

### Flaky tests

Common causes:
- Race conditions (await all promises)
- Shared state between tests (use cleanup)
- Network issues (mock external calls)

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library Best Practices](https://testing-library.com/docs/guiding-principles)
- [Test Desiderata (Kent Beck)](https://kentbeck.github.io/TestDesiderata/)

## Contributing

When adding new features, please:
1. Write tests first (TDD) or alongside the feature
2. Ensure all tests pass before submitting PR
3. Maintain or improve test coverage
4. Update this documentation if adding new testing patterns
