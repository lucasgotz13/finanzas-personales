import type { NextFunction, Request, Response } from 'express';
import { DomainError } from '@finanzas/domain';

const STATUS_BY_CODE = {
  VALIDATION_ERROR: 422,
  NOT_FOUND: 404,
  CONFLICT: 409,
} as const;

/** Maps domain errors to the API error envelope (design: {error:{code,message,details[]}}). */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof DomainError) {
    res.status(STATUS_BY_CODE[err.code]).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error', details: [] } });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found', details: [] } });
}

/** Express 4 does not catch async rejections; this wrapper forwards them to the error handler. */
export function wrap(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
}
