// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
//
//   node --test .github/prune/test/
//
// The rpm job re-signs only when the plan deletes an rpm (ruled 2026-11-16). A deb-only drop (retiring
// plugin-qualify 0.20.3 on trixie/amd64) stopped in the rpm job: re-publishing the untouched tree through
// publish-tree.sh re-judged what the channel already served and refused it. The fixture is a channel tree with
// signed repodata, committed as main serves it and then pulled the way channel-pull pulls it (strip: rpm, the
// repodata discarded), and a stand-in for publish-tree.sh that records its call and rewrites the metadata.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, '..', 'rpm-metadata.sh');
const workflow = readFileSync(join(here, '..', '..', 'workflows', 'prune.yml'), 'utf8');

function fixture(deletes) {
  const dir = mkdtempSync(join(tmpdir(), 'prune-rpm-meta-'));
  const channel = join(dir, 'channel');
  for (const d of ['44/x86_64', '44/noarch', '45/x86_64']) {
    const r = join(channel, 'rpm/fedora', d, 'repodata');
    mkdirSync(r, { recursive: true });
    writeFileSync(join(r, 'repomd.xml'), `<repomd>${d} as served</repomd>\n`);
    writeFileSync(join(r, 'repomd.xml.asc'), `signature of ${d} as served\n`);
    writeFileSync(join(channel, 'rpm/fedora', d, `pkg-${d.replace('/', '-')}.rpm`), 'rpm');
  }
  const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.org', GIT_COMMITTER_NAME: 't',
    GIT_COMMITTER_EMAIL: 't@example.org', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
  const git = (...a) => execFileSync('git', ['-C', channel, ...a], { env, stdio: 'ignore' });
  git('init', '-q', '-b', 'main'); git('add', '-A'); git('commit', '-q', '--no-gpg-sign', '-m', 'served');
  const served = digest(channel);
  // channel-pull: find build/channel/rpm -type d -name repodata -prune -exec rm -rf {} +
  for (const d of ['44/x86_64', '44/noarch', '45/x86_64']) rmSync(join(channel, 'rpm/fedora', d, 'repodata'), { recursive: true });
  const list = join(dir, 'rpm-delete.txt');
  writeFileSync(list, deletes.map((f) => f + '\n').join(''));
  const calls = join(dir, 'publish-calls.txt');
  const publish = join(dir, 'publish-tree.sh');
  writeFileSync(publish, `#!/bin/bash\nset -eu\necho "$*" >> ${JSON.stringify(calls)}\nfor d in "$1"/fedora/*/*/; do mkdir -p "$d/repodata"; echo regenerated > "$d/repodata/repomd.xml"; echo resigned > "$d/repodata/repomd.xml.asc"; done\n`);
  chmodSync(publish, 0o755);
  return { dir, channel, list, calls, publish, served };
}
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
const walkTree = (d) => walk(d).filter((f) => !relative(d, f).startsWith('.git/'));
const digest = (root) => Object.fromEntries(walkTree(root).sort().map((f) => [relative(root, f), createHash('sha256').update(readFileSync(f)).digest('hex')]));
const run = (f) => spawnSync('bash', [script, f.channel, f.list, 'KEYID', f.publish], { encoding: 'utf8' });

test('a deb-only plan (no rpm deleted) leaves the rpm tree byte-identical, signed as served: nothing is re-published', () => {
  const f = fixture([]);
  const r = run(f);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /the plan deletes no rpm: the rpm tree is handed over untouched/);
  assert.equal(existsSync(f.calls), false, 'publish-tree.sh is not called');
  // the repodata the pull discarded is back, as served: the handover carries it to the deb job
  assert.deepEqual(digest(f.channel), f.served);
  for (const d of ['44/x86_64', '44/noarch', '45/x86_64']) {
    assert.equal(readFileSync(join(f.channel, 'rpm/fedora', d, 'repodata/repomd.xml.asc'), 'utf8'), `signature of ${d} as served\n`);
  }
});

test('a plan that deletes an rpm still regenerates and re-signs every directory through publish-tree.sh', () => {
  const f = fixture(['rpm/fedora/44/x86_64/old-1.0-1.fc44.x86_64.rpm']);
  const r = run(f);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const calls = readFileSync(f.calls, 'utf8').trim().split('\n');
  assert.equal(calls.length, 1);
  assert.match(calls[0], new RegExp(`^${f.channel}/rpm \\S+ KEYID$`));
  for (const d of ['44/x86_64', '44/noarch', '45/x86_64']) {
    assert.equal(readFileSync(join(f.channel, 'rpm/fedora', d, 'repodata/repomd.xml.asc'), 'utf8'), 'resigned\n');
  }
});

test('an untouched handover refuses an rpm tree that is not the one main serves', () => {
  const f = fixture([]);
  writeFileSync(join(f.channel, 'rpm/fedora/44/x86_64/stray-1.0-1.fc44.x86_64.rpm'), 'rpm');
  const r = run(f);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /holds files main does not serve/);
});

test('a re-publish that leaves a directory unsigned fails the step', () => {
  const f = fixture(['rpm/fedora/44/x86_64/old-1.0-1.fc44.x86_64.rpm']);
  writeFileSync(f.publish, '#!/bin/bash\nfor d in "$1"/fedora/*/*/; do mkdir -p "$d/repodata"; : > "$d/repodata/repomd.xml.asc"; done\n');
  const r = run(f);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /has no signed metadata/);
});

test('prune.yml: the rpm job regenerates only through rpm-metadata.sh, given the plan\'s rpm delete list', () => {
  const rpmJob = workflow.slice(workflow.indexOf('\n  rpm:\n'), workflow.indexOf('\n  deb:\n'));
  assert.match(rpmJob, /\.self\/\.github\/prune\/rpm-metadata\.sh build\/channel rpm-delete\.txt "\$OPENMIXER_GPG_KEY_ID" \.fmx\/\.github\/actions\/publish-rpms\/publish-tree\.sh/);
  assert.equal(rpmJob.match(/publish-tree\.sh/g).length, 1, 'no other call of publish-tree.sh in the rpm job');
  // the delete list the script reads is the one the deletion step wrote, before it
  assert.ok(rpmJob.indexOf('> rpm-delete.txt') < rpmJob.indexOf('rpm-metadata.sh'));
});

test('prune.yml: the rpm job passes the release matrix to rpm-metadata.sh, so publish-tree.sh judges only the published arches', () => {
  const rpmJob = workflow.slice(workflow.indexOf('\n  rpm:\n'), workflow.indexOf('\n  deb:\n'));
  const env = /^ {6}OMX_RELEASE_MATRIX: \$\{\{ vars\.OMX_RELEASE_MATRIX \}\}$/m;
  assert.match(rpmJob, env, 'the rpm job env carries OMX_RELEASE_MATRIX from vars');
  // sabotage: the line removed is red
  assert.doesNotMatch(rpmJob.replace(env, ''), env);
});
