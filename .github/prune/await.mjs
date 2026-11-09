// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
//
// Wait until the repository the site serves carries the repomd revision the prune published. The wait ends on the
// revision, never on a fixed number of tries: a repository that takes longer to publish is waited for, up to the
// deadline, and the failure names the revision it saw and the one it wanted.
//
//   node await.mjs <url> <local repomd.xml> [deadline-seconds] [interval-seconds]
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const revisionOf = (repomd) => {
  const m = repomd.match(/<revision>\s*([^<\s]+)\s*<\/revision>/);
  if (!m) throw new Error('repomd.xml carries no revision');
  return m[1];
};

// `fetchText()` answers the served repomd.xml (rejecting while it is not served yet); `now` and `sleep` are the clock
export async function awaitRevision({ fetchText, want, deadlineMs, intervalMs, now = Date.now, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const end = now() + deadlineMs;
  let seen = 'nothing served';
  for (;;) {
    try { seen = revisionOf(await fetchText()); } catch (e) { seen = `unreadable (${e.message})`; }
    if (seen === want) return { ok: true, seen };
    if (now() >= end) return { ok: false, seen };
    await sleep(intervalMs);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [url, file, deadline = '1800', interval = '10'] = process.argv.slice(2);
  const want = revisionOf(fs.readFileSync(file, 'utf8'));
  const r = await awaitRevision({
    fetchText: async () => { const res = await fetch(url, { cache: 'no-store' }); if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.text(); },
    want, deadlineMs: Number(deadline) * 1000, intervalMs: Number(interval) * 1000,
  });
  if (!r.ok) { console.error(`::error::${url} serves revision ${r.seen}, the prune published ${want}`); process.exit(1); }
  console.log(`${url} serves revision ${want}`);
}
