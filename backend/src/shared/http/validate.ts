import type { Request } from 'express';
import { z } from 'zod';
import { ValidationError } from '../errors/DomainError.js';

export function validateBody<T>(req: Request, schema: z.ZodType<T, z.ZodTypeDef, unknown>): T {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const message = result.error.errors.map((e) => e.message).join('; ');
    throw new ValidationError(message);
  }
  return result.data;
}

export function validateQuery<T>(req: Request, schema: z.ZodType<T, z.ZodTypeDef, unknown>): T {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    const message = result.error.errors.map((e) => e.message).join('; ');
    throw new ValidationError(message);
  }
  return result.data;
}
