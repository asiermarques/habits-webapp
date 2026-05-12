import { Router } from 'express';
import { validateBody } from '../../shared/http/validate.js';
import { setCurrencySchema } from './schemas.js';
import type { SettingsRepository } from '../domain/SettingsRepository.js';

export function createSettingsRouter(repo: SettingsRepository): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(repo.get());
  });

  router.put('/currency', (req, res) => {
    const { currency } = validateBody(req, setCurrencySchema);
    res.json(repo.setCurrency(currency));
  });

  return router;
}
