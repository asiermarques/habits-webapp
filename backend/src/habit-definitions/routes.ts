import { Router } from 'express';
import { HABIT_TYPES, type HabitType } from '@habitsapp/shared';
import {
  listHabitDefinitions,
  createHabitDefinition,
  updateHabitDefinition,
  deleteHabitDefinition,
} from './repository.js';

export const habitDefinitionsRouter = Router();

const MAX_NAME_LENGTH = 100;

function isHabitType(value: unknown): value is HabitType {
  return typeof value === 'string' && (HABIT_TYPES as readonly string[]).includes(value);
}

habitDefinitionsRouter.get('/', (req, res) => {
  const userId = Number(req.query.userId);
  if (!Number.isInteger(userId)) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }
  res.json(listHabitDefinitions(userId));
});

habitDefinitionsRouter.post('/', (req, res) => {
  const userId = Number(req.body?.userId);
  if (!Number.isInteger(userId)) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }

  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  if (name.length > MAX_NAME_LENGTH) {
    res.status(400).json({ error: `name must be ${MAX_NAME_LENGTH} characters or fewer` });
    return;
  }
  if (!isHabitType(req.body?.type)) {
    res.status(400).json({ error: 'type must be one of: workout, writing, custom' });
    return;
  }

  const positive = typeof req.body?.positive === 'boolean' ? req.body.positive : undefined;
  const result = createHabitDefinition({ userId, name, type: req.body.type, positive });
  if (result.status === 'user_not_found') {
    res.status(404).json({ error: 'user not found' });
    return;
  }
  res.status(201).json(result.definition);
});

habitDefinitionsRouter.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'invalid id' });
    return;
  }

  const patch: { name?: string; type?: HabitType; positive?: boolean } = {};

  if (req.body?.name !== undefined) {
    if (typeof req.body.name !== 'string' || !req.body.name.trim()) {
      res.status(400).json({ error: 'name cannot be empty' });
      return;
    }
    const trimmed = req.body.name.trim();
    if (trimmed.length > MAX_NAME_LENGTH) {
      res.status(400).json({ error: `name must be ${MAX_NAME_LENGTH} characters or fewer` });
      return;
    }
    patch.name = trimmed;
  }

  if (req.body?.type !== undefined) {
    if (!isHabitType(req.body.type)) {
      res.status(400).json({ error: 'type must be one of: workout, writing, custom' });
      return;
    }
    patch.type = req.body.type;
  }

  if (typeof req.body?.positive === 'boolean') {
    patch.positive = req.body.positive;
  }

  const result = updateHabitDefinition(id, patch);
  if (result.status === 'not_found') {
    res.status(404).json({ error: 'habit definition not found' });
    return;
  }
  if (result.status === 'type_locked') {
    res.status(409).json({ error: 'type cannot change once entries exist' });
    return;
  }
  res.json(result.definition);
});

habitDefinitionsRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'invalid id' });
    return;
  }

  const result = deleteHabitDefinition(id);
  if (result === 'not_found') {
    res.status(404).json({ error: 'habit definition not found' });
    return;
  }
  if (result === 'has_entries') {
    res.status(409).json({ error: 'cannot delete a habit definition with existing entries' });
    return;
  }
  res.status(204).end();
});
