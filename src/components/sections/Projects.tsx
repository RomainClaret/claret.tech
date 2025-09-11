"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { FadeIn, SlideInUp, ScaleIn } from "@/components/ui/animated";
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
  Code2,
  Sparkles,
  Zap,
  FileCode2,
  Activity,
} from "lucide-react";
import { ProjectFilter } from "@/components/ui/project-filter";
import { useProjects } from "@/contexts/projects-context";
import { HolographicCard } from "@/components/ui/holographic-card";
import { HolographicStatsCard } from "@/components/ui/holographic-stats-card";
import { motion } from "framer-motion";
import { getProjectColor, getLanguageIcon } from "@/lib/utils/language-colors";
import { projectsSection } from "@/data/portfolio";
import { logError } from "@/lib/utils/dev-logger";

interface PinnedRepository {
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

interface Repository {
  id: string;
  name: string;
  description: string | null;
  url: string;
  homepageUrl: string | null;
  stargazerCount: number;
  forkCount: number;
  primaryLanguage: {
    name: string;
    color: string;
  } | null;
  languages?: {
    edges: Array<{
      node: {
        name: string;
        color: string;
      };
      size: number;
    }>;
  };
  topics?: {
    edges: Array<{
      node: {
        topic: {
          name: string;
        };
      };
    }>;
  };
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  isPrivate: boolean;
  isArchived: boolean;
  diskUsage: number;
  isFork: boolean;
  parent?: {
    nameWithOwner: string;
  } | null;
}

interface GitHubData {
  data: {
    user: {
      name: string;
      bio: string;
      avatarUrl: string;
      location: string;
      pinnedItems: {
        totalCount: number;
        edges: Array<{
          node: PinnedRepository;
        }>;
      };
    };
  };
}

type ViewMode = "featured" | "all";
type LayoutMode = "grid" | "list";

export function Projects() {
  const shouldReduceAnimations = useShouldReduceAnimations();
  const [pinnedProjects, setPinnedProjects] = useState<PinnedRepository[]>([]);
  const {
    allProjects,
    setAllProjects,
    isLoading: contextLoading,
  } = useProjects();
  const [loading, setLoading] = useState(true);
  const [loadingAll, setLoadingAll] = useState(false);
  const [selectedTech, setSelectedTech] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("featured");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("grid");
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  // Fetch pinned projects
  useEffect(() => {
    async function fetchPinnedProjects() {
      try {
        const response = await fetch("/api/fetch-github");
        const result = await response.json();

        if (result.success && result.data) {
          setPinnedProjects(
            result.data.pinnedItems.edges.map(
              (edge: { node: PinnedRepository }) => edge.node,
            ),
          );
        } else {
          const fallbackResponse = await fetch("/profile.json");
          const data: GitHubData = await fallbackResponse.json();
          setPinnedProjects(
            data.data.user.pinnedItems.edges.map((edge) => edge.node),
          );
        }
      } catch (error) {
        // Only log in non-test environments to avoid test stderr pollution
        if (typeof process === "undefined" || process.env.NODE_ENV !== "test") {
          logError(error, "Projects.fetchPinnedProjects");
        }
        try {
          const fallbackResponse = await fetch("/profile.json");
          const data: GitHubData = await fallbackResponse.json();
          setPinnedProjects(
            data.data.user.pinnedItems.edges.map((edge) => edge.node),
          );
        } catch (fallbackError) {
          logError(fallbackError, "Projects.fetchPinnedProjects.fallback");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchPinnedProjects();
  }, []);

  // Fetch all projects when switching to "all" view
  const fetchAllProjects = useCallback(async () => {
    // If already loaded from context or currently loading, skip
    if (allProjects.length > 0 || loadingAll || contextLoading) return;

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
  }, [allProjects.length, loadingAll, contextLoading, setAllProjects]);

  useEffect(() => {
    if (viewMode === "all") {
      fetchAllProjects();
    }
  }, [viewMode, fetchAllProjects]);

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

  // Check if section should be displayed
  if (!projectsSection.display) {
    return null;
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-7xl">
        <div className="lg:px-8">
          <div className="text-center">
            <h2 className="section-title-gradient">Projects</h2>
            <p className="text-muted-foreground">Loading projects...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 md:px-16 pt-20 pb-8 sm:pt-24 sm:pb-16 max-w-7xl relative">
      <div className="lg:px-8">
        <FadeIn className="text-center mb-8 sm:mb-12">
          <h2 className="section-title-gradient">{projectsSection.title}</h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto">
            <span className="text-primary font-semibold">
              {projectsSection.subtitle.highlightedText}
            </span>
            {""}
            {projectsSection.subtitle.normalText}
          </p>
        </FadeIn>

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
              <div className="text-2xl sm:text-3xl font-bold text-yellow-500 mb-0.5 sm:mb-1">
                {stats.totalStars}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                Stars Earned
              </div>
            </div>
          </HolographicStatsCard>

          <HolographicStatsCard glowColor="34, 197, 94" delay={0.2}>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-green-500 mb-0.5 sm:mb-1">
                {stats.totalForks}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                Forks
              </div>
            </div>
          </HolographicStatsCard>

          <HolographicStatsCard glowColor="139, 92, 246" delay={0.25}>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-purple-500 mb-0.5 sm:mb-1">
                {stats.languageCount}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                Languages
              </div>
            </div>
          </HolographicStatsCard>
        </div>

        {/* Featured Project Hero */}
        {pinnedProjects.length > 0 && (
          <SlideInUp delay={200} className="mb-8 sm:mb-16 relative z-10">
            <motion.div
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

              {/* Get the featured project based on configuration */}
              {(() => {
                let featuredProject: PinnedRepository;

                // Check if manual selection is configured
                if (
                  projectsSection.featuredProject &&
                  projectsSection.featuredProject !== "auto" &&
                  projectsSection.featuredProject !== null
                ) {
                  // Try to find the manually specified project
                  const manualProject = pinnedProjects.find(
                    (p) => p.name === projectsSection.featuredProject,
                  );
                  featuredProject = manualProject || pinnedProjects[0];
                } else {
                  // Auto mode: select project with most stars
                  featuredProject = [...pinnedProjects].sort(
                    (a, b) => b.stargazers.totalCount - a.stargazers.totalCount,
                  )[0];
                }

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
                              <motion.div
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
                              </motion.div>
                              <motion.div
                                className="absolute inset-0 rounded-full pointer-events-none"
                                style={{
                                  backgroundColor: `rgb(${projectColor})`,
                                  opacity: 0.1,
                                  willChange: "transform",
                                }}
                                animate={{
                                  scale: [1, 1.2, 1],
                                }}
                                transition={{
                                  duration: 3,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                }}
                              />
                            </div>
                          </div>
                          <h3 className="text-xl sm:text-2xl font-bold mb-2 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                            {featuredProject.name}
                          </h3>
                          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
                            {featuredProject.description}
                          </p>
                        </div>

                        {/* Visual Representation */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                          <ScaleIn delay={300}>
                            <motion.div
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
                            </motion.div>
                          </ScaleIn>
                          <ScaleIn delay={350}>
                            <motion.div
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
                            </motion.div>
                          </ScaleIn>
                          <ScaleIn delay={400}>
                            <motion.div
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
                            </motion.div>
                          </ScaleIn>
                          <ScaleIn delay={450}>
                            <motion.div
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
                            </motion.div>
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
            </motion.div>
          </SlideInUp>
        )}

        {/* Controls */}
        <FadeIn delay={200} className="mb-8 space-y-4">
          {/* View Mode Toggle */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode("featured")}
                className={cn(
                  "px-4 py-2 rounded-lg font-medium transition-all duration-200",
                  viewMode === "featured"
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                <Sparkles className="w-4 h-4 inline-block mr-2" />
                Featured
              </button>
              <button
                onClick={() => setViewMode("all")}
                className={cn(
                  "px-4 py-2 rounded-lg font-medium transition-all duration-200",
                  viewMode === "all"
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                <Grid className="w-4 h-4 inline-block mr-2" />
                All Projects
              </button>
            </div>

            {/* Layout Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLayoutMode("grid")}
                className={cn(
                  "p-2 rounded-lg transition-all duration-200",
                  layoutMode === "grid"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
                aria-label="Grid view"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setLayoutMode("list")}
                className={cn(
                  "p-2 rounded-lg transition-all duration-200",
                  layoutMode === "list"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
                aria-label="List view"
              >
                <List className="w-4 h-4" />
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
              className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
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
        </FadeIn>

        {/* Loading indicator for all projects */}
        {(loadingAll ||
          (viewMode === "all" &&
            contextLoading &&
            allProjects.length === 0)) && (
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
          <div
            className={cn(
              "text-center py-12",
              !shouldReduceAnimations && "animate-fade-in",
            )}
          >
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
          </div>
        ) : (
          <div
            className={cn(
              layoutMode === "grid"
                ? "grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6"
                : "space-y-4",
            )}
          >
            {filteredProjects.map((project, index) => (
              <SlideInUp
                key={project.id}
                delay={Math.min(index * 50, 300)}
                className="group"
              >
                {layoutMode === "grid" ? (
                  <motion.div
                    className="relative h-full cursor-pointer"
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    onClick={() =>
                      setExpandedProject(
                        expandedProject === project.id ? null : project.id,
                      )
                    }
                    style={{ willChange: "transform" }}
                  >
                    <HolographicCard
                      glowColor={getProjectColor(
                        project.primaryLanguage?.color,
                        project.primaryLanguage?.name,
                      )}
                      className="h-full"
                      isActive={expandedProject === project.id}
                    >
                      <div className="h-full p-3 sm:p-4 md:p-6 flex flex-col">
                        {/* Project Header */}
                        <div className="flex items-start gap-3 mb-2 sm:mb-3">
                          <div className="relative">
                            <motion.div
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
                            </motion.div>
                            {/* Breathing effect */}
                            <motion.div
                              className="absolute inset-0 rounded-full pointer-events-none"
                              style={{
                                backgroundColor: `rgb(${getProjectColor(
                                  project.primaryLanguage?.color,
                                  project.primaryLanguage?.name,
                                )})`,
                                opacity: 0.1,
                                willChange: "transform",
                              }}
                              animate={{
                                scale: [1, 1.15, 1],
                              }}
                              transition={{
                                duration: 3,
                                repeat: Infinity,
                                ease: "easeInOut",
                              }}
                            />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-base sm:text-lg md:text-xl font-bold mb-1 bg-gradient-to-r from-foreground to-foreground hover:from-primary hover:to-purple-600 bg-clip-text text-transparent transition-all duration-300">
                              {project.name}
                            </h3>
                            <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                              Click to explore
                            </span>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 flex-grow line-clamp-2 sm:line-clamp-3">
                          {project.description || "No description available."}
                        </p>

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

                    {/* Expanded Details */}
                    {expandedProject === project.id && (
                      <FadeIn className="mt-4 bg-card rounded-xl p-6 border border-border">
                        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                          {project.description ||
                            "No detailed description available."}
                        </p>

                        {/* Topics/Tags */}
                        {project.topics && project.topics.edges.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-primary" />
                              Topics
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {project.topics.edges.map((edge, i) => (
                                <span
                                  key={i}
                                  className="px-2.5 py-1 text-xs rounded-lg font-medium"
                                  style={{
                                    backgroundColor: `rgba(${getProjectColor(
                                      project.primaryLanguage?.color,
                                      project.primaryLanguage?.name,
                                    )}, 0.1)`,
                                    color: `rgb(${getProjectColor(
                                      project.primaryLanguage?.color,
                                      project.primaryLanguage?.name,
                                    )})`,
                                    border: `1px solid rgba(${getProjectColor(
                                      project.primaryLanguage?.color,
                                      project.primaryLanguage?.name,
                                    )}, 0.3)`,
                                  }}
                                >
                                  {edge.node.topic.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Language Breakdown */}
                        {project.languages &&
                          project.languages.edges.length > 1 && (
                            <div className="mb-4">
                              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <Code2 className="w-4 h-4 text-primary" />
                                Languages
                              </h4>
                              <div className="flex flex-wrap gap-3">
                                {project.languages.edges.map((edge, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center gap-1.5 text-sm"
                                  >
                                    <span
                                      className="w-3 h-3 rounded-full"
                                      style={{
                                        backgroundColor:
                                          edge.node.color || "#666",
                                      }}
                                    />
                                    <span className="text-muted-foreground">
                                      {edge.node.name}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        {/* Activity Info */}
                        <div className="mb-4">
                          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-primary" />
                            Activity
                          </h4>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            {project.createdAt && (
                              <div>
                                <span className="text-muted-foreground">
                                  Created:{" "}
                                </span>
                                <span className="font-medium">
                                  {new Date(
                                    project.createdAt,
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                              </div>
                            )}
                            {project.pushedAt && (
                              <div>
                                <span className="text-muted-foreground">
                                  Last push:{" "}
                                </span>
                                <span className="font-medium">
                                  {new Date(
                                    project.pushedAt,
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Links */}
                        <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
                          <Link
                            href={project.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline transition-colors font-medium"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="w-4 h-4" />
                            View on GitHub
                          </Link>
                          {project.homepageUrl && (
                            <Link
                              href={project.homepageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline transition-colors font-medium"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-4 h-4" />
                              Live Demo
                            </Link>
                          )}
                        </div>
                      </FadeIn>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
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
                              <h3 className="text-base sm:text-lg font-semibold group-hover:text-primary transition-colors flex items-center gap-1 sm:gap-2">
                                {project.name}
                                <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
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
                  </motion.div>
                )}
              </SlideInUp>
            ))}
          </div>
        )}

        {/* GitHub Profile Link */}
        <FadeIn delay={300} className="text-center mt-12">
          <Link
            href={`https://github.com/${process.env.NEXT_PUBLIC_GH_USERNAME || "RomainClaret"}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-primary hover:underline transition-colors"
          >
            <i className="fab fa-github text-xl" aria-hidden="true" />
            Follow me on GitHub for more
          </Link>
        </FadeIn>
      </div>
    </div>
  );
}
