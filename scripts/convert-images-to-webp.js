const sharp = require("sharp");
const fs = require("fs").promises;
const path = require("path");

async function convertImagesToWebP() {
  const imagesDir = path.join(__dirname, "../public/images");

  try {
    const files = await fs.readdir(imagesDir);
    const imageFiles = files.filter(
      (file) => file.endsWith(".jpg") || file.endsWith(".png"),
    );

    console.log(`🖼️  Converting ${imageFiles.length} images to WebP format...`);

    for (const file of imageFiles) {
      const inputPath = path.join(imagesDir, file);
      const outputPath = path.join(
        imagesDir,
        file.replace(/\.(jpg|png)$/, ".webp"),
      );

      try {
        // Get original file stats
        const stats = await fs.stat(inputPath);
        const originalSize = stats.size;

        // Convert to WebP with quality optimization
        await sharp(inputPath)
          .webp({
            quality: 85,
            effort: 6,
            lossless: file.includes("logo"), // Use lossless for logos
          })
          .toFile(outputPath);

        // Get new file stats
        const newStats = await fs.stat(outputPath);
        const newSize = newStats.size;
        const reduction = (
          ((originalSize - newSize) / originalSize) *
          100
        ).toFixed(1);

        console.log(
          `✓ ${file} → ${file.replace(/\.(jpg|png)$/, ".webp")} (${reduction}% smaller)`,
        );
      } catch (error) {
        console.error(`✗ Failed to convert ${file}:`, error.message);
      }
    }

    console.log("\n✅ Image conversion complete!");

    // Generate size report
    const report = [];
    for (const file of imageFiles) {
      const webpPath = path.join(
        imagesDir,
        file.replace(/\.(jpg|png)$/, ".webp"),
      );
      try {
        const originalStats = await fs.stat(path.join(imagesDir, file));
        const webpStats = await fs.stat(webpPath);
        report.push({
          original: file,
          originalSize: (originalStats.size / 1024).toFixed(1) + "KB",
          webpSize: (webpStats.size / 1024).toFixed(1) + "KB",
          reduction:
            (
              ((originalStats.size - webpStats.size) / originalStats.size) *
              100
            ).toFixed(1) + "%",
        });
      } catch (error) {
        // Skip if WebP doesn't exist
      }
    }

    // Sort by size reduction
    report.sort((a, b) => parseFloat(b.reduction) - parseFloat(a.reduction));

    console.log("\n📊 Conversion Report:");
    console.log("─".repeat(80));
    report.forEach((item) => {
      console.log(
        `${item.original.padEnd(40)} ${item.originalSize.padStart(10)} → ${item.webpSize.padStart(10)} (${item.reduction.padStart(6)} smaller)`,
      );
    });
  } catch (error) {
    console.error("Error converting images:", error);
  }
}

// Run the conversion
convertImagesToWebP();
