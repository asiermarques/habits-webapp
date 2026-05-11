import { Router } from 'express';
import type { EntryCursor, EntryData } from '@habitsapp/shared';
import {
  PAGE_SIZE,
  createEntry,
  deleteEntry,
  listEntries,
  updateEntry,
} from './repository.js';

export const entriesRouter = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseCursor(raw: unknown): EntryCursor | undefined {
  if (typeof raw !== 'string' || !raw) return undefined;
  try {
    const decoded = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (
      decoded &&
      typeof decoded.date === 'string' &&
      DATE_RE.test(decoded.date) &&
      typeof decoded.id === 'number'
    ) {
      return { date: decoded.date, id: decoded.id };
    }
  } catch {
    // fall through
  }
  return undefined;
}

function encodeCursor(cursor: EntryCursor | null): string | null {
  if (!cursor) return null;
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

entriesRouter.get('/', (req, res) => {
  const userId = Number(req.query.userId);
  if (!Number.isInteger(userId)) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }
  const habitDefinitionId = req.query.habitDefinitionId
    ? Number(req.query.habitDefinitionId)
    : undefined;
  if (habitDefinitionId !== undefined && !Number.isInteger(habitDefinitionId)) {
    res.status(400).json({ error: 'habitDefinitionId must be an integer' });
    return;
  }

  const cursor = parseCursor(req.query.cursor);
  const limit = req.query.limit ? Number(req.query.limit) : PAGE_SIZE;
  const safeLimit = Number.isInteger(limit) && limit > 0 && limit <= 100 ? limit : PAGE_SIZE;

  const page = listEntries({ userId, habitDefinitionId, cursor, limit: safeLimit });
  res.json({
    items: page.items,
    nextCursor: encodeCursor(page.nextCursor),
  });
});

entriesRouter.post('/', (req, res) => {
  const habitDefinitionId = Number(req.body?.habitDefinitionId);
  const userId = Number(req.body?.userId);
  const date = typeof req.body?.date === 'string' ? req.body.date : '';
  const data = req.body?.data;

  if (!Number.isInteger(habitDefinitionId)) {
    res.status(400).json({ error: 'habitDefinitionId is required' });
    return;
  }
  if (!Number.isInteger(userId)) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }
  if (!DATE_RE.test(date)) {
    res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    return;
  }
  if (!data || typeof data !== 'object') {
    res.status(400).json({ error: 'data is required' });
    return;
  }

  const result = createEntry({
    habitDefinitionId,
    userId,
    date,
    data: data as EntryData,
  });

  if (result.status === 'definition_not_found') {
    res.status(404).json({ error: 'habit definition not found' });
    return;
  }
  if (result.status === 'user_not_found') {
    res.status(404).json({ error: 'user not found' });
    return;
  }
  if (result.status === 'wrong_user') {
    res.status(403).json({ error: 'habit definition belongs to a different user' });
    return;
  }
  if (result.status === 'invalid_data') {
    res.status(400).json({ error: result.reason });
    return;
  }
  res.status(201).json(result.entry);
});

entriesRouter.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'invalid id' });
    return;
  }

  const patch: { date?: string; data?: EntryData } = {};
  if (req.body?.date !== undefined) {
    if (typeof req.body.date !== 'string' || !DATE_RE.test(req.body.date)) {
      res.status(400).json({ error: 'date must be YYYY-MM-DD' });
      return;
    }
    patch.date = req.body.date;
  }
  if (req.body?.data !== undefined) {
    if (!req.body.data || typeof req.body.data !== 'object') {
      res.status(400).json({ error: 'data must be an object' });
      return;
    }
    patch.data = req.body.data as EntryData;
  }

  const result = updateEntry(id, patch);
  if (result.status === 'not_found') {
    res.status(404).json({ error: 'entry not found' });
    return;
  }
  if (result.status === 'invalid_data') {
    res.status(400).json({ error: result.reason });
    return;
  }
  res.json(result.entry);
});

entriesRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'invalid id' });
    return;
  }
  const result = deleteEntry(id);
  if (result === 'not_found') {
    res.status(404).json({ error: 'entry not found' });
    return;
  }
  res.status(204).end();
});
