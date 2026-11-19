// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
//
//   node --test .github/prune/test/
//
// The kept-install check of prune.yml (verify-dnf) asks dnf for the newest version of a package. repoquery prints
// one line per architecture (--latest-limit=1 is the latest per arch), so the first line is not the newest: run
// 44479750668 read omx-contract 3.19.1 (noarch, listed first) and reported a false red while 3.20.0 (x86_64) was
// the one dnf install took. newest-evr.mjs takes the highest EVR across the lines, by rpm's own comparison.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, '..', 'newest-evr.mjs');
const workflow = readFileSync(join(here, '..', '..', 'workflows', 'prune.yml'), 'utf8');

const newest = (name, text) => spawnSync('node', [script, name], { input: text, encoding: 'utf8' });

test('run 44479750668: the noarch 3.19.1 line first, the x86_64 3.20.0 line second: the newest is 3.20.0', () => {
  const r = newest('omx-contract', 'omx-contract-0:3.19.1-1.fc45.noarch\nomx-contract-0:3.20.0-1.fc45.x86_64\n');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '3.20.0-1.fc45\n');
});

test('noarch newer than x86_64: the noarch build is the newest', () => {
  const r = newest('omx-contract', 'omx-contract-0:3.20.0-1.fc45.x86_64\nomx-contract-0:3.21.0-1.fc45.noarch\n');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '3.21.0-1.fc45\n');
});

test('the newest is found by rpm comparison, not by string order: 3.9 is older than 3.10', () => {
  const r = newest('omx-contract', 'omx-contract-0:3.9.0-1.fc45.noarch\nomx-contract-0:3.10.0-1.fc45.x86_64\n');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '3.10.0-1.fc45\n');
});

test('a release decides between two builds of one version', () => {
  const r = newest('omx-contract', 'omx-contract-0:3.20.0-1.fc45.noarch\nomx-contract-0:3.20.0-2.fc45.x86_64\n');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '3.20.0-2.fc45\n');
});

test('a single line is unchanged: its version is the answer', () => {
  const r = newest('omx-contract', 'omx-contract-0:3.20.0-1.fc45.x86_64\n');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '3.20.0-1.fc45\n');
});

test('a line of another package is refused, not compared', () => {
  const r = newest('omx-contract', 'omx-other-0:9.0.0-1.fc45.noarch\n');
  assert.notEqual(r.status, 0);
});

test('verify-dnf reads the newest across arches through the script, not the first line', () => {
  const dnf = workflow.slice(workflow.indexOf('\n  verify-dnf:\n'), workflow.indexOf('\n  verify-apt:\n'));
  assert.match(dnf, /dnf repoquery[^\n]*--latest-limit=1[^\n]*\| node \.github\/prune\/newest-evr\.mjs "\$a"/);
  assert.doesNotMatch(dnf, /\| head -1\)/);
});
