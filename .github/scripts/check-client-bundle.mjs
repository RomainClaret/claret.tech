// Fails the build job when a client chunk ships a package the site removed
// from the browser on purpose (client-bundle-deny.json says which, and why).
//
// It reads each chunk's source map, which next.config.mjs has every build
// write (hidden, beside the chunk), and the npm packages its sources name.
// A build without maps fails too: the check would otherwise check nothing.
//
// usage (after next build): node .github/scripts/check-client-bundle.mjs [.next]
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const dist = process.argv[2] ?? ".next";
const chunks = join(dist, "static/chunks");
const denied = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "client-bundle-deny.json"),
    "utf8",
  ),
);

/** Every .js.map under a folder. */
function maps(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return maps(path);
    return entry.name.endsWith(".js.map") ? [path] : [];
  });
}

/** The package a source path is in: its last node_modules segment. */
function packageOf(source) {
  const parts = source.split("node_modules/");
  if (parts.length < 2) return null;
  const rest = parts.at(-1).split("/");
  return rest[0].startsWith("@") ? `${rest[0]}/${rest[1]}` : rest[0];
}

const found = maps(chunks);
if (found.length === 0) {
  console.error(
    `No source maps under ${chunks}: the check has nothing to read ` +
      "(productionBrowserSourceMaps in next.config.mjs).",
  );
  process.exit(1);
}

const problems = [];
for (const path of found) {
  const { sources = [] } = JSON.parse(readFileSync(path, "utf8"));
  const shipped = new Set(sources.map(packageOf).filter(Boolean));
  for (const name of Object.keys(denied)) {
    if (shipped.has(name)) {
      problems.push(
        `${relative(chunks, path).replace(/\.map$/, "")} ships ${name}: ${denied[name]}`,
      );
    }
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(
  `${found.length} client chunks, none with ${Object.keys(denied).join(", ")}`,
);
