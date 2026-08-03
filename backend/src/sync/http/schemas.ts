import { z } from 'zod';

export const versionQuerySchema = z.object({
  userId: z.coerce.number({ invalid_type_error: 'userId is required' }).int(),
});
