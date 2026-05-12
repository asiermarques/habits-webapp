import { Router } from 'express';
import { validateBody } from '../../shared/http/validate.js';
import { createUserSchema, updateUserSchema } from './schemas.js';
import type { UserRepository } from '../domain/UserRepository.js';

export function createUsersRouter(userRepo: UserRepository): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(userRepo.list());
  });

  router.post('/', (req, res) => {
    const { name } = validateBody(req, createUserSchema);
    res.status(201).json(userRepo.create(name));
  });

  router.put('/:id', (req, res) => {
    const id = Number(req.params.id);
    const patch = validateBody(req, updateUserSchema);
    res.json(userRepo.update(id, patch));
  });

  router.delete('/:id', (req, res) => {
    const id = Number(req.params.id);
    userRepo.delete(id);
    res.status(204).end();
  });

  return router;
}
