// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
//
//   node --test .github/prune/test/
//
// A kept binary is never one whose exact-version dependency (name (= X)) has no build of X on an architecture
// the suite serves: the main it is pinned to is gone there, so `apt-get install` of it fails on a clean machine
// ("Depends: plugin-qualify (= 0.20.4) but it is not installable", 2026-11-16, the six plugin-qualify-l10n-*
// of trixie: plugin-qualify 0.20.4 was published for arm64 only). The prune chose per binary name and kept an
// l10n as the newest of its own name while its main was gone, and the plan invariant skips a requirement that
// nothing satisfies on that architecture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePackages, selectRepo } from '../prune.mjs';

const stanza = (name, version, arch, depends) => [
  `Package: ${name}`, `Architecture: ${arch}`, `Version: ${version}`,
  `Filename: ./${arch}/${name}_${version}_${arch}.deb`,
  ...(depends ? [`Depends: ${depends}`] : []), `Description: ${name}`,
].join('\n');

const index = (mainArches) => [
  stanza('plugin-hostd', '0.20.7', 'amd64'),
  stanza('plugin-hostd', '0.20.7', 'arm64'),
  ...mainArches.map((a) => stanza('plugin-qualify', '0.20.4', a)),
  stanza('plugin-qualify-l10n-pt', '0.20.4', 'all', 'plugin-qualify (= 0.20.4)'),
].join('\n\n') + '\n';

const names = (rows) => rows.map((r) => `${r.name} ${r.version}`).sort();

test('an l10n whose exact main has no build on an architecture is not kept', () => {
  const r = selectRepo(parsePackages(index(['arm64']), 'debian/trixie'), []);
  assert.ok(names(r.delete).includes('plugin-qualify-l10n-pt 0.20.4'), JSON.stringify(names(r.keep)));
  assert.ok(!names(r.keep).includes('plugin-qualify-l10n-pt 0.20.4'));
});

test('an l10n whose exact main builds on every architecture stays', () => {
  const r = selectRepo(parsePackages(index(['amd64', 'arm64']), 'debian/trixie'), []);
  assert.ok(names(r.keep).includes('plugin-qualify-l10n-pt 0.20.4'));
});

test('a pinned l10n stays, its pin is the owner\'s word', () => {
  const keep = [{ deb: ['plugin-qualify-l10n-pt'], version: '0.20.4', reason: 'pinned by a test' }];
  const r = selectRepo(parsePackages(index(['arm64']), 'debian/trixie'), keep);
  assert.ok(names(r.keep).includes('plugin-qualify-l10n-pt 0.20.4'));
});
