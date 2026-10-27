#!/usr/bin/env bash
# Checks browser-tests-passed.sh against what GitHub could answer: a
# temporary repository, and a stub gh first on PATH that applies the
# script's own --jq filters (with jq) to answers shaped like the API's.
# Exits non-zero on a failure: a wrong answer lets an untested commit reach
# production, or blocks every deploy, so CI runs this before the deploy
# uses the script.
set -eu

SCRIPT="$(cd "$(dirname "$0")" && pwd)/browser-tests-passed.sh"
T=$(mktemp -d "${TMPDIR:-/tmp}/browser-tests-test.XXXXXX")
trap 'rm -rf "$T"' EXIT
export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.com
export GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.com
failures=0

# The stub answers `gh api <path> --jq <filter>` from files in $API: runs-<sha>
# (a commit's runs; none when missing), run-<id> (a run), jobs-<id> (its jobs;
# none skipped when missing). A run's answers in turn, as it goes on, are
# run-<id>.1, run-<id>.2..., the last one repeated. $API/fail fails every call.
mkdir -p "$T/bin" "$T/api"
cat >"$T/bin/gh" <<'STUB'
#!/usr/bin/env bash
set -u
[ "$1" = api ] || { echo "stub gh: only api" >&2; exit 2; }
path=$2
shift 2
filter=.
while [ $# -gt 0 ]; do
  case $1 in
    --jq) filter=$2; shift 2 ;;
    *) shift ;;
  esac
done
[ -e "$API/fail" ] && { echo "HTTP 502: Bad Gateway" >&2; exit 1; }
case $path in
  repos/*/actions/workflows/playwright.yml/runs\?*)
    key=runs-$(printf '%s' "$path" | sed -n 's/.*[?&]head_sha=\([0-9a-f]*\).*/\1/p')
    empty='{"total_count": 0, "workflow_runs": []}' ;;
  repos/*/actions/runs/*/jobs\?*)
    key=jobs-$(printf '%s' "$path" | sed 's#.*/actions/runs/\([0-9]*\)/jobs.*#\1#')
    empty='{"total_count": 0, "jobs": []}' ;;
  repos/*/actions/runs/*)
    key=run-${path##*/}
    empty= ;;
  *) echo "stub gh: unexpected path $path" >&2; exit 2 ;;
esac
file=$API/$key
if [ -e "$file.1" ]; then
  count=$(( $(cat "$file.count" 2>/dev/null || echo 0) + 1 ))
  echo "$count" >"$file.count"
  while [ "$count" -gt 1 ] && [ ! -e "$file.$count" ]; do count=$((count - 1)); done
  file=$file.$count
fi
if [ -e "$file" ]; then
  jq -r "$filter" "$file"
elif [ -n "$empty" ]; then
  printf '%s' "$empty" | jq -r "$filter"
else
  echo "stub gh: no answer for $path" >&2
  exit 2
fi
STUB
chmod +x "$T/bin/gh"

# A run as the runs list gives it.
run() { # run <id> <event> <status> <conclusion|null>
  local conclusion=null
  [ "$4" != null ] && conclusion="\"$4\""
  printf '{"id": %s, "event": "%s", "status": "%s", "conclusion": %s}' \
    "$1" "$2" "$3" "$conclusion"
}
runs() { # runs <sha> <run>...
  local sha=$1 IFS=,
  shift
  printf '{"total_count": %s, "workflow_runs": [%s]}' "$#" "$*" >"$T/api/runs-$sha"
}
state() { # state <id> <n> <status> <conclusion|null>: the run's nth answer
  local conclusion=null
  [ "$4" != null ] && conclusion="\"$4\""
  printf '{"id": %s, "status": "%s", "conclusion": %s}' \
    "$1" "$3" "$conclusion" >"$T/api/run-$1.$2"
}

check() { # check <name> <pass|refuse> <sha> [text the refusal shows]
  local out status
  out=$(cd "$T/repo" && PATH="${FIRST_ON_PATH:-}$T/bin:$PATH" API="$T/api" SHA=$3 REPO=o/r \
    POLL_SECONDS=0 bash "$SCRIPT" 2>&1) && status=0 || status=$?
  if { [ "$2" = pass ] && [ "$status" -eq 0 ]; } ||
    { [ "$2" = refuse ] && [ "$status" -ne 0 ] &&
      { [ -z "${4:-}" ] || printf '%s' "$out" | grep -qF -- "$4"; }; }; then
    echo "ok   $1"
  else
    echo "FAIL $1: wanted $2${4:+ saying \"$4\"}, got exit $status:"
    printf '%s\n' "$out" | sed 's/^/       /'
    failures=$((failures + 1))
  fi
  rm -f "$T/api/"*
}

git init -q --initial-branch=main "$T/repo"
cd "$T/repo"
commit() { git add -A; git commit -q -m "$1"; git rev-parse HEAD; }
mkdir src
echo a >src/a.ts
echo readme >README.md
root=$(commit root)
echo b >src/a.ts
code1=$(commit code1)
echo more >>README.md
docs=$(commit docs)
echo c >src/b.ts
code2=$(commit code2)
mkdir notes
git mv src/b.ts notes/b.md
moved=$(commit moved)
cd "$T"

runs "$code1" "$(run 1 push completed success)"
check "passes on a green run for the commit" pass "$code1"

runs "$code1" "$(run 1 push completed failure)"
check "refuses a run that failed" refuse "$code1" "ended in failure"

runs "$code1" "$(run 1 push completed cancelled)"
check "refuses a run that was cancelled" refuse "$code1" "ended in cancelled"

runs "$code1" "$(run 1 push in_progress null)"
state 1 1 in_progress null
state 1 2 completed success
check "waits for a run still going, then passes" pass "$code1"

runs "$code1" "$(run 1 push queued null)"
state 1 1 completed failure
check "waits for a run still going, then refuses its failure" refuse "$code1" "ended in failure"

runs "$code1" "$(run 1 push completed success)"
check "passes a docs-only push over a green run" pass "$docs"

runs "$code1" "$(run 1 push completed failure)"
check "refuses a docs-only push over a failed run" refuse "$docs" "ended in failure"

runs "$code1" "$(run 1 push completed success)"
check "refuses code that no run tested" refuse "$code2" "src/b.ts"

runs "$code2" "$(run 2 push completed success)"
check "refuses code renamed to a .md file" refuse "$moved" "src/b.ts"

runs "$code1" "$(run 1 push completed success)"
printf '%s' '{"total_count": 2, "jobs": [{"name": "navigation-tests (chromium)", "conclusion": "success"}, {"name": "mobile-tests", "conclusion": "skipped"}]}' >"$T/api/jobs-1"
check "refuses a green run with a job skipped" refuse "$code1" "mobile-tests"

runs "$code1" "$(run 3 pull_request completed success)"
check "takes no pull request's run" refuse "$code1" "No browser-test run"

runs "$code1" "$(run 1 workflow_dispatch completed success)" "$(run 3 pull_request completed failure)"
check "takes a run started by hand" pass "$code1"

check "refuses when no run is found" refuse "$code1" "No browser-test run"

touch "$T/api/fail"
check "refuses when GitHub cannot be asked" refuse "$code1" "Could not ask GitHub"

# A git whose diff fails: the pipeline read that as "nothing changed" and
# passed the gate (security audit run 1, hardening).
mkdir -p "$T/badgit"
real_git=$(command -v git)
cat >"$T/badgit/git" <<STUB
#!/usr/bin/env bash
for arg in "\$@"; do [ "\$arg" = diff ] && { echo "fatal: bad object" >&2; exit 128; }; done
exec "$real_git" "\$@"
STUB
chmod +x "$T/badgit/git"
runs "$code1" "$(run 1 push completed success)"
FIRST_ON_PATH="$T/badgit:" check "refuses when the commits cannot be compared" refuse "$code1" "Could not compare"

[ -n "$root" ]
if [ "$failures" -gt 0 ]; then
  echo "$failures failed"
  exit 1
fi
echo "all passed"
