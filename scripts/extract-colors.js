#!/usr/bin/env node

/**
 * Build-time script to extract dominant colors from all images
 * This pre-computes colors to avoid runtime extraction and improve performance
 *
 * Usage: node scripts/extract-colors.js
 * Output: src/lib/utils/precomputed-colors.json
 */

const fs = require("fs").promises;
const path = require("path");
const { createCanvas, loadImage } = require("canvas");

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

/**
 * Extract dominant color from an image using canvas
 * This is a simplified color extraction algorithm
 */
async function extractDominantColor(imagePath) {
  try {
    const image = await loadImage(imagePath);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");

    // Draw image to canvas
    ctx.drawImage(image, 0, 0);

    // Sample colors from different regions
    const sampleSize = 10;
    const samples = [];

    // Get samples from a grid across the image
    for (
      let x = 0;
      x < image.width;
      x += Math.floor(image.width / sampleSize)
    ) {
      for (
        let y = 0;
        y < image.height;
        y += Math.floor(image.height / sampleSize)
      ) {
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        if (pixel[3] > 0) {
          // Only consider non-transparent pixels
          samples.push({
            r: pixel[0],
            g: pixel[1],
            b: pixel[2],
          });
        }
      }
    }

    if (samples.length === 0) {
      return null;
    }

    // Calculate average color (simple dominant color algorithm)
    const avgColor = samples.reduce(
      (acc, color) => {
        acc.r += color.r;
        acc.g += color.g;
        acc.b += color.b;
        return acc;
      },
      { r: 0, g: 0, b: 0 },
    );

    avgColor.r = Math.round(avgColor.r / samples.length);
    avgColor.g = Math.round(avgColor.g / samples.length);
    avgColor.b = Math.round(avgColor.b / samples.length);

    // Boost saturation slightly for better visual impact
    const max = Math.max(avgColor.r, avgColor.g, avgColor.b);
    const min = Math.min(avgColor.r, avgColor.g, avgColor.b);
    const delta = max - min;

    if (delta > 0) {
      const saturationBoost = 1.2;
      const mid = (max + min) / 2;

      avgColor.r = Math.round(mid + (avgColor.r - mid) * saturationBoost);
      avgColor.g = Math.round(mid + (avgColor.g - mid) * saturationBoost);
      avgColor.b = Math.round(mid + (avgColor.b - mid) * saturationBoost);

      // Clamp values
      avgColor.r = Math.max(0, Math.min(255, avgColor.r));
      avgColor.g = Math.max(0, Math.min(255, avgColor.g));
      avgColor.b = Math.max(0, Math.min(255, avgColor.b));
    }

    return `rgb(${avgColor.r}, ${avgColor.g}, ${avgColor.b})`;
  } catch (error) {
    console.error(`Error extracting color from ${imagePath}:`, error.message);
    return null;
  }
}

/**
 * Process all images and extract colors
 */
async function processImages() {
  console.log("🎨 Starting color extraction from images...\n");

  try {
    // Get all image files
    const files = await fs.readdir(IMAGES_DIR);
    const imageFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return SUPPORTED_EXTENSIONS.includes(ext);
    });

    console.log(`Found ${imageFiles.length} images to process\n`);

    const colorMap = {};
    let processed = 0;
    let failed = 0;

    // Process each image
    for (const file of imageFiles) {
      const imagePath = path.join(IMAGES_DIR, file);
      const publicPath = `/images/${file}`;

      process.stdout.write(`Processing ${file}...`);

      const color = await extractDominantColor(imagePath);

      if (color) {
        colorMap[publicPath] = color;
        processed++;
        console.log(` ✓ ${color}`);
      } else {
        failed++;
        console.log(" ✗ Failed");
      }
    }

    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_FILE);
    await fs.mkdir(outputDir, { recursive: true });

    // Write the color map to file
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(colorMap, null, 2), "utf8");

    console.log(`\n✅ Color extraction complete!`);
    console.log(`   - Processed: ${processed} images`);
    console.log(`   - Failed: ${failed} images`);
    console.log(`   - Output: ${OUTPUT_FILE}\n`);

    // Display sample of extracted colors
    console.log("Sample of extracted colors:");
    Object.entries(colorMap)
      .slice(0, 5)
      .forEach(([path, color]) => {
        console.log(`   ${path.padEnd(30)} → ${color}`);
      });
  } catch (error) {
    console.error("❌ Error during color extraction:", error);
    process.exit(1);
  }
}

// Check if canvas package is available
try {
  require("canvas");
} catch (error) {
  console.error(
    '❌ Error: The "canvas" package is required for image processing.',
  );
  console.error("   Please install it with: npm install --save-dev canvas");
  console.error("\n   Note: This package requires system dependencies.");
  console.error(
    "   On macOS: brew install pkg-config cairo pango libpng jpeg giflib librsvg",
  );
  console.error(
    "   On Ubuntu: sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev",
  );
  process.exit(1);
}

// Run the extraction
processImages();
