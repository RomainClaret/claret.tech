import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { cookies } from "next/headers";
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
import { getSafariFromNextCookies } from "@/lib/utils/safari-detection";
import { SVGProtectionWrapper } from "@/components/ui/svg-protection-wrapper";
import { AnimatedFavicon } from "@/components/ui/animated-favicon";
import { ToastContainer } from "@/components/ui/toast";
import CookieNotice from "@/components/ui/cookie-notice";
import { TestModeProvider } from "@/components/providers/test-mode-provider";
import { LegalModalsProvider } from "@/components/ui/legal-modals-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const montserrat = localFont({
  src: "../../public/fonts/Montserrat-Regular.ttf",
  variable: "--font-montserrat",
  display: "swap",
});

const agustina = localFont({
  src: "../../public/fonts/Agustina.woff",
  variable: "--font-agustina",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Romain Claret - Evolving Artificial Intelligence",
  description:
    "PhD researcher breeding neural networks that think in components, not patterns. Making evolution computationally viable. Because intelligence emerges, it isn't engineered.",
  keywords:
    "Romain Claret, Evolving AI, Neuroevolution, Compositional Intelligence, ES-HyperNEAT, GECCO, Evolutionary Computation, Artificial Life, Emergent Intelligence, PhD University Neuchâtel",
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
      "PhD researcher breeding neural networks that think in components, not patterns. Making evolution computationally viable. Because intelligence emerges, it isn't engineered.",
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
  twitter: {
    card: "summary_large_image",
    title: "Romain Claret - Evolution > Engineering",
    description: "Breeding neural networks that think compositionally.",
    creator: "@romainclaret",
    images: ["/og-image.png"],
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value || "light";

  // Get Safari detection from server-side cookies to prevent hydration mismatch
  const isSafariFromServer = getSafariFromNextCookies(cookieStore);

  // Build className and data attributes for consistent server/client rendering
  const htmlClassName = isSafariFromServer
    ? theme // Safari: no animations class
    : `${theme} enable-animations`; // Non-Safari: enable animations

  return (
    <html
      lang="en"
      className={htmlClassName}
      data-safari={isSafariFromServer.toString()}
    >
      <head>
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
              
              /* Ensure interactive elements have higher z-index in test mode */
              html[data-test-mode="true"] nav,
              body[data-test-mode="true"] nav,
              html[data-test-mode="true"] button,
              body[data-test-mode="true"] button,
              html[data-test-mode="true"] a,
              body[data-test-mode="true"] a,
              html[data-test-mode="true"] .terminal,
              body[data-test-mode="true"] .terminal {
                position: relative;
                z-index: 10002 !important;
              }
            `,
          }}
        />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {/* 
        SVG Circle Radius Protection (Emergency Failsafe)
        
        This runtime protection catches any remaining SVG circle radius issues at the DOM level.
        While components now use the shared validateRadius utility (src/lib/utils/svg-validation.ts),
        this failsafe provides additional protection against undefined radius values that could
        cause rendering errors.
        
        Note: This could be removed after thorough testing confirms all SVG issues are resolved
        by the validateRadius utility in components.
        */}
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
        {/* Resource hints for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link rel="preconnect" href="https://github.com" />
        <link rel="preconnect" href="https://medium.com" />
        <link rel="preconnect" href="https://api.github.com" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://github.com" />
        <link rel="dns-prefetch" href="https://medium.com" />
        <link rel="dns-prefetch" href="https://api.github.com" />
        <link rel="dns-prefetch" href="https://cdn-images-1.medium.com" />
        {/* Preload critical fonts */}
        <link
          rel="preload"
          href="/fonts/Montserrat-Regular.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Agustina.woff"
          as="font"
          type="font/woff"
          crossOrigin="anonymous"
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
        className={`${inter.variable} ${montserrat.variable} ${agustina.variable} font-sans`}
        suppressHydrationWarning
      >
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
          <ThemeProvider initialTheme={theme as "light" | "dark"}>
            <SafariProvider initialSafari={isSafariFromServer}>
              <AnimationStateProvider>
                <QualityProvider>
                  <BackgroundProvider>
                    <TerminalProvider>
                      <SVGProtectionWrapper>
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
                      </SVGProtectionWrapper>
                    </TerminalProvider>
                  </BackgroundProvider>
                </QualityProvider>
              </AnimationStateProvider>
            </SafariProvider>
          </ThemeProvider>
        </TestModeProvider>
      </body>
    </html>
  );
}
