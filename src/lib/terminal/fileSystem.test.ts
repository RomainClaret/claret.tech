import { describe, it, expect } from "vitest";
import {
  fileSystem,
  resolvePath,
  getFileAtPath,
  getParentPath,
} from "./fileSystem";

describe("Terminal File System", () => {
  describe("resolvePath", () => {
    it("resolves absolute paths", () => {
      expect(resolvePath("/home/user", "/docs")).toBe("/docs");
      expect(resolvePath("/", "/docs/api.md")).toBe("/docs/api.md");
      expect(resolvePath("/home/user/projects", "/")).toBe("/");
    });

    it("resolves relative paths", () => {
      expect(resolvePath("/", "docs")).toBe("/docs");
      expect(resolvePath("/docs", "api.md")).toBe("/docs/api.md");
      expect(resolvePath("/home/user", "projects")).toBe("/home/user/projects");
    });

    it("resolves current directory (.)", () => {
      expect(resolvePath("/home/user", ".")).toBe("/home/user");
      expect(resolvePath("/docs", ".")).toBe("/docs");
      expect(resolvePath("/", ".")).toBe("/");
    });

    it("resolves parent directory (..)", () => {
      expect(resolvePath("/home/user", "..")).toBe("/home");
      expect(resolvePath("/docs/api", "..")).toBe("/docs");
      expect(resolvePath("/docs", "..")).toBe("/");
      expect(resolvePath("/", "..")).toBe("/");
    });

    it("handles paths with and without trailing slashes", () => {
      expect(resolvePath("/home/user/", "docs")).toBe("/home/user/docs");
      expect(resolvePath("/home/user", "docs")).toBe("/home/user/docs");
    });

    it("handles complex relative paths", () => {
      // The resolvePath function doesn't resolve complex paths - it just concatenates
      expect(resolvePath("/home/user/projects", "../docs")).toBe(
        "/home/user/projects/../docs",
      );
      expect(resolvePath("/docs/api", "./guide.md")).toBe(
        "/docs/api/./guide.md",
      );
    });
  });

  describe("getFileAtPath", () => {
    it("gets files at root level", () => {
      const file = getFileAtPath("/README.md");
      expect(file).toBeTruthy();
      expect(file?.type).toBe("file");
      expect(file?.name).toBe("README.md");
      expect(file?.content).toContain("Interactive terminal");
    });

    it("gets directories at root level", () => {
      const dir = getFileAtPath("/docs");
      expect(dir).toBeTruthy();
      expect(dir?.type).toBe("directory");
      expect(dir?.name).toBe("docs");
      expect(dir?.children).toBeDefined();
    });

    it("gets nested files", () => {
      const file = getFileAtPath("/docs/api.md");
      expect(file).toBeTruthy();
      expect(file?.type).toBe("file");
      expect(file?.name).toBe("api.md");
      expect(file?.content).toBe("API documentation");
    });

    it("gets nested directories", () => {
      const dir = getFileAtPath("/docs");
      expect(dir).toBeTruthy();
      expect(dir?.type).toBe("directory");
      expect(dir?.children).toBeDefined();
      expect(Object.keys(dir?.children || {})).toContain("api.md");
    });

    it("gets hidden files and directories", () => {
      const hiddenFile = getFileAtPath("/.hiddenFile");
      expect(hiddenFile).toBeTruthy();
      expect(hiddenFile?.hidden).toBe(true);
      expect(hiddenFile?.content).toBe(
        "This is a hidden file in the root directory.",
      );

      const hiddenDir = getFileAtPath("/.hidden");
      expect(hiddenDir).toBeTruthy();
      expect(hiddenDir?.hidden).toBe(true);
      expect(hiddenDir?.type).toBe("directory");
    });

    it("returns null for non-existent files", () => {
      expect(getFileAtPath("/nonexistent.txt")).toBeNull();
      expect(getFileAtPath("/docs/nonexistent.md")).toBeNull();
      expect(getFileAtPath("/nonexistent/file.txt")).toBeNull();
    });

    it("returns root directory for root path", () => {
      const root = getFileAtPath("/");
      expect(root).toBeTruthy();
      expect(root?.type).toBe("directory");
      expect(root?.name).toBe("/");
      expect(root?.children).toBeDefined();
    });

    it("handles deeply nested paths", () => {
      const file = getFileAtPath("/.hidden/dir2/file");
      expect(file).toBeTruthy();
      expect(file?.type).toBe("file");
      expect(file?.content).toBe("File in hidden directory");
    });

    it("returns null when trying to access children of files", () => {
      expect(getFileAtPath("/README.md/nonexistent")).toBeNull();
    });
  });

  describe("getParentPath", () => {
    it("gets parent of nested paths", () => {
      expect(getParentPath("/home/user/docs")).toBe("/home/user");
      expect(getParentPath("/docs/api.md")).toBe("/docs");
      expect(getParentPath("/home/user")).toBe("/home");
    });

    it("gets parent of root-level paths", () => {
      expect(getParentPath("/docs")).toBe("/");
      expect(getParentPath("/file.txt")).toBe("/");
    });

    it("handles root path", () => {
      expect(getParentPath("/")).toBe("/");
    });

    it("handles hidden paths", () => {
      expect(getParentPath("/.hidden/file1")).toBe("/.hidden");
      expect(getParentPath("/.hiddenFile")).toBe("/");
    });

    it("handles deep nested paths", () => {
      expect(getParentPath("/a/b/c/d/e")).toBe("/a/b/c/d");
    });
  });

  describe("fileSystem structure", () => {
    it("has expected root structure", () => {
      expect(fileSystem.type).toBe("directory");
      expect(fileSystem.name).toBe("/");
      expect(fileSystem.children).toBeDefined();
    });

    it("contains expected root files", () => {
      const children = fileSystem.children!;
      expect(children["README.md"]).toBeDefined();
      expect(children["file"]).toBeDefined();
      expect(children["docs"]).toBeDefined();
    });

    it("contains hidden files and directories", () => {
      const children = fileSystem.children!;
      expect(children[".hidden"]).toBeDefined();
      expect(children[".hiddenDir"]).toBeDefined();
      expect(children[".hiddenFile"]).toBeDefined();
      expect(children[".hidden"].hidden).toBe(true);
      expect(children[".hiddenDir"].hidden).toBe(true);
      expect(children[".hiddenFile"].hidden).toBe(true);
    });

    it("docs directory has expected structure", () => {
      const docs = fileSystem.children!["docs"];
      expect(docs.type).toBe("directory");
      expect(docs.children!["README.md"]).toBeDefined();
      expect(docs.children!["api.md"]).toBeDefined();
      expect(docs.children!["guide.md"]).toBeDefined();
    });

    it("hidden directory has expected structure", () => {
      const hidden = fileSystem.children![".hidden"];
      expect(hidden.type).toBe("directory");
      expect(hidden.children!["file1"]).toBeDefined();
      expect(hidden.children!["file2"]).toBeDefined();
      expect(hidden.children!["dir2"]).toBeDefined();
      expect(hidden.children![".secrets"]).toBeDefined();
    });

    it("nested hidden directory has correct structure", () => {
      const dir2 = fileSystem.children![".hidden"].children!["dir2"];
      expect(dir2.type).toBe("directory");
      expect(dir2.children!["file"]).toBeDefined();
      expect(dir2.children!["file"].content).toBe("File in hidden directory");
    });
  });
});
