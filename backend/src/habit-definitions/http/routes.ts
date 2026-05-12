import { Router } from 'express';
import { validateBody, validateQuery } from '../../shared/middleware/validate.js';
import {
  listQuerySchema,
  createHabitDefinitionSchema,
  updateHabitDefinitionSchema,
} from './schemas.js';
import type { HabitDefinitionRepository } from '../domain/HabitDefinitionRepository.js';

export function createHabitDefinitionsRouter(habitRepo: HabitDefinitionRepository): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const { userId } = validateQuery(req, listQuerySchema);
    res.json(habitRepo.listByUser(userId));
  });

  router.post('/', (req, res) => {
    const input = validateBody(req, createHabitDefinitionSchema);
    res.status(201).json(habitRepo.insert(input));
  });

  router.put('/:id', (req, res) => {
    const id = Number(req.params.id);
    const patch = validateBody(req, updateHabitDefinitionSchema);
    res.json(habitRepo.update(id, patch));
  });

  router.delete('/:id', (req, res) => {
    const id = Number(req.params.id);
    habitRepo.delete(id);
    res.status(204).end();
  });

  return router;
}
