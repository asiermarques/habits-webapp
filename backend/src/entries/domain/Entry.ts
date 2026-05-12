import type { Entry } from '@habitsapp/shared';
export type { Entry };

import { WrongUserError } from './errors.js';

export function enforceOwnership(definitionUserId: number, requestUserId: number): void {
  if (definitionUserId !== requestUserId) throw new WrongUserError();
}
