// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
//
//   node --test .github/prune/test/
//
// The apply verifies the cells the release matrix PUBLISHES, read from the same check-matrix the releases use
// (Open-Mixer/.github, release-matrix/quick.txt through matrix.sh), and never an ad-hoc list. While the wave is
// quick, aarch64 rpm is not built (the rpi5 builder is not up): a skew that exists only in an aarch64 cell of the
// shared tree is not a skew the release publishes, so the apply does not refuse it. A skew inside a published cell
// is still refused. The cell set reaches select.mjs as --cells, and the workflow gives every select call that set.
import { test } from 'node:test';
import { scratch } from './scratch.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const select = path.join(here, '..', 'select.mjs');
const workflowPath = path.join(here, '..', '..', 'workflows', 'prune.yml');
const workflow = fs.readFileSync(workflowPath, 'utf8');

// ------------------------------------------------------------------ fixture: a fedora/44 tree

function rpmPkg(nevra, { requires = [] } = {}) {
  const [name, arch, v] = nevra.split(' ');
  const [, ver, rel] = v.match(/^(.*)-([^-]*)$/);
  // a requirement is 'name' or 'name = ver-rel' (an exact pin, the flags dnf reads)
  const entry = (r) => {
    const m = r.match(/^(\S+) = ([^-]+)-(\S+)$/);
    return m ? `      <rpm:entry name="${m[1]}" flags="EQ" epoch="0" ver="${m[2]}" rel="${m[3]}"/>` : `      <rpm:entry name="${r}"/>`;
  };
  return `<package type="rpm">
  <name>${name}</name>
  <arch>${arch}</arch>
  <version epoch="0" ver="${ver}" rel="${rel}"/>
  <checksum type="sha256" pkgid="YES">00</checksum>
  <summary>${name}</summary>
  <location href="${name}-${ver}-${rel}.${arch}.rpm"/>
  <format>
    <rpm:license>GPL-3.0-or-later</rpm:license>
    <rpm:sourcerpm>${name}-${ver}-${rel}.src.rpm</rpm:sourcerpm>
    <rpm:provides>
      <rpm:entry name="${name}" flags="EQ" epoch="0" ver="${ver}" rel="${rel}"/>
    </rpm:provides>
    <rpm:requires>
      <rpm:entry name="libc.so.6(GLIBC_2.34)(64bit)"/>
${requires.map(entry).join('\n')}
    </rpm:requires>
  </format>
</package>`;
}
const primary = (pkgs) => `<?xml version="1.0" encoding="UTF-8"?>
<metadata xmlns="http://linux.duke.edu/metadata/common" xmlns:rpm="http://linux.duke.edu/metadata/rpm" packages="${pkgs.length}">
${pkgs.join('\n')}
</metadata>
`;

// plugin-hostd 0.20.6 on aarch64 needs the noarch contract 0.20.6 (exact pin). On x86_64 it needs nothing; with
// x86Pinned the x86_64 build pins the same contract, so the drop below strands a package in a published cell.
function channel({ x86Pinned = false } = {}) {
  const dir = scratch('prune-published-');
  const tree = path.join(dir, 'channel');
  const pin = ['plugin-hostd-contract = 0.20.6-1.fc44'];
  const xml = {
    x86_64: primary([rpmPkg('plugin-hostd x86_64 0.20.6-1.fc44', { requires: x86Pinned ? pin : [] })]),
    aarch64: primary([rpmPkg('plugin-hostd aarch64 0.20.6-1.fc44', { requires: pin })]),
    noarch: primary([
      rpmPkg('plugin-hostd-contract noarch 0.20.5-1.fc44'),
      rpmPkg('plugin-hostd-contract noarch 0.20.6-1.fc44'),
    ]),
  };
  for (const [d, x] of Object.entries(xml)) {
    const r = path.join(tree, 'rpm/fedora/44', d, 'repodata');
    fs.mkdirSync(r, { recursive: true });
    fs.writeFileSync(path.join(r, 'primary.xml'), x);
    fs.writeFileSync(path.join(r, 'repomd.xml'), '<repomd><data type="primary"><location href="repodata/primary.xml"/></data></repomd>\n');
    for (const m of x.matchAll(/<location href="([^"]*)"/g)) fs.writeFileSync(path.join(tree, 'rpm/fedora/44', d, m[1]), '');
  }
  const s = path.join(tree, 'deb/debian/trixie');
  fs.mkdirSync(s, { recursive: true });
  fs.writeFileSync(path.join(s, 'Packages'), '');
  fs.writeFileSync(path.join(dir, 'keep.yml'), 'keep:\n');
  return { dir, tree };
}

// the drop of the noarch contract 0.20.6 alone: the package the aarch64 build pins
const DROP = 'plugin-hostd-contract@0.20.6:fedora/44/noarch';

function run({ x86Pinned = false, cells } = {}) {
  const { dir, tree } = channel({ x86Pinned });
  const args = [select, '--keep', path.join(dir, 'keep.yml'), '--tree', tree, '--drop', DROP, '--json', path.join(dir, 'plan.json')];
  if (cells !== undefined) args.push('--cells', cells);
  return spawnSync(process.execPath, args, { encoding: 'utf8' });
}

const PUBLISHED = 'fedora/44/x86_64,debian/trixie/amd64,debian/trixie/arm64';
const ALL = 'fedora/44/x86_64,fedora/44/aarch64,debian/trixie/amd64,debian/trixie/arm64';

test('a skew in an aarch64 cell is refused when every cell is judged (the state today)', () => {
  const r = run({ cells: ALL });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /plugin-hostd 0\.20\.6-1\.fc44 \(aarch64\) requires plugin-hostd-contract/);
});

test('the matrix publishes no aarch64 rpm: the aarch64-only skew is not judged, the plan is green', () => {
  const r = run({ cells: PUBLISHED });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.doesNotMatch(r.stderr, /aarch64/, 'no refusal names the unpublished cell');
});

test('an empty cell set is refused by name, never green by judging nothing', () => {
  // the aarch64 skew is present; an empty --cells would judge no binary and pass it (green by nothing)
  const r = run({ cells: '' });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /--cells is empty: the release matrix published no cells/);
});

test('a skew inside a published cell is still refused with the matrix set', () => {
  const r = run({ x86Pinned: true, cells: PUBLISHED });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /plugin-hostd 0\.20\.6-1\.fc44 \(x86_64\) requires plugin-hostd-contract/);
});

test('the sabotage: the cell set replaced by all cells turns the aarch64-off case red again', () => {
  // the same run the green case makes, with the whole set in place of the matrix's
  assert.equal(run({ cells: PUBLISHED }).status, 0);
  assert.equal(run({ cells: ALL }).status, 1);
});

// ------------------------------------------------------------------ the workflow reads the matrix, and nothing else

// the plan job's published cell list is the check-matrix output the releases read, rendered as cell names
function publishedFromMatrix(text) {
  const plan = text.slice(text.indexOf('\n  plan:\n'), text.indexOf('\n  rpm:\n'));
  return /MATRIX_CELLS: \$\{\{ steps\.cells\.outputs\.cells \}\}/.test(plan)
    && /cells: \$\{\{ steps\.published\.outputs\.list \}\}/.test(plan);
}

test('the plan job takes its published cells from the same check-matrix the releases use', () => {
  assert.ok(publishedFromMatrix(workflow), 'plan derives its cells from steps.cells (check-matrix) and outputs them');
});

test('the matrix read replaced by all cells is red', () => {
  const sab = workflow.replace(/MATRIX_CELLS: \$\{\{ steps\.cells\.outputs\.cells \}\}/, 'MATRIX_CELLS: \'[{"fedora":"44","arch":"x86_64"},{"fedora":"44","arch":"aarch64"},{"suite":"trixie","arch":"amd64"},{"suite":"trixie","arch":"arm64"}]\'');
  assert.notEqual(sab, workflow, 'the sabotage found its line');
  assert.equal(publishedFromMatrix(sab), false);
});

test('every select.mjs call of the apply is given the published cells', () => {
  const calls = workflow.split('\n').filter((l) => /select\.mjs --keep/.test(l));
  assert.ok(calls.length >= 4, `found ${calls.length} select calls`);
  for (const l of calls) assert.match(l, /--cells "\$CELLS"/, l.trim());
});

test('the rpm and deb jobs judge the plan\'s published cells, not a list of their own', () => {
  for (const job of ['rpm', 'deb']) {
    const j = workflow.slice(workflow.indexOf(`\n  ${job}:\n`), workflow.indexOf(job === 'rpm' ? '\n  deb:\n' : '\n  verify-dnf:\n'));
    assert.match(j, /CELLS: \$\{\{ needs\.plan\.outputs\.cells \}\}/, `${job} job`);
  }
});
