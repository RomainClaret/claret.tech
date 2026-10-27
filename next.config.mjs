// @ts-check
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import bundleAnalyzer from "@next/bundle-analyzer";
import RemoveProblematicSourceMapUrlsPlugin from "./scripts/webpack-remove-sourcemap-plugin.js";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Inlined at build time. The homepage is generated once, when the site is
  // built, and must hydrate with the same text: the footer shows this year
  // first and corrects it once the page runs. BUILD_DATE is the footer's
  // "Updated": the built commit's day (the build day where git is missing,
  // as in a git archive), so it says what is deployed.
  env: {
    BUILD_YEAR: String(new Date().getFullYear()),
    BUILD_DATE: (() => {
      const today = new Date().toISOString().slice(0, 10);
      try {
        const committed = execSync("git log -1 --format=%cs", {
          stdio: ["ignore", "pipe", "ignore"],
        })
          .toString()
          .trim();
        return committed || today;
      } catch {
        return today;
      }
    })(),
    // The built commit, which error reports name (src/lib/client-error):
    // the page's build and the server's can differ after a deploy. Vercel's
    // VERCEL_GIT_COMMIT_SHA cannot say: the site deploys prebuilt from the
    // CLI, with Vercel's Git integration off. A git archive has neither.
    BUILD_COMMIT: (() => {
      try {
        const head = execSync("git rev-parse HEAD", {
          stdio: ["ignore", "pipe", "ignore"],
        })
          .toString()
          .trim();
        if (/^[0-9a-f]{40}$/.test(head)) return head.slice(0, 7);
      } catch {
        // No git: CI still names the commit.
      }
      const fromCi = process.env.GITHUB_SHA ?? "";
      return /^[0-9a-f]{40}$/.test(fromCi) ? fromCi.slice(0, 7) : "unknown";
    })(),
  },

  // Published: a client error report names a frame in a minified chunk
  // (src/lib/client-error), and the chunk's map, at <chunk>.map, turns it
  // into a file and a line (scripts/map-frame.mjs). The repository is
  // public, so a map reveals nothing new. Hidden (the webpack hook below):
  // the chunks carry no comment pointing at their maps, which cost 647 B
  // gzipped on every homepage view for devtools' sake alone.
  productionBrowserSourceMaps: true,

  // Image optimization
  images: {
    // A month. On Vercel's Hobby plan the optimizer has 5,000 transformations
    // a month, and each cache miss or stale refresh is one: at a day, every
    // remote image cost one a day it was seen. Local /images get a year from
    // their headers below.
    minimumCacheTTL: 2678400,
    // No remote image. With Medium, Unsplash, jsDelivr and any GitHub avatar
    // open, anyone could spend the month's transformations, after which
    // every image not yet cached failed until the month ended; even the
    // avatar alone left the query, fragment and userinfo of its URL open, a
    // new transformation per spelling. The blog's pictures have their own
    // route (src/app/api/blog-image), and the avatar is a local file.
    remotePatterns: [],
    // Local images from /images only, with no query: Next's default, every
    // local path, made the optimizer fetch PDFs and API routes before
    // refusing them.
    localPatterns: [{ pathname: "/images/**", search: "" }],
    formats: ["image/avif", "image/webp"],
  },

  // Performance optimizations
  compress: true,
  poweredByHeader: false,

  // Hosts besides localhost that may open the dev server, such as the Mac's
  // Tailscale address for a phone: DEV_ALLOWED_ORIGINS, hostnames separated
  // by commas, with no scheme or port (100.101.102.103,my-mac.example.ts.net).
  // Next 16 refuses its dev resources to other hosts, and a page opened from
  // one never hydrated: its live-update connection (/_next/hmr) was refused,
  // and its buttons, data and terminal stayed dead (2026-10-26). Dev only.
  allowedDevOrigins: (process.env.DEV_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean),

  // Enable experimental features for better performance
  experimental: {
    // Next 16 mounts an MCP endpoint, /_next/mcp, in dev by default, behind
    // a cross-site guard that never checks the Host header. Nothing here uses
    // it.
    mcpServer: false,
    // optimizeCss: true, // Disabled due to critters dependency issue
    // optimizePackageImports(lucide-react/framer-motion) was tried 2026-07-19
    // and REVERTED: its __barrel_optimize__ proxy modules broke lazy chunks
    // in webpack dev (pdf-modal crashed the page with "Cannot read
    // properties of undefined (reading 'call')"). The real lucide win is the
    // explicit icon map in skills-neural-cloud instead of a namespace import.
  },

  // Custom webpack config for WebLLM support and optimizations
  webpack: (config, { isServer, dev }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      // lottie-react imports the full lottie-web player, which carries the
      // canvas and HTML renderers and the expression engine. The splash only
      // uses the SVG renderer without expressions, which is what the light
      // build is: 137 KB smaller raw, and the splash frames render byte for
      // byte the same (12 sampled frames of both animations at DPR 2).
      // `$` makes the alias exact, so the light build's own path still
      // resolves normally. lottie-web is a direct dependency so the target
      // resolves from the project root: reached only through lottie-react,
      // it did so only while npm happened to hoist it.
      "lottie-web$": "lottie-web/build/player/lottie_light.js",
      // The PDF reader runs pdf.js's legacy build. The default build calls
      // URL.parse and Promise.withResolvers without a polyfill, which
      // Chrome and Edge 111 to 125 and Safari 16.4 to 17.x lack, all in the
      // browserslist: there the reader's page fell to the error page. The
      // legacy build targets Chrome 110, Firefox ESR and Safari 16.4 (+19
      // KB gzipped, loaded only with the reader); scripts/setup-assets.js
      // copies its worker. react-pdf imports the bare package everywhere.
      // The minified file: the plain one declares an unused
      // `var __webpack_exports__` that webpack before 5.103 leaves named so,
      // and inside next dev's eval source maps it hides the module's own
      // exports, so the reader's chunk failed to load in dev, never in a
      // build (pdf.js 5.4; webpack/webpack#20097, vercel/next.js#89177).
      "pdfjs-dist$": "pdfjs-dist/legacy/build/pdf.min.mjs",
    };

    // Configure to prevent source map 404 errors
    if (!isServer && dev) {
      // Use our custom plugin to remove problematic sourceMappingURL comments
      // This specifically targets known missing source maps like lucide-react.js.map
      config.plugins.push(
        new RemoveProblematicSourceMapUrlsPlugin({
          problematicMaps: [
            "lucide-react.js.map",
            "index.js.map",
            "@lucide/react.js.map",
          ],
        }),
      );

      // Note: The lucide-react package includes sourceMappingURL comments
      // but doesn't ship the actual .map files, causing 404 errors.
      // Our plugin removes these specific references while preserving other source maps.
    }

    // The maps without the sourceMappingURL comment in every chunk; see
    // productionBrowserSourceMaps above.
    if (!isServer && !dev) {
      config.devtool = "hidden-source-map";
    }

    // Optimize bundle size (only in production)
    if (!isServer && !dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: "all",
          cacheGroups: {
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
            },
            vendors: {
              test: /[\\/]node_modules[\\/]/,
              priority: -10,
              reuseExistingChunk: true,
            },
            // WebLLM chunk
            webllm: {
              name: "webllm",
              chunks: "async",
              test: /[\\/]node_modules[\\/]@mlc-ai[\\/]/,
              priority: 30,
              reuseExistingChunk: true,
            },
            // Terminal chunk
            terminal: {
              name: "terminal",
              chunks: "async",
              test: /[\\/]node_modules[\\/]@xterm[\\/]/,
              priority: 25,
              reuseExistingChunk: true,
            },
            // PDF.js chunk
            pdfjs: {
              name: "pdfjs",
              chunks: "async",
              test: /[\\/]node_modules[\\/](react-pdf|pdfjs-dist)[\\/]/,
              priority: 20,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }

    // Next keys its webpack cache on its own version and on this file. The
    // browser targets (package.json's browserslist) and the PostCSS config
    // shape the CSS too, and cached stylesheets from node_modules (xterm's,
    // pdf.js's) kept an older target list's output after the list changed.
    // Either file changing now rebuilds the cache.
    if (config.cache?.buildDependencies) {
      config.cache.buildDependencies.config = [
        ...(config.cache.buildDependencies.config ?? []),
        fileURLToPath(new URL("./package.json", import.meta.url)),
        fileURLToPath(new URL("./postcss.config.js", import.meta.url)),
      ];
    }

    return config;
  },

  async redirects() {
    return [
      {
        // The raw files live under /pdfs/, so that is where people reach for a
        // document, and the reader pages are /pdf/<slug>. Forward the plural
        // to the singular so a guessed URL lands somewhere useful.
        //
        // The negative lookahead is load-bearing: redirects are evaluated
        // before filesystem routes, so without it this would swallow every
        // real file in public/pdfs/, including the CV that greeting.resumeLink
        // and the sitemap both point at.
        source: "/pdfs/:slug((?!.*\\.pdf$).*)",
        destination: "/pdf/:slug",
        permanent: true,
      },
      // Renamed files, 2026-08. The PDFs under public/pdfs were renamed into a
      // consistent scheme, and these keep every URL that was shared before then
      // working. The rule above cannot cover them: its negative lookahead
      // deliberately skips anything ending .pdf, so without these entries a
      // resume link in someone's job application 404s.
      //
      // 301 rather than `permanent: true`, which emits 308. These exist for
      // links made before the rename, and old links are followed by old
      // clients: 308 only dates from 2015, and the fetchers inside document
      // viewers, link previewers and crawlers often implement just 301/302/307.
      // 301 has been in HTTP since 1.0 and costs nothing here.
      //
      // Safe to prune once the old links have aged out. They are history, not
      // routing: nothing in the site points at these names any more.
      // No entry for /pdfs/RomainClaret_CV.pdf, deliberately. That path is
      // served by a real file, copied from the current CV at build time by
      // scripts/mirror-legacy-pdfs.js, because the resume URL is circulating
      // in places whose fetchers may not follow a redirect at all.
      //
      // A redirect here would defeat that: redirects are evaluated before
      // filesystem routes, so it would answer first and the copy would never
      // be served. Measured, not assumed - a real file at that path plus this
      // redirect returned 308, not the PDF.
      {
        source: "/pdfs/RomainClaret_PhD_Thesis.pdf",
        destination: "/pdfs/thesis_PHD.pdf",
        statusCode: 301,
      },
      {
        source: "/pdfs/RomainClaret_PhD_Thesis_chapter_7.pdf",
        destination: "/pdfs/thesis_PHD_chapter_7.pdf",
        statusCode: 301,
      },
      {
        source: "/pdfs/RomainClaret_Msc_Thesis.pdf",
        destination: "/pdfs/thesis_MSC.pdf",
        statusCode: 301,
      },
      {
        source: "/pdfs/RomainClaret_Msc_Thesis_Poster.pdf",
        destination: "/pdfs/thesis_MSC_poster.pdf",
        statusCode: 301,
      },
      {
        source: "/pdfs/RomainClaret_Bsc_Thesis.pdf",
        destination: "/pdfs/thesis_BSC.pdf",
        statusCode: 301,
      },
      {
        source: "/pdfs/RomainClaret_Bsc_Thesis_Poster.pdf",
        destination: "/pdfs/thesis_BSC_poster.pdf",
        statusCode: 301,
      },
      // No redirect for the arXiv -> ARXIV rename, deliberately. Next matches
      // redirect sources case-insensitively, so any rule whose source is the
      // old spelling also matches the new one: pointing it at the file made
      // the URL redirect to itself, and pointing it at the reader page made
      // the paper's own download link stop serving the PDF. Either way the
      // live URL loses, which is a worse trade than an old link 404ing.
      // /pdfs/preprint_arXiv_... therefore 404s on a case-sensitive host; the
      // paper is reachable at /pdf/claret2026quadtree.
      {
        source: "/pdfs/preprint_self_blockchain_small_techie_overview_2016.pdf",
        destination: "/pdfs/preprint_SELF_2016_blockchain_overview.pdf",
        statusCode: 301,
      },
      {
        source:
          "/pdfs/poster_visual_vestibular_integration_in_sensory_recognition_thresholds_2010.pdf",
        destination:
          "/pdfs/poster_SNF_2010_visual_vestibular_integration_in_sensory_recognition_thresholds.pdf",
        statusCode: 301,
      },
      {
        source: "/pdfs/poster_DEBS_2023.pdf",
        destination: "/pdfs/poster_DEBS_2023_scaling_neuroevolution.pdf",
        statusCode: 301,
      },
      {
        source: "/pdfs/lecture_unige_demystifying_ai_light.pdf",
        destination: "/pdfs/lecture_UNIGE_2022_demystifying_ai_light.pdf",
        statusCode: 301,
      },
    ];
  },

  // Headers for caching and security
  async headers() {
    // The two directives that force https, plus HSTS, only make sense when the
    // origin is actually reachable over https.
    //
    // Served over plain http they make WebKit rewrite every asset request to
    // https://<host> and fail on TLS. Measured against `npm start` on
    // localhost: 19 failed requests covering both stylesheets, the fonts and
    // every JS chunk, leaving an unstyled document with no React on it.
    // Chromium ignores upgrade-insecure-requests for localhost, which is why
    // this only ever shows up on WebKit.
    //
    // That is not hypothetical for this repo: every e2e job in
    // .github/workflows/playwright.yml serves the production build with
    // `npm start` over http://localhost:3000, so the whole WebKit suite was
    // running against a page that had never loaded. It reported green because
    // the specs returned early when the terminal was missing instead of
    // failing; once those soft checks became assertions, it surfaced.
    //
    // SERVE_HTTP is therefore opt-in and off by default: Vercel serves https
    // and never sets it, so production keeps all three headers. Only a local
    // or CI production server serving plain http turns them off, and
    // src/lib/security-headers.test.ts pins both states. Anything but a dev
    // server forces https: a build under NODE_ENV=test dropped the headers
    // when only "production" counted.
    const servesOverHttp = process.env.SERVE_HTTP === "true";
    const isProd = process.env.NODE_ENV !== "development" && !servesOverHttp;

    // Content Security Policy: the browser reaches only what the site uses.
    // Beyond the site itself, that is the terminal's AI chat (`ai init`):
    // its model from Hugging Face, which redirects weights to its Xet CDN
    // (us.aws.cdn.hf.co, other regions under hf.co), and the model's WebGPU
    // library from raw.githubusercontent.com; and Vercel's preview toolbar
    // (vercel.live, its pusher socket). The GitHub, ORCID, Semantic Scholar,
    // Kudos, S3, Vercel Speed Insights and remote image hosts it listed are
    // reached by the server or by nothing (round 25): remote images come
    // through the site itself, the GitHub avatar through its image
    // optimizer and the blog's pictures through /api/blog-image.
    // PRIVACY-POLICY.md names these hosts; src/lib/security-headers.test.ts
    // holds both to this list.
    const ContentSecurityPolicy = `
      default-src 'self';
      script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://vercel.live;
      worker-src 'self' blob:;
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: blob:;
      font-src 'self' data: moz-extension: chrome-extension:;
      connect-src 'self' https://huggingface.co https://www.huggingface.co https://cdn.huggingface.co https://cdn-lfs.huggingface.co https://cdn-lfs-us-1.huggingface.co https://cdn-lfs-eu-1.huggingface.co https://*.hf.co https://raw.githubusercontent.com https://vercel.live wss://ws-us3.pusher.com;
      media-src 'self';
      object-src 'none';
      frame-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'none';
      ${isProd ? "block-all-mixed-content; upgrade-insecure-requests;" : ""}
    `
      .replace(/\s{2,}/g, " ")
      .trim();

    return [
      // Prevent caching of HTML pages to ensure fresh JS chunk references after deploys
      //
      // `rss` is in the exclusion list because headers set here WIN over the
      // ones a route handler returns - Next applies these before the handler
      // runs and will not overwrite an existing cache-control. Without the
      // exclusion /rss.xml served max-age=0 while its handler asked for an
      // hour, so every feed poll re-ran the self-proxy in rss.xml/route.ts,
      // which fans out to rss2json plus a page fetch and an image fetch PER
      // FEED ITEM. Measured before the fix:
      //   /rss.xml -> public, max-age=0, must-revalidate
      {
        source:
          "/((?!_next|fonts|images|animations|pdfs|pyodide|api|favicon|robots|rss|sitemap).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
      {
        // The Pyodide runtime is ~18MB of version-pinned bytes vendored by
        // scripts/setup-assets.js, each version in a folder of its own,
        // /pyodide/<version>/, which the worker's URL names. A new version is
        // new URLs, so immutable is safe and saves a revalidation round-trip
        // per asset per session. (Until round 24 the folder had no version,
        // and a returning visitor kept the cached runtime after an update.)
        source: "/pyodide/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          // Only this site's pages may load it: the files are large and
          // draw on the plan's shared monthly transfer.
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            // Deprecated header; OWASP recommends disabling the legacy XSS
            // auditor (it introduced its own vulnerabilities). CSP is the real
            // XSS control here.
            key: "X-XSS-Protection",
            value: "0",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Content-Security-Policy",
            value: ContentSecurityPolicy,
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          ...(isProd
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
          {
            // Isolate our browsing context group from cross-origin popups so a
            // window we open (or one that opens us) cannot reach back through
            // window.opener. Our only window.open() calls are external social
            // links that need no opener. COEP is intentionally NOT set: nothing
            // here needs cross-origin isolation, and it would hold every
            // cross-origin load (the AI chat's model downloads) to CORP or
            // CORS checks. Images are no longer among them: they come through
            // the site itself (its image optimizer, /api/blog-image).
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
        ],
      },
      {
        // The Python sandbox worker gets its own complete policy, not a delta
        // on the site-wide one.
        //
        // This is what closes the last egress channel. Dynamic import() is
        // syntax, not a global, so it cannot be stripped from the worker the
        // way fetch and WebSocket are: escaped code can always evaluate
        // import("https://..."). The import throws on a non-module response,
        // but the REQUEST still happens, so any origin the policy allows is a
        // working exfiltration endpoint. The site-wide script-src allowed
        // https://*.vercel.app, a wildcard over every Vercel preview
        // deployment on the internet; it allows https://vercel.live now, and
        // the worker needs none of it.
        //
        // Nothing in this worker legitimately talks to a third party: Pyodide,
        // the wasm and the wheels are all same-origin under /pyodide/. So the
        // worker gets 'self' and nothing else, and import() can only reach
        // code this site already trusts.
        source: "/python-worker.js",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'none'",
              // 'self' covers /pyodide/pyodide.mjs and pyodide.asm.mjs.
              "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'",
              // pyodide.asm.wasm, python_stdlib.zip, the numpy wheel.
              "connect-src 'self'",
              // Nested workers are stripped at runtime; this is the second lock.
              "worker-src 'none'",
              "child-src 'none'",
              "object-src 'none'",
              "base-uri 'none'",
            ].join("; "),
          },
        ],
      },
      {
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/animations/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Papers/posters are large and mostly static, but files DO get
        // replaced under the same name (e.g. an updated presentation), so
        // no `immutable`: fresh for a day, then revalidate in background.
        source: "/pdfs/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=2592000",
          },
          // Only this site's pages may load it: the files are large and
          // draw on the plan's shared monthly transfer.
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
      // Do NOT add a Cache-Control rule for /_next/static here. Next applies
      // custom headers() BEFORE its own static-asset defaults, so a rule here
      // suppresses the dev-only "no-store, must-revalidate" and dev chunks
      // (whose filenames have no content hash) get cached immutable for a
      // year, freezing stale/mixed compiles in the browser (2026-07-19
      // pdf-modal crash). In production Next already serves /_next/static
      // with "public, max-age=31536000, immutable" on its own.
      // Deliberately NO blanket Cache-Control for /api/:path* .
      //
      // There was one, and it silently beat every route handler: Next sets
      // these before the handler runs and then refuses to overwrite an
      // existing cache-control, so a handler's own value never reached the
      // wire. Measured while it was in place:
      //
      //   /api/medium-posts?playwright=true -> public, s-maxage=300, ...
      //                                        (handler asks for private, no-store)
      //   /api/last-commit                  -> public, s-maxage=300, ...
      //
      // That downgraded the routes wanting an hour to five minutes, dropped
      // the no-store on mock responses, and made the rate limiter's 429 -
      // which sets no header of its own - publicly cacheable, so one client
      // tripping the limit could plant it in a shared cache for everyone.
      //
      // Every route now states its own policy, which is also where the policy
      // belongs; src/app/api/*/route.test.ts pins them.
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
