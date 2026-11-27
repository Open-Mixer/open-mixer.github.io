// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
//
//   node --test .github/prune/test/
//
// The noarch/arch skew of 2026-11-18, which the prune apply refused the channel for: the aarch64 cells served the noarch contract subpackages of omx-dsp and
// plugin-hostd (built once, filed for every architecture of the release) while the arch packages of the same build,
// which pin them exactly, were built for x86_64 only. An exact pin made the invariant see it once a drop stranded a
// dependent; a skew the plan deletes nothing around passed in silence. The plan now judges the tree it KEEPS, in every
// cell the matrix publishes: an architecture-independent package whose build has arch packages in the release, and none
// in a cell it is served for, is a refusal, named with the cell, the package and where its arch packages are. A build
// with no arch package at all (openmixer-release) is served everywhere by design and is no skew.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const select = path.join(here, '..', 'select.mjs');

// ------------------------------------------------------------------ fixtures

// one rpm of a build: 'name arch ver-rel', its source rpm named (the build it belongs to), its exact pins
function rpmPkg(nevra, { source, requires = [] } = {}) {
  const [name, arch, v] = nevra.split(' ');
  const [, ver, rel] = v.match(/^(.*)-([^-]*)$/);
  const src = source ? `${source}-${ver}-${rel}.src.rpm` : `${name}-${ver}-${rel}.src.rpm`;
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
    <rpm:sourcerpm>${src}</rpm:sourcerpm>
    <rpm:provides>
      <rpm:entry name="${name}" flags="EQ" epoch="0" ver="${ver}" rel="${rel}"/>
    </rpm:provides>
    <rpm:requires>
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
// one deb stanza: 'name arch version', its source package
const stanza = (name, arch, version, source, depends = '') => [
  `Package: ${name}`, `Source: ${source}`, `Version: ${version}`, `Architecture: ${arch}`,
  ...(depends ? [`Depends: ${depends}`] : []),
  `Filename: ./${arch}/${name}_${version}_${arch}.deb`, 'Size: 1', 'Description: t', '',
].join('\n');

// the channel of 2026-11-18 in small: fedora/45 with omx-dsp 0.32.4 built for x86_64 (devel, arch) and its noarch
// contract filed for the release; aarch64 holds the devel of 0.32.0 alone (x86_64 holds that one too). `aarch64Built` adds the 0.32.4 devel there (the
// rpi5-builder pass) and the skew is gone. debian/trixie the same way: libomx-dsp-dev amd64 and the all contract of one
// source, arm64 built or not.
function channel({ aarch64Built = false, arm64Built = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prune-skew-'));
  const tree = path.join(dir, 'channel');
  const pin = (v) => [`omx-dsp-contract = ${v}`];
  const xml = {
    x86_64: primary([
      rpmPkg('omx-dsp-devel x86_64 0.32.0-1.fc45', { source: 'omx-dsp', requires: pin('0.32.0-1.fc45') }),
      rpmPkg('omx-dsp-devel x86_64 0.32.4-1.fc45', { source: 'omx-dsp', requires: pin('0.32.4-1.fc45') }),
    ]),
    aarch64: primary([
      rpmPkg('omx-dsp-devel aarch64 0.32.0-1.fc45', { source: 'omx-dsp', requires: pin('0.32.0-1.fc45') }),
      ...(aarch64Built ? [rpmPkg('omx-dsp-devel aarch64 0.32.4-1.fc45', { source: 'omx-dsp', requires: pin('0.32.4-1.fc45') })] : []),
    ]),
    noarch: primary([
      rpmPkg('omx-dsp-contract noarch 0.32.0-1.fc45', { source: 'omx-dsp' }),
      rpmPkg('omx-dsp-contract noarch 0.32.4-1.fc45', { source: 'omx-dsp' }),
      // a build with no arch package at all: served for every architecture by design
      rpmPkg('openmixer-release noarch 1-1.fc45'),
    ]),
  };
  for (const [d, x] of Object.entries(xml)) {
    const r = path.join(tree, 'rpm/fedora/45', d, 'repodata');
    fs.mkdirSync(r, { recursive: true });
    fs.writeFileSync(path.join(r, 'primary.xml'), x);
    fs.writeFileSync(path.join(r, 'repomd.xml'), '<repomd><data type="primary"><location href="repodata/primary.xml"/></data></repomd>\n');
    for (const m of x.matchAll(/<location href="([^"]*)"/g)) fs.writeFileSync(path.join(tree, 'rpm/fedora/45', d, m[1]), '');
  }
  const s = path.join(tree, 'deb/debian/trixie');
  const debs = [
    stanza('libomx-dsp-dev', 'amd64', '0.32.4-1', 'omx-dsp', 'omx-dsp-contract (= 0.32.4-1)'),
    stanza('omx-dsp-contract', 'all', '0.32.4-1', 'omx-dsp'),
    stanza('openmixer-release', 'all', '1-1', 'openmixer-release'),
    ...(arm64Built ? [stanza('libomx-dsp-dev', 'arm64', '0.32.4-1', 'omx-dsp', 'omx-dsp-contract (= 0.32.4-1)')] : []),
  ];
  fs.mkdirSync(s, { recursive: true });
  fs.writeFileSync(path.join(s, 'Packages'), debs.join('\n'));
  for (const m of debs.join('\n').matchAll(/Filename: \.\/([^\n]*)/g)) {
    fs.mkdirSync(path.dirname(path.join(s, m[1])), { recursive: true });
    fs.writeFileSync(path.join(s, m[1]), '');
  }
  fs.writeFileSync(path.join(dir, 'keep.yml'), 'keep:\n');
  return { dir, tree };
}

function run(opts = {}, ...extra) {
  const { dir, tree } = channel(opts);
  const args = [select, '--keep', path.join(dir, 'keep.yml'), '--tree', tree, '--newest', '2', '--json', path.join(dir, 'plan.json'), ...extra];
  const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });
  return r;
}

const ALL = 'fedora/45/x86_64,fedora/45/aarch64,debian/trixie/amd64,debian/trixie/arm64';
const X86_ONLY = 'fedora/45/x86_64,debian/trixie/amd64';
const RPM_SKEW = /rpm fedora\/45 omx-dsp-contract 0\.32\.4-1\.fc45 \(noarch\) is served for aarch64 without an arch package of its build omx-dsp-0\.32\.4-1\.fc45\.src\.rpm: omx-dsp-devel is built for x86_64/;
const DEB_SKEW = /deb debian\/trixie omx-dsp-contract 0\.32\.4-1 \(all\) is served for arm64 without an arch package of its build omx-dsp 0\.32\.4-1: libomx-dsp-dev is built for amd64/;

test('the skew of 2026-11-18, every published cell judged: the plan is refused and names the noarch package, the cell and where its arch packages are', () => {
  const r = run({}, '--cells', ALL);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /serves an architecture-independent package in a cell without its arch packages \(the skew of 2026-11-18\)/);
  assert.match(r.stderr, RPM_SKEW);
  assert.match(r.stderr, DEB_SKEW);
  // the pure noarch build is no skew
  assert.doesNotMatch(r.stdout + r.stderr, /openmixer-release 1-1/);
  // the old contract, kept for the aarch64 devel that pins it, has its arch package in that cell: no skew
  assert.doesNotMatch(r.stderr, /omx-dsp-contract 0\.32\.0/);
});

test('the arch packages built for every cell (the rpi5-builder pass): the same tree is green', () => {
  const r = run({ aarch64Built: true, arm64Built: true }, '--cells', ALL);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.doesNotMatch(r.stderr, /without an arch package/);
});

test('a skew only in a cell the matrix does not publish is not judged', () => {
  const r = run({}, '--cells', X86_ONLY);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.doesNotMatch(r.stderr, /without an arch package/);
});

test('without --cells every architecture the tree has is judged: the aarch64 skew, not an arm64 the deb tree holds nothing of', () => {
  const r = run({});
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, RPM_SKEW);
  assert.doesNotMatch(r.stderr, /arm64/, 'an architecture no package of the tree has is a cell only the matrix can name');
});

test('the skew is judged on what the plan keeps: a drop of the skewed build mends it', () => {
  // the build 0.32.4 dropped from the release, its noarch contract and the x86_64 devel that pins it: both architectures
  // are left at 0.32.0, the contract of which each has its devel for
  const r = run({}, '--cells', ALL, '--drop', 'omx-dsp@0.32.4');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.doesNotMatch(r.stderr, /without an arch package/);
});

test('one arch package of the build in the cell is enough: a subpackage missing there alone is no skew', () => {
  // the build has two arch packages; the cell holds one of them
  const { dir, tree } = channel({ aarch64Built: true, arm64Built: true });
  const extra = path.join(tree, 'rpm/fedora/45/x86_64/repodata/primary.xml');
  const xml = fs.readFileSync(extra, 'utf8').replace('</metadata>', rpmPkg('omx-dsp-tools x86_64 0.32.4-1.fc45', { source: 'omx-dsp' }) + '\n</metadata>');
  fs.writeFileSync(extra, xml);
  fs.writeFileSync(path.join(tree, 'rpm/fedora/45/x86_64/omx-dsp-tools-0.32.4-1.fc45.x86_64.rpm'), '');
  const r = spawnSync(process.execPath, [select, '--keep', path.join(dir, 'keep.yml'), '--tree', tree, '--newest', '2', '--cells', ALL], { encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
