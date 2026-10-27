#!/usr/bin/env bash
# Run a commit's browser tests as GitHub's runners would: built and served
# inside CI's Playwright image, on amd64, with 4 CPUs.
#
# act runs them in this image too, but on all of Docker's 16 CPUs, too fast
# for Linux WebKit's timing failures to show: each of GitHub's last five
# runs before 2026-10-22 had a WebKit test pass only on its retry, where
# four act rehearsals had none. Calibrated on d8da49f, whose GitHub run is
# known: WebKit is about 1.3 times slower here than on GitHub, and as flaky;
# Chromium 1.5 to 1.9 times at 4 CPUs and GitHub's speed at CPUS=8;
# Lighthouse scores about 20 points low at any CPUs
# (docs/TESTING_INFRASTRUCTURE.md, "GitHub's WebKit, before a push").
# Docker Desktop runs amd64 under Rosetta (Settings, General), and starts
# every node there with V8's optimizing compiler off (--no-opt, hidden from
# process.execArgv by a preload at /proc/.reset): the server and
# Playwright's runner run so, Chromium does not.
#
#   bash scripts/e2e-container.sh start <name> [commit]
#   bash scripts/e2e-container.sh run <name> <playwright test arguments>
#   bash scripts/e2e-container.sh stop <name>
#
# start copies the commit (HEAD by default; uncommitted changes stay out)
# from git, installs and builds it as playwright.yml does, and serves it on
# the container's port 3000. run hands its arguments to `npx playwright
# test` there, with CI's test environment, and keeps test-results/ after
# it, e.g.
#
#   bash scripts/e2e-container.sh run webkit-ci tests/e2e/terminal.spec.ts \
#     --project=webkit --retries=0 --repeat-each=10
#
# The container is this script's by a label: start and stop touch no other.
# start and run refuse while tests run in it (a second run clears the
# first's test-results/, and both timings are void). Ctrl-C stops the
# script, and in run the tests in the container too.
#
# Environment: IMAGE (default: the image playwright.yml runs), PLATFORM
# (linux/amd64; for another, start keeps that image's copy under a local
# tag, claret-e2e/...), CPUS (4, a GitHub runner's; empty for no limit),
# OUT (for start: where the logs, reports and test results go, mounted at
# /out; a new temporary folder by default), REPORT (for run: the JSON
# report's name in OUT, written with --reporter=line,json; report.json by
# default), LIGHTHOUSE_CPU_MULTIPLIER (for run: Lighthouse's CPU slowdown,
# to project CI's score; docs/TESTING_INFRASTRUCTURE.md, "Lighthouse before
# a push").
set -euo pipefail

# Ctrl-C reaches the docker client too, which then returns 0 while its
# command goes on in the container: without this trap, a start interrupted
# during npm ci went on to a build without `next` (2026-10-22).
trap 'echo "interrupted" >&2; exit 130' INT TERM

root=$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)
label=claret.e2e-container

usage() {
  cat >&2 <<'USAGE'
usage: bash scripts/e2e-container.sh start <name> [commit]
       bash scripts/e2e-container.sh run <name> <playwright test arguments>
       bash scripts/e2e-container.sh stop <name>
USAGE
  exit 2
}

ours() {
  [ "$(docker inspect -f "{{index .Config.Labels \"$label\"}}" "$1" 2>/dev/null)" = yes ]
}

# Tests running in the container: the runner, its workers and the browsers
# all have "playwright" in their command lines; the server and sleep do not.
running() {
  docker exec "$1" pgrep -f playwright >/dev/null 2>&1
}

# A busy host voids the timings: on 2026-10-22 research jobs took 12 of the
# Mac's 16 CPUs, and a pass that had failed once at GitHub's speed failed
# 21 times. Said, not refused: a run under load still finds what fails.
# Counted per process outside Docker's VM, and per container but this one:
# the load average counted this script's own runs too, so back-to-back runs
# warned about themselves. macOS only, the script's host.
warn_if_busy() {
  [ "$(uname)" = Darwin ] || return 0
  local cpus busy
  cpus=$(sysctl -n hw.ncpu)
  busy=$({
    ps -Ao pcpu=,comm= | awk '!/com\.apple\.Virtualization\.VirtualMachine/ {
      cpu = $1; sub(/^ *[0-9.]+ +/, ""); n = split($0, path, "/"); print cpu, path[n] }'
    docker stats --no-stream --format '{{.CPUPerc}} {{.Name}}' 2>/dev/null |
      tr -d % | awk -v self="$name" '$2 != self' || true
  } | awk -v cpus="$cpus" '
    { used += $1; if ($1 > top) { top = $1; $1 = ""; who = substr($0, 2) } }
    END { if (used > cpus * 50)
      printf "%.1f of %d CPUs in use, the most by %s at %.0f%%", used / 100, cpus, who, top }')
  [ -z "$busy" ] || echo "warning: the host is busy ($busy): timings here are not GitHub's" >&2
}

[ $# -ge 2 ] || usage
command=$1
name=$2

case $command in
start)
  commit=${3:-HEAD}
  sha=$(git -C "$root" rev-parse --verify --quiet "$commit^{commit}") ||
    { echo "no commit $commit" >&2; exit 1; }
  if docker inspect "$name" >/dev/null 2>&1; then
    ours "$name" || { echo "a container named $name exists, not this script's" >&2; exit 1; }
    if running "$name"; then
      echo "$name is running tests: wait for them, or stop it first" >&2
      exit 1
    fi
    docker rm -f "$name" >/dev/null
  fi
  warn_if_busy
  image=${IMAGE:-$(sed -n 's/^ *image: \(mcr\.microsoft\.com\/playwright:[^ ]*\).*/\1/p' \
    "$root/.github/workflows/playwright.yml" | head -1)}
  [ -n "$image" ] || { echo "no Playwright image in playwright.yml" >&2; exit 1; }
  platform=${PLATFORM:-linux/amd64}
  # This image store keeps one architecture per tag: an arm64 pull under the
  # shared tag would replace the amd64 image. Another platform gets the image
  # under a local tag of its own, made on first use.
  if [ -z "${IMAGE:-}" ] && [ "$platform" != linux/amd64 ]; then
    arch=${platform#*/}
    arch=${arch%%/*}
    # The name without its digest: a tag holds no "@".
    base=${image%@*}
    tag="claret-e2e/${base##*/}-$arch"
    if [ "$(docker image inspect -f '{{.Architecture}}' "$tag" 2>/dev/null)" != "$arch" ]; then
      echo "$name: making $tag, once per Playwright version"
      docker pull --quiet --platform "$platform" "$image" >/dev/null
      docker tag "$image" "$tag"
      docker pull --quiet --platform linux/amd64 "$image" >/dev/null
    fi
    image=$tag
  fi
  cpus=${CPUS-4}
  out=${OUT:-$(mktemp -d)}
  mkdir -p "$out"
  out=$(cd "$out" && pwd)
  echo "$name: ${sha:0:7} in $image ($platform, ${cpus:-all} CPUs), output in $out"
  docker run -d --name "$name" --label "$label=yes" --ipc=host --init \
    --platform "$platform" ${cpus:+--cpus "$cpus"} -v "$out:/out" "$image" \
    sleep infinity >/dev/null
  # Streamed, not written to OUT: each start left a 45 MB archive there.
  git -C "$root" archive --format=tar "$sha" |
    docker exec -i "$name" bash -c 'mkdir -p /work && tar -xf - -C /work' ||
    { echo "copying ${sha:0:7} into $name failed" >&2; exit 1; }
  docker exec "$name" bash -c '
    set -e
    cd /work
    node --version
    npm ci --no-audit --no-fund
  ' >"$out/install.log" 2>&1 || { echo "install failed: $out/install.log" >&2; exit 1; }
  # playwright.yml's build, without GitHub's token: USE_GITHUB_DATA is false
  # there, so nothing in it uses one.
  docker exec -e SERVE_HTTP=true -e NEXT_PUBLIC_SITE_URL=https://claret.tech \
    -e USE_GITHUB_DATA=false "$name" bash -c 'cd /work && npm run build' \
    >"$out/build.log" 2>&1 || { echo "build failed: $out/build.log" >&2; exit 1; }
  docker exec -d -e SKIP_EXTERNAL_APIS=true "$name" \
    bash -c 'cd /work && npm start >/out/server.log 2>&1'
  for _ in $(seq 1 90); do
    if docker exec "$name" curl -sf -o /dev/null http://localhost:3000/; then
      echo "$name: serving"
      exit 0
    fi
    sleep 2
  done
  echo "the server did not start: $out/server.log" >&2
  exit 1
  ;;
run)
  ours "$name" || { echo "no container $name from this script" >&2; exit 1; }
  if running "$name"; then
    echo "$name is running tests already: two runs at once void both timings" >&2
    exit 1
  fi
  warn_if_busy
  shift 2
  # Interrupted, the tests would go on in the container.
  trap 'docker exec "$name" pkill -f playwright >/dev/null 2>&1 || true
    echo "interrupted: the tests in $name were stopped" >&2; exit 130' INT TERM
  status=0
  docker exec -e CI=1 -e SKIP_EXTERNAL_APIS=true \
    -e PLAYWRIGHT_BASE_URL=http://localhost:3000 -e HOME=/root \
    -e PLAYWRIGHT_JSON_OUTPUT_FILE="/out/${REPORT:-report.json}" \
    -e LIGHTHOUSE_CPU_MULTIPLIER "$name" \
    bash -c 'cd /work && npx playwright test "$@"' bash "$@" || status=$?
  # Kept per run: the next run starts by clearing test-results/.
  stamp=$(date +%Y%m%d-%H%M%S)
  docker exec "$name" bash -c \
    "[ ! -d /work/test-results ] || cp -r /work/test-results /out/test-results-$stamp" ||
    echo "test-results/ was not copied out" >&2
  exit "$status"
  ;;
stop)
  ours "$name" || { echo "no container $name from this script" >&2; exit 1; }
  docker rm -f "$name" >/dev/null
  ;;
*)
  usage
  ;;
esac
