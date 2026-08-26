import bundleAnalyzer from "@next/bundle-analyzer";
import RemoveProblematicSourceMapUrlsPlugin from "./scripts/webpack-remove-sourcemap-plugin.js";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ESLint configuration for build
  eslint: {
    // Ignore test files during production builds
    ignoreDuringBuilds: false,
    dirs: [
      "src/app",
      "src/components",
      "src/lib",
      "src/hooks",
      "src/contexts",
      "src/data",
    ],
  },

  // Disable source maps in production to prevent 404 errors for .map files
  productionBrowserSourceMaps: false,

  // Image optimization
  images: {
    remotePatterns: [
      {
        // Path-scoped: without a pathname these turn /_next/image into an open
        // image proxy for anyone's repository content, which is also the
        // surface the Next image-optimizer advisories target.
        //
        // github.com serves the avatar as /RomainClaret.png, a single segment
        // with no trailing slash, so /RomainClaret/** does not match it. That
        // scoping broke the profile image; it is pinned to the exact file
        // instead, which is the only github.com image the site uses.
        protocol: "https",
        hostname: "github.com",
        pathname: "/RomainClaret.png",
      },
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        pathname: "/RomainClaret/**",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "cdn-images-1.medium.com",
      },
      {
        protocol: "https",
        hostname: "cdn-images-2.medium.com",
      },
      {
        protocol: "https",
        hostname: "miro.medium.com",
      },
      {
        protocol: "https",
        hostname: "cdn.jsdelivr.net",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
    formats: ["image/avif", "image/webp"],
  },

  // Performance optimizations
  compress: true,
  poweredByHeader: false,

  // Enable experimental features for better performance
  experimental: {
    // optimizeCss: true, // Disabled due to critters dependency issue
    // optimizePackageImports(lucide-react/framer-motion) was tried 2026-07-19
    // and REVERTED: its __barrel_optimize__ proxy modules broke lazy chunks
    // in webpack dev (pdf-modal crashed the page with "Cannot read
    // properties of undefined (reading 'call')"). The real lucide win is the
    // explicit icon map in skills-neural-cloud instead of a namespace import.
  },

  // Custom webpack config for WebLLM support and optimizations
  webpack: (config, { isServer, dev, webpack }) => {
    // Add WebLLM-specific aliases
    config.resolve.alias = {
      ...config.resolve.alias,
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
    // src/app/security-headers.test.ts pins both states.
    const servesOverHttp = process.env.SERVE_HTTP === "true";
    const isProd = process.env.NODE_ENV === "production" && !servesOverHttp;

    // Content Security Policy - strict but allows necessary resources
    const ContentSecurityPolicy = `
      default-src 'self';
      script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://va.vercel-scripts.com https://vercel.live;
      worker-src 'self' blob:;
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: blob: https://github.com https://raw.githubusercontent.com https://avatars.githubusercontent.com https://cdn-images-1.medium.com https://cdn-images-2.medium.com https://miro.medium.com https://images.unsplash.com;
      font-src 'self' data: https://cdn.scite.ai moz-extension: chrome-extension:;
      connect-src 'self' https://api.github.com https://pub.orcid.org https://api.semanticscholar.org https://www.growkudos.com https://huggingface.co https://www.huggingface.co https://cdn.huggingface.co https://cdn-lfs.huggingface.co https://cdn-lfs-us-1.huggingface.co https://cdn-lfs-eu-1.huggingface.co https://s3.amazonaws.com https://raw.githubusercontent.com https://va.vercel-scripts.com https://vitals.vercel-insights.com https://vercel.live wss://ws-us3.pusher.com;
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
        // scripts/setup-assets.js. Its filenames never change within a release,
        // and a new release lands in a fresh deploy, so immutable is safe and
        // saves a revalidation round-trip per asset per session.
        source: "/pyodide/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
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
            // links that need no opener. COEP is intentionally NOT set: it would
            // break cross-origin images (GitHub/Medium) and WebLLM.
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
        // working exfiltration endpoint - and the site-wide script-src allows
        // https://*.vercel.app, a wildcard over every Vercel preview
        // deployment on the internet.
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
