import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import type { HabitDefinition, User } from '@habitsapp/shared';

const app = createApp();

async function createUser(name: string): Promise<User> {
  const res = await request(app).post('/users').send({ name });
  return res.body as User;
}

async function createHabit(
  body: Partial<HabitDefinition> & {
    name: string;
    type: 'workout' | 'writing' | 'custom';
  },
): Promise<HabitDefinition> {
  const res = await request(app).post('/habit-definitions').send(body);
  return res.body as HabitDefinition;
}

async function logEntry(
  habitDefinitionId: number,
  userId: number,
  date: string,
  data: Record<string, unknown>,
) {
  return request(app)
    .post('/entries')
    .send({ habitDefinitionId, userId, date, data });
}

function parseCsv(csv: string): string[][] {
  // Tiny RFC-4180 parser sufficient for our well-formed output.
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (inQuotes) {
      if (c === '"' && csv[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

describe('GET /export/csv', () => {
  it('returns 400 when userId is missing', async () => {
    const res = await request(app).get('/export/csv?from=2026-01-01&to=2026-01-31');
    expect(res.status).toBe(400);
  });

  it('returns 400 when from is malformed', async () => {
    const user = await createUser('Alice');
    const res = await request(app).get(
      `/export/csv?userId=${user.id}&from=01-01-2026&to=2026-01-31`,
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when from is after to', async () => {
    const user = await createUser('Alice');
    const res = await request(app).get(
      `/export/csv?userId=${user.id}&from=2026-02-01&to=2026-01-01`,
    );
    expect(res.status).toBe(400);
  });

  it('returns a CSV header even when there are no rows', async () => {
    const user = await createUser('Alice');
    const res = await request(app).get(
      `/export/csv?userId=${user.id}&from=2026-01-01&to=2026-01-31`,
    );
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toContain('attachment');

    const rows = parseCsv(res.text);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual([
      'date', 'habit_name', 'type', 'positive', 'duration', 'distance',
      'weight', 'amount', 'notes', 'words', 'time', 'number',
    ]);
  });

  it('emits one row per entry with archetype-appropriate columns filled', async () => {
    const user = await createUser('Alice');
    const running = await createHabit({ name: 'Running', type: 'workout' });
    const journal = await createHabit({ name: 'Journal', type: 'writing' });
    const fastFood = await createHabit({
      name: 'Fast food',
      type: 'custom',
      positive: false,
    });

    await logEntry(running.id, user.id, '2026-01-05', {
      duration: 30,
      distance: 5.2,
      weight: null,
      number: null,
      notes: null,
    });
    await logEntry(journal.id, user.id, '2026-01-10', { words: 800, time: 25 });
    await logEntry(fastFood.id, user.id, '2026-01-15', {
      number: 1,
    });

    const res = await request(app).get(
      `/export/csv?userId=${user.id}&from=2026-01-01&to=2026-01-31`,
    );
    expect(res.status).toBe(200);
    const rows = parseCsv(res.text);

    expect(rows).toHaveLength(4); // header + 3
    // Sorted ascending by date.
    expect(rows[1][0]).toBe('2026-01-05');
    expect(rows[1][1]).toBe('Running');
    expect(rows[1][2]).toBe('workout');
    expect(rows[1][3]).toBe('true');
    expect(rows[1][4]).toBe('30');   // duration
    expect(rows[1][5]).toBe('5.2');  // distance
    expect(rows[1][9]).toBe('');     // words

    expect(rows[2][1]).toBe('Journal');
    expect(rows[2][9]).toBe('800');  // words
    expect(rows[2][10]).toBe('25');  // time

    expect(rows[3][1]).toBe('Fast food');
    expect(rows[3][3]).toBe('false');
    expect(rows[3][11]).toBe('1');   // number
  });

  it('escapes commas, quotes and newlines in text fields', async () => {
    const user = await createUser('Alice');
    const tricky = await createHabit({
      name: 'Run, fast',
      type: 'workout',
    });

    await logEntry(tricky.id, user.id, '2026-02-01', {
      duration: 10,
      notes: 'Felt "great"\nand fast',
    });

    const res = await request(app).get(
      `/export/csv?userId=${user.id}&from=2026-02-01&to=2026-02-28`,
    );
    const rows = parseCsv(res.text);
    expect(rows[1][1]).toBe('Run, fast');
    expect(rows[1][8]).toBe('Felt "great"\nand fast');
  });

  it('filters by date range and isolates per user', async () => {
    const alice = await createUser('Alice');
    const bob = await createUser('Bob');
    const reading = await createHabit({ name: 'Reading', type: 'custom' });

    await logEntry(reading.id, alice.id, '2025-12-31', { number: 1 });
    await logEntry(reading.id, alice.id, '2026-01-15', { number: 2 });
    await logEntry(reading.id, alice.id, '2026-02-01', { number: 3 });
    await logEntry(reading.id, bob.id, '2026-01-20', { number: 9 });

    const res = await request(app).get(
      `/export/csv?userId=${alice.id}&from=2026-01-01&to=2026-01-31`,
    );
    const rows = parseCsv(res.text);
    expect(rows).toHaveLength(2); // header + the single in-range Alice entry
    expect(rows[1][0]).toBe('2026-01-15');
    expect(rows[1][11]).toBe('2'); // number
  });
});
