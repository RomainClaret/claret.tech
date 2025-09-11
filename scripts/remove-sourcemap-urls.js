#!/usr/bin/env node

/**
 * Post-processing script to remove sourceMappingURL comments from development builds
 * This prevents 404 errors for missing source map files from packages like lucide-react
 */

const fs = require("fs");
const path = require("path");

function removeSourceMapUrls(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dir, file.name);

    if (file.isDirectory()) {
      // Recursively process subdirectories
      removeSourceMapUrls(fullPath);
    } else if (file.name.endsWith(".js")) {
      // Process JavaScript files
      try {
        let content = fs.readFileSync(fullPath, "utf8");

        // Only remove specific problematic source map references
        // This is safer than removing all sourceMappingURL comments
        if (
          content.includes("sourceMappingURL=lucide-react.js.map") ||
          content.includes("sourceMappingURL=index.js.map")
        ) {
          const modified = content.replace(
            /\/\/# sourceMappingURL=(lucide-react\.js\.map|index\.js\.map)/g,
            "",
          );

          if (modified !== content) {
            fs.writeFileSync(fullPath, modified, "utf8");
            console.log(`✓ Removed source map URL from: ${file.name}`);
          }
        }
      } catch (error) {
        console.error(`Error processing ${fullPath}:`, error.message);
      }
    }
  }
}

// Main execution
const targetDir = path.join(__dirname, "..", ".next", "static");

if (fs.existsSync(targetDir)) {
  console.log(
    "Removing problematic sourceMappingURL comments from development build...",
  );
  removeSourceMapUrls(targetDir);
  console.log("Done!");
} else {
  console.log("Build directory not found. Run this script after building.");
}
