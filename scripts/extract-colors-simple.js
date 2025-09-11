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

// Predefined colors based on known company/institution branding
const KNOWN_COLORS = {
  // Universities
  "unine_logo.jpg": "rgb(0, 102, 255)", // University of Neuchâtel bright blue
  "ucd_logo.jpg": "rgb(0, 39, 76)", // UCD Dublin blue
  "unige_logo.jpg": "rgb(207, 35, 42)", // University of Geneva red
  "harvardLogo.png": "rgb(165, 28, 48)", // Harvard crimson

  // Companies
  "artificialkind_logo.jpg": "rgb(26, 26, 94)", // ArtificialKind deep navy blue
  "artificialkind_logo.png": "rgb(26, 26, 94)",
  "libacy_logo.png": "rgb(90, 191, 204)", // Libacy turquoise
  "versicherix_logo.png": "rgb(16, 185, 129)", // Green
  "manufactureclaret_logo.jpg": "rgb(211, 211, 211)", // Manufacture Claret light gray
  "clarettech_logo.jpg": "rgb(64, 64, 64)", // Claret.Tech dark charcoal
  "overclouds_logo.png": "rgb(59, 130, 246)", // Sky blue
  "jvpl_logo.png": "rgb(239, 68, 68)", // Red

  // Schools
  "he_arc_logo.png": "rgb(227, 6, 19)", // HE-Arc bright red
  "he_arc_logo_ing.jpg": "rgb(227, 6, 19)", // HE-Arc bright red
  "hes_so_logo_master.png": "rgb(0, 121, 193)", // HES-SO blue

  // Papers/Publications
  "paper_blockchain_2016.png": "rgb(245, 158, 11)", // Amber
  "paper_geenns_2024.png": "rgb(139, 92, 246)", // Purple
  "paper_graphqa_2020.png": "rgb(34, 197, 94)", // Green
  "paper_graphqa_schema_2020.png": "rgb(34, 197, 94)", // Green
  "paper_visual_vestibular_2013.png": "rgb(59, 130, 246)", // Blue

  // Conference logos
  "gecco_2024_logo.jpg": "rgb(16, 185, 129)", // Green (evolutionary computing)
  "gecco_2024_logo.png": "rgb(16, 185, 129)",
  "40th_annual_meeting_of_neuroscience_2010_logo.jpg": "rgb(147, 51, 234)", // Purple (neuroscience)
  "40th_annual_meeting_of_neuroscience_2010_logo.png": "rgb(147, 51, 234)",

  // Other assets
  "contactMail.webp": "rgb(107, 114, 128)", // Gray
  "contactMailDark.svg": "rgb(107, 114, 128)", // Gray
  "developerActivity.svg": "rgb(59, 130, 246)", // Blue
  "manOnTable.svg": "rgb(107, 114, 128)", // Gray
  "programmer.svg": "rgb(139, 92, 246)", // Purple
  "skill.svg": "rgb(34, 197, 94)", // Green
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

      if (KNOWN_COLORS[file]) {
        colorMap[publicPath] = KNOWN_COLORS[file];
        knownCount++;
        console.log(`✓ ${file.padEnd(45)} → ${KNOWN_COLORS[file]}`);
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
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(colorMap, null, 2), "utf8");

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
