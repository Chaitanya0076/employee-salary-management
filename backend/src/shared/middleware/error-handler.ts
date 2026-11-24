import type { ErrorRequestHandler } from 'express';
import { Prisma } from '../../generated/prisma/client.js';
import { AppError, type ErrorDetail } from '../errors/index.js';

export interface ErrorResponseBody {
  error: { code: string; message: string; details?: ErrorDetail[] };
}

type Logger = Pick<Console, 'error'>;

/** Errors raised by express.json() carry a `type` and an HTTP `status`. */
function isBodyParserError(err: unknown): err is { type: string; status: number } {
  return typeof err === 'object' && err !== null && 'type' in err && 'status' in err;
}

function body(code: string, message: string, details?: ErrorDetail[]): ErrorResponseBody {
  return { error: details?.length ? { code, message, details } : { code, message } };
}

/**
 * Central error handler: every error leaves the API in the same shape,
 * and internal details (stack traces, driver messages) never reach the client.
 */
export function createErrorHandler(logger: Logger = console): ErrorRequestHandler {
  return (err, _req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    if (err instanceof AppError) {
      res.status(err.statusCode).json(body(err.code, err.message, err.details));
      return;
    }

    // Safety net for races the services can't pre-check (e.g. two concurrent creates).
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        res
          .status(409)
          .json(body('CONFLICT', 'A record with the same unique value already exists'));
        return;
      }
      if (err.code === 'P2025') {
        res.status(404).json(body('NOT_FOUND', 'Resource not found'));
        return;
      }
    }

    if (isBodyParserError(err)) {
      if (err.type === 'entity.parse.failed') {
        res.status(400).json(body('INVALID_JSON', 'Request body is not valid JSON'));
        return;
      }
      if (err.type === 'entity.too.large') {
        res.status(413).json(body('PAYLOAD_TOO_LARGE', 'Request body is too large'));
        return;
      }
    }

    logger.error(err);
    res.status(500).json(body('INTERNAL_ERROR', 'Internal server error'));
  };
}
