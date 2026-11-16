#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
# The rpm job's metadata step: regenerate and sign the dnf metadata only when the plan deletes an rpm.
#
#   rpm-metadata.sh <channel checkout> <rpm-delete.txt> <signing key id> <publish-tree.sh>
#
# A plan that deletes no rpm (a deb-only drop) leaves the rpm tree as main serves it: byte for byte, signed as
# served, and nothing goes through publish-tree.sh. Re-publishing an untouched tree only re-judges it: on
# 2026-11-16 a trixie/amd64 deb retirement stopped here because the channel already served noarch contracts ahead
# of their aarch64 builds, a state no deb drop made or could mend (ruled 2026-11-16). A plan that deletes an rpm
# (or an unindexed file under rpm/) regenerates and re-signs every directory through publish-tree.sh and its
# guards, as before, and every directory must end with signed metadata.
set -euo pipefail
channel=$1 deletes=$2 key=$3 publish=$4

if [ ! -s "$deletes" ]; then
  echo "the plan deletes no rpm: the rpm tree is handed over untouched, signed as served"
  exit 0
fi

# publish-tree.sh adds the packages of a directory and rewrites the metadata of every directory of the tree;
# given the kept packages it adds nothing, and the metadata describes only them (only the per-release trees: the
# release package beside them would be filed again under its fixed name)
staging=$(mktemp -d)
trap 'rm -rf "$staging"' EXIT
find "$channel/rpm/fedora" -name '*.rpm' -exec cp -t "$staging" {} +
"$publish" "$channel/rpm" "$staging" "$key"
for d in "$channel"/rpm/fedora/*/*/; do
  test -s "$d/repodata/repomd.xml.asc" || { echo "::error::$d has no signed metadata"; exit 1; }
done
