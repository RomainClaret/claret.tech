#!/usr/bin/env node

/**
 * Applies the patches in patches/ to node_modules (postinstall).
 *
 * patches/patches.json names, for each patch, the package, the exact version
 * it was made for, its diff (a unified diff, as git or patch-package writes
 * one) and the SHA-256 of every file it touches, before and after. Nothing
 * is written unless the version and every file match: each hunk lands
 * exactly where the diff says, a tree already patched is left as it is, and
 * anything else fails the install with what to redo. patch-package, which
 * this replaces, tolerated lines moved by up to 20 and brought 14 packages
 * (two flagged by npm audit) to apply one diff.
 *
 * Usage: node scripts/apply-patches.mjs [--reverse] [root]
 *   root: where node_modules and patches/ are (default: this repository)
 *   --reverse: restores the original files (to redo a patch)
 */

import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const sha256 = (text) =>
  text === null ? null : createHash("sha256").update(text).digest("hex");

/**
 * The files of a unified diff, each with its hunks. A hunk's lines are
 * counted from its header, so a removed line that starts with "--" is not
 * taken for the next file's header.
 */
export function parseDiff(text) {
  const lines = text.split("\n");
  const files = [];
  let i = 0;
  while (i < lines.length) {
    if (!lines[i].startsWith("--- ")) {
      i++;
      continue;
    }
    if (!lines[i + 1]?.startsWith("+++ ")) {
      throw new Error(`diff line ${i + 1}: "---" without "+++"`);
    }
    const file = {
      from: lines[i].slice(4),
      to: lines[i + 1].slice(4),
      hunks: [],
    };
    files.push(file);
    i += 2;
    while (lines[i]?.startsWith("@@ ")) {
      const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(lines[i]);
      if (!m) throw new Error(`diff line ${i + 1}: bad hunk header`);
      const hunk = {
        oldStart: Number(m[1]),
        oldCount: m[2] === undefined ? 1 : Number(m[2]),
        newStart: Number(m[3]),
        newCount: m[4] === undefined ? 1 : Number(m[4]),
        lines: [],
      };
      i++;
      let old = 0;
      let added = 0;
      while (old < hunk.oldCount || added < hunk.newCount) {
        const line = lines[i];
        if (line === undefined || !/^[ +-]/.test(line)) {
          throw new Error(`diff line ${i + 1}: the hunk ends early`);
        }
        if (line[0] !== "+") old++;
        if (line[0] !== "-") added++;
        hunk.lines.push(line);
        i++;
      }
      if (lines[i]?.startsWith("\\")) {
        throw new Error(`diff line ${i + 1}: a file without a final newline`);
      }
      file.hunks.push(hunk);
    }
  }
  return files;
}

/**
 * A file's text with its hunks applied, or undone: null for no file. Every
 * line the diff keeps or removes must be where the diff says it is.
 */
export function applyFile(text, file, reverse = false) {
  if ((reverse ? file.to : file.from) === "/dev/null") {
    if (text !== null) throw new Error("the file the diff creates exists");
  }
  if ((reverse ? file.from : file.to) === "/dev/null") return null;
  const source = text === null ? [] : text.split("\n");
  const out = [];
  let at = 0;
  for (const hunk of file.hunks) {
    const [start, count] = reverse
      ? [hunk.newStart, hunk.newCount]
      : [hunk.oldStart, hunk.oldCount];
    const first = count === 0 ? start : start - 1;
    if (first < at) throw new Error("the diff's hunks overlap");
    out.push(...source.slice(at, first));
    at = first;
    for (const line of hunk.lines) {
      const kind = reverse
        ? { " ": " ", "-": "+", "+": "-" }[line[0]]
        : line[0];
      const body = line.slice(1);
      if (kind === "+") {
        out.push(body);
        continue;
      }
      if (source[at] !== body) {
        throw new Error(
          `line ${at + 1} is ${JSON.stringify(source[at])}, the diff expects ${JSON.stringify(body)}`,
        );
      }
      at++;
      if (kind === " ") out.push(body);
    }
  }
  out.push(...source.slice(at));
  // A created file ends with a newline, as the diff did not say otherwise.
  if (text === null) out.push("");
  return out.join("\n");
}

const stripPrefix = (path) => path.replace(/^[ab]\//, "");

/** Applies (or undoes) every patch under `root`; returns what it did. */
export function applyPatches(root, reverse = false) {
  const entries = JSON.parse(
    readFileSync(join(root, "patches/patches.json"), "utf8"),
  );
  const report = [];
  for (const entry of entries) {
    const name = `${entry.package}@${entry.version}`;
    const installed = JSON.parse(
      readFileSync(
        join(root, "node_modules", entry.package, "package.json"),
        "utf8",
      ),
    ).version;
    if (installed !== entry.version) {
      throw new Error(
        `${entry.package} ${installed} is installed, and patches/${entry.patch} is for ${entry.version}: redo the patch for ${installed}, or drop it (docs/TESTING_INFRASTRUCTURE.md)`,
      );
    }
    const files = parseDiff(
      readFileSync(join(root, "patches", entry.patch), "utf8"),
    );
    const listed = Object.keys(entry.files).sort();
    const paths = files
      .map((file) => stripPrefix(file.to === "/dev/null" ? file.from : file.to))
      .sort();
    if (JSON.stringify(listed) !== JSON.stringify(paths)) {
      throw new Error(`${name}: patches.json and the diff list other files`);
    }

    // Every file is checked before any is written.
    const writes = [];
    for (const file of files) {
      const path = stripPrefix(file.to === "/dev/null" ? file.from : file.to);
      const hashes = entry.files[path];
      const [from, to] = reverse
        ? [hashes.after, hashes.before]
        : [hashes.before, hashes.after];
      const full = join(root, path);
      const text = existsSync(full) ? readFileSync(full, "utf8") : null;
      const now = sha256(text);
      if (now === to) continue;
      if (now !== from) {
        throw new Error(
          `${path}: sha256 ${now ?? "(no file)"}, but ${name} has ${hashes.before ?? "(no file)"} unpatched and ${hashes.after ?? "(no file)"} patched: reinstall it (npm ci)`,
        );
      }
      const result = applyFile(text, file, reverse);
      if (sha256(result) !== to) {
        throw new Error(`${path}: the result differs from patches.json`);
      }
      // A new module goes first, before the files that import it, and a
      // module the diff deletes last, after the files that imported it.
      const order = text === null ? 0 : result === null ? 2 : 1;
      writes.push({ full, result, order });
    }
    writes.sort((a, b) => a.order - b.order);
    for (const { full, result } of writes) {
      if (result === null) {
        rmSync(full);
        continue;
      }
      writeFileSync(`${full}.tmp`, result);
      renameSync(`${full}.tmp`, full);
    }
    report.push(
      writes.length === 0
        ? `${name} already ${reverse ? "unpatched" : "patched"}`
        : `${name} ${reverse ? "unpatched" : "patched"} (${writes.length} files)`,
    );
  }
  return report;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const root =
    args.find((arg) => !arg.startsWith("--")) ??
    join(dirname(fileURLToPath(import.meta.url)), "..");
  try {
    for (const line of applyPatches(root, args.includes("--reverse"))) {
      console.log(`[apply-patches] ${line}`);
    }
  } catch (error) {
    console.error(`[apply-patches] ${error.message}`);
    process.exit(1);
  }
}
