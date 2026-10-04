// Projects section data

export interface ProjectsSection {
  display: boolean;
  title: string;
  subtitle: {
    highlightedText: string;
    normalText: string;
  };
  featuredProject?: string | "auto" | null; // null or "auto" = automatic (highest stars), string = specific project name
}

export const projectsSection: ProjectsSection = {
  display: true,
  title: "Software Engineering Playground",
  subtitle: {
    highlightedText: "Building tools that should exist but don't",
    normalText:
      "Most of these exist because I needed them and could not find one that did the job: research pipelines, kernel automation, tools for analyzing evolutionary runs, and visualizations. A few are finished. Most are good enough for what I needed them for.",
  },
  // Featured project selection:
  // - "auto" or null: Automatically select the project with the most stars
  // - "project-name": Manually specify a project name to feature
  // - Set to a specific project name if you want to manually feature it
  featuredProject: "auto", // Change to a project name like "bop-the-slop" to manually feature it
};
