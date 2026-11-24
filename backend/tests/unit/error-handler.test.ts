import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../src/generated/prisma/client.js';
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../src/shared/errors/index.js';
import { createErrorHandler } from '../../src/shared/middleware/error-handler.js';

function fakeResponse(headersSent = false) {
  const res = {
    headersSent,
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

function run(err: unknown, res = fakeResponse()) {
  const logger = { error: vi.fn() };
  const next = vi.fn();
  createErrorHandler(logger)(err, {} as Request, res as unknown as Response, next as NextFunction);
  return { res, logger, next };
}

describe('errorHandler', () => {
  it.each([
    [new UnauthorizedError(), 401, 'UNAUTHORIZED', 'Authentication required'],
    [new NotFoundError('Employee 7 not found'), 404, 'NOT_FOUND', 'Employee 7 not found'],
    [new ConflictError('Overlapping period'), 409, 'CONFLICT', 'Overlapping period'],
  ])('maps %s to its status and code', (err, status, code, message) => {
    const { res, logger } = run(err);

    expect(res.statusCode).toBe(status);
    expect(res.body).toEqual({ error: { code, message } });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('includes validation details when present', () => {
    const details = [{ path: 'body.email', message: 'Invalid email' }];
    const { res } = run(new ValidationError('Request validation failed', details));

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details },
    });
  });

  it.each([
    ['P2002', 409, 'CONFLICT'],
    ['P2025', 404, 'NOT_FOUND'],
  ])('maps the Prisma %s error to %i', (code, status, errorCode) => {
    const err = new Prisma.PrismaClientKnownRequestError('db error with internals', {
      code,
      clientVersion: 'test',
    });

    const { res, logger } = run(err);

    expect(res.statusCode).toBe(status);
    expect(res.body).toMatchObject({ error: { code: errorCode } });
    expect(JSON.stringify(res.body)).not.toContain('internals');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('turns malformed JSON into a 400', () => {
    const { res } = run(
      Object.assign(new SyntaxError('Unexpected token'), {
        type: 'entity.parse.failed',
        status: 400,
      }),
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' },
    });
  });

  it('turns an oversized body into a 413', () => {
    const { res } = run(
      Object.assign(new Error('too large'), {
        type: 'entity.too.large',
        status: 413,
      }),
    );

    expect(res.statusCode).toBe(413);
    expect(res.body).toMatchObject({ error: { code: 'PAYLOAD_TOO_LARGE' } });
  });

  it('hides unexpected errors behind a generic 500 and logs them', () => {
    const err = new Error('connection refused at 10.0.0.5:5432');
    const { res, logger } = run(err);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
    expect(logger.error).toHaveBeenCalledWith(err);
  });

  it('delegates to Express when the response has already started', () => {
    const err = new Error('late failure');
    const { res, next } = run(err, fakeResponse(true));

    expect(next).toHaveBeenCalledWith(err);
    expect(res.body).toBeUndefined();
  });
});
