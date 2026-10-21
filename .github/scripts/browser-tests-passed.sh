#!/usr/bin/env bash
# Exit 0 when the browser tests (playwright.yml) passed for the commit to
# deploy, waiting for a run still going; say why and exit 1 otherwise.
#
# Environment: SHA (the commit), REPO (owner/name), GH_TOKEN (for gh, with
# actions: read) and POLL_SECONDS (between two looks at a run still going,
# 30 by default). Tested by browser-tests-passed.test.sh, which CI runs.
# Needs the commit history: check out with fetch-depth: 0 (filter:
# blob:none is enough, the diff compares trees).
#
# The deploy waited for ci.yml alone, so a commit whose browser tests had
# failed, or had not finished, could reach production. playwright.yml runs
# once per push to main, for the pushed head, and not at all for a push of
# files it skips (its paths-ignore): the newest run among the commit's
# ancestors counts then, if nothing changed after it but such files. Only
# main's own runs count: a pull request's tests a merge commit, with the
# branch's copy of the workflow. And a run counts when green with no job
# skipped: change detection skipped suites until 2026-10-21, when main
# began running them all. Log lines go to stderr.
set -u

poll=${POLL_SECONDS:-30}
runs_url="https://github.com/$REPO/actions/runs"
by_hand='Run "Playwright Tests" on main by hand (Actions, Run workflow), then deploy again.'

# The files playwright.yml's push paths-ignore leaves out (ci-workflows.test.ts
# keeps the two lists equal).
skipped() {
  case $1 in
    *.md | .github/workflows/ci.yml | LICENSE | .gitignore) return 0 ;;
  esac
  return 1
}

if ! commits=$(git rev-list --first-parent --max-count=50 "$SHA"); then
  echo "Unknown commit $SHA" >&2
  exit 1
fi

for commit in $commits; do
  if ! run=$(gh api "repos/$REPO/actions/workflows/playwright.yml/runs?head_sha=$commit&per_page=20" \
    --jq '[.workflow_runs[] | select(.event == "push" or .event == "workflow_dispatch")][0]
      | select(. != null) | "\(.id) \(.status) \(.conclusion)"'); then
    echo "Could not ask GitHub for the browser-test runs of $commit" >&2
    exit 1
  fi
  [ -z "$run" ] && continue
  read -r id status conclusion <<<"$run"

  # Everything after the tested commit must be files the workflow skips.
  untested=$(git -c core.quotePath=false diff --name-only --no-renames "$commit" "$SHA" |
    while IFS= read -r path; do skipped "$path" || echo "$path"; done)
  if [ -n "$untested" ]; then
    echo "The newest browser-test run is for $commit ($runs_url/$id)," >&2
    echo "and these files changed after it:" >&2
    echo "$untested" | sed 's/^/  /' >&2
    echo "$by_hand" >&2
    exit 1
  fi

  while [ "$status" != "completed" ]; do
    echo "Waiting for the browser tests of $commit ($status): $runs_url/$id" >&2
    sleep "$poll"
    if ! run=$(gh api "repos/$REPO/actions/runs/$id" --jq '"\(.status) \(.conclusion)"'); then
      echo "Could not ask GitHub for run $id" >&2
      exit 1
    fi
    read -r status conclusion <<<"$run"
  done

  if [ "$conclusion" != "success" ]; then
    echo "The browser tests of $commit ended in $conclusion: $runs_url/$id" >&2
    echo "Fix them and push, or re-run the run if it failed for nothing, then deploy again." >&2
    exit 1
  fi

  if ! left_out=$(gh api "repos/$REPO/actions/runs/$id/jobs?per_page=100" \
    --jq '[.jobs[] | select(.conclusion == "skipped") | .name] | join(", ")'); then
    echo "Could not ask GitHub for the jobs of run $id" >&2
    exit 1
  fi
  if [ -n "$left_out" ]; then
    echo "The browser tests of $commit passed with jobs skipped: $left_out" >&2
    echo "($runs_url/$id). $by_hand" >&2
    exit 1
  fi

  echo "The browser tests passed for $commit: $runs_url/$id" >&2
  exit 0
done

echo "No browser-test run for $SHA or the 49 commits before it." >&2
echo "$by_hand" >&2
exit 1
