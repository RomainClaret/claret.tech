"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { projectsSection } from "@/data/portfolio";
import { logError } from "@/lib/utils/dev-logger";
import { withLoadFallback } from "@/lib/utils/load-fallback";
import { loadOnIntent } from "@/lib/utils/load-on-intent";
import { reloadPage } from "@/lib/utils/reload-page";
import type { PinnedRepository } from "./ProjectsContent";

// What /api/fetch-github and /profile.json both answer: the GitHub user,
// pinned repositories included, when there is one.
interface PinnedAnswer {
  success: boolean;
  data?: {
    pinnedItems: {
      edges: Array<{
        node: PinnedRepository;
      }>;
    };
  } | null;
}

// The live API first, then the snapshot the deploy build saved
// (src/app/profile.json/route.ts): one request each, at most.
const PINNED_SOURCES = ["/api/fetch-github", "/profile.json"];

/** The section until its repositories and its code are in, as the HTML has it. */
function ProjectsLoading() {
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

/**
 * In the cards' place while their code cannot be fetched: no connection, or
 * a deploy since this page loaded (Vercel's Hobby plan keeps no older
 * chunks). Without it, React.lazy threw and the page's error boundary
 * replaced every section.
 */
function ProjectsUnavailable({
  retry,
  retrying,
}: {
  retry: () => void;
  retrying: boolean;
}) {
  return (
    <div className="container mx-auto px-4 py-16 max-w-7xl">
      <div className="lg:px-8 text-center" role="alert">
        <h2 className="section-title-gradient">Projects</h2>
        <p className="text-muted-foreground">The projects could not load.</p>
        <div className="mt-4 flex justify-center gap-4 text-sm">
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            className="text-primary hover:underline disabled:opacity-60 disabled:no-underline"
          >
            {retrying ? "Trying again..." : "Try again"}
          </button>
          {!retrying && (
            <button
              type="button"
              onClick={reloadPage}
              className="text-primary hover:underline"
            >
              Reload page
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// The cards' code comes with the repositories: its import starts beside
// their fetch, below, and the section shows once both are in.
const content = loadOnIntent(() => import("./ProjectsContent"));
const ProjectsContent = dynamic(
  withLoadFallback(
    () => content.load().then((mod) => mod.ProjectsContent),
    ProjectsUnavailable,
    {
      onError: (error) => logError(error, "Projects chunk"),
      peek: () => content.loaded()?.ProjectsContent,
    },
  ),
  { ssr: false, loading: ProjectsLoading },
);

export function Projects() {
  const [pinnedProjects, setPinnedProjects] = useState<PinnedRepository[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch pinned projects. The fallback used to read a file nothing built,
  // twice: once when the API had no data, and again from the catch that the
  // failed read landed in.
  useEffect(() => {
    content.preload();
    async function fetchPinnedProjects() {
      try {
        for (const url of PINNED_SOURCES) {
          try {
            const response = await fetch(url);
            const result: PinnedAnswer = await response.json();
            if (result.success && result.data) {
              setPinnedProjects(
                result.data.pinnedItems.edges.map((edge) => edge.node),
              );
              return;
            }
          } catch (error) {
            logError(error, `Projects.fetchPinnedProjects ${url}`);
          }
        }
      } finally {
        setLoading(false);
      }
    }

    fetchPinnedProjects();
  }, []);

  if (!projectsSection.display) {
    return null;
  }

  if (loading) {
    return <ProjectsLoading />;
  }

  return <ProjectsContent pinnedProjects={pinnedProjects} />;
}
