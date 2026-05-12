import { NotFoundError, ConflictError } from '../../shared/errors/DomainError.js';

export class UserNotFoundError extends NotFoundError {
  constructor(id: number) {
    super(`user ${id} not found`);
  }
}

export class OnlyUserError extends ConflictError {
  constructor() {
    super('cannot delete the only user');
  }
}
