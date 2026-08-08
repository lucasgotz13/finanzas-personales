/** Domain error codes mapped to HTTP statuses by the API adapter. */
export type ErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT';

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly details: string[];

  constructor(code: ErrorCode, message: string, details: string[] = []) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details: string[] = []) {
    super('VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string, details: string[] = []) {
    super('NOT_FOUND', message, details);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, details: string[] = []) {
    super('CONFLICT', message, details);
    this.name = 'ConflictError';
  }
}
