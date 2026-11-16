// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
//
//   node --test .github/prune/test/
//
// The plan refuses only what it NEWLY breaks (ruled 2026-11-16). The case is the trixie/amd64 retirement of
// plugin-qualify 0.20.3: it already did not install there (it wants omx-clap-host << 0.32~, apt's candidate is
// 0.32.3), so its dependents did not install either, and dropping it must not be refused over them. The same
// drop on an architecture where the dependent DID install is still refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parsePackages, judgeUninstallable, installsBefore } from '../prune.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const select = path.join(here, '..', 'select.mjs');

const debPkg = (name, version, arch, depends) => [
  `Package: ${name}`, `Architecture: ${arch}`, `Version: ${version}`,
  `Filename: ./${arch}/${name}_${version}_${arch}.deb`,
  ...(depends ? [`Depends: ${depends}`] : []), `Description: ${name}`,
].join('\n');

// amd64: plugin-qualify 0.20.3 wants clap-host << 0.32~, the candidate is 0.32.3: already broken there.
// arm64: the same plugin-qualify 0.20.3 with a clap-host 0.31.2 candidate: installs.
const trixie = (amd64ClapHost = '0.32.3') => [
  debPkg('omx-clap-host', '0.31.2', 'amd64', 'libc6 (>= 2.38)'),
  debPkg('omx-clap-host', amd64ClapHost, 'amd64', 'libc6 (>= 2.38)'),
  debPkg('omx-clap-host', '0.31.2', 'arm64', 'libc6 (>= 2.38)'),
  debPkg('plugin-qualify', '0.20.3', 'amd64', 'libc6 (>= 2.38), omx-clap-host (>= 0.31.2~), omx-clap-host (<< 0.32~)'),
  debPkg('plugin-qualify', '0.20.3', 'arm64', 'libc6 (>= 2.38), omx-clap-host (>= 0.31.2~), omx-clap-host (<< 0.32~)'),
  debPkg('plugin-qualification-records', '2026111001', 'amd64', 'plugin-qualify (>= 0.20.1~), plugin-qualify (<< 0.21~)'),
  debPkg('plugin-qualification-records', '2026111001', 'arm64', 'plugin-qualify (>= 0.20.1~), plugin-qualify (<< 0.21~)'),
].join('\n\n') + '\n';

function run(packages, drop) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prune-already-'));
  fs.writeFileSync(path.join(tmp, 'keep.yml'), 'keep:\n');
  const s = path.join(tmp, 'tree/deb/debian/trixie');
  fs.mkdirSync(s, { recursive: true });
  fs.writeFileSync(path.join(s, 'Packages'), packages);
  for (const p of parsePackages(packages, 'debian/trixie')) {
    fs.mkdirSync(path.join(s, p.arch), { recursive: true });
    fs.writeFileSync(path.join(s, p.file), '');
  }
  return spawnSync(process.execPath, [select, '--keep', path.join(tmp, 'keep.yml'), '--tree', path.join(tmp, 'tree'),
    '--drop', drop, '--delete-list', '--json', path.join(tmp, 'plan.json')], { encoding: 'utf8' });
}
const deleted = (out) => out.split('\n').filter((l) => l.startsWith('delete\t')).map((l) => l.split('\t')[2]).sort();

test('a drop that removes the only satisfier of a dependent that installed before is still refused', () => {
  // the arm64 dependent installs before the plan: removing its plugin-qualify breaks it, newly
  const r = run(trixie(), 'plugin-qualify@0.20.3:trixie/arm64');
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /the plan leaves a kept package uninstallable:/);
  assert.match(r.stderr, /plugin-qualification-records 2026111001 \(arm64\) requires plugin-qualify/);
  assert.doesNotMatch(r.stdout, /already uninstallable/);
  // and on amd64 too, when the amd64 plugin-qualify did install there (a clap-host candidate it accepts)
  const before = run(trixie('0.31.5'), 'plugin-qualify@0.20.3:trixie/amd64');
  assert.equal(before.status, 1, before.stdout + before.stderr);
  assert.match(before.stderr, /plugin-qualification-records 2026111001 \(amd64\) requires plugin-qualify/);
});

test('a drop whose dependent was already uninstallable before the plan is allowed, the dependent named unchanged', () => {
  const r = run(trixie(), 'plugin-qualify@0.20.3:trixie/amd64');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(deleted(r.stdout), ['deb/debian/trixie/amd64/plugin-qualify_0.20.3_amd64.deb']);
  assert.match(r.stdout, /deb debian\/trixie plugin-qualification-records 2026111001 \(amd64\): already uninstallable, unchanged/);
  assert.doesNotMatch(r.stdout + r.stderr, /\(arm64\)/, 'arm64 is not touched and not judged short');
});

test('judgeUninstallable: the before-plan solver decides which side a line falls on', () => {
  const pkgs = parsePackages(trixie(), 'debian/trixie');
  const kept = new Set(pkgs.filter((p) => !(p.name === 'plugin-qualify' && p.arch === 'amd64')).map((p) => p.file));
  const records = (a) => pkgs.find((p) => p.name === 'plugin-qualification-records' && p.arch === a);
  assert.equal(installsBefore(pkgs, records('amd64'), 'amd64'), false, 'apt never steps clap-host back from its candidate');
  assert.equal(installsBefore(pkgs, records('arm64'), 'arm64'), true);
  const judged = judgeUninstallable(pkgs, kept);
  assert.deepEqual(judged.refused, []);
  assert.deepEqual(judged.already, ['deb debian/trixie plugin-qualification-records 2026111001 (amd64): already uninstallable, unchanged']);
  // a before-check that answers "installs" for everything puts the line back among the refusals
  const blind = judgeUninstallable(pkgs, kept, { installableBefore: () => true });
  assert.equal(blind.refused.length, 1);
  assert.deepEqual(blind.already, []);
});

test('installsBefore: a name only the distribution provides is met; a name the repository provides must be met from it', () => {
  const pkgs = parsePackages([
    debPkg('plugin-hostd', '0.20.4', 'amd64', 'libc6 (>= 2.38)'),
    debPkg('plugin-hostd-full', '0.20.6', 'all', 'libc6 (>= 2.38), plugin-hostd (= 0.20.6)'),
    debPkg('plugin-hostd-full', '0.20.4', 'all', 'plugin-hostd (= 0.20.4) | not-in-the-channel'),
  ].join('\n\n') + '\n', 'debian/trixie');
  const full = (v) => pkgs.find((p) => p.name === 'plugin-hostd-full' && p.evr === v);
  assert.equal(installsBefore(pkgs, full('0.20.6'), 'amd64'), false, 'plugin-hostd = 0.20.6 is not served on amd64');
  assert.equal(installsBefore(pkgs, full('0.20.4'), 'amd64'), true);
  // an undecided search (budget spent) counts as installable: the case stays a refusal
  assert.equal(installsBefore(pkgs, full('0.20.6'), 'amd64', { budget: 0 }), true);
});
