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
    // Scripts for the `python` command. Without at least one of these, the
    // "run a file" half of that command has nothing to point at.
    examples: {
      type: "directory",
      name: "examples",
      children: {
        "hello.py": {
          type: "file",
          name: "hello.py",
          content: `"""The smallest thing that proves this is really CPython."""

import sys

print("Hello from CPython", sys.version.split()[0])
print("Running in WebAssembly, sandboxed, on your machine.")
`,
        },
        "fib.py": {
          type: "file",
          name: "fib.py",
          content: `"""Fibonacci two ways, because one of them is a trap."""

from functools import lru_cache


def slow(n):
    """Exponential: recomputes the same subproblems over and over."""
    return n if n < 2 else slow(n - 1) + slow(n - 2)


@lru_cache(maxsize=None)
def fast(n):
    """Same recursion, memoized. Linear instead of exponential."""
    return n if n < 2 else fast(n - 1) + fast(n - 2)


print("first 10:", [fast(i) for i in range(10)])
print("fib(90) is", fast(90), "and slow() would still be running")
`,
        },
        "colony.py": {
          type: "file",
          name: "colony.py",
          content: `"""A colony of penguins huddling: local rules, global behavior.

Nobody is told to form a cluster. Each penguin only moves toward whichever
neighbor is nearest. The huddle is what that rule looks like from the outside,
which is the whole idea behind the research on this site.
"""

import random

random.seed(7)

COUNT, STEPS, WIDTH = 12, 40, 48
penguins = [random.uniform(0, WIDTH) for _ in range(COUNT)]


def nearest_neighbor(index):
    me = penguins[index]
    others = [(abs(me - p), p) for i, p in enumerate(penguins) if i != index]
    return min(others)[1]


def spread():
    return max(penguins) - min(penguins)


print("start:  spread over", round(spread(), 1), "units")

for step in range(STEPS):
    for i in range(COUNT):
        penguins[i] += (nearest_neighbor(i) - penguins[i]) * 0.1

print("end:    spread over", round(spread(), 1), "units")

row = [" "] * WIDTH
for p in penguins:
    row[max(0, min(WIDTH - 1, int(p)))] = "o"
print("".join(row))
print("\\nNo penguin was told to huddle.")
`,
        },
      },
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
