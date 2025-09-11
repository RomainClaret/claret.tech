#!/usr/bin/env node

// Build-time script to fetch publications from free academic APIs
// Usage: node scripts/fetch-publications.js

const fs = require("fs").promises;
const path = require("path");

// Load environment variables
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });

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

    const publications = [];

    // Add static publications first
    const staticPublications = [
      {
        id: "karmali2010perceptual",
        title:
          "Perceptual roll tilt thresholds demonstrate visual-vestibular fusion",
        authors: [
          "Faisal Karmali",
          "Koeun Lim",
          "Adil Adatia",
          "Romain Claret",
          "Keyvan Nicoucar",
          "Daniel M Merfeld",
        ],
        year: "2010",
        venue:
          "40th Annual meeting of Neuroscience, San Diego, CA, on November",
        citations: 2,
        abstract:
          "Prior studies show that visual motion perception is more precise than vestibular motion perception, but it is unclear whether this is universal or the result of specific experimental conditions. We compared visual and vestibular motion precision over a broad range of temporal frequencies by measuring thresholds for vestibular (subject motion in the dark), visual (visual scene motion) or visual-vestibular (subject motion in the light) stimuli.",
        shortDescription:
          "Investigating how the brain integrates visual and vestibular information for motion perception by comparing precision thresholds across sensory modalities.",
        pdfUrl:
          "/pdfs/poster_visual_vestibular_integration_in_sensory_recognition_thresholds_2010.pdf",
        openAccessUrl:
          "https://journals.physiology.org/doi/abs/10.1152/jn.00332.2013",
        paperUrl:
          "https://journals.physiology.org/doi/full/10.1152/jn.00332.2013",
        googleScholarCitationId: "4650031951635731568",
        source: "static",
      },
    ];

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
              // Add paper URL and shortDescription for GECCO
              let paperUrl = null;
              let shortDescription = null;

              if (paper.externalIds?.DOI === "10.1145/3638530.3664144") {
                paperUrl = "https://dl.acm.org/doi/10.1145/3638530.3664144";
                shortDescription =
                  "Achieved 29% MNIST accuracy with ES-HyperNEAT through systematic TPE optimization, beating previous 23.90% benchmark while proving transferability to Fashion-MNIST.";
              }

              publications.push({
                id: paper.paperId,
                title: paper.title,
                authors: paper.authors ? paper.authors.map((a) => a.name) : [],
                year: paper.year?.toString() || "Unknown",
                venue: paper.venue,
                citations: paper.citationCount,
                abstract: paper.abstract,
                shortDescription: shortDescription,
                doi: paper.externalIds?.DOI || null,
                arxivId: paper.externalIds?.ArXiv || null,
                pdfUrl: paper.openAccessPdf?.url,
                paperUrl: paperUrl,
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

    // Sort by year and citations
    publications.sort((a, b) => {
      const yearDiff = parseInt(b.year) - parseInt(a.year);
      if (yearDiff !== 0) return yearDiff;
      return (b.citations || 0) - (a.citations || 0);
    });

    // Save results
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
      totalCitations: publications.reduce(
        (sum, pub) => sum + (pub.citations || 0),
        0,
      ),
      publications,
    };

    await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
    console.log(
      `\n✅ Saved ${publications.length} publications to ${outputPath}`,
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
