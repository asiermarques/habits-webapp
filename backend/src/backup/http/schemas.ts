import { z } from 'zod';
import { ISO_DATE_RE } from '../../shared/domain/value-objects/IsoDate.js';
import { BACKUP_VERSION } from '@habitsapp/shared';

export const exportQuerySchema = z.object({
  userId: z.coerce.number({ invalid_type_error: 'userId is required' }).int(),
});

const backupHabitSchema = z.object({
  name: z.string().min(1, 'habit name is required'),
  type: z.enum(['workout', 'writing', 'custom']),
  positive: z.boolean(),
  color: z.string().min(1),
});

const backupEntrySchema = z.object({
  habitName: z.string().min(1),
  date: z.string().regex(ISO_DATE_RE, 'date must be YYYY-MM-DD'),
  data: z.object({}).passthrough(),
});

// Validates the whole bundle up-front so import never half-applies on a bad row.
// Cross-references each entry's data against its definition's type — the same
// invariants entries/domain enforces, duplicated here to avoid a cross-slice
// domain import.
export const importBodySchema = z
  .object({
    userId: z.number({ required_error: 'userId is required' }).int(),
    version: z.number().int(),
    exportedAt: z.string().optional(),
    habitDefinitions: z.array(backupHabitSchema),
    entries: z.array(backupEntrySchema),
  })
  .superRefine((bundle, ctx) => {
    if (bundle.version !== BACKUP_VERSION) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `unsupported backup version ${bundle.version} (expected ${BACKUP_VERSION})`,
        path: ['version'],
      });
    }

    const typeByName = new Map(bundle.habitDefinitions.map((d) => [d.name, d.type]));
    if (typeByName.size !== bundle.habitDefinitions.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'duplicate habit definition names in backup',
        path: ['habitDefinitions'],
      });
    }

    bundle.entries.forEach((entry, i) => {
      const type = typeByName.get(entry.habitName);
      if (!type) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `entry references unknown habit "${entry.habitName}"`,
          path: ['entries', i, 'habitName'],
        });
        return;
      }
      const data = entry.data as Record<string, unknown>;
      if (type === 'workout' && (typeof data.duration !== 'number' || data.duration <= 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'workout entries require a positive `duration`',
          path: ['entries', i, 'data', 'duration'],
        });
      }
      if (type === 'writing' && (typeof data.words !== 'number' || data.words < 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'writing entries require a non-negative `words`',
          path: ['entries', i, 'data', 'words'],
        });
      }
    });
  });
