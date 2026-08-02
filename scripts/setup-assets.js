#!/usr/bin/env node

/**
 * Post-install asset vendoring.
 *
 * Copies runtime assets out of node_modules into public/ so they are served
 * same-origin. Same-origin matters for more than convenience: serving the
 * Pyodide runtime from a CDN would mean widening `connect-src` and handing a
 * third party code execution on this origin. Vendoring also lets the worker
 * delete fetch outright once it has booted, since nothing needs the network
 * afterward.
 *
 * Usage: node scripts/setup-assets.js   (runs automatically via postinstall)
 */

const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");

// Pyodide runtime files. pyodide.js (UMD) is included alongside pyodide.mjs so
// the worker can fall back to importScripts() if a module worker is a problem.
const PYODIDE_FILES = [
  "pyodide.mjs",
  "pyodide.js",
  "pyodide.asm.mjs",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json",
];

// Packages vendored beyond the standard library. Anything listed here is
// downloaded at install time and served locally; nothing is ever fetched from
// PyPI at runtime (micropip is blocked inside the sandbox).
const VENDORED_PACKAGES = ["numpy"];

const DOWNLOAD_RETRIES = 3;

function log(msg) {
  process.stdout.write(`[setup-assets] ${msg}\n`);
}

/** Copy a file only when the destination is missing or differs in size. */
async function copyIfChanged(src, dest) {
  const [srcStat, destStat] = await Promise.all([
    fsp.stat(src),
    fsp.stat(dest).catch(() => null),
  ]);
  if (destStat && destStat.size === srcStat.size) return false;
  await fsp.copyFile(src, dest);
  return true;
}

async function sha256(file) {
  const hash = crypto.createHash("sha256");
  hash.update(await fsp.readFile(file));
  return hash.digest("hex");
}

/**
 * Download with retries and checksum verification.
 *
 * The checksum is not decoration: this is the only step in the build that pulls
 * a binary over the network, and the file ends up executing inside visitors'
 * browsers. A mismatch fails loudly rather than shipping unknown bytes.
 */
async function downloadVerified(url, dest, expectedSha256) {
  for (let attempt = 1; attempt <= DOWNLOAD_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const actual = crypto.createHash("sha256").update(buf).digest("hex");
      if (expectedSha256 && actual !== expectedSha256) {
        throw new Error(
          `checksum mismatch (expected ${expectedSha256.slice(0, 12)}..., got ${actual.slice(0, 12)}...)`,
        );
      }
      await fsp.writeFile(dest, buf);
      return buf.length;
    } catch (err) {
      if (attempt === DOWNLOAD_RETRIES) throw err;
      const backoff = attempt * 1000;
      log(`  retry ${attempt}/${DOWNLOAD_RETRIES - 1} after ${err.message}`);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  return 0;
}

/**
 * PDF.js worker. Best-effort by design: react-pdf degrades to an inline
 * message when the worker is missing, and this has been optional since before
 * the Pyodide work.
 */
async function setupPdfWorker() {
  const src = path.join(
    ROOT,
    "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  );
  const dest = path.join(PUBLIC, "pdf.worker.min.mjs");
  try {
    await copyIfChanged(src, dest);
    log("pdf.worker.min.mjs ready");
  } catch (err) {
    log(`pdf.worker.min.mjs skipped (${err.message})`);
  }
}

/**
 * Pyodide runtime. NOT best-effort: a missing wasm blob is an 11 MB 404 that
 * nobody notices until a visitor types `python`, so a failure here fails the
 * install.
 */
async function setupPyodide() {
  const pkgDir = path.join(ROOT, "node_modules/pyodide");
  const destDir = path.join(PUBLIC, "pyodide");

  if (!fs.existsSync(pkgDir)) {
    throw new Error(
      "node_modules/pyodide is missing. Run `npm install` before this script.",
    );
  }

  const version = JSON.parse(
    await fsp.readFile(path.join(pkgDir, "package.json"), "utf8"),
  ).version;

  await fsp.mkdir(destDir, { recursive: true });

  let copied = 0;
  for (const name of PYODIDE_FILES) {
    const changed = await copyIfChanged(
      path.join(pkgDir, name),
      path.join(destDir, name),
    );
    if (changed) copied++;
  }
  log(
    `pyodide ${version}: ${PYODIDE_FILES.length} runtime files ready (${copied} updated)`,
  );

  // Record the version so the worker can assert the assets match the package
  // it was written against, and so `python --version` can answer without
  // booting an 11 MB runtime.
  await fsp.writeFile(
    path.join(destDir, "version.json"),
    `${JSON.stringify({ pyodide: version }, null, 2)}\n`,
  );

  await setupPyodidePackages(pkgDir, destDir, version);
}

/**
 * Wheels for the vendored packages. The npm package ships the interpreter but
 * no packages, so these come from the release CDN, pinned to the exact version
 * and verified against the sha256 already recorded in pyodide-lock.json.
 *
 * Best-effort: a missing wheel degrades to a clear "not available in this
 * deployment" message at import time rather than breaking the interpreter.
 */
async function setupPyodidePackages(pkgDir, destDir, version) {
  const lock = JSON.parse(
    await fsp.readFile(path.join(pkgDir, "pyodide-lock.json"), "utf8"),
  );

  // Resolve the transitive closure so a package with dependencies pulls them in.
  const wanted = new Set();
  const visit = (name) => {
    if (wanted.has(name)) return;
    const entry = lock.packages && lock.packages[name];
    if (!entry) {
      log(`  warning: ${name} is not in pyodide-lock.json, skipping`);
      return;
    }
    wanted.add(name);
    for (const dep of entry.depends || []) visit(dep);
  };
  for (const name of VENDORED_PACKAGES) visit(name);

  for (const name of wanted) {
    const entry = lock.packages[name];
    const dest = path.join(destDir, entry.file_name);

    if (fs.existsSync(dest) && (await sha256(dest)) === entry.sha256) {
      log(`  ${name} ${entry.version} already vendored`);
      continue;
    }

    const url = `https://cdn.jsdelivr.net/pyodide/v${version}/full/${entry.file_name}`;
    try {
      const bytes = await downloadVerified(url, dest, entry.sha256);
      log(
        `  ${name} ${entry.version} downloaded (${(bytes / 1048576).toFixed(1)} MB, checksum ok)`,
      );
    } catch (err) {
      log(`  warning: ${name} unavailable (${err.message})`);
      log(
        `  the terminal will report it as missing rather than failing to boot`,
      );
      await fsp.rm(dest, { force: true });
    }
  }
}

async function main() {
  await setupPdfWorker();
  await setupPyodide();
  log("done");
}

main().catch((err) => {
  process.stderr.write(`[setup-assets] failed: ${err.message}\n`);
  process.exit(1);
});
