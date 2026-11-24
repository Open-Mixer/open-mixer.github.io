// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
//
//   node --test .github/prune/test/
//
// scratch.mjs removes the directories a test made on every exit path of the test process. Each path runs in a child
// node process under a TMPDIR of its own: once as shipped (the directory must be gone) and once with
// PRUNE_SCRATCH_SABOTAGE=keep (the directory must still be there, so the check can see a leak at all).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { scratch } from './scratch.mjs';

const lib = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'scratch.mjs')).href;

const ENDS = {
  'the end of the script': '',
  'an uncaught error': "throw new Error('boom');",
  'process.exit(3)': 'process.exit(3);',
  'SIGTERM': "process.kill(process.pid, 'SIGTERM'); await new Promise((r) => setTimeout(r, 5000));",
};

function child(end, sabotage) {
  const tmp = scratch('scratch-test-');
  const code = `import { scratch } from ${JSON.stringify(lib)};\n`
    + `const d = scratch('child-'); (await import('node:fs')).writeFileSync(d + '/f', 'x');\n${end}\n`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    env: { ...process.env, TMPDIR: tmp, PRUNE_SCRATCH_SABOTAGE: sabotage ? 'keep' : '' },
    encoding: 'utf8',
  });
  return { r, left: fs.readdirSync(tmp) };
}

for (const [name, end] of Object.entries(ENDS)) {
  test(`a scratch directory is removed on ${name}`, () => {
    const { r, left } = child(end, false);
    if (name === 'SIGTERM') assert.equal(r.signal, 'SIGTERM', 'the signal is raised again after the cleanup');
    assert.deepEqual(left, [], `left behind: ${left.join(' ')} (stderr: ${r.stderr})`);
  });
  test(`sabotaged (PRUNE_SCRATCH_SABOTAGE=keep), the directory stays on ${name}`, () => {
    const { left } = child(end, true);
    assert.equal(left.length, 1, 'the check must see a directory left behind');
  });
}
