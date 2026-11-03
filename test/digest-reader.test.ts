import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

let runsDir: string;

function writeNight(night: string, content: string) {
  writeFileSync(path.join(runsDir, `${night}.jsonl`), content);
}

beforeEach(() => {
  runsDir = mkdtempSync(path.join(tmpdir(), 'rig-digest-reader-'));
});

afterEach(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

describe('readNight', () => {
  it('aggregates jobs and counts malformed fixture lines', () => {
    const digest = readNight('runs', '2026-10-28');
    expect(digest).not.toBeNull();
    expect(digest?.rows).toHaveLength(5);
    expect(digest?.badLines).toBe(1);
    expect(digest?.rows.map((row) => row.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(digest?.rows[0]).toMatchObject({ owner: null, runs: 1, retries: 0 });
    expect(digest?.rows[1]).toMatchObject({
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: null,
    });
  });

  it('returns an empty digest for an empty file and null for a missing or invalid night', () => {
    writeNight('2026-11-01', '');
    expect(readNight(runsDir, '2026-11-01')).toEqual({ rows: [], badLines: 0 });
    expect(readNight(runsDir, '2026-11-02')).toBeNull();
    expect(readNight(runsDir, '../2026-11-01')).toBeNull();
  });
});
