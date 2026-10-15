import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { TerminalProvider } from "@/lib/terminal/terminal-context";
import { Navigation } from "@/components/ui/navigation";
import { Footer } from "@/components/ui/footer";
import { AppWrapper } from "@/components/ui/app-wrapper";
import { FloatingNav } from "@/components/ui/floating-nav";
import { generateStructuredData } from "@/lib/seo/structured-data";
import { BackgroundProvider } from "@/contexts/background-context";
import { SafariProvider } from "@/contexts/safari-context";
import { AnimationStateProvider } from "@/contexts/animation-state-context";
import { QualityProvider } from "@/contexts/quality-context";
import { AnimatedFavicon } from "@/components/ui/animated-favicon";
import { ToastContainer } from "@/components/ui/toast";
import CookieNotice from "@/components/ui/cookie-notice";
import { TestModeProvider } from "@/components/providers/test-mode-provider";
import { MotionProvider } from "@/components/providers/motion-provider";
import { LegalModalsProvider } from "@/components/ui/legal-modals-provider";
import { PenguinSource } from "@/components/ui/penguin-source";
import montserratRanges from "@/lib/fonts/montserrat-ranges.json";
import { HEAD_BOOT_SCRIPT } from "@/lib/boot/head-boot";

// The Latin part of Montserrat, every layout feature kept (41 KB): the only
// font file a visit preloads. The full font (79 KB, every glyph of the
// original TTF) covers the rest, declared in <head> below for those
// characters only, so a page that shows one still gets Montserrat for it.
// Both come from scripts/subset-montserrat.py. next/font takes literals
// only: this range must equal "latin" in src/lib/fonts/montserrat-ranges.json
// (layout-font.test.ts checks).
const montserrat = localFont({
  src: "../../public/fonts/Montserrat-Regular-latin.woff2",
  variable: "--font-montserrat",
  display: "swap",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-017F,U+0192,U+0218-021B,U+02BB-02BC,U+02C6-02C7,U+02C9,U+02D8-02DD,U+2000-206F,U+20A0-20CF,U+2100-214F,U+2190-21FF,U+2200-22FF,U+FB00-FB06,U+FEFF,U+FFFD",
    },
  ],
});

// The same family for everything outside that range, from the full font.
const montserratRestFace = `@font-face{font-family:${montserrat.style.fontFamily.split(",")[0]};src:url("/fonts/Montserrat-Regular.woff2") format("woff2");font-display:swap;unicode-range:${montserratRanges.rest}}`;

export const metadata: Metadata = {
  title: "Romain Claret - Evolving Artificial Intelligence",
  description:
    "Neuroevolution researcher and lecturer growing artificial minds from evolved specialists that learn to work together, and studying the behaviors that emerge without human data.",
  keywords:
    "Romain Claret, Evolving AI, Neuroevolution, GEENNS, Compositional Reasoning, Lifelong Learning, Artificial Life, Emergent Behavior, Interactive Evolution, ES-HyperNEAT, GECCO, Evolutionary Computation, Lecturer, University College Dublin, University of Neuchâtel",
  authors: [{ name: "Romain Claret" }],
  metadataBase: new URL("https://claret.tech"),
  alternates: {
    canonical: "https://claret.tech",
    types: {
      "application/rss+xml": "/rss.xml",
    },
  },
  openGraph: {
    title: "Romain Claret - Evolving Artificial Intelligence",
    description:
      "Neuroevolution researcher and lecturer growing artificial minds from evolved specialists that learn to work together, and studying the behaviors that emerge without human data.",
    type: "website",
    url: "https://claret.tech",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Romain Claret - Evolving Artificial Intelligence",
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      // Default favicon
      { url: "/favicon.ico", sizes: "any" },
      // Theme-aware favicons using media queries
      {
        url: "/favicon-light.png",
        sizes: "32x32",
        type: "image/png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/favicon-dark.png",
        sizes: "32x32",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
      { url: "/favicons/apple-touch-icon-152x152.png", sizes: "152x152" },
      { url: "/favicons/apple-touch-icon-144x144.png", sizes: "144x144" },
      { url: "/favicons/apple-touch-icon-120x120.png", sizes: "120x120" },
      { url: "/favicons/apple-touch-icon-114x114.png", sizes: "114x114" },
      { url: "/favicons/apple-touch-icon-76x76.png", sizes: "76x76" },
      { url: "/favicons/apple-touch-icon-72x72.png", sizes: "72x72" },
      { url: "/favicons/apple-touch-icon-60x60.png", sizes: "60x60" },
      { url: "/favicons/apple-touch-icon-57x57.png", sizes: "57x57" },
    ],
    other: [
      {
        rel: "mask-icon",
        url: "/safari-pinned-tab.svg",
        color: "#8c43ce",
      },
    ],
  },
  manifest: "/favicons/site.webmanifest",
};

// Generate comprehensive structured data for SEO
const structuredData = generateStructuredData();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Generated once, at build time, for every visitor: nothing here may
  // depend on the request. The visitor's theme and browser reach <html>
  // through the head script below, before the first paint; the providers
  // start from these same values and catch up after hydration, under the
  // splash's backdrop. (Read from cookies on every request, they made each
  // page view a function call: 200-350 ms before the first byte, about a
  // second when the function was cold.)
  return (
    <html
      lang="en"
      className="light enable-animations"
      data-safari="false"
      // globals.css scrolls smoothly; this keeps Next.js setting that aside
      // while it moves to a new route, as it did by default until 16.
      data-scroll-behavior="smooth"
      // The head script below sets the theme class and the browser's
      // attributes before React hydrates, from the visitor's storage and
      // user agent: <html> legitimately differs from what was rendered.
      suppressHydrationWarning
    >
      <head>
        {/* First in <head>, so it runs before anything is drawn. */}
        <script dangerouslySetInnerHTML={{ __html: HEAD_BOOT_SCRIPT }} />
        {/* The splash's backdrop is in the HTML (app-wrapper.tsx); with
            scripts off nothing would ever remove it. Nor would anything
            animate in the content framer starts at opacity 0 (globals.css). */}
        <noscript>
          <style>
            {
              '[data-splash-backdrop]{display:none}[style*="opacity:0;transform:"],[style="opacity:0"],[style="transform:scale(0)"],[data-reveal="pending"]{opacity:1!important;transform:none!important}'
            }
          </style>
        </noscript>
        <style dangerouslySetInnerHTML={{ __html: montserratRestFace }} />
        <meta name="theme-color" content="#55198b" />
        <meta name="msapplication-TileColor" content="#8c43ce" />
        <meta name="msapplication-config" content="/browserconfig.xml" />

        <style
          dangerouslySetInnerHTML={{
            __html: `
              /* More targeted animation disabling - don't break all animations by default */
              /* Only disable performance-heavy animations until browser detection completes */
              
              html:not(.enable-animations) .animate-pulse,
              html:not(.enable-animations) .animate-spin,
              html:not(.enable-animations) .animate-bounce,
              html:not(.enable-animations) .animate-float,
              body:not(.enable-animations) .animate-pulse,
              body:not(.enable-animations) .animate-spin,
              body:not(.enable-animations) .animate-bounce,
              body:not(.enable-animations) .animate-float {
                animation: none !important;
              }
              
              /* Safari compatibility - minimal approach */
              /* Performance optimizations are now handled by the quality context */
              
              /* Preserve essential accessibility and navigation */
              body[data-safari="true"] .fixed,
              body[data-safari="true"] nav,
              body[data-safari="true"] [class*="floating"] {
                position: fixed !important;
              }
              
              /* Basic backdrop-blur fallbacks for Safari */
              @supports not (backdrop-filter: blur(1px)) {
                .backdrop-blur-sm { background-color: rgba(0, 0, 0, 0.05) !important; }
                .backdrop-blur-md { background-color: rgba(0, 0, 0, 0.1) !important; }
                .backdrop-blur-lg { background-color: rgba(0, 0, 0, 0.15) !important; }
                .backdrop-blur-xl { background-color: rgba(0, 0, 0, 0.2) !important; }
              }
              
              /* Test mode optimizations - disable pointer events on decorative elements */
              html[data-test-mode="true"] svg.neural-network,
              body[data-test-mode="true"] svg.neural-network,
              html[data-test-mode="true"] .background-canvas,
              body[data-test-mode="true"] .background-canvas,
              html[data-test-mode="true"] canvas,
              body[data-test-mode="true"] canvas {
                pointer-events: none !important;
              }

              /* No layout of its own in test mode: a rule here once gave
                 every nav, button and link position: relative and a
                 z-index of 10002, so the navigation was not fixed in
                 Chromium's and Firefox's tests and a logo test passed with
                 the logo scrolled away. Tests see the site as it ships. */
            `,
          }}
        />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {/* A circle's radius, checked as it is set: every write to `r`, from
            React or framer-motion, goes through setAttribute, so a bad value
            ("undefined", "NaN", "") becomes 4 before it reaches the DOM and
            the browser's "Expected length" error. It runs before any
            component, and it is the one guard: components also clamp their
            radii (validateRadius in src/lib/utils/svg-validation.ts).
            layout-svg-guard.test.ts runs it as shipped. */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  "use strict";
  if (window.__SVG_PROTECTION_ACTIVE__) return;
  window.__SVG_PROTECTION_ACTIVE__ = true;
  
  // Runtime protection for SVG circle radius attributes
  const originalSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    // Intercept radius attribute setting on SVG circles
    if (name === 'r' && this.tagName && this.tagName.toLowerCase() === 'circle') {
      if (value === undefined || value === 'undefined' || value === null || 
          value === 'null' || value === '' || isNaN(parseFloat(value))) {
        value = '4'; // Safe fallback radius
      }
    }
    return originalSetAttribute.call(this, name, value);
  };
})();
            `,
          }}
        />
        {/* Additional SEO meta tags */}
        <meta name="author" content="Romain Claret" />
        <meta name="generator" content="Next.js 15" />
        <link rel="author" href="/humans.txt" />

        {/* Safari polyfill for requestIdleCallback */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window !== 'undefined' && !window.requestIdleCallback) {
                  window.requestIdleCallback = function(cb) {
                    const start = Date.now();
                    return setTimeout(function() {
                      cb({
                        didTimeout: false,
                        timeRemaining: function() {
                          return Math.max(0, 50 - (Date.now() - start));
                        }
                      });
                    }, 1);
                  };
                  window.cancelIdleCallback = function(id) {
                    clearTimeout(id);
                  };
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${montserrat.variable} font-sans`}
        suppressHydrationWarning
      >
        {/* Easter egg: a penguin hidden in the HTML source (View Page Source) */}
        <PenguinSource />
        {/* Skip Navigation Links */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Skip to main content
        </a>
        <a
          href="#main-navigation"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-48 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Skip to navigation
        </a>

        <TestModeProvider>
          <MotionProvider>
            <ThemeProvider initialTheme="light">
              <SafariProvider initialSafari={false}>
                <AnimationStateProvider>
                  <QualityProvider>
                    <BackgroundProvider>
                      <TerminalProvider>
                        <LegalModalsProvider>
                          <AppWrapper>
                            <AnimatedFavicon />
                            <Navigation />
                            <main id="main-content" className="pt-16">
                              {children}
                            </main>
                            <FloatingNav />
                            <Footer />
                          </AppWrapper>
                          <ToastContainer />
                          <CookieNotice />
                        </LegalModalsProvider>
                        {process.env.NODE_ENV === "production" &&
                          process.env.VERCEL && <Analytics />}
                      </TerminalProvider>
                    </BackgroundProvider>
                  </QualityProvider>
                </AnimationStateProvider>
              </SafariProvider>
            </ThemeProvider>
          </MotionProvider>
        </TestModeProvider>
      </body>
    </html>
  );
}
