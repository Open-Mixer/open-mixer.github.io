// SPDX-License-Identifier: GPL-3.0-or-later
// --require-files: an index entry whose file is not where its location says is named and refused before any plan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const select = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'select.mjs');
const pkgXml = (name, ver) => `<package type="rpm"><name>${name}</name><arch>noarch</arch><version epoch="0" ver="${ver}" rel="1.fc44"/>
<size package="10" installed="1" archive="1"/><location href="${name}-${ver}-1.fc44.noarch.rpm"/></package>`;

function tree(filesOnDisk) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reqfiles-'));
  const rd = path.join(dir, 'rpm/fedora/44/noarch/repodata');
  fs.mkdirSync(rd, { recursive: true });
  fs.writeFileSync(path.join(rd, 'repomd.xml'), '<repomd><data type="primary"><location href="repodata/primary.xml"/></data></repomd>');
  fs.writeFileSync(path.join(rd, 'primary.xml'), `<metadata>${pkgXml('foo', '1')}${pkgXml('foo', '2')}${pkgXml('foo', '3')}</metadata>`);
  for (const f of filesOnDisk) fs.writeFileSync(path.join(dir, 'rpm/fedora/44/noarch', f), 'x');
  fs.writeFileSync(path.join(dir, 'keep.yml'), 'keep:\n');
  return dir;
}
const run = (dir, ...extra) => spawnSync('node', [select, '--keep', path.join(dir, 'keep.yml'), '--tree', dir, '--newest', '2', ...extra], { encoding: 'utf8' });

test('a listed file missing from disk is named and the run refuses', () => {
  const dir = tree(['foo-1-1.fc44.noarch.rpm', 'foo-3-1.fc44.noarch.rpm']);
  const r = run(dir, '--require-files');
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /channel inconsistency/);
  assert.match(r.stderr, /rpm\/fedora\/44\/noarch\/foo-2-1\.fc44\.noarch\.rpm/);
});

test('every listed file on disk: the plan runs; without the flag a missing file is not looked at', () => {
  const all = ['foo-1-1.fc44.noarch.rpm', 'foo-2-1.fc44.noarch.rpm', 'foo-3-1.fc44.noarch.rpm'];
  assert.equal(run(tree(all), '--require-files').status, 0);
  assert.equal(run(tree(all.slice(1)), '--require-files').status, 1);
  assert.equal(run(tree(all.slice(1))).status, 0);
});
