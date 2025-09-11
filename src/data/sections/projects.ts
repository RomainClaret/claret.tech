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
      "—Need it? Build it. Broken? Fix it. Too slow? Optimize it. Each project here exists because I needed it and nobody else had done it right. From automating kernels to analyzing evolutionary data, from research pipelines to visualization tools—every problem has a solution waiting to be coded.",
  },
  // Featured project selection:
  // - "auto" or null: Automatically select the project with the most stars
  // - "project-name": Manually specify a project name to feature
  // - Set to a specific project name if you want to manually feature it
  featuredProject: "auto", // Change to a project name like "bop-the-slop" to manually feature it
};
