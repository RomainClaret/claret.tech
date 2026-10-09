#!/usr/bin/env bash
# Checks diff-base.sh against the pushes CI sees, using a local bare origin
# and file:// clones, so a force-pushed old head is really missing from the
# clone as it is in a fetch-depth: 0 checkout. Exits non-zero on a failure:
# a wrong base silently skips CI jobs, so CI runs this before using it.
set -eu

SCRIPT="$(cd "$(dirname "$0")" && pwd)/diff-base.sh"
T=$(mktemp -d "${TMPDIR:-/tmp}/diff-base-test.XXXXXX")
trap 'rm -rf "$T"' EXIT
cd "$T"
export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.com
export GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.com
failures=0

git init -q --bare --initial-branch=main origin.git
git -C origin.git config uploadpack.allowFilter true
git clone -q "file://$T/origin.git" work 2>/dev/null
cd work
git checkout -q -B main
commit() { echo "$1" > "$1.txt"; git add "$1.txt"; git commit -q -m "$1"; git rev-parse HEAD; }
root=$(commit root); a=$(commit a); b=$(commit b); c=$(commit c)
git push -q origin main
cd "$T"

# What actions/checkout with fetch-depth: 0 leaves: every branch, nothing
# orphaned.
ci_clone() { # ci_clone <dir> <branch> [filter]
  rm -rf "$1"
  git clone -q ${3:+--filter=$3} "file://$T/origin.git" "$1" 2>/dev/null
  git -C "$1" checkout -q "$2"
}
# Old heads GitHub has garbage-collected.
prune() {
  git -C origin.git reflog expire --expire=now --all
  git -C origin.git gc -q --prune=now
}
check() { # check <name> <expected> <dir> <event> <before>
  local got
  got=$(cd "$3" && EVENT=$4 BEFORE=$5 bash "$SCRIPT" 2>/dev/null)
  if [ "$got" = "$2" ]; then
    echo "ok   $1"
  else
    echo "FAIL $1: expected $2, got $got"
    failures=$((failures + 1))
  fi
}
zeros=0000000000000000000000000000000000000000

ci_clone ci main
check "a push of several commits uses the previous head" "$a" ci push "$a"
check "a manual run or a deploy checks everything" "$root" ci workflow_dispatch ""
check "a scheduled run checks everything" "$root" ci schedule ""

# main force-pushed: c rewritten as c2.
cd work; git reset -q --hard "$b"; commit c2 >/dev/null; git push -q -f origin main; cd "$T"
ci_clone ci main
check "a force push fetches the old head by SHA" "$c" ci push "$c"
ci_clone ci-partial main blob:none
check "the same in a blob:none clone" "$c" ci-partial push "$c"
prune
ci_clone ci main
check "main rewritten past a gone old head checks everything" "$root" ci push "$c"

# A branch, then force-pushed with its old head gone.
cd work
git checkout -q -b feat "$b"; commit f1 >/dev/null; f2=$(commit f2); git push -q origin feat
git reset -q --hard HEAD~1; commit f2b >/dev/null; git push -q -f origin feat
git checkout -q main
cd "$T"
prune
ci_clone ci feat
check "a branch rewritten past a gone old head uses its merge-base" "$b" ci push "$f2"
check "a new branch uses its merge-base with main" "$b" ci push "$zeros"
check "a pull request uses HEAD~1, the base branch's tip" "$(git -C ci rev-parse HEAD~1)" ci pull_request ""

cd work; git checkout -q -b empty main; git push -q origin empty; git checkout -q main; cd "$T"
ci_clone ci empty
check "a new branch with no commits of its own uses HEAD~1" "$(git -C ci rev-parse HEAD~1)" ci push "$zeros"

if [ "$failures" -gt 0 ]; then
  echo "$failures check(s) failed"
  exit 1
fi
echo "all checks passed"
