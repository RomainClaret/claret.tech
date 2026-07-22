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
    dirs: ['src/app', 'src/components', 'src/lib', 'src/hooks', 'src/contexts', 'src/data'],
  },

  // Disable source maps in production to prevent 404 errors for .map files
  productionBrowserSourceMaps: false,

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "github.com",
      },
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
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
      config.plugins.push(new RemoveProblematicSourceMapUrlsPlugin({
        problematicMaps: [
          'lucide-react.js.map',
          'index.js.map',
          '@lucide/react.js.map'
        ]
      }));
      
      // Note: The lucide-react package includes sourceMappingURL comments
      // but doesn't ship the actual .map files, causing 404 errors.
      // Our plugin removes these specific references while preserving other source maps.
    }


    // Optimize bundle size (only in production)
    if (!isServer && !dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
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
              name: 'webllm',
              chunks: 'async',
              test: /[\\/]node_modules[\\/]@mlc-ai[\\/]/,
              priority: 30,
              reuseExistingChunk: true,
            },
            // Terminal chunk
            terminal: {
              name: 'terminal',
              chunks: 'async',
              test: /[\\/]node_modules[\\/]@xterm[\\/]/,
              priority: 25,
              reuseExistingChunk: true,
            },
            // PDF.js chunk
            pdfjs: {
              name: 'pdfjs',
              chunks: 'async',
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

  // Headers for caching and security
  async headers() {
    // Content Security Policy - strict but allows necessary resources
    const ContentSecurityPolicy = `
      default-src 'self';
      script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://va.vercel-scripts.com https://*.vercel.app https://vercel.live;
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
      block-all-mixed-content;
      upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim();

    return [
      // Prevent caching of HTML pages to ensure fresh JS chunk references after deploys
      {
        source: "/((?!_next|fonts|images|animations|pdfs|api|favicon|robots|sitemap).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
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
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
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
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=300, stale-while-revalidate=600",
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);