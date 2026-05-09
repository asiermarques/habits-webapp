import { Router } from 'express';
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
} from './repository.js';

export const usersRouter = Router();

const MAX_NAME_LENGTH = 100;

usersRouter.get('/', (_req, res) => {
  res.json(listUsers());
});

usersRouter.post('/', (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  if (name.length > MAX_NAME_LENGTH) {
    res.status(400).json({ error: `name must be ${MAX_NAME_LENGTH} characters or fewer` });
    return;
  }
  res.status(201).json(createUser(name));
});

usersRouter.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'invalid id' });
    return;
  }

  const patch: { name?: string; isDefault?: boolean } = {};
  if (typeof req.body?.name === 'string') {
    const trimmed = req.body.name.trim();
    if (!trimmed) {
      res.status(400).json({ error: 'name cannot be empty' });
      return;
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      res.status(400).json({ error: `name must be ${MAX_NAME_LENGTH} characters or fewer` });
      return;
    }
    patch.name = trimmed;
  }
  if (typeof req.body?.isDefault === 'boolean') {
    patch.isDefault = req.body.isDefault;
  }

  const updated = updateUser(id, patch);
  if (!updated) {
    res.status(404).json({ error: 'user not found' });
    return;
  }
  res.json(updated);
});

usersRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'invalid id' });
    return;
  }
  const result = deleteUser(id);
  if (result === 'not_found') {
    res.status(404).json({ error: 'user not found' });
    return;
  }
  if (result === 'only_user') {
    res.status(409).json({ error: 'cannot delete the only user' });
    return;
  }
  res.status(204).end();
});
