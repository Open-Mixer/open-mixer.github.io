// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
//
//   node --test .github/prune/test/
//
// The apply checks of prune.yml (verify-dnf, verify-apt: every kept version installs) run in EVERY cell the shared
// matrix names, and in no cell of their own (Open-Mixer/.github#63, ruling D25 of #59). The cells come from the
// check-matrix action of Open-Mixer/.github@openmixer-v1, which reads release-matrix/quick.txt, the one list. The
// action is read from OMX_ACTIONS (a checkout's .github/actions; the plan job sets it), else cloned at openmixer-v1.
// PRUNE_WORKFLOW points the tests at another prune.yml (a sabotaged copy).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parsePackages, uninstallable } from '../prune.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const select = path.join(here, '..', 'select.mjs');
const expectMjs = path.join(here, '..', 'expect.mjs');
const workflow = process.env.PRUNE_WORKFLOW || path.join(here, '..', '..', 'workflows', 'prune.yml');
const tmpRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'prune-apply-'));

let actionsDir = process.env.OMX_ACTIONS;
function actions() {
  if (actionsDir) return actionsDir;
  const d = tmpRoot();
  const r = spawnSync('git', ['clone', '-q', '--depth', '1', '-b', 'openmixer-v1', 'https://github.com/Open-Mixer/.github', path.join(d, 'gh')], { encoding: 'utf8' });
  assert.equal(r.status, 0, `could not read Open-Mixer/.github@openmixer-v1 (set OMX_ACTIONS): ${r.stderr}`);
  return (actionsDir = path.join(d, 'gh', '.github', 'actions'));
}

// ------------------------------------------------------------------ reading the workflow

// one shell word of a run: block, quoted (a ${{ }} expression holds spaces) or bare
const ARG = String.raw`("[^"]*"|'[^']*'|\S+)`;
const unq = (s) => s.trim().replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');

function jobsOf(text) {
  const lines = text.split('\n');
  const out = new Map();
  let cur = null;
  for (const l of lines.slice(lines.findIndex((x) => /^jobs:\s*$/.test(x)) + 1)) {
    const m = l.match(/^ {2}([\w-]+):\s*$/);
    if (m) { cur = []; out.set(m[1], cur); continue; }
    if (/^\S/.test(l)) break;
    if (cur) cur.push(l);
  }
  return new Map([...out].map(([k, v]) => [k, v.join('\n')]));
}

// the with: inputs of the step of a job that uses Open-Mixer/.github's <action>@openmixer-v1
function withOf(jobText, action) {
  const lines = jobText.split('\n');
  const i = lines.findIndex((l) => l.includes(`Open-Mixer/.github/.github/actions/${action}@openmixer-v1`));
  if (i < 0) return null;
  const ind = lines[i].indexOf('uses:');
  let start = i;
  while (start > 0 && !/^\s*- /.test(lines[start])) start--;
  const w = {};
  for (let j = start + 1; j < lines.length; j++) {
    const l = lines[j];
    if (!l.trim()) continue;
    const at = l.search(/\S/);
    if (at < ind || (at === ind - 2 && l.trim().startsWith('- '))) break;
    if (at === ind && /^\s*with:\s*$/.test(l)) {
      for (j++; j < lines.length; j++) {
        const m = lines[j];
        if (!m.trim()) continue;
        if (m.search(/\S/) <= ind) { j--; break; }
        const kv = m.trim().match(/^([\w-]+):\s*(.*)$/);
        if (kv) w[kv[1]] = unq(kv[2]);
      }
    }
  }
  return w;
}

// check-matrix.sh run as the action runs it, for one wave: its key=value outputs
function renderCheckMatrix(w, wave) {
  const out = path.join(tmpRoot(), 'out');
  fs.writeFileSync(out, '');
  const r = spawnSync('bash', [path.join(actions(), 'check-matrix', 'check-matrix.sh')], {
    encoding: 'utf8',
    env: {
      ...process.env, GITHUB_OUTPUT: out, WAVE: wave, MATRIX: '',
      RPM_RELEASES: w['rpm-releases'] || '', RPM_ARCHES: w['rpm-arches'] || '["x86_64", "aarch64"]',
      DEB_RELEASES: w['deb-releases'] || '', DEB_ARCHES: w['deb-arches'] || '["amd64", "arm64"]',
    },
  });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  return Object.fromEntries(fs.readFileSync(out, 'utf8').split('\n').filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
}

const cellName = (format, c) => (format === 'rpm' ? `fedora/${c.fedora} ${c.arch}` : `debian/${c.suite} ${c.arch}`);

// The cells the apply checks run, for one wave: every expect.mjs call of a job, its --repo and --arch either literal
// or ${{ matrix.cell.* }} of a matrix that is fromJSON of a plan job's output, rendered by check-matrix.
function appliedCells(text, wave) {
  const jobs = jobsOf(text);
  const cells = [];
  const problems = [];
  for (const [name, job] of jobs) {
    for (const m of job.matchAll(new RegExp(`expect\\.mjs[^\\n]*--format\\s+${ARG}\\s+--repo\\s+${ARG}\\s+--arch\\s+${ARG}`, 'g'))) {
      const [format, repo, arch] = [unq(m[1]), unq(m[2]), unq(m[3])];
      if (!/\$/.test(repo + arch)) { cells.push({ job: name, format, cell: `${repo} ${arch}` }); continue; }
      const src = job.match(/cell:\s*\$\{\{\s*fromJSON\(needs\.([\w-]+)\.outputs\.([\w-]+)\)\s*\}\}/);
      if (!src) { problems.push(`${name}: --repo ${repo} --arch ${arch} is not literal and not a matrix cell`); continue; }
      const [, planJob, output] = src;
      const pj = jobs.get(planJob) || '';
      const om = pj.match(new RegExp(`^\\s+${output}:\\s*\\$\\{\\{\\s*steps\\.([\\w-]+)\\.outputs\\.([\\w-]+)\\s*\\}\\}`, 'm'));
      const w = withOf(pj, 'check-matrix');
      if (!om || !w) { problems.push(`${name}: its matrix ${planJob}.${output} is not a check-matrix output`); continue; }
      if (!/vars\.OMX_RELEASE_MATRIX/.test(w.wave || '')) problems.push(`${planJob}: the check-matrix step does not read OMX_RELEASE_MATRIX`);
      const rendered = JSON.parse(renderCheckMatrix(w, wave)[om[2]] || '[]');
      for (const c of rendered) {
        const sub = (s) => s.replace(/\$\{\{\s*matrix\.cell\.(\w+)\s*\}\}/g, (_, k) => c[k]);
        const r = sub(repo), a = sub(arch);
        if (/\$/.test(r + a)) problems.push(`${name}: --repo ${repo} --arch ${arch} names something besides matrix.cell`);
        else cells.push({ job: name, format, cell: `${r} ${a}` });
      }
    }
  }
  return { cells, problems };
}

function quickSet() {
  const out = [];
  for (const line of fs.readFileSync(path.join(actions(), 'release-matrix', 'quick.txt'), 'utf8').split('\n')) {
    const p = line.trim().split(/\s+/);
    if (p.length !== 3 || line.startsWith('#')) continue;
    out.push(p[0] === 'rpm' ? `fedora/${p[1]} ${p[2]}` : `debian/${p[1]} ${p[2]}`);
  }
  return out.sort();
}

const text = () => fs.readFileSync(workflow, 'utf8');

test('apply checks: the cells verify-dnf and verify-apt run are the shared quick set, every one of them', () => {
  const { cells, problems } = appliedCells(text(), 'quick');
  assert.deepEqual(problems, []);
  assert.deepEqual(cells.map((c) => c.cell).sort(), quickSet(), 'the apply checks run exactly the cells of release-matrix/quick.txt');
  for (const c of cells) assert.equal(c.cell.startsWith('fedora/') ? 'rpm' : 'deb', c.format, `${c.job}: ${c.cell} checked as ${c.format}`);
});

test('apply checks: with the whole matrix (OMX_RELEASE_MATRIX=full) they run every cell check-matrix renders', () => {
  const jobs = jobsOf(text());
  const plans = [...jobs.values()].map((j) => withOf(j, 'check-matrix')).filter(Boolean);
  assert.equal(plans.length, 1, 'one check-matrix step declares the matrix of the apply checks');
  const r = renderCheckMatrix(plans[0], 'full');
  const want = [...JSON.parse(r.rpm).map((c) => cellName('rpm', c)), ...JSON.parse(r.deb).map((c) => cellName('deb', c))].sort();
  const { cells, problems } = appliedCells(text(), 'full');
  assert.deepEqual(problems, []);
  assert.deepEqual(cells.map((c) => c.cell).sort(), want);
  assert.ok(want.length > quickSet().length, 'full adds the cells quick skips');
});

test('apply checks: an arm cell runs on an arm runner, as .github\'s install checks do', () => {
  for (const [name, job] of jobsOf(text())) {
    if (!/expect\.mjs/.test(job)) continue;
    const runsOn = (job.match(/^\s+runs-on:\s*(.*)$/m) || [])[1] || '';
    const arm = /--format\s+rpm/.test(job) ? 'aarch64' : 'arm64';
    assert.match(runsOn, new RegExp(`matrix\\.cell\\.arch == '${arm}' && 'ubuntu-24\\.04-arm'`), `${name} runs-on: ${runsOn}`);
    assert.match(job, /image:\s*\$\{\{\s*matrix\.cell\.image\s*\}\}/, `${name}: the container is the cell's image`);
  }
});

// ------------------------------------------------------------------ the 2026-11-13 trixie/arm64 case

const debPkg = (name, version, arch, { depends, source } = {}) => [
  `Package: ${name}`, `Architecture: ${arch}`, `Version: ${version}`, ...(source ? [`Source: ${source}`] : []),
  'Maintainer: Pau Aliagas <linuxnow@gmail.com>', `Filename: ./${arch}/${name}_${version}_${arch}.deb`,
  ...(depends ? [`Depends: ${depends}`] : []), `Description: ${name}`, ' a long description line',
].join('\n');
// trixie: amd64 still carries 0.20.4, arm64 0.20.6; the contract is arch all. bookworm is whole.
const trixie = [
  debPkg('plugin-hostd', '0.20.4-1', 'amd64', { source: 'plugin-hostd', depends: 'plugin-hostd-contract (= 0.20.4-1)' }),
  debPkg('plugin-hostd', '0.20.6-1', 'arm64', { source: 'plugin-hostd', depends: 'plugin-hostd-contract (= 0.20.6-1)' }),
  debPkg('plugin-hostd-contract', '0.20.4-1', 'all', { source: 'plugin-hostd-contract' }),
  debPkg('plugin-hostd-contract', '0.20.6-1', 'all', { source: 'plugin-hostd-contract' }),
].join('\n\n') + '\n';
const bookworm = [
  debPkg('plugin-hostd', '0.20.6-1', 'amd64', { source: 'plugin-hostd', depends: 'plugin-hostd-contract (= 0.20.6-1)' }),
  debPkg('plugin-hostd-contract', '0.20.6-1', 'all', { source: 'plugin-hostd-contract' }),
].join('\n\n') + '\n';

// What the apt/dnf loop of one cell finds: expect.mjs's install lines for the cell, each judged against the kept
// packages of the cell's repository (the package manager's view: a requirement whose only satisfiers are deleted).
function applyCheck(tree, planFile, format, cell) {
  const [repo, arch] = cell.split(' ');
  const r = spawnSync(process.execPath, [expectMjs, '--plan', planFile, '--format', format, '--repo', repo, '--arch', arch], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const installs = r.stdout.split('\n').filter((l) => l.startsWith('install ')).flatMap((l) => l.slice(8).split(','));
  if (format !== 'deb' || !fs.existsSync(path.join(tree, 'deb', repo, 'Packages'))) return [];
  const pkgs = parsePackages(fs.readFileSync(path.join(tree, 'deb', repo, 'Packages'), 'utf8'), repo);
  const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  const kept = new Set(plan.keep.filter((k) => k.format === 'deb' && k.repo === repo).map((k) => k.file));
  return uninstallable(pkgs, kept).filter((l) => l.includes(`(${arch})`) && installs.some((s) => l.includes(` ${s.split('=')[0]} ${s.split('=')[1]} `)));
}

test('apply checks: a scoped drop that strands a kept package in trixie/arm64 is caught by that cell\'s check', () => {
  const tmp = tmpRoot();
  fs.writeFileSync(path.join(tmp, 'keep.yml'), 'keep:\n');
  const tree = path.join(tmp, 'tree');
  for (const [suite, packages] of [['trixie', trixie], ['bookworm', bookworm]]) {
    const s = path.join(tree, 'deb/debian', suite);
    fs.mkdirSync(s, { recursive: true });
    fs.writeFileSync(path.join(s, 'Packages'), packages);
    for (const p of parsePackages(packages, `debian/${suite}`)) { fs.mkdirSync(path.join(s, p.arch), { recursive: true }); fs.writeFileSync(path.join(s, p.file), ''); }
  }
  const planFile = path.join(tmp, 'plan.json');
  // the plan is written before the invariant refuses it: the apply check is the net behind the plan's own
  spawnSync(process.execPath, [select, '--keep', path.join(tmp, 'keep.yml'), '--tree', tree, '--drop', 'plugin-hostd-contract@0.20.6:trixie/all', '--json', planFile], { encoding: 'utf8' });
  const { cells, problems } = appliedCells(text(), 'quick');
  assert.deepEqual(problems, []);
  const caught = cells.map((c) => ({ ...c, fails: applyCheck(tree, planFile, c.format, c.cell) })).filter((c) => c.fails.length);
  assert.deepEqual(caught.map((c) => c.cell), ['debian/trixie arm64'], 'the trixie/arm64 apply check, and only it, fails');
  assert.match(caught[0].fails[0], /plugin-hostd 0\.20\.6-1 \(arm64\) requires plugin-hostd-contract = 0\.20\.6-1/);
  // the two cells the apply checks ran before (fc44 x86_64 and bookworm amd64) would have passed it
  const before = [['rpm', 'fedora/44 x86_64'], ['deb', 'debian/bookworm amd64']];
  assert.deepEqual(before.flatMap(([f, c]) => applyCheck(tree, planFile, f, c)), []);
});

// ------------------------------------------------------------------ no cell list of its own

// A literal cell in prune.yml (an image debian:<suite> or fedora:<n>, fc<n>, a Debian suite, fedora/<n>, an
// architecture) is red outside the whole matrix handed to check-matrix and the places below, each with its reason;
// an entry that matches no line is red too.
const ALLOW = [
  ['', /description: 'Drop mode:/, 'the drop input\'s description: examples of the entry syntax, not a cell the workflow runs'],
  ['rpm', /^\s+image: fedora:44$/, 'the toolchain of the job that rewrites every release\'s metadata, not a cell it checks'],
  ['deb', /^\s+image: debian:bookworm$/, 'the toolchain of the job that rewrites every suite\'s index, not a cell it checks'],
];
const PLAN_KEYS = new Set(['rpm-releases', 'rpm-arches', 'deb-releases', 'deb-arches']);
const LITERALS = [
  /\b(debian|fedora):[\w.]+/, /\bfc\d+\b/, /\b(bookworm|trixie|bullseye|forky|sid)\b/, /\bfedora\/\d+/,
  /\b(x86_64|aarch64|amd64|arm64)\b/,
];

function literalCells(src) {
  const errs = [], used = new Set();
  let job = '';
  src.split('\n').forEach((raw, n) => {
    const jm = raw.match(/^ {2}([\w-]+):\s*$/);
    if (jm) job = jm[1];
    const code = raw.replace(/\s#\s.*$/, '');
    if (!code.trim() || code.trim().startsWith('#')) return;
    const key = (code.match(/^\s*([\w-]+):/) || [])[1];
    if (PLAN_KEYS.has(key)) return;
    const a = ALLOW.findIndex(([j, re]) => (!j || j === job) && re.test(code));
    if (a >= 0) { used.add(a); return; }
    // the house runner choice: an arm cell runs on an arm runner
    const rest = code.replace(/matrix\.cell\.arch == '(aarch64|arm64)'/g, '');
    for (const re of LITERALS) {
      const m = rest.match(re);
      if (m) { errs.push(`prune.yml:${n + 1}: '${m[0]}' is a cell written into the workflow: ${code.trim()}`); break; }
    }
  });
  ALLOW.forEach(([j, re, why], i) => { if (!used.has(i)) errs.push(`ALLOW ${j || '*'} ${re} (${why}) matches no line: a stale entry`); });
  return errs;
}

test('no hardcoded cells: prune.yml writes no cell list of its own', () => {
  assert.deepEqual(literalCells(text()), []);
});

test('no hardcoded cells: a literal cell put back is red, and so is a stale allowance', () => {
  const src = text();
  const sab = src.replace(new RegExp(`--format deb --repo ${ARG} --arch ${ARG}`), '--format deb --repo debian/trixie --arch arm64');
  assert.notEqual(sab, src, 'no deb expect.mjs call to sabotage');
  assert.ok(literalCells(sab).some((e) => /'trixie'|'arm64'/.test(e)));
  assert.ok(literalCells(src.replace(/description: 'Drop mode:/, "description: 'Drop:")).some((e) => /stale entry|is a cell/.test(e)));
});
