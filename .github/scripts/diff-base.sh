#!/usr/bin/env bash
# Print the commit CI should diff against to decide which jobs run.
#
# Environment: EVENT (github.event_name) and BEFORE (github.event.before).
# Tested by diff-base.test.sh, which CI runs before using it.
# Needs the commit history and origin/main: check out with fetch-depth: 0
# (filter: blob:none is enough, the diff compares trees).
#
# A push is compared with the commit the branch pointed to before it. HEAD~1
# covers only the last of the pushed commits, so a push of several skipped
# every job whose files only the earlier ones touched. This assumes the
# previous head's run finished, which is why ci.yml never cancels runs on
# main. Log lines go to stderr; the base is the only thing printed on stdout.
set -u

zeros=0000000000000000000000000000000000000000
head=$(git rev-parse HEAD)
has_commit() { git cat-file -e "$1^{commit}" 2>/dev/null; }

if [ "$EVENT" = "push" ] && [ -n "$BEFORE" ] && [ "$BEFORE" != "$zeros" ]; then
  # After a force push the old head is on no branch, so the clone does not
  # have it. GitHub still serves it by SHA until it is garbage collected.
  has_commit "$BEFORE" ||
    git fetch --quiet --no-tags origin "$BEFORE" 2>/dev/null || true
  if has_commit "$BEFORE"; then
    echo "Using the branch's previous head as base: $BEFORE" >&2
    echo "$BEFORE"
    exit 0
  fi
  echo "The branch's previous head $BEFORE cannot be fetched" >&2
fi

if [ "$EVENT" = "push" ]; then
  # A new branch, or one rewritten past its old head: all it changed since it
  # left main.
  if base=$(git merge-base origin/main HEAD 2>/dev/null) && [ "$base" != "$head" ]; then
    echo "Using the merge-base with main: $base" >&2
    echo "$base"
    exit 0
  fi
  if [ "$BEFORE" != "$zeros" ]; then
    # main itself rewritten, with nothing left to compare against. Compare
    # with the first commit instead, which runs every job: HEAD~1 would
    # silently skip whatever the earlier rewritten commits touched.
    root=$(git rev-list --max-parents=0 HEAD | tail -n 1)
    echo "No usable base; comparing with the first commit: $root" >&2
    echo "$root"
    exit 0
  fi
fi

if [ "$EVENT" != "push" ] && [ "$EVENT" != "pull_request" ]; then
  # No range of changes to go by: a manual run, or the deploy calling this
  # workflow, where github.event_name is the caller's workflow_dispatch.
  # Compare with the first commit, which runs every job. HEAD~1 let a deploy
  # whose last commit touched only docs skip every test and the build, and
  # ship whatever came before it untested.
  root=$(git rev-list --max-parents=0 HEAD | tail -n 1)
  echo "A $EVENT run checks everything; comparing with the first commit: $root" >&2
  echo "$root"
  exit 0
fi

# A pull request checks out its merge commit, whose first parent is the base
# branch's tip: HEAD~1 covers the whole pull request. A push lands here only
# as a new branch with no commits of its own.
if parent=$(git rev-parse --verify --quiet HEAD~1); then
  echo "Using HEAD~1 as base: $parent" >&2
  echo "$parent"
else
  echo "No parent commit found, using HEAD as base: $head" >&2
  echo "$head"
fi
