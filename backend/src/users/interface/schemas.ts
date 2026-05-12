import { z } from 'zod';

const MAX_NAME_LENGTH = 100;

export const createUserSchema = z.object({
  name: z
    .string({ required_error: 'name is required' })
    .trim()
    .min(1, 'name is required')
    .max(MAX_NAME_LENGTH, `name must be ${MAX_NAME_LENGTH} characters or fewer`),
});

export const updateUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'name cannot be empty')
    .max(MAX_NAME_LENGTH, `name must be ${MAX_NAME_LENGTH} characters or fewer`)
    .optional(),
  isDefault: z.boolean().optional(),
});
