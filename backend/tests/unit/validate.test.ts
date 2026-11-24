import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ValidationError } from '../../src/shared/errors/index.js';
import { validate, type RequestSchemas } from '../../src/shared/middleware/validate.js';

function run(schemas: RequestSchemas, req: Partial<Request>) {
  const next = vi.fn();
  const request = { params: {}, query: {}, body: undefined, ...req } as Request;
  validate(schemas)(request, {} as Response, next as NextFunction);
  return { req: request, next, error: next.mock.calls[0]?.[0] as unknown };
}

describe('validate middleware', () => {
  it('replaces the body with parsed data, stripping unknown keys', () => {
    const { req, error } = run(
      { body: z.object({ name: z.string().trim() }) },
      { body: { name: '  Ada  ', isAdmin: true } },
    );

    expect(error).toBeUndefined();
    expect(req.body).toEqual({ name: 'Ada' });
  });

  it('coerces and defaults query parameters', () => {
    const schema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().max(100).default(25),
    });
    const { req, error } = run({ query: schema }, { query: { page: '3' } });

    expect(error).toBeUndefined();
    expect(req.query).toEqual({ page: 3, pageSize: 25 });
  });

  it('coerces route params', () => {
    const { req } = run(
      { params: z.object({ id: z.coerce.number().int().positive() }) },
      {
        params: { id: '42' },
      },
    );

    expect(req.params).toEqual({ id: 42 });
  });

  it('reports every invalid field across sources with dotted paths', () => {
    const { req, error } = run(
      {
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: z.object({ email: z.email(), amount: z.number().positive() }),
      },
      { params: { id: 'abc' }, body: { email: 'nope', amount: -5 } },
    );

    expect(error).toBeInstanceOf(ValidationError);
    const paths = (error as ValidationError).details?.map((d) => d.path);
    expect(paths).toEqual(['params.id', 'body.email', 'body.amount']);
    // Nothing is replaced when validation fails.
    expect(req.params).toEqual({ id: 'abc' });
  });

  it('rejects a missing body when one is required', () => {
    const { error } = run({ body: z.object({ name: z.string() }) }, {});

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).details?.[0]?.path).toBe('body');
  });
});
