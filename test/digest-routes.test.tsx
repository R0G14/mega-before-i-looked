import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const configBase = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
};

let runsDir: string;

function writeNight(night: string, content: string) {
  writeFileSync(path.join(runsDir, `${night}.jsonl`), content);
}

beforeEach(() => {
  runsDir = mkdtempSync(path.join(tmpdir(), 'rig-digest-routes-'));
});

afterEach(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

describe('digest routes', () => {
  it('renders sorted rows, null owners, retry highlighting, and the malformed-line count', async () => {
    writeNight(
      '2026-11-01',
      [
        '{"at":"2026-11-01T01:00:00+01:00","job":"zeta","status":"retry","owner":null,"error":"temporary"}',
        '{"at":"2026-11-01T01:01:00+01:00","job":"zeta","status":"retry","owner":null}',
        '{"at":"2026-11-01T01:02:00+01:00","job":"zeta","status":"retry","owner":null}',
        '{"at":"2026-11-01T01:03:00+01:00","job":"alpha","status":"fail","owner":"ops","error":"broken"}',
        '{bad json}',
      ].join('\n'),
    );

    const response = await createApp({ ...configBase, runsDir }).request('/digest/2026-11-01');
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html.indexOf('alpha')).toBeLessThan(html.indexOf('zeta'));
    expect(html).toContain('>—</td>');
    expect(html).toContain('class="warn">3</td>');
    expect(html).toContain('1 malformed line skipped');
  });

  it('returns the aggregated digest as JSON', async () => {
    writeNight(
      '2026-11-01',
      [
        '{"at":"2026-11-01T01:00:00+01:00","job":"zeta","status":"ok","owner":"ops"}',
        '{"at":"2026-11-01T01:01:00+01:00","job":"alpha","status":"ok","owner":null}',
        '{bad json}',
      ].join('\n'),
    );
    const app = createApp({ ...configBase, runsDir });
    const response = await app.request('/api/digest/2026-11-01');
    const page = await app.request('/digest/2026-11-01');
    const rows = await response.json() as { job: string }[];
    const html = await page.text();
    expect(response.status).toBe(200);
    expect(rows.map((row) => row.job)).toEqual(['alpha', 'zeta']);
    expect(html.indexOf('alpha')).toBeLessThan(html.indexOf('zeta'));
  });

  it('returns 404 for a missing night on both routes', async () => {
    const app = createApp({ ...configBase, runsDir });
    expect((await app.request('/digest/2026-11-02')).status).toBe(404);
    expect((await app.request('/api/digest/2026-11-02')).status).toBe(404);
  });

  it('renders an empty night', async () => {
    writeNight('2026-11-01', '');
    const response = await createApp({ ...configBase, runsDir }).request('/digest/2026-11-01');
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('nothing ran');
  });
});
