// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
//
// The one way a prune test makes a temporary directory. scratch(prefix) is fs.mkdtempSync under os.tmpdir() (so
// TMPDIR moves it), and every directory it made is removed when the test process ends, on every exit path: the
// tests finish (pass or fail), an uncaught error, process.exit(), or SIGINT/SIGTERM/SIGHUP (removed, then the
// signal is raised again so the exit status stays the signal's). Only SIGKILL can skip it.
//
// Each test file runs in a process of its own under `node --test`, so each file cleans its own directories.
// tmp-gate.sh runs the whole suite under an empty TMPDIR and fails when anything is left in it.
//
// PRUNE_SCRATCH_SABOTAGE=keep turns the removal off: tmp-gate.sh --self-test sets it and requires the gate to FAIL,
// so a gate that would pass without this cleanup is itself a failure.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const made = new Set();

export function scratch(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  made.add(dir);
  return dir;
}

function removeAll() {
  if (process.env.PRUNE_SCRATCH_SABOTAGE === 'keep') return;
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
  made.clear();
}

process.on('exit', removeAll);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.once(sig, () => {
    removeAll();
    process.kill(process.pid, sig);
  });
}
