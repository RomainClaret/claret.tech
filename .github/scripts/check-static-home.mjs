// Fails the build job when the homepage stops being a static file.
//
// / is generated once, at build time, and served from the edge cache.
// Anything that makes it depend on the request (cookies(), headers(),
// searchParams, a no-store fetch while rendering, a middleware or proxy) turns
// every page view back into a function call: 200-350 ms before the first
// byte on the live site, about a second when the function was cold.
//
// usage (after next build): node .github/scripts/check-static-home.mjs [.next]
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dist = process.argv[2] ?? ".next";
const read = (file) => JSON.parse(readFileSync(join(dist, file), "utf8"));

const problems = [];
const prerendered = read("prerender-manifest.json").routes ?? {};
if (!prerendered["/"]) {
  problems.push(
    "/ is not prerendered: something it renders reads the request " +
      "(cookies(), headers(), searchParams, a no-store fetch)",
  );
}
const middleware = Object.keys(
  read("server/middleware-manifest.json").middleware ?? {},
);
if (middleware.length) {
  problems.push(`a middleware runs on: ${middleware.join(", ")}`);
}
// A proxy.ts (Next 16's name for a middleware), or a middleware on the
// Node.js runtime, is recorded here instead: the manifest above stays empty.
const nodeMiddleware = read("server/functions-config-manifest.json")
  .functions?.["/_middleware"];
if (nodeMiddleware) {
  const paths = (nodeMiddleware.matchers ?? []).map(
    (matcher) => matcher.originalSource,
  );
  problems.push(
    `a proxy or Node.js middleware runs on: ${paths.join(", ") || "every path"}`,
  );
}

if (problems.length) {
  console.error(
    `The homepage is no longer a static file:\n- ${problems.join("\n- ")}`,
  );
  process.exit(1);
}
console.log("/ is prerendered, and no middleware or proxy runs.");
