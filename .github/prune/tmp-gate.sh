#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
#
#   .github/prune/tmp-gate.sh               run the prune tests under an empty TMPDIR; fail when they leave anything
#   .github/prune/tmp-gate.sh --self-test   the above, then the same run with the tests' cleanup sabotaged
#                                           (PRUNE_SCRATCH_SABOTAGE=keep), which the gate must FAIL
#
# The prune tests used to leave every temporary directory they made behind, among them a shallow clone of the shared
# .github repository per run (about 530 inodes each), until a shared host's /tmp ran out of inodes. Every test now
# makes its directories with test/scratch.mjs, which removes them on every exit path; this gate holds that for the
# whole suite, a test that calls mkdtemp directly included, because it checks what is left, not how it was made.
#
# Exit 0: the tests passed and left nothing. 1: a test failed. 3: something was left in TMPDIR (each entry named).
# 2 (self-test): the sabotaged run did not fail on what it left (it passed, or failed for another reason).
set -u
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

# one run of the suite under its own empty TMPDIR, removed on every exit path of this script
gate_tmp=''
cleanup() { [ -n "$gate_tmp" ] && rm -rf "$gate_tmp"; gate_tmp=''; }
trap cleanup EXIT
trap 'cleanup; trap - INT; kill -INT $$' INT
trap 'cleanup; trap - TERM; kill -TERM $$' TERM
trap 'cleanup; trap - HUP; kill -HUP $$' HUP

gate() {
	gate_tmp=$(mktemp -d "${TMPDIR:-/tmp}/prune-tmp-gate.XXXXXX") || { echo "tmp-gate: cannot make a TMPDIR" >&2; return 1; }
	local rc=0 left
	TMPDIR=$gate_tmp node --test "$here"/test/*.test.mjs || rc=$?
	left=$(cd "$gate_tmp" && find . -mindepth 1 -maxdepth 1 | sed 's|^\./||' | sort)
	cleanup
	if [ "$rc" != 0 ]; then
		echo "tmp-gate: the prune tests failed (exit $rc)" >&2
		return 1
	fi
	if [ -n "$left" ]; then
		echo "tmp-gate: the prune tests left $(printf '%s\n' "$left" | wc -l) entries in TMPDIR:" >&2
		printf '%s\n' "$left" | sed 's/^/  /' >&2
		return 3
	fi
	echo "tmp-gate: the prune tests passed and left nothing in TMPDIR"
}

case "${1:-}" in
'')
	gate
	;;
--self-test)
	gate || exit $?
	echo "tmp-gate: self-test, sabotaged run (PRUNE_SCRATCH_SABOTAGE=keep): the gate must fail on what is left"
	rc=0
	PRUNE_SCRATCH_SABOTAGE=keep gate || rc=$?
	if [ "$rc" != 3 ]; then
		echo "tmp-gate: SELF-TEST FAIL: with the cleanup sabotaged the gate exited $rc, not 3 (left behind)" >&2
		exit 2
	fi
	echo "tmp-gate: self-test ok: shipped run clean, sabotaged run caught"
	;;
*)
	echo "usage: tmp-gate.sh [--self-test]" >&2
	exit 2
	;;
esac
