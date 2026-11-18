// SPDX-License-Identifier: GPL-3.0-or-later
// prune.yml keeps the newest 2 builds by default (owner, 2026-11-18) and has no co-signing path: the apt index
// carries one signature, the packages key's.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const yml = readFileSync(new URL('../../workflows/prune.yml', import.meta.url), 'utf8')

test('newest defaults to 2', () => {
  const m = yml.match(/ {6}newest:\n(?: {8}.*\n)*? {8}default: '(\d+)'/)
  assert.ok(m, 'no newest input with a default')
  assert.equal(m[1], '2')
})

test('no co-signing key or COSIGN path', () => {
  assert.doesNotMatch(yml, /COSIGN|RPM_GPG_KEY|RPM_GPG_PASSPHRASE/)
})
