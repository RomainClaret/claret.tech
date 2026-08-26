#!/usr/bin/env node

/**
 * Serve renamed PDFs at the names they used to have.
 *
 * The documents under public/pdfs were renamed into a consistent scheme, and
 * next.config.mjs redirects the old paths to the new ones. A redirect is enough
 * for a browser. It is not enough for every client: the server-side fetchers
 * inside document viewers, link previewers and crawlers are frequently old, and
 * some implement only 301/302/307. Those redirects are 301 for exactly that
 * reason, but a fetcher that ignores redirects altogether still gets nothing.
 *
 * So the URLs that are actually circulating get a real file instead. This
 * copies the canonical document to its old name at build time, which means the
 * old URL keeps serving the CURRENT document rather than a snapshot: the copy
 * is generated, so the two cannot drift the way two hand-maintained files
 * would.
 *
 * A path handled here must NOT also have a redirect in next.config.mjs.
 * Redirects are evaluated before filesystem routes - measured, not assumed:
 * with both in place the redirect answers and the copy is never served, which
 * defeats the point of having it. See the note in that file.
 *
 * Usage: node scripts/mirror-legacy-pdfs.js
 *        (runs automatically via postinstall and prebuild)
 */

const fs = require("fs");
const path = require("path");

const PDF_DIR = path.join(__dirname, "..", "public", "pdfs");

/**
 * Old name -> current document.
 *
 * Deliberately short. Mirroring all thirteen renamed files would add roughly
 * 20MB to a 30MB directory for documents with no known external links; these
 * are the ones whose old URL is known to be out in the world. Adding another is
 * one line here plus removing its redirect from next.config.mjs.
 */
const MIRRORS = [
  {
    legacy: "RomainClaret_CV.pdf",
    canonical: "CV_RomainClaret.pdf",
    // Linked from a Google Docs viewer URL, and the kind of link that ends up
    // in job applications and email signatures.
    why: "resume URL shared externally",
  },
];

function main() {
  const missing = MIRRORS.filter(
    (m) => !fs.existsSync(path.join(PDF_DIR, m.canonical)),
  );

  // Loudly, not quietly. A skipped copy leaves the old URL 404ing, which is the
  // single thing this script exists to prevent, and a warning in a build log
  // nobody reads is indistinguishable from success.
  if (missing.length > 0) {
    console.error("mirror-legacy-pdfs: canonical file(s) not found:");
    for (const m of missing) {
      console.error(`  ${m.canonical}  (needed for /pdfs/${m.legacy})`);
    }
    console.error(
      "\nWas one of them renamed again? Update MIRRORS in this script to match.",
    );
    process.exit(1);
  }

  for (const { legacy, canonical } of MIRRORS) {
    const from = path.join(PDF_DIR, canonical);
    const to = path.join(PDF_DIR, legacy);

    // Skip an identical copy so repeated runs do not rewrite the file and churn
    // its mtime; this runs on every install and every build.
    if (
      fs.existsSync(to) &&
      fs.readFileSync(to).equals(fs.readFileSync(from))
    ) {
      console.log(`mirror-legacy-pdfs: ${legacy} already current`);
      continue;
    }

    fs.copyFileSync(from, to);
    console.log(`mirror-legacy-pdfs: ${legacy} <- ${canonical}`);
  }
}

main();
