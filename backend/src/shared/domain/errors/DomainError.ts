export abstract class DomainError extends Error {
  abstract readonly httpStatus: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends DomainError {
  readonly httpStatus = 404;
}

export class ConflictError extends DomainError {
  readonly httpStatus = 409;
}

export class ValidationError extends DomainError {
  readonly httpStatus = 400;
}

export class ForbiddenError extends DomainError {
  readonly httpStatus = 403;
}
