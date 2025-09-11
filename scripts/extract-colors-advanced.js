/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require("fs").promises;
const path = require("path");
const ColorThief = require("colorthief");
const sharp = require("sharp");

// Known brand colors for manual overrides
const BRAND_COLORS = {
  "/images/unine_logo.jpg": "rgb(0, 51, 102)", // UniNE blue
  "/images/ucd_logo.jpg": "rgb(0, 39, 76)", // UCD navy blue
  "/images/clarettech_logo.jpg": "rgb(139, 0, 0)", // Claret red
  "/images/manufactureclaret_logo.jpg": "rgb(139, 0, 0)", // Claret red
  "/images/he_arc_logo.png": "rgb(0, 158, 224)", // HE-Arc blue
  "/images/hes_so_logo_master.png": "rgb(220, 38, 38)", // HES-SO red
  "/images/unige_logo.jpg": "rgb(207, 35, 42)", // UniGE red
  "/images/harvardLogo.png": "rgb(165, 28, 48)", // Harvard crimson
  "/images/jvpl_logo.png": "rgb(165, 28, 48)", // Harvard Medical red
  "/images/versicherix_logo.png": "rgb(16, 185, 129)", // Versicherix green
  "/images/overclouds_logo.png": "rgb(59, 130, 246)", // Sky blue
  "/images/libacy_logo.png": "rgb(79, 70, 229)", // Indigo
  "/images/artificialkind_logo.jpg": "rgb(124, 58, 237)", // Purple
};

// Helper to convert RGB array to string
function rgbToString(rgb) {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

// Helper to calculate color distance
function colorDistance(c1, c2) {
  return Math.sqrt(
    Math.pow(c1[0] - c2[0], 2) +
      Math.pow(c1[1] - c2[1], 2) +
      Math.pow(c1[2] - c2[2], 2),
  );
}

// Helper to calculate luminance
function getLuminance(rgb) {
  return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
}

// Helper to calculate saturation
function getSaturation(rgb) {
  const max = Math.max(rgb[0], rgb[1], rgb[2]);
  const min = Math.min(rgb[0], rgb[1], rgb[2]);
  return max === 0 ? 0 : (max - min) / max;
}

// Filter out background colors (white, black, very light grays)
function isBackgroundColor(rgb) {
  const luminance = getLuminance(rgb);
  const saturation = getSaturation(rgb);

  // Very light colors (likely background)
  if (luminance > 0.9) return true;

  // Very dark colors (likely shadows)
  if (luminance < 0.1) return true;

  // Low saturation grays with high luminance
  if (saturation < 0.1 && luminance > 0.7) return true;

  return false;
}

// Extract the most prominent brand color
async function extractBrandColor(imagePath) {
  try {
    const colorThief = new ColorThief();

    // Get palette of colors
    const palette = await colorThief.getPalette(imagePath, 10);

    // Filter out background colors
    const brandColors = palette.filter((color) => !isBackgroundColor(color));

    if (brandColors.length === 0) {
      // If all colors are filtered out, return the most saturated color
      return palette.reduce((best, current) => {
        return getSaturation(current) > getSaturation(best) ? current : best;
      });
    }

    // Sort by saturation and luminance to get the most prominent brand color
    brandColors.sort((a, b) => {
      const satA = getSaturation(a);
      const satB = getSaturation(b);

      // Prefer more saturated colors
      if (Math.abs(satA - satB) > 0.1) {
        return satB - satA;
      }

      // For similar saturation, prefer medium luminance (not too dark, not too light)
      const lumA = Math.abs(getLuminance(a) - 0.5);
      const lumB = Math.abs(getLuminance(b) - 0.5);
      return lumA - lumB;
    });

    return brandColors[0];
  } catch (error) {
    console.error(`Error extracting color from ${imagePath}:`, error);
    return null;
  }
}

// Process image with sharp for better color extraction
async function processImageForColorExtraction(inputPath, outputPath) {
  try {
    await sharp(inputPath)
      .resize(200, 200, { fit: "inside" })
      .toFile(outputPath);
    return outputPath;
  } catch (error) {
    console.error(`Error processing image ${inputPath}:`, error);
    return inputPath;
  }
}

async function extractColors() {
  const publicDir = path.join(__dirname, "..", "public");
  const imagesDir = path.join(publicDir, "images");
  const outputPath = path.join(
    __dirname,
    "..",
    "src",
    "lib",
    "utils",
    "precomputed-colors.json",
  );

  const colorMap = {};

  try {
    const files = await fs.readdir(imagesDir);
    const imageFiles = files.filter(
      (file) =>
        /\.(jpg|jpeg|png|webp)$/i.test(file) && !file.includes("_processed"),
    );

    console.log(`Found ${imageFiles.length} image files to process`);

    for (const file of imageFiles) {
      const imagePath = `/images/${file}`;
      const fullPath = path.join(imagesDir, file);

      // Check for manual override first
      if (BRAND_COLORS[imagePath]) {
        colorMap[imagePath] = BRAND_COLORS[imagePath];
        console.log(
          `✓ ${file} - Using brand color: ${BRAND_COLORS[imagePath]}`,
        );
        continue;
      }

      try {
        // Process image for better color extraction
        const processedPath = path.join(
          imagesDir,
          `${path.parse(file).name}_processed.png`,
        );
        await processImageForColorExtraction(fullPath, processedPath);

        // Extract color
        const dominantColor = await extractBrandColor(processedPath);

        if (dominantColor) {
          const colorString = rgbToString(dominantColor);
          colorMap[imagePath] = colorString;
          console.log(`✓ ${file} - Extracted: ${colorString}`);
        } else {
          // Fallback color
          colorMap[imagePath] = "rgb(139, 92, 246)";
          console.log(`⚠ ${file} - Using fallback color`);
        }

        // Clean up processed image
        try {
          await fs.unlink(processedPath);
        } catch (e) {
          // Ignore cleanup errors
        }
      } catch (error) {
        console.error(`✗ ${file} - Error:`, error.message);
        colorMap[imagePath] = "rgb(139, 92, 246)"; // Fallback
      }
    }

    // Sort keys for consistent output
    const sortedColorMap = {};
    Object.keys(colorMap)
      .sort()
      .forEach((key) => {
        sortedColorMap[key] = colorMap[key];
      });

    // Write to file
    await fs.writeFile(outputPath, JSON.stringify(sortedColorMap, null, 2));

    console.log(`\n✅ Color extraction complete! Written to ${outputPath}`);
    console.log(`Processed ${Object.keys(colorMap).length} images`);
  } catch (error) {
    console.error("Error during color extraction:", error);
    process.exit(1);
  }
}

// Run the extraction
extractColors();
