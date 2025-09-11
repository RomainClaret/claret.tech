const fs = require("fs").promises;
const path = require("path");

// Files that contain image references
const filesToUpdate = [
  "src/data/sections/experience.ts",
  "src/data/sections/education.ts",
  "src/data/sections/papers.ts",
  "src/components/sections/Contact.tsx",
];

async function updateImageReferences() {
  console.log("🔄 Updating image references to use WebP...\n");

  for (const filePath of filesToUpdate) {
    const fullPath = path.join(__dirname, "..", filePath);

    try {
      let content = await fs.readFile(fullPath, "utf8");
      const originalContent = content;

      // Replace .jpg and .png references with .webp
      // Only for local images (starting with /images/)
      content = content.replace(
        /\/images\/([^"']+)\.(jpg|png)/g,
        "/images/$1.webp",
      );

      if (content !== originalContent) {
        await fs.writeFile(fullPath, content);
        console.log(`✓ Updated ${filePath}`);

        // Count replacements
        const replacements =
          (content.match(/\.webp/g) || []).length -
          (originalContent.match(/\.webp/g) || []).length;
        console.log(`  → ${replacements} image references updated`);
      } else {
        console.log(`ℹ No changes needed for ${filePath}`);
      }
    } catch (error) {
      console.error(`✗ Error updating ${filePath}:`, error.message);
    }
  }

  console.log("\n✅ Image reference update complete!");
}

// Run the update
updateImageReferences();
