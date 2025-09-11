#!/usr/bin/env node

/**
 * Generate favicon PNGs from the static grid SVG
 * Uses Sharp for high-quality SVG to PNG conversion
 */

const sharp = require("sharp");
const fs = require("fs").promises;
const path = require("path");

// Define all required favicon sizes
const FAVICON_SIZES = [
  // Core favicon sizes
  { size: 16, name: "favicon-16x16.png" },
  { size: 32, name: "favicon-32x32.png" },
  { size: 48, name: "favicon-48x48.png" },
  { size: 64, name: "favicon-64x64.png" },

  // Apple touch icons
  { size: 57, name: "apple-touch-icon-57x57.png" },
  { size: 60, name: "apple-touch-icon-60x60.png" },
  { size: 72, name: "apple-touch-icon-72x72.png" },
  { size: 76, name: "apple-touch-icon-76x76.png" },
  { size: 114, name: "apple-touch-icon-114x114.png" },
  { size: 120, name: "apple-touch-icon-120x120.png" },
  { size: 144, name: "apple-touch-icon-144x144.png" },
  { size: 152, name: "apple-touch-icon-152x152.png" },
  { size: 167, name: "apple-touch-icon-167x167.png" },
  { size: 180, name: "apple-touch-icon.png" },

  // Android/Chrome icons
  { size: 192, name: "android-chrome-192x192.png" },
  { size: 512, name: "android-chrome-512x512.png" },

  // Microsoft tile icons
  { size: 70, name: "mstile-70x70.png" },
  { size: 144, name: "mstile-144x144.png" },
  { size: 150, name: "mstile-150x150.png" },
  { size: 310, name: "mstile-310x310.png" },

  // Other common sizes
  { size: 128, name: "favicon-128x128.png" },
  { size: 196, name: "favicon-196x196.png" },
  { size: 228, name: "favicon-228x228.png" },
  { size: 256, name: "favicon-256x256.png" },
  { size: 384, name: "favicon-384x384.png" },
];

// Special rectangular size for Windows
const RECTANGULAR_SIZES = [
  { width: 310, height: 150, name: "mstile-310x150.png" },
];

async function generateFaviconPNG(svgPath, outputPath, size) {
  try {
    await sharp(svgPath)
      .resize(size, size, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
      })
      .png({
        quality: 100,
        compressionLevel: 9,
        adaptiveFiltering: true,
      })
      .toFile(outputPath);

    console.log(`✅ Generated: ${path.basename(outputPath)} (${size}x${size})`);
  } catch (error) {
    console.error(`❌ Failed to generate ${outputPath}:`, error.message);
  }
}

async function generateRectangularPNG(svgPath, outputPath, width, height) {
  try {
    await sharp(svgPath)
      .resize(width, height, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({
        quality: 100,
        compressionLevel: 9,
        adaptiveFiltering: true,
      })
      .toFile(outputPath);

    console.log(
      `✅ Generated: ${path.basename(outputPath)} (${width}x${height})`,
    );
  } catch (error) {
    console.error(`❌ Failed to generate ${outputPath}:`, error.message);
  }
}

async function createICOFromPNGs(pngPaths, icoPath) {
  try {
    // Use the 32x32 version as the base for ICO
    const png32Path = pngPaths.find((p) => p.includes("32x32"));
    if (!png32Path) {
      throw new Error("32x32 PNG not found for ICO creation");
    }

    // For now, we'll copy the 32x32 PNG as ICO
    // In a production environment, you might want to use a proper ICO creation library
    await fs.copyFile(png32Path, icoPath);
    console.log(`✅ Generated: ${path.basename(icoPath)} (using 32x32 base)`);
  } catch (error) {
    console.error(`❌ Failed to create ICO:`, error.message);
  }
}

async function generateAllFavicons() {
  console.log("🎨 Starting favicon generation from SVG...");

  const projectRoot = path.join(__dirname, "..");
  const svgPath = path.join(
    projectRoot,
    "public",
    "favicons",
    "favicon-grid.svg",
  );
  const outputDir = path.join(projectRoot, "public", "favicons");

  // Check if SVG exists
  try {
    await fs.access(svgPath);
  } catch (error) {
    console.error(`❌ SVG file not found: ${svgPath}`);
    return;
  }

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  console.log(`📁 Input SVG: ${svgPath}`);
  console.log(`📁 Output directory: ${outputDir}`);

  const generatedPaths = [];

  // Generate square favicon PNGs
  console.log("\n🔷 Generating square favicons...");
  for (const spec of FAVICON_SIZES) {
    const outputPath = path.join(outputDir, spec.name);
    await generateFaviconPNG(svgPath, outputPath, spec.size);
    generatedPaths.push(outputPath);
  }

  // Generate rectangular PNGs
  console.log("\n📐 Generating rectangular favicons...");
  for (const spec of RECTANGULAR_SIZES) {
    const outputPath = path.join(outputDir, spec.name);
    await generateRectangularPNG(svgPath, outputPath, spec.width, spec.height);
    generatedPaths.push(outputPath);
  }

  // Create ICO file
  console.log("\n🎯 Creating ICO file...");
  const icoPath = path.join(outputDir, "favicon.ico");
  await createICOFromPNGs(generatedPaths, icoPath);

  console.log("\n✨ Favicon generation complete!");
  console.log(`📊 Generated ${generatedPaths.length + 1} files total`);

  // Copy main files to public root
  console.log("\n📋 Copying main favicon files to public root...");
  const publicRoot = path.join(projectRoot, "public");

  const mainFiles = [
    { src: "favicon.ico", dest: "favicon.ico" },
    { src: "favicon-32x32.png", dest: "favicon.png" },
    { src: "favicon-32x32.png", dest: "favicon-light.png" },
    { src: "favicon-32x32.png", dest: "favicon-dark.png" },
    { src: "apple-touch-icon.png", dest: "apple-touch-icon.png" },
  ];

  for (const file of mainFiles) {
    const srcPath = path.join(outputDir, file.src);
    const destPath = path.join(publicRoot, file.dest);

    try {
      await fs.copyFile(srcPath, destPath);
      console.log(`✅ Copied: ${file.dest}`);
    } catch (error) {
      console.error(`❌ Failed to copy ${file.dest}:`, error.message);
    }
  }

  console.log("\n🎉 All favicon files generated and copied!");
  console.log("🔄 Clear your browser cache to see the new favicons.");
}

// Run the script
if (require.main === module) {
  generateAllFavicons().catch(console.error);
}

module.exports = { generateAllFavicons };
