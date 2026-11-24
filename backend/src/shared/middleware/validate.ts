import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { ValidationError, type ErrorDetail } from '../errors/index.js';

export interface RequestSchemas {
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
}

const SOURCES = ['params', 'query', 'body'] as const;

/**
 * Validates and coerces request parts with Zod. On success the parsed values
 * replace the raw ones, so controllers receive typed, defaulted data.
 * Problems from all parts are reported together in one 400 response.
 */
export function validate(schemas: RequestSchemas): RequestHandler {
  return (req, _res, next) => {
    const details: ErrorDetail[] = [];
    const parsed: Partial<Record<(typeof SOURCES)[number], unknown>> = {};

    for (const source of SOURCES) {
      const schema = schemas[source];
      if (!schema) continue;

      const result = schema.safeParse(req[source]);
      if (result.success) {
        parsed[source] = result.data;
      } else {
        for (const issue of result.error.issues) {
          details.push({
            path: [source, ...issue.path.map(String)].join('.'),
            message: issue.message,
          });
        }
      }
    }

    if (details.length > 0) {
      next(new ValidationError('Request validation failed', details));
      return;
    }

    if ('params' in parsed) req.params = parsed.params as typeof req.params;
    if ('body' in parsed) req.body = parsed.body;
    if ('query' in parsed) {
      // Express 5 exposes req.query as a getter, so it is redefined rather than assigned.
      Object.defineProperty(req, 'query', {
        value: parsed.query,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }

    next();
  };
}
