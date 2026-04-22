import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signToken } from './auth';
import jwt from 'jsonwebtoken';

// Use a fixed secret for testing
vi.mock('../config', () => ({
  config: {
    JWT_SECRET: 'test-secret-for-unit-tests-only-do-not-use',
    SESSION_TTL_SECONDS: 3600,
    NODE_ENV: 'test',
  },
}));

describe('signToken', () => {
  const user = { id: 'user-123', email: 'test@test.com', role: 'user' };

  it('creates a valid JWT with user claims', () => {
    const token = signToken(user);
    const payload = jwt.decode(token) as Record<string, unknown>;

    expect(payload.sub).toBe('user-123');
    expect(payload.email).toBe('test@test.com');
    expect(payload.role).toBe('user');
  });

  it('includes session ID when provided', () => {
    const token = signToken(user, 'session-456');
    const payload = jwt.decode(token) as Record<string, unknown>;

    expect(payload.sid).toBe('session-456');
  });

  it('omits session ID when not provided', () => {
    const token = signToken(user);
    const payload = jwt.decode(token) as Record<string, unknown>;

    expect(payload.sid).toBeUndefined();
  });

  it('includes mfa=false by default', () => {
    const token = signToken(user, 'session-1');
    const payload = jwt.decode(token) as Record<string, unknown>;

    expect(payload.mfa).toBe(false);
  });

  it('includes mfa=true when specified', () => {
    const token = signToken(user, 'session-1', true);
    const payload = jwt.decode(token) as Record<string, unknown>;

    expect(payload.mfa).toBe(true);
  });

  it('sets expiry based on SESSION_TTL_SECONDS', () => {
    const token = signToken(user);
    const payload = jwt.decode(token) as Record<string, unknown>;

    expect(payload.exp).toBeDefined();
    const ttl = (payload.exp as number) - (payload.iat as number);
    expect(ttl).toBe(3600);
  });

  it('produces a token verifiable with the secret', () => {
    const token = signToken(user);
    const verified = jwt.verify(token, 'test-secret-for-unit-tests-only-do-not-use');

    expect(verified).toBeDefined();
    expect((verified as Record<string, unknown>).sub).toBe('user-123');
  });

  it('rejects token with wrong secret', () => {
    const token = signToken(user);

    expect(() => {
      jwt.verify(token, 'wrong-secret');
    }).toThrow();
  });
});
