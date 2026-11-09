#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
# The prune's tree is still the one its plan was made from, and so is main.
#
#   unmoved.sh <channel checkout> <planned sha> [<branch>]
#
# The plan job decides what to keep and delete on main at one commit; the apply jobs pull main again, maybe an hour
# later (2026-11-09: they waited that long for a runner). A release that published in between left its packages
# in the tree, and the prune, regenerating the dnf metadata from its own older tree and carrying it over the new
# one, pushed metadata that did not list them: a silent downgrade for every user. So the apply stops, and pushes
# nothing, as soon as the checkout it works in, or main itself, is anything but the planned commit. It is run
# after the pull, right before the metadata is regenerated, and right before the push.
#
# Stopping rather than replaying the deletions over the new main: the plan (newest per package, the pins, the
# installability closure) and the install checks after the push are a function of the planned tree, so a tree
# that grew since is not one the plan proves anything about. A re-run plans again over it.
#
# The push itself cannot get around this: the commit the deb job pushes has the planned commit as its parent and
# channel-push never forces, so a main that moved after the last check refuses it as not a fast-forward.
#
# PUBLISH_TOKEN (optional) authenticates the fetch, as channel-pull does.
set -euo pipefail

dir=${1:?usage: unmoved.sh <channel checkout> <planned sha> [<branch>]}
planned=${2:?usage: unmoved.sh <channel checkout> <planned sha> [<branch>]}
branch=${3:-main}

head=$(git -C "$dir" rev-parse HEAD)
if [ "$head" != "$planned" ]; then
    echo "::error::the channel was pulled at $head, not at $planned, the commit the plan was made from: main moved since the plan (a publish landed). Nothing was pushed; run the prune again." >&2
    exit 1
fi

auth=()
if [ -n "${PUBLISH_TOKEN:-}" ]; then
    basic=$(printf 'x-access-token:%s' "$PUBLISH_TOKEN" | base64 -w0)
    echo "::add-mask::$basic"
    auth=(-c "http.https://github.com/.extraheader=AUTHORIZATION: basic $basic")
fi
git -C "$dir" "${auth[@]}" fetch -q --depth 1 origin "refs/heads/$branch"
tip=$(git -C "$dir" rev-parse FETCH_HEAD)
if [ "$tip" != "$planned" ]; then
    echo "::error::$branch is at $tip now, not at $planned, the commit the plan was made from: a publish landed since the plan. Nothing was pushed; run the prune again." >&2
    exit 1
fi
echo "the checkout and $branch are both at $planned, the planned commit"
