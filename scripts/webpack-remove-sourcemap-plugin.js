/**
 * Safe webpack plugin to remove specific sourceMappingURL comments
 * Only targets known problematic source maps that don't exist
 */

class RemoveProblematicSourceMapUrlsPlugin {
  constructor(options = {}) {
    this.problematicMaps = options.problematicMaps || [
      "lucide-react.js.map",
      "index.js.map",
      "@lucide/react.js.map",
    ];
  }

  apply(compiler) {
    compiler.hooks.compilation.tap(
      "RemoveProblematicSourceMapUrlsPlugin",
      (compilation) => {
        // Use the processAssets hook which runs after chunks are created
        compilation.hooks.processAssets.tap(
          {
            name: "RemoveProblematicSourceMapUrlsPlugin",
            // Run after optimization but before emitting
            stage:
              compilation.constructor.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER,
          },
          (assets) => {
            Object.keys(assets).forEach((assetName) => {
              // Only process JavaScript files
              if (!assetName.endsWith(".js")) return;

              try {
                const asset = assets[assetName];
                const source = asset.source();

                if (typeof source === "string") {
                  let modified = source;
                  let wasModified = false;

                  // Remove only specific problematic sourceMappingURL comments
                  this.problematicMaps.forEach((mapFile) => {
                    const regex = new RegExp(
                      `\\/\\/# sourceMappingURL=${mapFile.replace(".", "\\.")}\\s*$`,
                      "gm",
                    );

                    if (regex.test(modified)) {
                      modified = modified.replace(regex, "");
                      wasModified = true;
                    }
                  });

                  // Only update the asset if we made changes
                  if (wasModified) {
                    // Import webpack sources from the compiler
                    const { sources } = compiler.webpack;
                    assets[assetName] = new sources.RawSource(modified);
                  }
                }
              } catch (error) {
                console.warn(
                  `Warning: Could not process ${assetName}:`,
                  error.message,
                );
              }
            });
          },
        );
      },
    );
  }
}

module.exports = RemoveProblematicSourceMapUrlsPlugin;
