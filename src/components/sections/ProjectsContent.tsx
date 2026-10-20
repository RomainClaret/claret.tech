"use client";

/**
 * The projects section once its pinned repositories are in: the spotlight,
 * the cards, the filters and views, the details dialog and the full list on
 * demand. A chunk of its own, fetched beside those repositories
 * (Projects.tsx): the section's HTML is "Loading projects..." until both are
 * in, so none of this needs to be in the page's first JavaScript.
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { SlideInUp, ScaleIn } from "@/components/ui/animated";
import { useShouldReduceAnimations } from "@/lib/hooks/useSafari";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { formatFileSizeDisplay } from "@/lib/utils/formatters";
import {
  Star,
  GitFork,
  ExternalLink,
  Search,
  Grid,
  List,
  Calendar,
  Sparkles,
  Zap,
  FileCode2,
  Activity,
} from "lucide-react";
import { ProjectFilter } from "@/components/ui/project-filter";
import { ProjectDetailsDialog } from "@/components/ui/project-details-dialog";
import { useProjects, type Repository } from "@/contexts/projects-context";
import { HolographicCard } from "@/components/ui/holographic-card";
import { HolographicStatsCard } from "@/components/ui/holographic-stats-card";
import { m } from "framer-motion";
import { getProjectColor, getLanguageIcon } from "@/lib/utils/language-colors";
import { projectsSection } from "@/data/portfolio";
import { logError } from "@/lib/utils/dev-logger";

export interface PinnedRepository {
  name: string;
  description: string;
  forkCount: number;
  stargazers: {
    totalCount: number;
  };
  url: string;
  id: string;
  diskUsage: number;
  primaryLanguage: {
    name: string;
    color: string;
  } | null;
}

type ViewMode = "featured" | "all";
type LayoutMode = "grid" | "list";

export function ProjectsContent({
  pinnedProjects,
}: {
  pinnedProjects: PinnedRepository[];
}) {
  const shouldReduceAnimations = useShouldReduceAnimations();
  const {
    allProjects,
    setAllProjects,
    isLoading: contextLoading,
  } = useProjects();
  const [loadingAll, setLoadingAll] = useState(false);
  const [selectedTech, setSelectedTech] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("featured");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("grid");
  // The repository whose details are open, and the card's button, where
  // focus goes back on close.
  const [details, setDetails] = useState<{
    project: Repository;
    trigger: HTMLElement | null;
  } | null>(null);
  const closeDetails = useCallback(() => setDetails(null), []);

  // All repositories, asked for when "All" is chosen. Once asked, only the
  // next click on "All" asks again: an effect that re-ran on a failed (or
  // empty) answer asked again at once, for as long as that lasted.
  const [allAsked, setAllAsked] = useState(false);
  const fetchAllProjects = useCallback(async () => {
    setAllAsked(true);
    setLoadingAll(true);
    try {
      const response = await fetch("/api/fetch-all-repos");
      const result = await response.json();

      if (result.success && result.data) {
        setAllProjects(result.data);
      }
    } catch (error) {
      logError(error, "Projects.fetchAllProjects");
    } finally {
      setLoadingAll(false);
    }
  }, [setAllProjects]);
  const canFetchAll =
    allProjects.length === 0 && !loadingAll && !contextLoading;

  const showAllProjects = () => {
    setViewMode("all");
    if (canFetchAll) fetchAllProjects();
  };

  // "All" already showing when the splash's own fetch (contextLoading) ends
  // without the repositories: ask once, after this commit.
  const fetchAllNow = viewMode === "all" && canFetchAll && !allAsked;
  useEffect(() => {
    if (!fetchAllNow) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) fetchAllProjects();
    });
    return () => {
      cancelled = true;
    };
  }, [fetchAllNow, fetchAllProjects]);

  // Convert pinned projects to match Repository interface for unified handling
  const normalizedPinnedProjects: Repository[] = useMemo(() => {
    return pinnedProjects.map((project) => ({
      ...project,
      stargazerCount: project.stargazers.totalCount,
      homepageUrl: null,
      languages: undefined,
      topics: undefined,
      createdAt: "",
      updatedAt: "",
      pushedAt: "",
      isPrivate: false,
      isArchived: false,
      isFork: false,
      parent: null,
    }));
  }, [pinnedProjects]);

  // Current projects based on view mode
  const currentProjects =
    viewMode === "featured" ? normalizedPinnedProjects : allProjects;

  // Extract unique technologies
  const uniqueTechnologies = useMemo(() => {
    const techSet = new Set<string>();
    currentProjects.forEach((project) => {
      if (project.primaryLanguage?.name) {
        techSet.add(project.primaryLanguage.name);
      }
      // Also extract from languages if available
      if (project.languages) {
        project.languages.edges.forEach((edge) => {
          techSet.add(edge.node.name);
        });
      }
    });
    return Array.from(techSet).sort();
  }, [currentProjects]);

  // Filter projects
  const filteredProjects = useMemo(() => {
    let filtered = currentProjects;

    // Filter by technology
    if (selectedTech) {
      filtered = filtered.filter((project) => {
        if (project.primaryLanguage?.name === selectedTech) return true;
        if (project.languages) {
          return project.languages.edges.some(
            (edge) => edge.node.name === selectedTech,
          );
        }
        return false;
      });
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((project) => {
        const inName = project.name.toLowerCase().includes(query);
        const inDescription =
          project.description?.toLowerCase().includes(query) || false;
        const inTopics =
          project.topics?.edges.some((edge) =>
            edge.node.topic.name.toLowerCase().includes(query),
          ) || false;
        return inName || inDescription || inTopics;
      });
    }

    return filtered;
  }, [currentProjects, selectedTech, searchQuery]);

  // The featured project: a spotlight over the grid by default, and then
  // not repeated as the grid's first card. While a search or a filter is on
  // it steps aside, and the project is listed with the rest if it matches.
  const spotlight = useMemo(() => {
    if (pinnedProjects.length === 0) return null;
    const chosen = projectsSection.featuredProject;
    if (chosen && chosen !== "auto") {
      return pinnedProjects.find((p) => p.name === chosen) ?? pinnedProjects[0];
    }
    // Auto: the project with the most stars.
    return [...pinnedProjects].sort(
      (a, b) => b.stargazers.totalCount - a.stargazers.totalCount,
    )[0];
  }, [pinnedProjects]);
  const filtering = Boolean(searchQuery || selectedTech);
  const hero = filtering ? null : spotlight;
  const loadingAllShown =
    loadingAll ||
    (viewMode === "all" && contextLoading && allProjects.length === 0);
  const gridProjects = useMemo(
    () =>
      hero
        ? filteredProjects.filter(
            (project) => project.id !== hero.id && project.url !== hero.url,
          )
        : filteredProjects,
    [filteredProjects, hero],
  );

  // Calculate statistics for all projects only
  const stats = useMemo(() => {
    // Use all projects if available, otherwise fall back to pinned projects
    const projectsToCount =
      allProjects.length > 0 ? allProjects : normalizedPinnedProjects;

    const totalStars = projectsToCount.reduce(
      (sum, p) => sum + p.stargazerCount,
      0,
    );
    const totalForks = projectsToCount.reduce((sum, p) => sum + p.forkCount, 0);
    const languages = new Set(
      projectsToCount.map((p) => p.primaryLanguage?.name).filter(Boolean),
    );

    return {
      totalProjects: projectsToCount.length,
      totalStars,
      totalForks,
      languageCount: languages.size,
    };
  }, [allProjects, normalizedPinnedProjects]);

  return (
    <div className="container mx-auto px-4 md:px-16 pt-20 pb-8 sm:pt-24 sm:pb-16 max-w-7xl relative">
      <div className="lg:px-8">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="section-title-gradient">{projectsSection.title}</h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto">
            <span className="text-primary font-semibold">
              {projectsSection.subtitle.highlightedText}
            </span>
            {" • "}
            {projectsSection.subtitle.normalText}
          </p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 mb-8 sm:mb-12">
          <HolographicStatsCard glowColor="59, 130, 246" delay={0.1}>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-primary mb-0.5 sm:mb-1">
                {stats.totalProjects}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                Projects
              </div>
            </div>
          </HolographicStatsCard>

          <HolographicStatsCard glowColor="250, 204, 21" delay={0.15}>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-yellow-700 dark:text-yellow-400 mb-0.5 sm:mb-1">
                {stats.totalStars}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                Stars Earned
              </div>
            </div>
          </HolographicStatsCard>

          <HolographicStatsCard glowColor="34, 197, 94" delay={0.2}>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-green-700 dark:text-green-400 mb-0.5 sm:mb-1">
                {stats.totalForks}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                Forks
              </div>
            </div>
          </HolographicStatsCard>

          <HolographicStatsCard glowColor="139, 92, 246" delay={0.25}>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-purple-700 dark:text-purple-400 mb-0.5 sm:mb-1">
                {stats.languageCount}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                Languages
              </div>
            </div>
          </HolographicStatsCard>
        </div>

        {/* Controls: above the spotlight, which a search or a filter
            hides, so nothing above them moves as they are used. */}
        <div className="mb-8 space-y-4">
          {/* View Mode Toggle */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-pressed={viewMode === "featured"}
                onClick={() => setViewMode("featured")}
                className={cn(
                  "px-4 py-2 rounded-lg font-medium transition-all duration-200",
                  viewMode === "featured"
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                <Sparkles
                  className="w-4 h-4 inline-block mr-2"
                  aria-hidden="true"
                />
                Featured
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "all"}
                onClick={showAllProjects}
                className={cn(
                  "px-4 py-2 rounded-lg font-medium transition-all duration-200",
                  viewMode === "all"
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                <Grid
                  className="w-4 h-4 inline-block mr-2"
                  aria-hidden="true"
                />
                All Projects
              </button>
            </div>

            {/* Layout Toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-pressed={layoutMode === "grid"}
                onClick={() => setLayoutMode("grid")}
                className={cn(
                  "p-2 rounded-lg transition-all duration-200",
                  layoutMode === "grid"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
                aria-label="Grid view"
              >
                <Grid className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-pressed={layoutMode === "list"}
                onClick={() => setLayoutMode("list")}
                className={cn(
                  "p-2 rounded-lg transition-all duration-200",
                  layoutMode === "list"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
                aria-label="List view"
              >
                <List className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <label htmlFor="project-search" className="sr-only">
              Search projects
            </label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              id="project-search"
              name="project-search"
              type="search"
              autoComplete="off"
              placeholder="Search projects by name, description, or topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
            />
          </div>

          {/* Technology Filter */}
          {uniqueTechnologies.length > 0 && (
            <ProjectFilter
              technologies={uniqueTechnologies}
              selectedTech={selectedTech}
              onSelectTech={setSelectedTech}
            />
          )}
        </div>

        {/* Featured Project Hero */}
        {hero && (
          <SlideInUp className="mb-8 sm:mb-16 relative z-10">
            <m.div
              className="relative"
              whileHover={{ scale: 1.01 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              style={{ willChange: "transform" }}
            >
              {/* Featured Badge */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-background px-4 py-1 rounded-full border border-primary z-10">
                <span className="text-sm font-semibold text-primary flex items-center gap-1">
                  <Zap className="w-4 h-4" />
                  Featured Project
                </span>
              </div>

              {(() => {
                const featuredProject = hero;
                const projectColor = getProjectColor(
                  featuredProject.primaryLanguage?.color,
                  featuredProject.primaryLanguage?.name,
                );

                return (
                  <>
                    <HolographicCard glowColor={projectColor}>
                      <div className="p-6 sm:p-8">
                        <div className="text-center mb-4 sm:mb-6">
                          <div className="flex items-center justify-center gap-3 mb-3">
                            <div className="relative">
                              <m.div
                                className="w-14 h-14 rounded-full flex items-center justify-center"
                                style={{
                                  backgroundColor: `rgba(${projectColor}, 0.1)`,
                                }}
                                whileHover={{ scale: 1.1 }}
                              >
                                {(() => {
                                  const LanguageIcon = getLanguageIcon(
                                    featuredProject.primaryLanguage?.name,
                                  );
                                  return (
                                    <LanguageIcon
                                      className="w-7 h-7"
                                      style={{ color: `rgb(${projectColor})` }}
                                    />
                                  );
                                })()}
                              </m.div>
                              {/* Breathing effect: a CSS loop (motion.css) */}
                              <div
                                className="absolute inset-0 rounded-full pointer-events-none anim-decor anim-breathe-120"
                                style={{
                                  backgroundColor: `rgb(${projectColor})`,
                                  opacity: 0.1,
                                  willChange: "transform",
                                }}
                              />
                            </div>
                          </div>
                          <h3 className="text-xl sm:text-2xl font-bold mb-2 bg-linear-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                            {featuredProject.name}
                          </h3>
                          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
                            {featuredProject.description}
                          </p>
                        </div>

                        {/* Visual Representation */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                          <ScaleIn>
                            <m.div
                              className="bg-card rounded-lg p-3 sm:p-4 text-center border border-primary/20 hover:border-primary/50 transition-all hover:shadow-lg min-h-[100px] sm:min-h-[120px] flex flex-col justify-between"
                              whileHover={{ scale: 1.05 }}
                              transition={{
                                type: "spring",
                                stiffness: 300,
                                damping: 20,
                              }}
                            >
                              <div>
                                <Star className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1.5 sm:mb-2 text-yellow-500" />
                                <p className="text-lg sm:text-xl font-bold mb-1">
                                  {featuredProject.stargazers.totalCount}
                                </p>
                              </div>
                              <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">
                                Stars
                              </p>
                            </m.div>
                          </ScaleIn>
                          <ScaleIn>
                            <m.div
                              className="bg-card rounded-lg p-3 sm:p-4 text-center border border-primary/20 hover:border-primary/50 transition-all hover:shadow-lg min-h-[100px] sm:min-h-[120px] flex flex-col justify-between"
                              whileHover={{ scale: 1.05 }}
                              transition={{
                                type: "spring",
                                stiffness: 300,
                                damping: 20,
                              }}
                            >
                              <div>
                                <GitFork className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1.5 sm:mb-2 text-blue-500" />
                                <p className="text-lg sm:text-xl font-bold mb-1">
                                  {featuredProject.forkCount}
                                </p>
                              </div>
                              <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">
                                Forks
                              </p>
                            </m.div>
                          </ScaleIn>
                          <ScaleIn>
                            <m.div
                              className="bg-card rounded-lg p-3 sm:p-4 text-center border border-primary/20 hover:border-primary/50 transition-all hover:shadow-lg min-h-[100px] sm:min-h-[120px] flex flex-col justify-between"
                              whileHover={{ scale: 1.05 }}
                              transition={{
                                type: "spring",
                                stiffness: 300,
                                damping: 20,
                              }}
                            >
                              <div>
                                <FileCode2
                                  className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1.5 sm:mb-2"
                                  style={{
                                    color: `rgb(${projectColor})`,
                                  }}
                                />
                                <p className="text-xs sm:text-sm font-bold mb-1">
                                  {featuredProject.primaryLanguage?.name ||
                                    "Mixed"}
                                </p>
                              </div>
                              <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">
                                Primary Language
                              </p>
                            </m.div>
                          </ScaleIn>
                          <ScaleIn>
                            <m.div
                              className="bg-card rounded-lg p-3 sm:p-4 text-center border border-primary/20 hover:border-primary/50 transition-all hover:shadow-lg min-h-[100px] sm:min-h-[120px] flex flex-col justify-between"
                              whileHover={{ scale: 1.05 }}
                              transition={{
                                type: "spring",
                                stiffness: 300,
                                damping: 20,
                              }}
                            >
                              <div>
                                <Activity className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1.5 sm:mb-2 text-green-500" />
                                <p className="text-xs sm:text-sm font-bold mb-1">
                                  {formatFileSizeDisplay(
                                    featuredProject.diskUsage,
                                  )}
                                </p>
                              </div>
                              <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">
                                Repository Size
                              </p>
                            </m.div>
                          </ScaleIn>
                        </div>

                        <div className="flex justify-center">
                          <Link
                            href={featuredProject.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all hover:scale-105 hover:shadow-lg"
                          >
                            <ExternalLink className="w-4 h-4" />
                            View on GitHub
                          </Link>
                        </div>
                      </div>
                    </HolographicCard>
                  </>
                );
              })()}
            </m.div>
          </SlideInUp>
        )}

        {/* Loading indicator for all projects */}
        {loadingAllShown && (
          <div className="text-center py-8">
            <div className="inline-flex items-center gap-2 text-muted-foreground">
              <div
                className={cn(
                  "rounded-full h-4 w-4 border-b-2 border-primary",
                  !shouldReduceAnimations && "animate-spin",
                )}
              ></div>
              Loading all repositories...
            </div>
          </div>
        )}

        {/* Projects Display */}
        {filteredProjects.length === 0 ? (
          loadingAllShown ? null : (
            <div
              className={cn(
                "text-center py-12",
                !shouldReduceAnimations && "animate-fade-in",
              )}
            >
              {/* With no filter on, an empty list means nothing loaded. */}
              {filtering ? (
                <p className="text-muted-foreground">
                  No projects found matching your criteria.
                  <button
                    onClick={() => {
                      setSelectedTech(null);
                      setSearchQuery("");
                    }}
                    className="text-primary hover:underline ml-1"
                  >
                    Clear filters
                  </button>
                </p>
              ) : (
                <p className="text-muted-foreground">
                  The projects could not load from GitHub.
                </p>
              )}
            </div>
          )
        ) : gridProjects.length === 0 ? null : (
          <div
            className={cn(
              layoutMode === "grid"
                ? "grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6"
                : "space-y-4",
            )}
          >
            {gridProjects.map((project) => (
              <SlideInUp key={project.id} className="group">
                {layoutMode === "grid" ? (
                  <m.div
                    className="relative h-full cursor-pointer"
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    // A click anywhere on the card opens its details, as the
                    // button on its name does (Enter and Space come from
                    // there). No will-change: it made every card a stacking
                    // context and a layer of its own.
                    onClick={(event) => {
                      const card = event.currentTarget;
                      const trigger = card.querySelector<HTMLElement>(
                        '[aria-haspopup="dialog"]',
                      );
                      // A drag that selected text is not asking for details.
                      const selection = window.getSelection();
                      const selecting =
                        !!selection &&
                        !selection.isCollapsed &&
                        card.contains(selection.anchorNode);
                      if (
                        selecting &&
                        !trigger?.contains(event.target as Node)
                      ) {
                        return;
                      }
                      setDetails({ project, trigger });
                    }}
                  >
                    <HolographicCard
                      glowColor={getProjectColor(
                        project.primaryLanguage?.color,
                        project.primaryLanguage?.name,
                      )}
                    >
                      <div className="h-full p-3 sm:p-4 md:p-6 flex flex-col">
                        {/* Project Header */}
                        <div className="flex items-start gap-3 mb-2 sm:mb-3">
                          <div className="relative">
                            <m.div
                              className="w-10 h-10 rounded-full flex items-center justify-center"
                              style={{
                                backgroundColor: `rgba(${getProjectColor(
                                  project.primaryLanguage?.color,
                                  project.primaryLanguage?.name,
                                )}, 0.1)`,
                              }}
                              whileHover={{ scale: 1.1 }}
                            >
                              {(() => {
                                const LanguageIcon = getLanguageIcon(
                                  project.primaryLanguage?.name,
                                );
                                return (
                                  <LanguageIcon
                                    className="w-5 h-5"
                                    style={{
                                      color: `rgb(${getProjectColor(
                                        project.primaryLanguage?.color,
                                        project.primaryLanguage?.name,
                                      )})`,
                                    }}
                                  />
                                );
                              })()}
                            </m.div>
                            {/* Breathing effect: a CSS loop (motion.css) */}
                            <div
                              className="absolute inset-0 rounded-full pointer-events-none anim-decor anim-breathe-115"
                              style={{
                                backgroundColor: `rgb(${getProjectColor(
                                  project.primaryLanguage?.color,
                                  project.primaryLanguage?.name,
                                )})`,
                                opacity: 0.1,
                                willChange: "transform",
                              }}
                            />
                          </div>
                          {/* No min-w-0 and no wrap-break-word: a long name breaks
                              at its hyphens. With them it broke inside a word
                              on phones ("optimizatio", "n-studies"); a name
                              with no hyphen is clipped by the card, and the
                              dialog shows it whole. */}
                          <div className="flex-1">
                            <h3 className="text-base sm:text-lg md:text-xl font-bold mb-1">
                              <button
                                type="button"
                                aria-haspopup="dialog"
                                className="rounded-xs text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                              >
                                <span className="bg-linear-to-r from-foreground to-foreground hover:from-primary hover:to-purple-600 bg-clip-text text-transparent transition-all duration-300">
                                  {project.name}
                                </span>
                              </button>
                            </h3>
                            <span
                              aria-hidden="true"
                              className="text-xs text-primary opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                            >
                              Click to explore
                            </span>
                          </div>
                        </div>

                        {/* Description. The wrapper takes the row's spare
                            height: on the clamped paragraph, flex-grow
                            stretched it past its clamp next to a taller
                            card, and the lines after the ellipsis showed in
                            the extra height (5 under a 2-line clamp). */}
                        <div className="grow mb-3 sm:mb-4">
                          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 sm:line-clamp-3">
                            {project.description || "No description available."}
                          </p>
                        </div>

                        {/* Topics - Hidden on mobile for space */}
                        {project.topics && project.topics.edges.length > 0 && (
                          <div className="hidden sm:flex flex-wrap gap-1 mb-4">
                            {project.topics.edges.slice(0, 3).map((edge, i) => (
                              <span
                                key={i}
                                className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full"
                              >
                                {edge.node.topic.name}
                              </span>
                            ))}
                            {project.topics.edges.length > 3 && (
                              <span className="px-2 py-1 text-xs text-muted-foreground">
                                +{project.topics.edges.length - 3}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Stats */}
                        <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                          <span className="flex items-center gap-0.5 sm:gap-1">
                            <Star className="w-3 h-3 sm:w-4 sm:h-4" />
                            {project.stargazerCount}
                          </span>
                          <span className="flex items-center gap-0.5 sm:gap-1">
                            <GitFork className="w-3 h-3 sm:w-4 sm:h-4" />
                            {project.forkCount}
                          </span>
                          {project.updatedAt && (
                            <span className="hidden sm:flex items-center gap-1 ml-auto">
                              <Calendar className="w-4 h-4" />
                              {new Date(project.updatedAt).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  year: "numeric",
                                },
                              )}
                            </span>
                          )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between mt-auto pt-3 sm:pt-4 border-t border-border">
                          {/* Languages */}
                          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                            {project.primaryLanguage && (
                              <div className="flex items-center gap-0.5 sm:gap-1">
                                <span
                                  className="w-2 h-2 sm:w-3 sm:h-3 rounded-full"
                                  style={{
                                    backgroundColor:
                                      project.primaryLanguage.color,
                                  }}
                                  aria-hidden="true"
                                />
                                <span className="text-[10px] sm:text-sm truncate max-w-[60px] sm:max-w-none">
                                  {project.primaryLanguage.name}
                                </span>
                              </div>
                            )}
                            {project.languages &&
                              project.languages.edges.length > 1 && (
                                <span className="text-[10px] sm:text-xs text-muted-foreground">
                                  +{project.languages.edges.length - 1}
                                </span>
                              )}
                          </div>

                          {/* Size - Hidden on mobile */}
                          <span className="hidden sm:block text-sm text-muted-foreground">
                            {formatFileSizeDisplay(project.diskUsage)}
                          </span>
                        </div>
                      </div>
                    </HolographicCard>
                  </m.div>
                ) : (
                  <m.div
                    className="relative"
                    whileHover={{ scale: 1.01 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <HolographicCard
                      glowColor={getProjectColor(
                        project.primaryLanguage?.color,
                        project.primaryLanguage?.name,
                      )}
                    >
                      <Link
                        href={project.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <div className="p-3 sm:p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="text-base sm:text-lg font-semibold group-hover:text-primary group-focus-within:text-primary transition-colors flex items-center gap-1 sm:gap-2">
                                {project.name}
                                <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0" />
                              </h3>
                              <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-1">
                                {project.description ||
                                  "No description available."}
                              </p>
                              <div className="flex items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm text-muted-foreground">
                                {project.primaryLanguage && (
                                  <div className="flex items-center gap-0.5 sm:gap-1">
                                    <span
                                      className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full"
                                      style={{
                                        backgroundColor:
                                          project.primaryLanguage.color,
                                      }}
                                    />
                                    <span className="truncate max-w-[60px] sm:max-w-none">
                                      {project.primaryLanguage.name}
                                    </span>
                                  </div>
                                )}
                                <span className="flex items-center gap-0.5 sm:gap-1">
                                  <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                  {project.stargazerCount}
                                </span>
                                <span className="flex items-center gap-0.5 sm:gap-1">
                                  <GitFork className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                  {project.forkCount}
                                </span>
                                {project.updatedAt && (
                                  <span className="hidden sm:block ml-auto">
                                    Updated{" "}
                                    {new Date(
                                      project.updatedAt,
                                    ).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </HolographicCard>
                  </m.div>
                )}
              </SlideInUp>
            ))}
          </div>
        )}

        {/* Rendered once, outside every card: React events bubble through
            a portal along the component tree, so inside a card's onClick
            wrapper every click in the dialog would reach the card. A pinned
            repository shows its full record once all are loaded. */}
        {details && (
          <ProjectDetailsDialog
            project={
              allProjects.find(
                (candidate) =>
                  candidate.id === details.project.id ||
                  candidate.url === details.project.url,
              ) ?? details.project
            }
            returnFocus={details.trigger}
            onClose={closeDetails}
          />
        )}

        {/* GitHub Profile Link */}
        <div className="text-center mt-12">
          <Link
            href={`https://github.com/${process.env.NEXT_PUBLIC_GH_USERNAME || "RomainClaret"}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-primary hover:underline transition-colors"
          >
            <i className="fab fa-github text-xl" aria-hidden="true" />
            Follow me on GitHub for more
          </Link>
        </div>
      </div>
    </div>
  );
}
