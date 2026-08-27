import type { NextFunction, Request, Response } from 'express';
import { DomainError } from '@finanzas/domain';
import type { ErrorMeta, ErrorReason } from '@finanzas/domain';

const STATUS_BY_CODE = {
  VALIDATION_ERROR: 422,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNAUTHORIZED: 401,
} as const;

/** HTTP-adapter error code: auth failures belong to the adapter, not the domain. */
export type HttpErrorCode = 'UNAUTHORIZED';

/** Adapter-level error shaped like a DomainError so it fits the same envelope. */
export class HttpError extends Error {
  readonly code: HttpErrorCode;
  readonly details: string[];
  readonly reason?: ErrorReason;
  readonly meta?: ErrorMeta;

  constructor(code: HttpErrorCode, message: string, details: string[] = [], reason?: ErrorReason, meta?: ErrorMeta) {
    super(message);
    this.name = 'HttpError';
    this.code = code;
    this.details = details;
    this.reason = reason;
    this.meta = meta;
  }
}

/** Maps domain/adapter errors to the API error envelope
 * (design: {error:{code,message,details[],reason?,meta?}} — reason/meta are
 * additive and only included when the error carries them). */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const apiError =
    err instanceof DomainError || err instanceof HttpError
      ? {
          code: err.code,
          message: err.message,
          details: err.details,
          ...(err.reason !== undefined && { reason: err.reason }),
          ...(err.meta !== undefined && { meta: err.meta }),
        }
      : undefined;
  if (apiError) {
    res.status(STATUS_BY_CODE[apiError.code]).json({ error: apiError });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error', details: [] } });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found', details: [], reason: 'ROUTE_NOT_FOUND' } });
}

/** Express 4 does not catch async rejections; this wrapper forwards them to the error handler. */
export function wrap(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
}
