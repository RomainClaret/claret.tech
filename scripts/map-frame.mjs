#!/usr/bin/env node
/**
 * Maps a frame from a client error report to its source.
 *
 *   node scripts/map-frame.mjs "/_next/static/chunks/app/page-<hash>.js:1:2345"
 *   node scripts/map-frame.mjs "<frame>" https://<deployment>.vercel.app
 *   node scripts/map-frame.mjs "<frame>" .next
 *
 * Every build publishes its chunks' maps beside them, at <chunk>.map
 * (next.config.mjs). The map comes from https://claret.tech by default,
 * which serves the current deployment. For a report from an older build
 * (its issue names the build), pass that deployment's URL, or a .next
 * folder built from the reported commit.
 *
 * Older deployments are behind Vercel's protection, which answers with a
 * redirect to a login page. Set VERCEL_AUTOMATION_BYPASS_SECRET (the
 * project's Protection Bypass for Automation) to pass it, or use .next.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { SourceMapConsumer } from "source-map-js";

const FRAME = /^(\/_next\/static\/chunks\/[\w./%-]+\.js):(\d+):(\d+)$/;

const [frame, from = "https://claret.tech"] = process.argv.slice(2);
const match = FRAME.exec(frame ?? "");
if (!match) {
  process.stderr.write(
    'usage: node scripts/map-frame.mjs "/_next/static/chunks/<chunk>.js:<line>:<column>" [origin or .next folder]\n',
  );
  process.exit(2);
}
const [, chunk, line, column] = match;
const mapPath = `${chunk}.map`;

let raw;
if (/^https?:\/\//.test(from)) {
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const response = await fetch(new URL(mapPath, from), {
    redirect: "manual",
    headers: bypass ? { "x-vercel-protection-bypass": bypass } : {},
  });
  if (response.status >= 300 && response.status < 400) {
    process.stderr.write(
      `${from} is protected (${response.status}): set VERCEL_AUTOMATION_BYPASS_SECRET, or pass a .next folder built from that commit\n`,
    );
    process.exit(1);
  }
  if (!response.ok) {
    process.stderr.write(
      `${response.status} for ${mapPath} at ${from}: that build is not deployed there\n`,
    );
    process.exit(1);
  }
  raw = await response.text();
} else {
  raw = await readFile(
    path.join(from, decodeURIComponent(mapPath.replace(/^\/_next\//, ""))),
    "utf8",
  );
}

// A stack's columns count from 1, a source map's from 0.
const original = new SourceMapConsumer(JSON.parse(raw)).originalPositionFor({
  line: Number(line),
  column: Number(column) - 1,
});
process.stdout.write(
  original.source
    ? `${original.source}:${original.line}:${original.column + 1}${original.name ? ` (${original.name})` : ""}\n`
    : "no mapping at that position\n",
);
