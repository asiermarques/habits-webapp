import { NotFoundError, ConflictError } from '../../shared/domain/errors/DomainError.js';
export { UserNotFoundError } from '../../users/domain/errors.js';

export class HabitDefinitionNotFoundError extends NotFoundError {
  constructor(id: number) {
    super(`habit definition ${id} not found`);
  }
}

export class TypeLockedError extends ConflictError {
  constructor() {
    super('type cannot change once entries exist');
  }
}

export class HasEntriesError extends ConflictError {
  constructor() {
    super('cannot delete a habit definition with existing entries');
  }
}
