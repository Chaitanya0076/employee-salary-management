import type { RequestHandler } from 'express';

export interface RequestLogOptions {
  /** Include the raw X-Forwarded-For chain (only while calibrating TRUST_PROXY). */
  includeForwardedFor?: boolean;
  write?: (line: string) => void;
  now?: () => number;
}

/**
 * One JSON line per request: method, path (without the query string, which can
 * contain names), status, duration and client IP as resolved via `trust proxy`.
 */
export function requestLogger({
  includeForwardedFor = false,
  write = (line) => process.stdout.write(`${line}\n`),
  now = () => performance.now(),
}: RequestLogOptions = {}): RequestHandler {
  return (req, res, next) => {
    const started = now();
    res.on('finish', () => {
      const entry: Record<string, unknown> = {
        time: new Date().toISOString(),
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status: res.statusCode,
        ms: Math.round(now() - started),
        ip: req.ip,
      };
      if (includeForwardedFor) entry['forwardedFor'] = req.headers['x-forwarded-for'] ?? null;
      write(JSON.stringify(entry));
    });
    next();
  };
}
