#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
# The rpm job's metadata step: regenerate and sign the dnf metadata only when the plan deletes an rpm.
#
#   rpm-metadata.sh <channel checkout> <rpm-delete.txt> <signing key id> <publish-tree.sh>
#
# A plan that deletes no rpm (a deb-only drop) leaves the rpm tree as main serves it: byte for byte, signed as
# served (the repodata channel-pull discarded is restored from the pulled commit), and nothing goes through
# publish-tree.sh. Re-publishing an untouched tree only re-judges it: on
# 2026-11-16 a trixie/amd64 deb retirement stopped here because the channel already served noarch contracts ahead
# of their aarch64 builds, a state no deb drop made or could mend (ruled 2026-11-16). A plan that deletes an rpm
# (or an unindexed file under rpm/) regenerates and re-signs every directory through publish-tree.sh and its
# guards, as before, and every directory must end with signed metadata.
set -euo pipefail
channel=$1 deletes=$2 key=$3 publish=$4

if [ ! -s "$deletes" ]; then
  # channel-pull discards the repodata it pulls (strip: rpm), so the served metadata comes back from the
  # pulled commit, byte for byte, and the tree must then equal that commit exactly (2026-11-16: the first
  # untouched handover carried no repodata and the deb job stopped on it)
  git -C "$channel" checkout -q HEAD -- rpm
  git -C "$channel" diff --quiet HEAD -- rpm || { echo "::error::the rpm tree is not the one main serves"; exit 1; }
  test -z "$(git -C "$channel" ls-files --others -- rpm)" || { echo "::error::the rpm tree holds files main does not serve"; exit 1; }
  for d in "$channel"/rpm/fedora/*/*/; do
    test -s "$d/repodata/repomd.xml.asc" || { echo "::error::$d has no signed metadata"; exit 1; }
  done
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
