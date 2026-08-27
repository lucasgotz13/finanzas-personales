/** Domain error codes mapped to HTTP statuses by the API adapter. */
export type ErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT';

/**
 * Stable, machine-readable error reasons carried additively by DomainError
 * (and by the API adapter's HttpError). The UI keys its es-AR translation
 * templates on these identifiers; errors the UI does not translate carry no
 * reason at all.
 */
export type ErrorReason =
  | 'TRADE_EXCEEDS_BALANCE'
  | 'RATE_REQUIRED_FOR_CURRENCY'
  | 'CATEGORY_HAS_CHILDREN'
  | 'INVALID_NAME'
  | 'INVALID_PARENT_ID'
  | 'NOTHING_TO_UPDATE'
  | 'INVALID_CATEGORY_ID'
  | 'INVALID_TRANSACTION_ID'
  | 'INVALID_DATE_RANGE'
  | 'INVALID_PERIOD'
  | 'INVALID_DATE'
  | 'INVALID_MONTH'
  | 'INVALID_BUDGETS_PAYLOAD'
  | 'ROUTE_NOT_FOUND'
  | 'INVALID_PASSPHRASE'
  | 'AUTH_LOCKED'
  | 'AUTH_DISABLED';

/** Structured dynamic data accompanying an error reason. */
export type ErrorMeta = Record<string, unknown>;

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly details: string[];
  readonly reason?: ErrorReason;
  readonly meta?: ErrorMeta;

  constructor(code: ErrorCode, message: string, details: string[] = [], reason?: ErrorReason, meta?: ErrorMeta) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
    this.reason = reason;
    this.meta = meta;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details: string[] = [], reason?: ErrorReason, meta?: ErrorMeta) {
    super('VALIDATION_ERROR', message, details, reason, meta);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string, details: string[] = [], reason?: ErrorReason, meta?: ErrorMeta) {
    super('NOT_FOUND', message, details, reason, meta);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, details: string[] = [], reason?: ErrorReason, meta?: ErrorMeta) {
    super('CONFLICT', message, details, reason, meta);
    this.name = 'ConflictError';
  }
}
