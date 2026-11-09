// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
//
// A publish that lands on main between the prune's plan and its push. 2026-11-09: the apply jobs waited an hour for
// a runner, plugin-hostd-protocol 0.5.2 was published meanwhile, and the deb job laid the rpm job's metadata (made
// from the planned, older tree) over a pull that held the 0.5.2 rpms: they stayed in git and vanished from dnf.
//
// The fixture is a channel in a bare repository and the apply's git steps in prune.yml's order, with the real
// unmoved.sh as the guard and a stand-in for createrepo (an index listing the tree's rpms). Whatever the timing,
// main must end with an index that lists every rpm its tree holds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const guard = join(here, '..', 'unmoved.sh');
const workflow = readFileSync(join(here, '..', '..', 'workflows', 'prune.yml'), 'utf8');

const ARCH = 'rpm/fedora/44/x86_64';
const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.org', GIT_COMMITTER_NAME: 't',
  GIT_COMMITTER_EMAIL: 't@example.org', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', PUBLISH_TOKEN: '' };
const git = (cwd, ...args) => execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const rpms = (tree) => readdirSync(join(tree, ARCH)).filter((f) => f.endsWith('.rpm')).sort();
// createrepo's stand-in: the index of a directory is the list of the rpms it holds
const regenerate = (tree) => {
  mkdirSync(join(tree, ARCH, 'repodata'), { recursive: true });
  writeFileSync(join(tree, ARCH, 'repodata', 'repomd.xml'), rpms(tree).join('\n') + '\n');
};
const indexed = (tree) => readFileSync(join(tree, ARCH, 'repodata', 'repomd.xml'), 'utf8').split('\n').filter(Boolean);

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'prune-race-'));
  const origin = join(dir, 'origin.git');
  git(dir, 'init', '-q', '--bare', '-b', 'main', origin);
  const seed = join(dir, 'seed');
  git(dir, 'clone', '-q', origin, seed);
  mkdirSync(join(seed, ARCH), { recursive: true });
  for (const f of ['old-0.1.0-1.fc44.x86_64.rpm', 'proto-0.5.0-1.fc44.x86_64.rpm', 'proto-0.5.1-1.fc44.x86_64.rpm'])
    writeFileSync(join(seed, ARCH, f), f);
  regenerate(seed);
  git(seed, 'add', '-A');
  git(seed, 'commit', '-q', '-m', 'seed');
  git(seed, 'push', '-q', 'origin', 'HEAD:main');
  return { dir, origin, planned: git(seed, 'rev-parse', 'HEAD') };
}

// channel-pull: a shallow clone of main
let n = 0;
const pull = (fx) => {
  const to = join(fx.dir, `pull-${n++}`);
  git(fx.dir, 'clone', '-q', '--depth', '1', '-b', 'main', `file://${fx.origin}`, to);
  return to;
};

// a release that publishes proto 0.5.2 the way publish-rpms does: pull, place, regenerate over the pulled tree, push
const release = (fx) => {
  const t = pull(fx);
  writeFileSync(join(t, ARCH, 'proto-0.5.2-1.fc44.x86_64.rpm'), 'proto-0.5.2');
  regenerate(t);
  git(t, 'add', '-A');
  git(t, 'commit', '-q', '-m', 'rpm: publish v0.5.2 (plugin-hostd-protocol)');
  git(t, 'push', '-q', 'origin', 'HEAD:refs/heads/main');
};

const unmoved = (tree, planned) => spawnSync(guard, [tree, planned], { env, encoding: 'utf8' });

// the apply, in prune.yml's order; `at` names the step after which the release lands. Returns why it stopped.
function apply(fx, at) {
  const del = 'old-0.1.0-1.fc44.x86_64.rpm';
  const step = (name) => { if (at === name) release(fx); };
  const check = (tree) => { const r = unmoved(tree, fx.planned); if (r.status !== 0) throw new Error(r.stderr); };
  try {
    // rpm job
    step('plan');
    const rpm = pull(fx);
    check(rpm); // The tree is the one the plan was made from
    step('rpm pull');
    rmSync(join(rpm, ARCH, del));
    check(rpm); // Main has not moved since the plan, before the metadata is regenerated
    regenerate(rpm);
    const handover = join(fx.dir, 'handover');
    cpSync(join(rpm, ARCH, 'repodata'), handover, { recursive: true });
    step('rpm job');
    // deb job
    const deb = pull(fx);
    check(deb); // The pull is the tree the plan was made from
    cpSync(handover, join(deb, ARCH, 'repodata'), { recursive: true }); // Apply the rpm half
    rmSync(join(deb, ARCH, del));
    git(deb, 'add', '-A', 'rpm');
    step('deb apply');
    check(deb); // before the index is regenerated
    check(deb); // before the push
    step('last check');
    // channel-push: no rebuild, never forced
    git(deb, 'commit', '-q', '-m', 'deb: publish prune');
    const p = spawnSync('git', ['push', 'origin', 'HEAD:refs/heads/main'], { cwd: deb, env, encoding: 'utf8' });
    if (p.status !== 0) throw new Error(`push refused: ${p.stderr}`);
    return 'pushed';
  } catch (e) {
    return e.message;
  }
}

// what main serves: its index lists every rpm its tree holds
const served = (fx) => {
  const t = pull(fx);
  return { tree: rpms(t), index: indexed(t), head: git(t, 'rev-parse', 'HEAD') };
};

test('positive control: with main unmoved the prune pushes and its index lists exactly what it kept', () => {
  const fx = fixture();
  assert.equal(apply(fx, null), 'pushed');
  const s = served(fx);
  assert.deepEqual(s.tree, ['proto-0.5.0-1.fc44.x86_64.rpm', 'proto-0.5.1-1.fc44.x86_64.rpm']);
  assert.deepEqual(s.index, s.tree);
  rmSync(fx.dir, { recursive: true, force: true });
});

for (const at of ['plan', 'rpm pull', 'rpm job', 'deb apply', 'last check']) {
  test(`a release that lands after the ${at} step is never dropped from the index`, () => {
    const fx = fixture();
    const why = apply(fx, at);
    assert.notEqual(why, 'pushed', 'the prune pushed over a main that moved since its plan');
    if (at === 'last check') assert.match(why, /push refused/, 'after the last check git itself refuses, unforced');
    else assert.match(why, /main moved since the plan|a publish landed since the plan/);
    const s = served(fx);
    assert.ok(s.tree.includes('proto-0.5.2-1.fc44.x86_64.rpm'), 'the release is in the tree');
    assert.deepEqual(s.index, s.tree, 'main\'s index lists every rpm its tree holds, the release included');
    rmSync(fx.dir, { recursive: true, force: true });
  });
}

// the guard is only as good as its calls: every apply pull, regenerate and push in prune.yml is preceded by it
test('prune.yml runs the guard after each pull, before each regenerate and right before the push', () => {
  const job = (name) => {
    const m = workflow.match(new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-z-]+:\\n|$)`));
    assert.ok(m, `job ${name}`);
    return m[1].split(/\n      - /).slice(1);
  };
  const isGuard = (s) => /run: \.self\/\.github\/prune\/unmoved\.sh build\/channel "\$PLANNED"/.test(s)
    && /PLANNED: \$\{\{ needs\.plan\.outputs\.sha \}\}/.test(s);
  const expectGuarded = (steps, what, where) => {
    const i = steps.findIndex(what);
    assert.ok(i > 0, `${where}: step present`);
    return i;
  };
  for (const [name, regen] of [['rpm', /name: Regenerate and sign the metadata/], ['deb', /name: Regenerate and sign the index/]]) {
    const steps = job(name);
    const pullAt = expectGuarded(steps, (s) => /actions\/channel-pull@/.test(s), `${name} pull`);
    assert.ok(isGuard(steps[pullAt + 1]), `${name}: the step right after the pull is the guard`);
    const regenAt = expectGuarded(steps, (s) => regen.test(s), `${name} regenerate`);
    assert.ok(isGuard(steps[regenAt - 1]), `${name}: the step right before the regenerate is the guard`);
  }
  const deb = job('deb');
  const pushAt = expectGuarded(deb, (s) => /actions\/channel-push@/.test(s), 'deb push');
  assert.ok(isGuard(deb[pushAt - 1]), 'deb: the step right before the push is the guard');
  assert.ok(!/rebuild:/.test(deb[pushAt]), 'deb: the push has no rebuild: a lost race fails, it is not replayed');
  const forced = workflow.split('\n').filter((l) => /\bpush\b/.test(l) && /--force|\s-f\b|\s\+\S/.test(l));
  assert.deepEqual(forced, [], 'nothing in prune.yml forces a push');
});
