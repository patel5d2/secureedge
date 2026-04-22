import { describe, it, expect } from 'vitest';
import { requireRole } from './rbac';
import type { Request, Response, NextFunction } from 'express';

function mockReq(role?: string): Partial<Request> {
  return {
    user: role ? { id: '1', email: 'test@test.com', role, full_name: 'Test' } : undefined,
  };
}

function mockRes(): Partial<Response> & { statusCode: number; body: unknown } {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) { res.statusCode = code; return res; },
    json(data: unknown) { res.body = data; return res; },
  };
  return res;
}

describe('requireRole middleware', () => {
  it('returns 401 when no user on request', () => {
    const req = mockReq() as Request;
    const res = mockRes() as unknown as Response;
    const next = (() => {}) as NextFunction;

    requireRole('admin')(req, res, next);

    expect((res as any).statusCode).toBe(401);
    expect((res as any).body).toEqual({ error: 'unauthorized' });
  });

  it('returns 403 when user role does not match', () => {
    const req = mockReq('user') as Request;
    const res = mockRes() as unknown as Response;
    const next = (() => {}) as NextFunction;

    requireRole('admin')(req, res, next);

    expect((res as any).statusCode).toBe(403);
    expect((res as any).body).toEqual({ error: 'forbidden' });
  });

  it('calls next when user role matches single allowed role', () => {
    const req = mockReq('admin') as Request;
    const res = mockRes() as unknown as Response;
    let nextCalled = false;
    const next = (() => { nextCalled = true; }) as NextFunction;

    requireRole('admin')(req, res, next);

    expect(nextCalled).toBe(true);
  });

  it('calls next when user role matches one of multiple allowed roles', () => {
    const req = mockReq('helpdesk') as Request;
    const res = mockRes() as unknown as Response;
    let nextCalled = false;
    const next = (() => { nextCalled = true; }) as NextFunction;

    requireRole('admin', 'helpdesk')(req, res, next);

    expect(nextCalled).toBe(true);
  });

  it('rejects when user role is not in the allowed list', () => {
    const req = mockReq('user') as Request;
    const res = mockRes() as unknown as Response;
    const next = (() => {}) as NextFunction;

    requireRole('admin', 'helpdesk')(req, res, next);

    expect((res as any).statusCode).toBe(403);
  });
});
