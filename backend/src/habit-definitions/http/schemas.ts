import { z } from 'zod';

const MAX_NAME_LENGTH = 100;

export const listQuerySchema = z.object({
  userId: z.coerce.number({ invalid_type_error: 'userId is required' }).int(),
});

export const createHabitDefinitionSchema = z.object({
  userId: z.number({ required_error: 'userId is required' }).int(),
  name: z
    .string()
    .trim()
    .min(1, 'name is required')
    .max(MAX_NAME_LENGTH, `name must be ${MAX_NAME_LENGTH} characters or fewer`),
  type: z.enum(['workout', 'writing', 'custom'], {
    errorMap: () => ({ message: 'type must be one of: workout, writing, custom' }),
  }),
  positive: z.boolean().optional(),
});

export const updateHabitDefinitionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'name cannot be empty')
    .max(MAX_NAME_LENGTH, `name must be ${MAX_NAME_LENGTH} characters or fewer`)
    .optional(),
  type: z
    .enum(['workout', 'writing', 'custom'], {
      errorMap: () => ({ message: 'type must be one of: workout, writing, custom' }),
    })
    .optional(),
  positive: z.boolean().optional(),
});
