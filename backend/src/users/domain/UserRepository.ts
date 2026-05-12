import type { User } from './User.js';

export interface UserRepository {
  list(): User[];
  findById(id: number): User | undefined;
  create(name: string): User;
  update(id: number, patch: { name?: string; isDefault?: boolean }): User;
  delete(id: number): void;
}
