import { describe, it, expect, vi } from 'vitest';
import { errorHandler, HttpError, asyncHandler } from './errors';
import { ZodError, ZodIssue } from 'zod';
import type { Request, Response, NextFunction } from 'express';

function mockRes(): any {
  const res: any = {
    statusCode: 200,
    body: null,
    headersSent: false,
    status(code: number) { res.statusCode = code; return res; },
    json(data: unknown) { res.body = data; return res; },
  };
  return res;
}

describe('errorHandler', () => {
  const req = {} as Request;
  const next = (() => {}) as NextFunction;

  it('handles ZodError with 400 and validation details', () => {
    const issues: ZodIssue[] = [
      { code: 'invalid_type', expected: 'string', received: 'number', path: ['email'], message: 'Expected string' },
    ];
    const err = new ZodError(issues);
    const res = mockRes();

    errorHandler(err, req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.details).toHaveLength(1);
    expect(res.body.details[0].path).toBe('email');
  });

  it('handles HttpError with custom status', () => {
    const err = new HttpError(409, 'conflict');
    const res = mockRes();

    errorHandler(err, req, res, next);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('conflict');
  });

  it('handles unknown errors as 500', () => {
    const err = new Error('kaboom');
    const res = mockRes();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    errorHandler(err, req, res, next);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('internal_server_error');
    consoleSpy.mockRestore();
  });

  it('skips if headers already sent', () => {
    const res = mockRes();
    res.headersSent = true;

    errorHandler(new Error('ignored'), req, res, next);

    expect(res.body).toBeNull(); // no response sent
  });

  it('handles errors with statusCode property', () => {
    const err = { statusCode: 422, message: 'unprocessable' };
    const res = mockRes();

    errorHandler(err, req, res, next);

    expect(res.statusCode).toBe(422);
    expect(res.body.error).toBe('unprocessable');
  });
});

describe('asyncHandler', () => {
  it('passes async errors to next()', async () => {
    const error = new Error('async error');
    const handler = asyncHandler(async (_req, _res) => {
      throw error;
    });

    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn();

    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
