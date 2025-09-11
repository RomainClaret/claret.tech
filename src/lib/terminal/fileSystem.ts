// Virtual file system for the terminal

export interface VirtualFile {
  type: "file" | "directory";
  name: string;
  content?: string;
  hidden?: boolean;
  children?: { [key: string]: VirtualFile };
}

export const fileSystem: VirtualFile = {
  type: "directory",
  name: "/",
  children: {
    "README.md": {
      type: "file",
      name: "README.md",
      content: `Interactive terminal exploring the intersection of human and machine intelligence.

Type 'help' to begin.`,
    },
    file: {
      type: "file",
      name: "file",
      content: "This is a simple text file in the root directory.",
    },
    docs: {
      type: "directory",
      name: "docs",
      children: {
        "README.md": {
          type: "file",
          name: "README.md",
          content: "Documentation files",
        },
        "api.md": {
          type: "file",
          name: "api.md",
          content: "API documentation",
        },
        "guide.md": {
          type: "file",
          name: "guide.md",
          content: "User guide",
        },
      },
    },
    ".hidden": {
      type: "directory",
      name: ".hidden",
      hidden: true,
      children: {
        file1: {
          type: "file",
          name: "file1",
          content: "Hidden file 1",
        },
        file2: {
          type: "file",
          name: "file2",
          content: "Hidden file 2",
        },
        dir2: {
          type: "directory",
          name: "dir2",
          children: {
            file: {
              type: "file",
              name: "file",
              content: "File in hidden directory",
            },
          },
        },
        ".secrets": {
          type: "file",
          name: ".secrets",
          hidden: true,
          content: "Secret file",
        },
      },
    },
    ".hiddenDir": {
      type: "directory",
      name: ".hiddenDir",
      hidden: true,
      children: {},
    },
    ".hiddenFile": {
      type: "file",
      name: ".hiddenFile",
      hidden: true,
      content: "This is a hidden file in the root directory.",
    },
  },
};

// Helper functions for navigating the file system
export function resolvePath(currentPath: string, newPath: string): string {
  if (newPath.startsWith("/")) {
    return newPath;
  }

  if (newPath === ".") {
    return currentPath;
  }

  if (newPath === "..") {
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    return "/" + parts.join("/");
  }

  const normalizedCurrent = currentPath.endsWith("/")
    ? currentPath
    : currentPath + "/";
  return normalizedCurrent + newPath;
}

export function getFileAtPath(path: string): VirtualFile | null {
  const parts = path.split("/").filter(Boolean);
  let current = fileSystem;

  for (const part of parts) {
    if (
      current.type !== "directory" ||
      !current.children ||
      !current.children[part]
    ) {
      return null;
    }
    current = current.children[part];
  }

  return current;
}

export function getParentPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return "/" + parts.join("/");
}
