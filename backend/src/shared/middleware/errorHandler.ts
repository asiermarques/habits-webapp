import type { ErrorRequestHandler } from 'express';
import { DomainError } from '../domain/errors/DomainError.js';

export const domainErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (err instanceof DomainError) {
    res.status(err.httpStatus).json({ error: err.message });
    return;
  }
  next(err);
};
