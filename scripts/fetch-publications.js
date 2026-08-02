#!/usr/bin/env node

// Build-time script to fetch publications from free academic APIs
// Usage: node scripts/fetch-publications.js

const fs = require("fs").promises;
const path = require("path");

// Load environment variables
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });

// Configurable map of abbreviated author names (as returned by academic APIs)
// to canonical full names. Shared with the runtime API route; edit
// src/lib/api/author-name-fixes.json to extend.
const AUTHOR_NAME_FIXES = require("../src/lib/api/author-name-fixes.json");

// Import the fetch function (we'll compile TypeScript first)
async function fetchPublications() {
  try {
    console.log("🔍 Fetching publications from academic sources...\n");

    // Configuration from environment
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

    // We need to use dynamic import for TypeScript modules
    const { fetchAllPublications } = await import(
      "../.next/server/chunks/fetch-publications.js"
    ).catch(() => {
      console.error(
        "❌ Error: Could not load fetch-publications module.",
        "Make sure to run 'npm run build' first.",
      );
      process.exit(1);
    });

    // Fetch from all sources
    const publications = await fetchAllPublications(config);

    console.log(`\n✅ Found ${publications.length} total publications`);

    // Group by source for stats
    const bySource = publications.reduce((acc, pub) => {
      acc[pub.source] = (acc[pub.source] || 0) + 1;
      return acc;
    }, {});

    console.log("\nBy source:");
    Object.entries(bySource).forEach(([source, count]) => {
      console.log(`  - ${source}: ${count}`);
    });

    // Calculate total citations
    const totalCitations = publications.reduce(
      (sum, pub) => sum + (pub.citations || 0),
      0,
    );
    console.log(`\nTotal citations: ${totalCitations}`);

    // Save to JSON file
    const outputPath = path.join(
      __dirname,
      "..",
      "public",
      "publications.json",
    );
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    const output = {
      lastUpdated: new Date().toISOString(),
      count: publications.length,
      totalCitations,
      publications,
    };

    await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
    console.log(`\n📄 Saved to: ${outputPath}`);

    // Also save a backup with timestamp
    const backupPath = path.join(
      __dirname,
      "..",
      "public",
      `publications-${new Date().toISOString().split("T")[0]}.json`,
    );
    await fs.writeFile(backupPath, JSON.stringify(output, null, 2));
    console.log(`📄 Backup saved to: ${backupPath}`);

    // Generate BibTeX export
    const { exportToBibTeX } = await import(
      "../.next/server/chunks/fetch-publications.js"
    );
    const bibtex = exportToBibTeX(publications);
    const bibtexPath = path.join(__dirname, "..", "public", "publications.bib");
    await fs.writeFile(bibtexPath, bibtex);
    console.log(`📄 BibTeX saved to: ${bibtexPath}`);

    console.log("\n✨ Publications fetch completed successfully!");
  } catch (error) {
    console.error("❌ Error fetching publications:", error);
    process.exit(1);
  }
}

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
              console.error(`Response: ${data}`);
              resolve({ ok: false, status: res.statusCode, data });
            }
          });
        },
      )
      .on("error", reject);
  });
}

// Simple implementation without TypeScript compilation
async function fetchPublicationsSimple() {
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

    // Add static publications to the list
    staticPublications.forEach((pub) => publications.push(pub));

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
            console.log(`- Title: ${papers[0].title}`);
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

    // Merge with the previously-saved file:
    //  - field level: for a paper the fetch returned that already existed, start
    //    from the existing entry and overlay only the fresh, non-empty fetched
    //    values. This keeps manually-curated fields the API omits or returns
    //    empty (e.g. openAccessUrl) while still refreshing citations, etc., and
    //    preserves the existing key order (so an unchanged run stays a no-op).
    //  - paper level: re-add any existing paper this run did not return at all
    //    (Semantic Scholar unauthenticated frequently rate-limits CI runners).
    if (existing && Array.isArray(existing.publications)) {
      const idKey = (p) =>
        (p.id || p.title || "").toString().toLowerCase().trim();
      const titleKey = (p) => (p.title || "").toString().toLowerCase().trim();

      const existingByKey = new Map();
      for (const old of existing.publications) {
        existingByKey.set(idKey(old), old);
        existingByKey.set(titleKey(old), old);
      }

      // Field-level merge onto matched papers.
      for (let i = 0; i < publications.length; i++) {
        const pub = publications[i];
        const old =
          existingByKey.get(idKey(pub)) || existingByKey.get(titleKey(pub));
        if (!old) continue;
        const merged = { ...old };
        for (const [k, v] of Object.entries(pub)) {
          if (v !== undefined && v !== null && v !== "") merged[k] = v;
        }
        publications[i] = merged;
      }

      // Paper-level: preserve existing papers not returned this run.
      const haveIds = new Set(publications.map(idKey));
      const haveTitles = new Set(publications.map(titleKey));
      let preserved = 0;
      for (const old of existing.publications) {
        if (haveIds.has(idKey(old)) || haveTitles.has(titleKey(old))) continue;
        publications.push(old);
        haveIds.add(idKey(old));
        haveTitles.add(titleKey(old));
        preserved++;
      }
      if (preserved > 0) {
        console.log(
          `↻ Preserved ${preserved} existing publication(s) not returned this run (merge).`,
        );
      }
    }

    // Normalize author names (academic APIs abbreviate; map -> canonical full
    // names, configured in src/lib/api/author-name-fixes.json). Runs after the merge
    // so it covers static, fetched, and preserved entries.
    for (const pub of publications) {
      if (Array.isArray(pub.authors)) {
        pub.authors = pub.authors.map((a) => AUTHOR_NAME_FIXES[a] || a);
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
