#!/usr/bin/env node

// Build-time script to fetch publications from free academic APIs
// Usage: node scripts/fetch-publications.js

const fs = require("fs").promises;
const path = require("path");

// Configurable map of abbreviated author names (as returned by academic APIs)
// to canonical full names. Shared with the runtime API route; edit
// src/lib/api/author-name-fixes.json to extend.
const AUTHOR_NAME_FIXES = require("../src/lib/api/author-name-fixes.json");

// Use built-in https module for compatibility
const https = require("https");

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        { headers: { "User-Agent": "claret.tech-portfolio/1.0" } },
        (res) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            if (res.statusCode === 200) {
              try {
                resolve({ ok: true, data: JSON.parse(data) });
              } catch (e) {
                reject(new Error(`Failed to parse JSON: ${e.message}`));
              }
            } else {
              console.error(`API returned status ${res.statusCode}`);
              console.error(`Response: ${logText(data)}`);
              resolve({ ok: false, status: res.statusCode, data });
            }
          });
        },
      )
      .on("error", reject);
  });
}

// Simple implementation without TypeScript compilation
/**
 * Third-party text for the job log, on one line: a line of it starting with
 * "::" was a workflow command to GitHub Actions.
 */
function logText(value) {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/::/g, ": :");
}

/** A fetched paper with only https links: its url fields come from an API. */
function httpsOnly(pub) {
  const out = { ...pub };
  for (const [key, value] of Object.entries(out)) {
    if (
      /url$/i.test(key) &&
      typeof value === "string" &&
      !/^https:\/\//i.test(value)
    ) {
      delete out[key];
    }
  }
  return out;
}

/**
 * The fetched papers merged with the saved file.
 *  - field level: for a paper the fetch returned that already existed, start
 *    from the existing entry and overlay only the fresh, non-empty fetched
 *    values. This keeps manually-curated fields the API omits or returns
 *    empty (e.g. openAccessUrl) while still refreshing citations, etc., and
 *    preserves the existing key order (so an unchanged run stays a no-op).
 *  - paper level: re-add any existing paper this run did not return at all
 *    (Semantic Scholar unauthenticated frequently rate-limits CI runners).
 * Ids match ids and titles match titles, in maps of their own: in one map a
 * fetched paper titled like a curated id merged onto that record and took
 * its PDFs and links.
 */
function mergeWithExisting(fetched, existing) {
  const publications = fetched.map(httpsOnly);
  if (!existing || !Array.isArray(existing.publications)) return publications;
  const key = (value) => (value || "").toString().toLowerCase().trim();
  const byId = new Map();
  const byTitle = new Map();
  for (const old of existing.publications) {
    if (old.id) byId.set(key(old.id), old);
    if (old.title) byTitle.set(key(old.title), old);
  }
  const matchOf = (pub) =>
    (pub.id && byId.get(key(pub.id))) ||
    (pub.title && byTitle.get(key(pub.title))) ||
    null;

  const matched = new Set();
  for (let i = 0; i < publications.length; i++) {
    const old = matchOf(publications[i]);
    if (!old) continue;
    matched.add(old);
    const merged = { ...old };
    for (const [k, v] of Object.entries(publications[i])) {
      if (v !== undefined && v !== null && v !== "") merged[k] = v;
    }
    publications[i] = merged;
  }
  for (const old of existing.publications) {
    if (!matched.has(old)) publications.push(old);
  }
  return publications;
}

/** Canonical author names; own entries of the map only. */
function fixAuthor(name) {
  return Object.hasOwn(AUTHOR_NAME_FIXES, name)
    ? AUTHOR_NAME_FIXES[name]
    : name;
}

async function fetchPublicationsSimple() {
  // The keys, for a local run; CI passes them in the environment.
  require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
  try {
    console.log("🔍 Fetching publications from academic sources...\n");

    const config = {
      semanticScholarId: process.env.SEMANTIC_SCHOLAR_AUTHOR_ID,
      orcidId: process.env.ORCID_ID,
      authorName: process.env.AUTHOR_NAME || "Romain Claret",
    };

    console.log("Configuration:");
    console.log(
      `- Semantic Scholar ID: ${config.semanticScholarId || "Not set"}`,
    );
    console.log(`- ORCID ID: ${config.orcidId || "Not set"}`);
    console.log(`- Author Name: ${config.authorName}`);
    console.log("");

    // Read the previously-saved file so we can MERGE (never drop papers when a
    // source is temporarily unavailable) and avoid rewriting an unchanged file.
    const outputPath = path.join(
      __dirname,
      "..",
      "public",
      "publications.json",
    );
    // Refuse to run without it rather than treating absence as a first run.
    // The file is tracked in git, so it going missing is a symptom, and
    // regenerating silently would drop any previously fetched publication
    // that is not in the static list and reset lastUpdated to now.
    let existing = null;
    try {
      existing = JSON.parse(await fs.readFile(outputPath, "utf-8"));
    } catch (error) {
      console.error(
        `\n❌ Could not read ${outputPath}\n` +
          `   ${error.message}\n\n` +
          `   This file is committed and is merged into on every run, so a\n` +
          `   missing or unparseable one means something is wrong. Restore it\n` +
          `   with: git checkout -- public/publications.json\n`,
      );
      process.exit(1);
    }

    const publications = [];

    // Add static publications first
    // The same file the app imports, rather than a copy. The copy that used
    // to live here had drifted: it was missing bibtex and shortDescription on
    // every entry, and only survived a run because the merge below restored
    // those from the existing JSON.
    const staticPublications = require("../src/lib/api/static-publications.json");
    // Their abstracts live in a file of their own, out of the homepage's
    // first JavaScript (src/lib/api/fetch-publications.ts).
    const abstracts = require("../src/lib/api/publication-abstracts.json");

    // Add static publications to the list
    staticPublications.forEach((pub) =>
      publications.push(
        abstracts[pub.id] ? { ...pub, abstract: abstracts[pub.id] } : pub,
      ),
    );

    // Fetch from Semantic Scholar
    if (config.semanticScholarId) {
      console.log("Fetching from Semantic Scholar...");
      try {
        const url = `https://api.semanticscholar.org/graph/v1/author/${config.semanticScholarId}/papers?fields=paperId,title,authors,year,venue,citationCount,abstract,externalIds,openAccessPdf,url&limit=100`;
        console.log(`API URL: ${url}`);

        const response = await httpsGet(url);

        if (response.ok) {
          const data = response.data;
          console.log(
            `API Response received. Data keys: ${Object.keys(data).join(", ")}`,
          );

          const papers = data.data || data.papers || [];
          console.log(`Found ${papers.length} papers in response`);

          papers.forEach((paper) => {
            // Skip if we already have this paper (by title comparison)
            const isDuplicate = publications.some(
              (existing) =>
                existing.title.toLowerCase() === paper.title.toLowerCase(),
            );

            if (!isDuplicate) {
              // Per-paper curation lives in staticPublications above; curated
              // papers are deduped by title so fetched copies are dropped.
              publications.push({
                id: paper.paperId,
                title: paper.title,
                authors: paper.authors ? paper.authors.map((a) => a.name) : [],
                year: paper.year?.toString() || "Unknown",
                venue: paper.venue,
                citations: paper.citationCount,
                abstract: paper.abstract,
                doi: paper.externalIds?.DOI || null,
                arxivId: paper.externalIds?.ArXiv || null,
                pdfUrl: paper.openAccessPdf?.url,
                openAccessUrl: "", // API doesn't provide this; manual/curated field
                semanticScholarUrl: paper.url,
                source: "semantic-scholar",
              });
            }
          });

          console.log(`✓ Found ${papers.length} papers from Semantic Scholar`);

          // Show first paper as example
          if (papers.length > 0) {
            console.log("\nFirst paper example:");
            console.log(`- Title: ${logText(papers[0].title)}`);
            console.log(`- Year: ${papers[0].year}`);
            console.log(`- Citations: ${papers[0].citationCount}`);
          }
        } else {
          console.error(
            `Failed to fetch from Semantic Scholar: Status ${response.status}`,
          );
        }
      } catch (error) {
        console.error("Error fetching from Semantic Scholar:", error.message);
        console.error("Full error:", error);
      }
    } else {
      console.log("⚠️  No Semantic Scholar ID configured");
    }

    // Merge with the previously-saved file (mergeWithExisting).
    const before = publications.length;
    const mergedPublications = mergeWithExisting(publications, existing);
    publications.length = 0;
    publications.push(...mergedPublications);
    const preserved = publications.length - before;
    if (preserved > 0) {
      console.log(
        `↻ Preserved ${preserved} existing publication(s) not returned this run (merge).`,
      );
    }

    // Normalize author names (academic APIs abbreviate; map -> canonical full
    // names, configured in src/lib/api/author-name-fixes.json). Runs after the merge
    // so it covers static, fetched, and preserved entries.
    for (const pub of publications) {
      if (Array.isArray(pub.authors)) {
        pub.authors = pub.authors.map(fixAuthor);
      }
    }

    // Starred first, then newest by year and month, then citations.
    // Mirror of comparePublications in src/lib/api/fetch-publications.ts.
    publications.sort((a, b) => {
      const starDiff = (b.starred ? 1 : 0) - (a.starred ? 1 : 0);
      if (starDiff !== 0) return starDiff;
      const yearDiff = parseInt(b.year) - parseInt(a.year);
      if (yearDiff !== 0) return yearDiff;
      const monthDiff = (b.month || 0) - (a.month || 0);
      if (monthDiff !== 0) return monthDiff;
      return (b.citations || 0) - (a.citations || 0);
    });

    // Save results. Only bump lastUpdated when the publication set actually
    // changed (id + citation-count signature), so a no-op weekly run does not
    // open a PR just to change a timestamp.
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    const signature = (pubs) =>
      (pubs || [])
        .map((p) => `${p.id || p.title}:${p.citations || 0}`)
        .sort()
        .join("|");
    const unchanged =
      existing && signature(existing.publications) === signature(publications);

    const output = {
      lastUpdated:
        unchanged && existing.lastUpdated
          ? existing.lastUpdated
          : new Date().toISOString(),
      count: publications.length,
      totalCitations: publications.reduce(
        (sum, pub) => sum + (pub.citations || 0),
        0,
      ),
      publications,
    };

    // Trailing newline so the output matches the prettier-formatted committed
    // file (otherwise every run shows a spurious newline-only diff -> noise PR).
    await fs.writeFile(outputPath, JSON.stringify(output, null, 2) + "\n");
    console.log(
      `\n✅ Saved ${publications.length} publications to ${outputPath}` +
        (unchanged ? " (no substantive change, timestamp preserved)" : ""),
    );
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// Run the simple version (no TypeScript compilation needed)
if (require.main === module) {
  fetchPublicationsSimple();
}

module.exports = { mergeWithExisting, logText };
