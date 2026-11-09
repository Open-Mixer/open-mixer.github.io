// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
//
// The wait for Pages ends on the repomd revision, not on a fixed ten minutes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { awaitRevision, revisionOf } from '../await.mjs';

const repomd = (rev) => `<repomd><revision>${rev}</revision></repomd>`;

test('a repository that publishes after twenty minutes is waited for', async () => {
  let t = 0;
  const r = await awaitRevision({
    fetchText: async () => repomd(t >= 20 * 60_000 ? '200' : '100'),
    want: '200', deadlineMs: 30 * 60_000, intervalMs: 10_000,
    now: () => t, sleep: async (ms) => { t += ms; },
  });
  assert.equal(r.ok, true);
  assert.ok(t >= 20 * 60_000, 'it waited past the old ten-minute limit');
});

test('a revision that never arrives fails at the deadline and names what was seen', async () => {
  let t = 0;
  const r = await awaitRevision({
    fetchText: async () => repomd('100'), want: '200', deadlineMs: 60_000, intervalMs: 10_000,
    now: () => t, sleep: async (ms) => { t += ms; },
  });
  assert.deepEqual(r, { ok: false, seen: '100' });
});

test('a fetch that fails is retried, not fatal', async () => {
  let t = 0, n = 0;
  const r = await awaitRevision({
    fetchText: async () => { if (n++ < 3) throw new Error('HTTP 404'); return repomd('200'); },
    want: '200', deadlineMs: 600_000, intervalMs: 10_000, now: () => t, sleep: async (ms) => { t += ms; },
  });
  assert.equal(r.ok, true);
});

test('a repomd without a revision is refused', () => {
  assert.throws(() => revisionOf('<repomd/>'), /no revision/);
});
