"use client";

import { createContext, useContext, useState, ReactNode } from "react";

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

interface ProjectsContextType {
  allProjects: Repository[];
  setAllProjects: (projects: Repository[]) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const ProjectsContext = createContext<ProjectsContextType | undefined>(
  undefined,
);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [allProjects, setAllProjects] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <ProjectsContext.Provider
      value={{
        allProjects,
        setAllProjects,
        isLoading,
        setIsLoading,
      }}
    >
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectsContext);
  if (!context) {
    throw new Error("useProjects must be used within a ProjectsProvider");
  }
  return context;
}
