// Import orchestration. Spans two slices, so it composes their injected
// repository ports rather than touching tables directly (per the cross-slice
// rule). Merge-skip semantics: existing definitions (by name) and existing
// entries (by habit + date) are left untouched, making re-import idempotent.
//
// The caller must validate the bundle first (see http/schemas.ts) — by the time
// we get here, entry data is well-formed and every habitName resolves.
import type { BackupEntry, BackupHabitDefinition, EntryData, ImportResult } from '@habitsapp/shared';
import type { HabitDefinitionRepository } from '../habit-definitions/domain/HabitDefinitionRepository.js';
import type { EntryRepository } from '../entries/domain/EntryRepository.js';

type Importable = {
  habitDefinitions: BackupHabitDefinition[];
  entries: BackupEntry[];
};

export function importBackup(
  userId: number,
  bundle: Importable,
  habitRepo: HabitDefinitionRepository,
  entryRepo: EntryRepository,
): ImportResult {
  const nameToId = new Map(habitRepo.listByUser(userId).map((d) => [d.name, d.id]));

  let habitsCreated = 0;
  let habitsSkipped = 0;
  for (const def of bundle.habitDefinitions) {
    if (nameToId.has(def.name)) {
      habitsSkipped++;
      continue;
    }
    const created = habitRepo.insert({
      userId,
      name: def.name,
      type: def.type,
      positive: def.positive,
      color: def.color,
    });
    nameToId.set(created.name, created.id);
    habitsCreated++;
  }

  let entriesCreated = 0;
  let entriesSkipped = 0;
  for (const entry of bundle.entries) {
    const habitId = nameToId.get(entry.habitName)!; // guaranteed by up-front validation
    if (entryRepo.existsOnDate(habitId, entry.date)) {
      entriesSkipped++;
      continue;
    }
    entryRepo.insert({
      habitDefinitionId: habitId,
      userId,
      date: entry.date,
      data: entry.data as EntryData,
    });
    entriesCreated++;
  }

  return { habitsCreated, habitsSkipped, entriesCreated, entriesSkipped };
}
