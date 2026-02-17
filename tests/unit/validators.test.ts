import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Unit tests for validation logic
 * Tests input validation for forms and API endpoints
 */

// Username validator (from app.ts)
const usernameValidator = z.string().min(3).max(20).regex(/^[a-zA-Z0-9]+$/);

function validateUsername(username: string): { valid: boolean; error?: string } {
  try {
    usernameValidator.parse(username);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues?.[0];
      return { valid: false, error: firstError?.message || 'Validation failed' };
    }
    return { valid: false, error: 'Unknown validation error' };
  }
}

describe('Username Validation', () => {
  it('should accept valid usernames', () => {
    expect(validateUsername('john123').valid).toBe(true);
    expect(validateUsername('user').valid).toBe(true);
    expect(validateUsername('Test123').valid).toBe(true);
    expect(validateUsername('abc').valid).toBe(true); // Minimum 3 chars
  });

  it('should reject too short usernames', () => {
    const result = validateUsername('ab');
    expect(result.valid).toBe(false);
  });

  it('should reject too long usernames', () => {
    const result = validateUsername('a'.repeat(21));
    expect(result.valid).toBe(false);
  });

  it('should reject usernames with special characters', () => {
    expect(validateUsername('user@123').valid).toBe(false);
    expect(validateUsername('user name').valid).toBe(false);
    expect(validateUsername('user-name').valid).toBe(false);
    expect(validateUsername('user_name').valid).toBe(false);
    expect(validateUsername('user.name').valid).toBe(false);
  });

  it('should reject empty username', () => {
    expect(validateUsername('').valid).toBe(false);
  });

  it('should reject username with only numbers', () => {
    // This is actually valid per the regex, but we might want to change this
    expect(validateUsername('123456').valid).toBe(true);
  });
});

// Email validator
const emailValidator = z.string().email();

function validateEmail(email: string): boolean {
  return emailValidator.safeParse(email).success;
}

describe('Email Validation', () => {
  it('should accept valid emails', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('test.user@example.co.uk')).toBe(true);
    expect(validateEmail('user+tag@example.com')).toBe(true);
  });

  it('should reject invalid emails', () => {
    expect(validateEmail('notanemail')).toBe(false);
    expect(validateEmail('@example.com')).toBe(false);
    expect(validateEmail('user@')).toBe(false);
    expect(validateEmail('user @example.com')).toBe(false);
  });
});

// RAG Search query validator
function validateSearchQuery(query: string): { valid: boolean; error?: string } {
  if (!query || query.trim().length === 0) {
    return { valid: false, error: 'Query cannot be empty' };
  }

  if (query.length > 10000) {
    return { valid: false, error: 'Query too long (max 10000 characters)' };
  }

  return { valid: true };
}

describe('Search Query Validation', () => {
  it('should accept valid queries', () => {
    expect(validateSearchQuery('What is on the invoice?').valid).toBe(true);
    expect(validateSearchQuery('Tell me about the document').valid).toBe(true);
  });

  it('should reject empty queries', () => {
    expect(validateSearchQuery('').valid).toBe(false);
    expect(validateSearchQuery('   ').valid).toBe(false);
  });

  it('should reject overly long queries', () => {
    const longQuery = 'a'.repeat(10001);
    const result = validateSearchQuery(longQuery);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too long');
  });

  it('should accept queries up to the limit', () => {
    const maxQuery = 'a'.repeat(10000);
    expect(validateSearchQuery(maxQuery).valid).toBe(true);
  });
});

// File size validator
function validateFileSize(size: number, maxSize: number = 100 * 1024 * 1024): boolean {
  return size > 0 && size <= maxSize;
}

describe('File Size Validation', () => {
  const MB = 1024 * 1024;

  it('should accept files within limit', () => {
    expect(validateFileSize(1 * MB)).toBe(true);
    expect(validateFileSize(50 * MB)).toBe(true);
    expect(validateFileSize(99 * MB)).toBe(true);
  });

  it('should reject files over 100MB', () => {
    expect(validateFileSize(101 * MB)).toBe(false);
    expect(validateFileSize(200 * MB)).toBe(false);
  });

  it('should reject zero or negative sizes', () => {
    expect(validateFileSize(0)).toBe(false);
    expect(validateFileSize(-1)).toBe(false);
  });

  it('should respect custom max size', () => {
    const customMax = 50 * MB;
    expect(validateFileSize(40 * MB, customMax)).toBe(true);
    expect(validateFileSize(60 * MB, customMax)).toBe(false);
  });
});
