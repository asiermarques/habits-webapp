import { NotFoundError, ForbiddenError, ValidationError } from '../../shared/domain/errors/DomainError.js';

export class EntryNotFoundError extends NotFoundError {
  constructor(id: number) {
    super(`entry ${id} not found`);
  }
}

export class DefinitionNotFoundError extends NotFoundError {
  constructor(id: number) {
    super(`habit definition ${id} not found`);
  }
}

export class WrongUserError extends ForbiddenError {
  constructor() {
    super('habit definition belongs to a different user');
  }
}

export class InvalidEntryDataError extends ValidationError {
  constructor(reason: string) {
    super(reason);
  }
}
