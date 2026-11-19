// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
//
//   dnf repoquery ... --latest-limit=1 <name> | node .github/prune/newest-evr.mjs <name>
//
// repoquery prints the latest build of each architecture, one line each (run 44479750668: a noarch 3.19.1 line,
// then an x86_64 3.20.0 line). This reads those NEVRA lines on stdin and prints the highest version-release
// across them, in the %{evr} form the check compares against (epoch shown only when it is not 0). The comparison
// is rpm's own (rpm.vercmp through rpm --eval, epoch first, then version, then release), never a string sort.
// No line prints nothing; a line for another package, or one that does not parse, is refused with status 2.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const name = process.argv[2];
if (!name) {
  console.error('usage: newest-evr.mjs <package name> < repoquery lines');
  process.exit(2);
}

// NEVRA: <name>-[<epoch>:]<version>-<release>.<arch>; the release may hold dots, so the arch is after the last dot
const parse = (line) => {
  if (!line.startsWith(`${name}-`)) return null;
  const rest = line.slice(name.length + 1);
  const dot = rest.lastIndexOf('.');
  const evr = dot > 0 ? rest.slice(0, dot) : '';
  const colon = evr.indexOf(':');
  const epoch = colon >= 0 ? evr.slice(0, colon) : '0';
  const vr = colon >= 0 ? evr.slice(colon + 1) : evr;
  const cut = vr.lastIndexOf('-');
  if (!/^\d+$/.test(epoch) || cut <= 0 || cut === vr.length - 1) return null;
  return { epoch, version: vr.slice(0, cut), release: vr.slice(cut + 1), line };
};

// rpm's comparison of two version (or release) strings, through the rpm the container ships
const vercmp = (a, b) => {
  const r = spawnSync('rpm', ['--eval', '%{lua: print(rpm.vercmp(os.getenv("NEWEST_A"), os.getenv("NEWEST_B")))}'], {
    env: { ...process.env, NEWEST_A: a, NEWEST_B: b }, encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(`rpm --eval failed: ${r.stderr}`);
  return Number(r.stdout.trim());
};

const evrCmp = (a, b) => {
  const e = vercmp(a.epoch, b.epoch);
  if (e !== 0) return e;
  const v = vercmp(a.version, b.version);
  return v !== 0 ? v : vercmp(a.release, b.release);
};

const lines = readFileSync(0, 'utf8').split('\n').filter((l) => l.trim() !== '');
let best = null;
for (const line of lines) {
  const p = parse(line.trim());
  if (!p) {
    console.error(`::error::not a ${name} build: '${line}'`);
    process.exit(2);
  }
  if (!best || evrCmp(p, best) > 0) best = p;
}
if (best) console.log(`${best.epoch === '0' ? '' : `${best.epoch}:`}${best.version}-${best.release}`);
