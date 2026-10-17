#!/usr/bin/env node

/**
 * Simplified build-time script to create color mappings for images
 * This version creates a template that can be manually filled or uses predefined colors
 *
 * Usage: node scripts/extract-colors-simple.js
 * Output: src/lib/utils/precomputed-colors.json
 */

const fs = require("fs").promises;
const path = require("path");

// Configuration
const IMAGES_DIR = path.join(__dirname, "..", "public", "images");
const OUTPUT_FILE = path.join(
  __dirname,
  "..",
  "src",
  "lib",
  "utils",
  "precomputed-colors.json",
);
const SUPPORTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

// Predefined colors based on known company/institution branding, by file
// name without its extension: the site serves the .webp next to a .png or
// .jpg, and every format gets the same colour. (Keyed by full file name,
// this table named only the .png and .jpg files, so from the first commit
// every .webp the site loads got the default grey.)
const KNOWN_COLORS = {
  // Universities
  unine_logo: "rgb(0, 102, 255)", // University of Neuchâtel bright blue
  ucd_logo: "rgb(0, 39, 76)", // UCD Dublin blue
  unige_logo: "rgb(207, 35, 42)", // University of Geneva red

  // Companies
  artificialkind_logo: "rgb(26, 26, 94)", // ArtificialKind deep navy blue
  libacy_logo: "rgb(90, 191, 204)", // Libacy turquoise
  versicherix_logo: "rgb(16, 185, 129)", // Green
  manufactureclaret_logo: "rgb(211, 211, 211)", // Manufacture Claret light gray
  clarettech_logo: "rgb(64, 64, 64)", // Claret.Tech dark charcoal
  overclouds_logo: "rgb(59, 130, 246)", // Sky blue
  jvpl_logo: "rgb(239, 68, 68)", // Red

  // Schools
  he_arc_logo: "rgb(227, 6, 19)", // HE-Arc bright red
  hes_so_logo_master: "rgb(0, 121, 193)", // HES-SO blue

  // Papers/Publications
  paper_blockchain_2016: "rgb(245, 158, 11)", // Amber
  paper_geenns_2024: "rgb(139, 92, 246)", // Purple
  paper_visual_vestibular_2013: "rgb(59, 130, 246)", // Blue
  debs_2023: "rgb(139, 92, 246)", // Purple, as the GEENNS paper
  jax_es_hyperneat: "rgb(139, 92, 246)", // Purple, as the GEENNS paper

  // Conference logos
  gecco_2024_logo: "rgb(16, 185, 129)", // Green (evolutionary computing)
  "40th_annual_meeting_of_neuroscience_2010_logo": "rgb(147, 51, 234)", // Purple (neuroscience)

  // Upcoming 2026 conference logos
  icpr_2026_logo: "rgb(8, 56, 56)", // ICPR 2026 dark teal
  wcci_2026_logo: "rgb(8, 40, 88)", // IEEE WCCI 2026 navy
  alife_2026_logo: "rgb(168, 40, 24)", // ALIFE 2026 maple red
  ppsn_2026_logo: "rgb(17, 17, 17)", // PPSN 2026 black
  ppsn_2026_logo_white: "rgb(245, 245, 245)", // PPSN 2026 white variant
  gecco_2026_logo: "rgb(8, 40, 120)", // GECCO 2026 blue

  // Other assets
  contactMail: "rgb(107, 114, 128)", // Gray
};

/**
 * Process all images and create color mappings
 */
async function processImages() {
  console.log("🎨 Creating color mappings for images...\n");

  try {
    // Get all image files
    const files = await fs.readdir(IMAGES_DIR);
    const imageFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return SUPPORTED_EXTENSIONS.includes(ext);
    });

    console.log(`Found ${imageFiles.length} images to process\n`);

    const colorMap = {};
    let knownCount = 0;
    let defaultCount = 0;

    // Process each image
    for (const file of imageFiles) {
      const publicPath = `/images/${file}`;

      const known = KNOWN_COLORS[path.parse(file).name];

      if (known) {
        colorMap[publicPath] = known;
        knownCount++;
        console.log(`✓ ${file.padEnd(45)} → ${known}`);
      } else {
        // Use a default color based on file type
        const defaultColor = "rgb(107, 114, 128)"; // Default gray
        colorMap[publicPath] = defaultColor;
        defaultCount++;
        console.log(`⚠ ${file.padEnd(45)} → ${defaultColor} (default)`);
      }
    }

    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_FILE);
    await fs.mkdir(outputDir, { recursive: true });

    // Write the color map to file
    await fs.writeFile(
      OUTPUT_FILE,
      JSON.stringify(colorMap, null, 2) + "\n",
      "utf8",
    );

    console.log(`\n✅ Color mapping complete!`);
    console.log(`   - Known colors: ${knownCount} images`);
    console.log(`   - Default colors: ${defaultCount} images`);
    console.log(`   - Output: ${OUTPUT_FILE}\n`);

    if (defaultCount > 0) {
      console.log("⚠️  Note: Some images are using default colors.");
      console.log(
        "   You can manually update the colors in the generated file.\n",
      );
    }
  } catch (error) {
    console.error("❌ Error during color mapping:", error);
    process.exit(1);
  }
}

// Run the processing
processImages();
