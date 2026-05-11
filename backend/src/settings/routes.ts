import { Router } from 'express';
import { SUPPORTED_CURRENCIES, type CurrencyCode } from '@habitsapp/shared';
import { getSettings, setCurrency } from './repository.js';

export const settingsRouter = Router();

function isCurrency(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

settingsRouter.get('/', (_req, res) => {
  res.json(getSettings());
});

settingsRouter.put('/currency', (req, res) => {
  if (!isCurrency(req.body?.currency)) {
    res.status(400).json({
      error: `currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`,
    });
    return;
  }
  res.json(setCurrency(req.body.currency));
});
