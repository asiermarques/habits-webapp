import { Router } from 'express';
import { validateBody } from '../../shared/middleware/validate.js';
import { setCurrencySchema, setLocaleSchema } from './schemas.js';
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

  router.put('/locale', (req, res) => {
    const { locale } = validateBody(req, setLocaleSchema);
    res.json(repo.setLocale(locale));
  });

  return router;
}
