"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";
import { HighContrastToggle } from "./high-contrast-toggle";
import {
  Menu,
  X,
  Home,
  Code2,
  Briefcase,
  FolderOpen,
  Microscope,
  FileText,
  GraduationCap,
  PenTool,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminal } from "@/lib/terminal/terminal-context";
import { ProtectedLucideIcon } from "@/components/ui/protected-lucide-icon";
import { useAnimationState } from "@/contexts/animation-state-context";
import { useCardDeepLink } from "@/lib/hooks/useCardDeepLink";
import { scrollToSection } from "@/lib/utils/scroll-to-section";

const navItems = [
  { href: "#home", label: "Home", icon: Home },
  { href: "#skills", label: "Skills", icon: Code2 },
  { href: "#experience", label: "Experience", icon: Briefcase },
  { href: "#projects", label: "Projects", icon: FolderOpen },
  { href: "#research", label: "Research", icon: Microscope },
  { href: "#papers", label: "Papers", icon: FileText },
  { href: "#education", label: "Education", icon: GraduationCap },
  { href: "#blogs", label: "Blog", icon: PenTool },
  { href: "#contact", label: "Contact", icon: Mail },
];

export function Navigation() {
  const { isOpen: isTerminalOpen, toggleTerminal } = useTerminal();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [isHydrated, setIsHydrated] = useState(false);
  const { areAnimationsPlaying } = useAnimationState();

  // Track hydration to prevent animation class mismatch
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);

      // Update active section based on scroll position
      const sections = navItems.map((item) => item.href.replace("#", ""));
      const scrollPosition = window.scrollY + 64; // Offset for better detection (h-16 = 64px)

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = document.getElementById(sections[i]);
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(sections[i]);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Initial check
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const pathname = usePathname();
  const router = useRouter();
  const isHomePage = pathname === "/";

  // Land on the right section when the page is *entered* at a hash, e.g.
  // /#research from the nav on /pdf/<slug>, from the sitemap, or from a shared
  // link. Neither a client navigation nor a full load scrolls there on its
  // own: the sections are far down a very tall page whose content keeps
  // loading, and the splash locks scrolling while it runs, so whatever the
  // browser does early is lost.
  //
  // useCardDeepLink already solves exactly this for cards, including a settle
  // loop that re-aligns as content above shifts and a release on first user
  // scroll. The section elements carry the ids it needs, so it is reused
  // as-is. Its highlight return values are irrelevant here: nothing applies
  // the pulse class to a section.
  useCardDeepLink(navItems.map((item) => item.href.replace("#", "")));

  /**
   * Section anchors only exist on the homepage. Everywhere else (/pdf/<slug>)
   * they have to point back at it, or the link is inert.
   */
  const navHref = (href: string) => (isHomePage ? href : `/${href}`);

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
    href: string,
  ) => {
    setIsMobileMenuOpen(false);

    // Off the homepage there is nothing here to scroll to, so let the anchor
    // navigate normally. Cancelling first and only then looking for a target
    // is what made every nav item dead on /pdf/<slug>: the click was consumed
    // and then dropped. Leaving the default alone also keeps middle-click and
    // open-in-new-tab working.
    if (!isHomePage) return;

    e.preventDefault();

    scrollToSection(href.replace("#", ""));
  };

  return (
    <nav
      id="main-navigation"
      className={cn(
        "fixed top-0 z-50 w-full transition-all duration-300",
        isScrolled
          ? "bg-background/80 backdrop-blur-md border-b border-border shadow-sm"
          : "bg-transparent",
      )}
    >
      <div className="w-full px-4">
        <div className="flex h-16 items-center justify-between max-w-7xl mx-auto">
          {/* Terminal-style Logo */}
          <div className="flex items-center text-sm md:text-base font-mono">
            <Link
              href={isHomePage ? "#home" : "/"}
              onClick={(e) => handleNavClick(e, "#home")}
              className="flex items-center transition-colors hover:opacity-80"
            >
              <span className="text-gray-500 dark:text-gray-400">guest@</span>
              <span className="font-bold font-mono">Claret.Tech</span>
            </Link>
            <button
              onClick={toggleTerminal}
              className="flex items-center ml-1 transition-colors hover:opacity-80"
              aria-label="Toggle terminal"
            >
              <span className="text-gray-500 dark:text-gray-400">~&nbsp;$</span>
              <span
                className={cn(
                  "ml-1 inline-block w-2 h-4 md:h-5",
                  isTerminalOpen
                    ? "opacity-0"
                    : isHydrated && areAnimationsPlaying
                      ? "animate-cursor-blink"
                      : "",
                )}
                style={{ backgroundColor: "#00f900" }}
              />
            </button>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-6">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={navHref(item.href)}
                onClick={(e) => handleNavClick(e, item.href)}
                className={cn(
                  "relative text-sm font-medium transition-colors hover:text-primary",
                  activeSection === item.href.replace("#", "")
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              >
                {item.label}
                {activeSection === item.href.replace("#", "") && (
                  <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-primary rounded-full" />
                )}
              </a>
            ))}
            <HighContrastToggle />
            <ThemeToggle />
          </div>

          {/* Mobile Menu Button */}
          <div className="flex lg:hidden items-center space-x-2">
            <HighContrastToggle />
            <ThemeToggle />
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              data-testid="mobile-menu-button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium transition-colors hover:bg-muted"
              aria-label={
                isMobileMenuOpen
                  ? "Close navigation menu"
                  : "Open navigation menu"
              }
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-navigation-menu"
              aria-describedby="mobile-menu-desc"
            >
              <span id="mobile-menu-desc" className="sr-only">
                Toggle navigation menu to access all sections
              </span>
              {isMobileMenuOpen ? (
                <ProtectedLucideIcon
                  Icon={X}
                  className="h-5 w-5"
                  aria-hidden="true"
                />
              ) : (
                <ProtectedLucideIcon
                  Icon={Menu}
                  className="h-5 w-5"
                  aria-hidden="true"
                />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu - Floating Panel */}
      {isMobileMenuOpen && (
        <div
          id="mobile-navigation-menu"
          data-testid="mobile-navigation-menu"
          className="lg:hidden absolute top-full left-0 right-0 p-4 sm:p-6 animate-in slide-in-from-top-2 fade-in duration-300"
        >
          {/* Floating Panel Container */}
          <div className="relative mx-auto sm:max-w-[400px] md:max-w-[480px] md:ml-auto md:mr-4">
            {/* Glassmorphism Panel with Gradient Border */}
            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              {/* Animated Gradient Border */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-purple-500/20 to-pink-500/20 animate-gradient-xy" />

              {/* Inner Content with Backdrop */}
              <div className="relative m-[1px] rounded-2xl bg-background/95 backdrop-blur-xl">
                {/* Gradient Mesh Overlay */}
                <div className="absolute inset-0 opacity-30">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
                  <div className="absolute bottom-0 right-0 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />
                </div>

                {/* Menu Content */}
                <div className="relative z-10 p-6">
                  {/* Menu Items Grid - 2 columns on medium screens */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
                    {navItems
                      .filter((item) => item.href !== "#contact")
                      .map((item, index) => {
                        const Icon = item.icon;
                        const isActive =
                          activeSection === item.href.replace("#", "");

                        return (
                          <a
                            key={item.href}
                            href={navHref(item.href)}
                            onClick={(e) => handleNavClick(e, item.href)}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                              "hover:bg-gradient-to-r hover:from-primary/10 hover:to-transparent",
                              "group relative overflow-hidden backdrop-blur-sm",
                              isActive &&
                                "bg-gradient-to-r from-primary/20 to-transparent",
                              "animate-in fade-in slide-in-from-left-2",
                            )}
                            style={{ animationDelay: `${index * 50}ms` }}
                          >
                            {/* Active Indicator */}
                            {isActive && (
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
                            )}

                            {/* Icon */}
                            <div
                              className={cn(
                                "p-1.5 rounded-lg transition-all duration-200",
                                "bg-gradient-to-br from-card/50 to-card/30",
                                "group-hover:scale-110 group-hover:from-primary/20 group-hover:to-primary/10",
                                isActive && "from-primary/30 to-primary/20",
                              )}
                            >
                              <ProtectedLucideIcon
                                Icon={Icon}
                                className={cn(
                                  "w-4 h-4 transition-colors",
                                  isActive
                                    ? "text-primary"
                                    : "text-muted-foreground group-hover:text-primary",
                                )}
                              />
                            </div>

                            {/* Label */}
                            <span
                              className={cn(
                                "text-sm font-medium transition-colors",
                                isActive
                                  ? "text-primary"
                                  : "text-muted-foreground group-hover:text-foreground",
                              )}
                            >
                              {item.label}
                            </span>

                            {/* Hover Effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
                          </a>
                        );
                      })}
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-gradient-to-r from-transparent via-border/50 to-transparent mb-4" />

                  {/* Contact Button - Prominent CTA */}
                  <button
                    onClick={(e) => {
                      // A button has no navigation of its own to fall back on.
                      if (!isHomePage) {
                        setIsMobileMenuOpen(false);
                        router.push(navHref("#contact"));
                        return;
                      }
                      handleNavClick(e, "#contact");
                    }}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-lg font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                    aria-label="Contact me"
                  >
                    <ProtectedLucideIcon Icon={Mail} className="w-5 h-5" />
                    Get In Touch
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
