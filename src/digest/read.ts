import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { DigestRow, DigestStatus, NightDigest, ReadNight } from './types.js';

type RunRecord = {
  at: string;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRecord(line: string): RunRecord | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }

  if (
    !isRecord(value) ||
    typeof value.at !== 'string' ||
    typeof value.job !== 'string' ||
    value.job.length === 0 ||
    (value.status !== 'ok' && value.status !== 'retry' && value.status !== 'fail') ||
    (value.owner !== null && typeof value.owner !== 'string') ||
    (value.error !== undefined && typeof value.error !== 'string')
  ) {
    return null;
  }

  return {
    at: value.at,
    job: value.job,
    status: value.status,
    owner: value.owner,
    ...(typeof value.error === 'string' ? { error: value.error } : {}),
  };
}

function readFileOrNull(file: string): string | null {
  try {
    return readFileSync(file, 'utf8');
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') return null;
    throw error;
  }
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;

  const contents = readFileOrNull(path.join(runsDir, `${night}.jsonl`));
  if (contents === null) return null;

  const rows = new Map<string, DigestRow>();
  let badLines = 0;

  for (const line of contents.split(/\r?\n/)) {
    if (line.trim() === '') continue;

    const record = parseRecord(line);
    if (record === null) {
      badLines += 1;
      continue;
    }

    const row = rows.get(record.job);
    if (row === undefined) {
      rows.set(record.job, {
        job: record.job,
        owner: record.owner,
        runs: 1,
        retries: record.status === 'retry' ? 1 : 0,
        lastStatus: record.status,
        lastError: record.error ?? null,
        firstAt: record.at,
        lastAt: record.at,
      });
      continue;
    }

    row.runs += 1;
    if (record.status === 'retry') row.retries += 1;
    row.lastStatus = record.status;
    row.lastError = record.error ?? null;
    row.lastAt = record.at;
  }

  return {
    rows: [...rows.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0)),
    badLines,
  };
};
