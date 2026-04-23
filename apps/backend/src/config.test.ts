import { describe, it, expect } from 'vitest';
import { redactDatabaseUrl } from './config';

describe('redactDatabaseUrl', () => {
  it('replaces the password in a postgresql URL', () => {
    const url = 'postgresql://secureedge:super_secret@localhost:5432/secureedge';
    const result = redactDatabaseUrl(url);
    expect(result).not.toContain('super_secret');
    expect(result).toContain('***');
    expect(result).toContain('secureedge');
    expect(result).toContain('localhost');
  });

  it('handles URLs without a password', () => {
    const url = 'postgresql://localhost:5432/secureedge';
    const result = redactDatabaseUrl(url);
    expect(result).toContain('localhost');
    expect(result).not.toContain('***');
  });

  it('returns raw string for invalid URLs', () => {
    const raw = 'not-a-valid-url';
    const result = redactDatabaseUrl(raw);
    expect(result).toBe(raw);
  });

  it('handles URLs with special characters in password', () => {
    const url = 'postgresql://user:p%40ss%23word@host:5432/db';
    const result = redactDatabaseUrl(url);
    expect(result).toContain('***');
    expect(result).not.toContain('p%40ss');
  });
});
