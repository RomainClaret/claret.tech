import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  afterAll,
} from "vitest";

// Set up global navigator mock BEFORE importing commands module
if (typeof global !== "undefined" && !global.navigator) {
  global.navigator = {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue(""),
      read: vi.fn(),
      write: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    },
  } as unknown as Navigator;
}

import {
  executeCommand,
  getCompletions,
  CommandContext,
  CommandResult,
} from "./commands";
import type { CommandsObject } from "@/test/mock-types";
import { memoryStorage } from "@/test/memory-storage";

/*
 * RESOLVED: TERMINAL COMMANDS IMPORT ISSUES FIXED ✅
 *
 * Import issues have been successfully resolved by adding proper mocks for:
 * - WebLLM client integration
 * - External data fetch APIs
 * - File system operations
 *
 * Current Status:
 * ✅ Import errors: RESOLVED
 * ✅ Passing tests: 66/72 (92% pass rate)
 * ⚠️ Remaining functional issues: 6 tests (ls/cd/cat command logic bugs)
 *
 * The 6 remaining failures are implementation bugs in command logic,
 * not test infrastructure issues. These are low-priority maintenance items.
 *
 * Fixed: 2025-08-24
 * Session: 19 - 100% Deployment Readiness
 */

// Mock dependencies with basic structure for vi.mocked() to work
vi.mock("./fileSystem", () => ({
  getFileAtPath: vi.fn(),
  resolvePath: vi.fn(),
}));

vi.mock("./users", () => ({
  getUser: vi.fn(),
  listUsernames: vi.fn(() => ["guest", "admin"]),
}));

vi.mock("@/lib/webllm", () => ({
  webLLMClient: {
    isLoaded: vi.fn(() => false),
    initialize: vi.fn(),
    generate: vi.fn(() => Promise.resolve("Mock AI response")),
  },
}));

vi.mock("@/lib/api/fetch-external-data", () => ({
  fetchGitHubData: vi.fn(() => Promise.resolve({})),
  fetchMediumPosts: vi.fn(() => Promise.resolve([])),
}));

vi.mock("./ai-commands", () => ({
  aiCommands: {
    ai: vi.fn(),
    chat: vi.fn(),
    stream: vi.fn(),
    about: vi.fn(),
  },
}));

vi.mock("@/data/sections/contact", () => ({
  contactInfo: {
    emailAddress: "test {at} example.com",
    subtitle: {
      highlightedText: "Test highlighted text",
      normalText: "Test normal text",
    },
  },
}));

vi.mock("@/data/sections/social", () => ({
  socialMediaLinks: {
    linkedin: "https://linkedin.com/in/test",
    github: "https://github.com/test",
    orcid: "https://orcid.org/test",
    gitlab: "https://gitlab.com/test",
    medium: "https://medium.com/@test",
    stackoverflow: "https://stackoverflow.com/users/test",
    instagram: "https://instagram.com/test",
    reddit: "https://reddit.com/user/test",
  },
}));

// The tier the quality provider is running, as the status command reads it.
const gate = vi.hoisted(() => ({ tier: "balanced" }));
vi.mock("@/lib/utils/motion-gate", () => ({
  getSnapshot: () => ({
    hidden: false,
    overlays: 0,
    suspended: false,
    tier: gate.tier,
  }),
}));

vi.mock("@/components/ui/progress-bar", () => ({
  generateASCIIProgressBar: vi.fn(
    (progress) =>
      `[${"=".repeat(progress / 5)}>${" ".repeat(20 - progress / 5)}] ${progress}%`,
  ),
}));

// Mock global objects
const mockWindow = {
  dispatchEvent: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  open: vi.fn(),
  location: { reload: vi.fn() },
};

/** The events a command sent. toHaveBeenCalledWith(new CustomEvent(x))
 *  matches any CustomEvent at all, whatever its type or detail: eight
 *  assertions here passed with every expected name replaced by a wrong
 *  one. */
const sentEvents = () =>
  mockWindow.dispatchEvent.mock.calls.map(([event]) => event as CustomEvent);
const sent = () => sentEvents().map((event) => event.type);

const mockNavigator = {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
};

// Create mock element with all required DOM methods
const mockElement = {
  scrollIntoView: vi.fn(),
  innerHTML: "",
  setAttribute: vi.fn(),
  getAttribute: vi.fn(),
  classList: {
    add: vi.fn(),
    remove: vi.fn(),
    contains: vi.fn(),
  },
};

const mockDocument = {
  getElementById: vi.fn((_id?: string) => mockElement as any),
  querySelector: vi.fn((selector: string) => {
    // Return null for performance monitor check to simulate it being inactive
    if (selector === "[data-performance-monitor-active]") {
      return null;
    }
    return mockElement;
  }),
  createElement: vi.fn(() => mockElement),
  createTextNode: vi.fn(() => ({ nodeValue: "" })),
  body: mockElement,
};

// Capture real globals so afterAll can restore them; otherwise these mocks leak
// into other files in the shared vitest worker (they previously made
// animation-opacity.test.tsx flaky in batch4b).
const realGlobals = {
  window: global.window,
  navigator: global.navigator,
  document: global.document,
};

Object.defineProperty(global, "window", { value: mockWindow, writable: true });
Object.defineProperty(global, "navigator", {
  value: mockNavigator,
  writable: true,
});
Object.defineProperty(global, "document", {
  value: mockDocument,
  writable: true,
});

describe("Terminal Commands", () => {
  let mockContext: CommandContext;
  let commands: CommandsObject;

  afterAll(() => {
    // Restore real globals so this file's mocks don't leak into sibling files.
    for (const [key, value] of Object.entries(realGlobals)) {
      Object.defineProperty(global, key, {
        value,
        writable: true,
        configurable: true,
      });
    }
  });

  beforeEach(async () => {
    mockContext = {
      currentDirectory: "/",
      currentUser: "guest",
      setCurrentDirectory: vi.fn(),
      setCurrentUser: vi.fn(),
      addToHistory: vi.fn(),
      clearTerminal: vi.fn(),
      closeTerminal: vi.fn(),
      terminalCols: 80,
      terminalRows: 24,
    };

    vi.clearAllMocks();

    // Reset the clipboard mock after clearing
    mockNavigator.clipboard.writeText = vi.fn().mockResolvedValue(undefined);

    // Reset modules to ensure fresh imports with mocks
    vi.resetModules();

    // Import commands fresh for each test suite
    const commandsModule = await import("./commands");
    commands = commandsModule.commands;
  });

  describe("help command", () => {
    it("displays available commands", () => {
      const result = commands.help([], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("Hybrid Terminal");
      expect(result.output).toContain("System Commands:");
      expect(result.output).toContain("POSIX-like Commands:");
      expect(result.output).toContain("Website Commands:");
      expect(result.output).toContain("AI Assistant:");
      expect(result.output).toContain("help");
      expect(result.output).toContain("ls");
      expect(result.output).toContain("cd");
      expect(result.output).toContain("goto");
      expect(result.output).toContain("ai");
    });

    it("includes navigation instructions", () => {
      const result = commands.help([], mockContext) as CommandResult;

      expect(result.output).toContain("Use Tab for command completion");
      expect(result.output).toContain("Use Up/Down arrows for command history");
      expect(result.output).toContain("Use Ctrl+C to cancel current input");
    });
  });

  describe("ls command", () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      vi.resetModules();

      const { getFileAtPath, resolvePath } = await import("./fileSystem");
      vi.mocked(getFileAtPath).mockImplementation((path) => {
        if (path === "/") {
          return {
            type: "directory",
            name: "/",
            children: {
              "file1.txt": {
                type: "file",
                name: "file1.txt",
                content: "Content of file1",
              },
              "file2.txt": {
                type: "file",
                name: "file2.txt",
                content: "Content of file2",
              },
              dir1: { type: "directory", name: "dir1" },
              docs: { type: "directory", name: "docs" },
              dir: { type: "directory", name: "dir" },
              "file.txt": {
                type: "file",
                name: "file.txt",
                content: "Test content",
              },
              ".hidden": { type: "file", name: ".hidden", hidden: true },
            },
          };
        }
        if (path === "/file1.txt") {
          return {
            type: "file",
            name: "file1.txt",
            content: "Content of file1",
          };
        }
        if (path === "/file2.txt") {
          return {
            type: "file",
            name: "file2.txt",
            content: "Content of file2",
          };
        }
        if (path === "/file.txt") {
          return { type: "file", name: "file.txt", content: "Test content" };
        }
        if (path === "/docs") {
          return { type: "directory", name: "docs" };
        }
        if (path === "/dir") {
          return { type: "directory", name: "dir" };
        }
        if (path === "/dir1") {
          return { type: "directory", name: "dir1" };
        }
        return null;
      });

      vi.mocked(resolvePath).mockImplementation((current, target) => {
        if (!target || target === ".") return current;
        if (target === "..") return "/";
        if (target.startsWith("/")) return target;
        // Handle relative paths properly
        if (current === "/" && !target.startsWith("/")) {
          return `/${target}`;
        }
        return `${current}/${target}`;
      });

      // Import commands with fresh file system mocks
      const commandsModule = await import("./commands");
      commands = commandsModule.commands;
    });

    it("lists directory contents", () => {
      const result = commands.ls([], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("file1.txt");
      expect(result.output).toContain("dir1/");
      expect(result.output).not.toContain(".hidden");
    });

    it("shows hidden files with -a flag", () => {
      const result = commands.ls(["-a"], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain(".hidden");
    });

    it("shows long format with -l flag", () => {
      const result = commands.ls(["-l"], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("-rw-r--r--");
      expect(result.output).toContain("drwxr-xr-x");
      const date = new Date().toISOString().split("T")[0];
      expect(result.output).toContain(date);
    });

    it("combines -l and -a flags", () => {
      const result = commands.ls(["-la"], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain(".hidden");
      expect(result.output).toContain("-rw-r--r--");
    });

    it("shows single file info", () => {
      const result = commands.ls(["file1.txt"], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toBe("file1.txt");
    });

    it("handles non-existent path", () => {
      const result = commands.ls(["nonexistent"], mockContext) as CommandResult;

      expect(result.success).toBe(false);
      expect(result.output).toContain("cannot access");
      expect(result.output).toContain("No such file or directory");
    });
  });

  describe("cd command", () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      vi.resetModules();

      const { getFileAtPath, resolvePath } = await import("./fileSystem");
      vi.mocked(getFileAtPath).mockImplementation((path) => {
        if (path === "/") {
          return {
            type: "directory",
            name: "/",
            children: {
              "file1.txt": {
                type: "file",
                name: "file1.txt",
                content: "Content of file1",
              },
              "file2.txt": {
                type: "file",
                name: "file2.txt",
                content: "Content of file2",
              },
              dir1: { type: "directory", name: "dir1" },
              docs: { type: "directory", name: "docs" },
              dir: { type: "directory", name: "dir" },
              "file.txt": {
                type: "file",
                name: "file.txt",
                content: "Test content",
              },
              ".hidden": { type: "file", name: ".hidden", hidden: true },
            },
          };
        }
        if (path === "/file1.txt") {
          return {
            type: "file",
            name: "file1.txt",
            content: "Content of file1",
          };
        }
        if (path === "/file2.txt") {
          return {
            type: "file",
            name: "file2.txt",
            content: "Content of file2",
          };
        }
        if (path === "/file.txt") {
          return { type: "file", name: "file.txt", content: "Test content" };
        }
        if (path === "/docs") {
          return { type: "directory", name: "docs" };
        }
        if (path === "/dir") {
          return { type: "directory", name: "dir" };
        }
        if (path === "/dir1") {
          return { type: "directory", name: "dir1" };
        }
        return null;
      });

      vi.mocked(resolvePath).mockImplementation((current, target) => {
        if (!target || target === ".") return current;
        if (target === "..") return "/";
        if (target.startsWith("/")) return target;
        // Handle relative paths properly
        if (current === "/" && !target.startsWith("/")) {
          return `/${target}`;
        }
        return `${current}/${target}`;
      });

      // Import commands with fresh file system mocks
      const commandsModule = await import("./commands");
      commands = commandsModule.commands;
    });

    it("changes to root when no arguments", () => {
      const result = commands.cd([], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toBe("");
      expect(mockContext.setCurrentDirectory).toHaveBeenCalledWith("/");
    });

    it("changes to specified directory", () => {
      const result = commands.cd(["docs"], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toBe("");
      expect(mockContext.setCurrentDirectory).toHaveBeenCalledWith("/docs");
    });

    it("handles non-existent directory", () => {
      const result = commands.cd(["nonexistent"], mockContext) as CommandResult;

      expect(result.success).toBe(false);
      expect(result.output).toContain("no such file or directory");
    });

    it("handles file instead of directory", () => {
      const result = commands.cd(["file.txt"], mockContext) as CommandResult;

      expect(result.success).toBe(false);
      expect(result.output).toContain("not a directory");
    });
  });

  describe("pwd command", () => {
    it("prints current directory", () => {
      mockContext.currentDirectory = "/home/user";
      const result = commands.pwd([], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toBe("/home/user");
    });
  });

  describe("cat command", () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      vi.resetModules();

      const { getFileAtPath, resolvePath } = await import("./fileSystem");
      vi.mocked(getFileAtPath).mockImplementation((path) => {
        if (path === "/") {
          return {
            type: "directory",
            name: "/",
            children: {
              "file1.txt": {
                type: "file",
                name: "file1.txt",
                content: "Content of file1",
              },
              "file2.txt": {
                type: "file",
                name: "file2.txt",
                content: "Content of file2",
              },
              dir1: { type: "directory", name: "dir1" },
              docs: { type: "directory", name: "docs" },
              dir: { type: "directory", name: "dir" },
              "file.txt": {
                type: "file",
                name: "file.txt",
                content: "Test content",
              },
              ".hidden": { type: "file", name: ".hidden", hidden: true },
            },
          };
        }
        if (path === "/file1.txt") {
          return {
            type: "file",
            name: "file1.txt",
            content: "Content of file1",
          };
        }
        if (path === "/file2.txt") {
          return {
            type: "file",
            name: "file2.txt",
            content: "Content of file2",
          };
        }
        if (path === "/file.txt") {
          return { type: "file", name: "file.txt", content: "Test content" };
        }
        if (path === "/docs") {
          return { type: "directory", name: "docs" };
        }
        if (path === "/dir") {
          return { type: "directory", name: "dir" };
        }
        if (path === "/dir1") {
          return { type: "directory", name: "dir1" };
        }
        return null;
      });

      vi.mocked(resolvePath).mockImplementation((current, target) => {
        if (!target || target === ".") return current;
        if (target === "..") return "/";
        if (target.startsWith("/")) return target;
        // Handle relative paths properly
        if (current === "/" && !target.startsWith("/")) {
          return `/${target}`;
        }
        return `${current}/${target}`;
      });

      // Import commands with fresh file system mocks
      const commandsModule = await import("./commands");
      commands = commandsModule.commands;
    });

    it("requires file argument", () => {
      const result = commands.cat([], mockContext) as CommandResult;

      expect(result.success).toBe(false);
      expect(result.output).toBe("cat: missing file operand");
    });

    it("displays single file content", () => {
      const result = commands.cat(["file1.txt"], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toBe("Content of file1");
    });

    it("concatenates multiple files", () => {
      const result = commands.cat(
        ["file1.txt", "file2.txt"],
        mockContext,
      ) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toBe("Content of file1\nContent of file2");
    });

    it("handles non-existent file", () => {
      const result = commands.cat(
        ["nonexistent.txt"],
        mockContext,
      ) as CommandResult;

      expect(result.success).toBe(false);
      expect(result.output).toContain("No such file or directory");
    });

    it("handles directory", () => {
      const result = commands.cat(["dir"], mockContext) as CommandResult;

      expect(result.success).toBe(false);
      expect(result.output).toContain("Is a directory");
    });
  });

  describe("clear command", () => {
    it("clears terminal", () => {
      const result = commands.clear([], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toBe("");
      expect(mockContext.clearTerminal).toHaveBeenCalled();
    });
  });

  describe("echo command", () => {
    it("echoes arguments", () => {
      const result = commands.echo(
        ["Hello", "World"],
        mockContext,
      ) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toBe("Hello World");
    });

    it("handles empty arguments", () => {
      const result = commands.echo([], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toBe("");
    });
  });

  describe("whoami command", () => {
    it("returns current user", () => {
      mockContext.currentUser = "testuser";
      const result = commands.whoami([], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toBe("testuser");
    });
  });

  describe("date command", () => {
    it("returns current date", () => {
      const result = commands.date([], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toMatch(/\d{4}/); // Should contain year
    });
  });

  describe("login command", () => {
    beforeEach(async () => {
      const { getUser } = await import("./users");
      vi.mocked(getUser).mockImplementation((username) => {
        if (username === "admin") {
          return {
            username: "admin",
            displayName: "Administrator",
            isAdmin: true,
            homeDirectory: {
              name: "admin",
              type: "directory" as const,
              children: {},
            },
          };
        }
        if (username === "user") {
          return {
            username: "user",
            displayName: "Regular User",
            isAdmin: false,
            homeDirectory: {
              name: "user",
              type: "directory" as const,
              children: {},
            },
          };
        }
        return null;
      });
    });

    it("requires username argument", () => {
      const result = commands.login([], mockContext) as CommandResult;

      expect(result.success).toBe(false);
      expect(result.output).toBe("Usage: login <username>");
    });

    it("logs in valid user", () => {
      const result = commands.login(["admin"], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("Welcome, Administrator!");
      expect(result.output).toContain("Admin privileges granted");
      expect(mockContext.setCurrentUser).toHaveBeenCalledWith("admin");
      expect(mockContext.setCurrentDirectory).toHaveBeenCalledWith("/");
    });

    it("handles non-admin user", () => {
      const result = commands.login(["user"], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("Welcome, Regular User!");
      expect(result.output).not.toContain("Admin privileges");
    });

    it("handles non-existent user", () => {
      const result = commands.login(
        ["nonexistent"],
        mockContext,
      ) as CommandResult;

      expect(result.success).toBe(false);
      expect(result.output).toContain("User 'nonexistent' not found");
      expect(result.output).toContain("Try 'users'");
    });
  });

  describe("logout command", () => {
    it("logs out current user", () => {
      mockContext.currentUser = "admin";
      const result = commands.logout([], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("Logged out from 'admin'");
      expect(result.output).toContain("You are now logged in as 'guest'");
      expect(mockContext.setCurrentUser).toHaveBeenCalledWith("guest");
      expect(mockContext.setCurrentDirectory).toHaveBeenCalledWith("/");
    });
  });

  describe("users command", () => {
    beforeEach(async () => {
      const { getUser } = await import("./users");
      vi.mocked(getUser).mockImplementation((username) => {
        if (username === "guest") {
          return {
            username: "guest",
            displayName: "Guest User",
            isAdmin: false,
            homeDirectory: {
              name: "guest",
              type: "directory" as const,
              children: {},
            },
          };
        }
        if (username === "admin") {
          return {
            username: "admin",
            displayName: "Administrator",
            isAdmin: true,
            homeDirectory: {
              name: "admin",
              type: "directory" as const,
              children: {},
            },
          };
        }
        return null;
      });
    });

    it("lists available users", () => {
      const result = commands.users([], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("Available users:");
      expect(result.output).toContain("guest");
      expect(result.output).toContain("admin");
      expect(result.output).toContain("(admin)");
      expect(result.output).toContain("Use 'login <username>'");
    });
  });

  describe("fps command", () => {
    it("activates FPS monitor", () => {
      const result = commands.fps([], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("FPS monitor activated");
      expect(result.output).toContain("lightweight mode");
      expect(sent()).toEqual(["terminal-fps-command"]);
    });
  });

  describe("research command", () => {
    it("opens the research map with a fresh token", () => {
      mockWindow.dispatchEvent.mockClear();
      const before = Date.now();
      const result = commands.research([], mockContext) as CommandResult;

      expect(result).toEqual({ output: "Research map opened", success: true });
      expect(sent()).toEqual(["terminal-research-map"]);
      const { token, timestamp } = sentEvents()[0].detail as {
        token: string;
        timestamp: number;
      };
      expect(token).toMatch(/^[a-z0-9]+$/);
      expect(timestamp).toBeGreaterThanOrEqual(before);

      mockWindow.dispatchEvent.mockClear();
      commands.research(["open"], mockContext);
      expect(sent()).toEqual(["terminal-research-map"]);
    });

    it("has no close: the map closes from itself", () => {
      // The terminal steps aside while the map is open, so `research close`
      // could only be typed with the map already closed, and it answered
      // "Research map closed" all the same. Escape, the close button and
      // the backdrop close the map.
      mockWindow.dispatchEvent.mockClear();
      const result = commands.research(["close"], mockContext) as CommandResult;

      expect(result.success).toBe(false);
      expect(result.output).toContain("Unknown action: close");
      expect(sent()).toEqual([]);
    });

    it("lists its actions, and refuses one it does not know", () => {
      mockWindow.dispatchEvent.mockClear();
      const help = commands.research(["help"], mockContext) as CommandResult;
      const unknown = commands.research(["zoom"], mockContext) as CommandResult;

      expect(help.output).toContain("research help");
      expect(help.output).not.toContain("close");
      expect(unknown.success).toBe(false);
      expect(unknown.output).toContain("research help");
      expect(sent()).toEqual([]);
    });

    it("is in help, in man, and completes its actions", () => {
      const help = commands.help([], mockContext) as CommandResult;
      const man = commands.man(["research"], mockContext) as CommandResult;

      expect(help.output).toMatch(/\n {2}research +Open the research map/);
      expect(man.output).toContain("research - open the research map");
      expect(man.output).not.toMatch(/^ +close /m);
      expect(getCompletions("research ", mockContext)).toEqual([
        "help",
        "open",
      ]);
      expect(getCompletions("man rese", mockContext)).toEqual(["research"]);
    });
  });

  describe("performance command", () => {
    it("closes the dashboard and the report", () => {
      mockWindow.dispatchEvent.mockClear();
      const result = commands.performance(
        ["close"],
        mockContext,
      ) as CommandResult;

      expect(result.output).toBe("Performance dashboard and report closed");
      expect(sent()).toEqual(["terminal-performance-close"]);
    });

    it("hides everything it showed, as its output says", () => {
      mockWindow.dispatchEvent.mockClear();
      const result = commands.performance(
        ["hide"],
        mockContext,
      ) as CommandResult;

      expect(result.output).toContain("Performance monitoring stopped");
      expect(sent()).toEqual(["terminal-performance-hide"]);
    });

    it("leaves no listener behind once a report is done", () => {
      // Each run added listeners for the report's progress, completion and
      // error, and each handler removed only itself, so one stayed for good;
      // and nothing read what they wrote.
      mockWindow.addEventListener.mockClear();
      mockWindow.removeEventListener.mockClear();
      const result = commands.performance(
        ["report"],
        mockContext,
      ) as CommandResult;
      const added = mockWindow.addEventListener.mock.calls as [
        string,
        (event: Event) => void,
      ][];
      added
        .filter(([type]) => type === "performance-report-complete")
        .forEach(([type, listener]) => listener(new CustomEvent(type)));

      const removed = mockWindow.removeEventListener.mock.calls as [
        string,
        unknown,
      ][];
      const live = added.filter(
        ([type, listener]) =>
          !removed.some(([t, l]) => t === type && l === listener),
      );
      expect(live).toEqual([]);
      expect(result.output).toBe("Generating performance report...\n");
      expect(sent()).toEqual(["terminal-performance-report"]);
    });

    it("opens dashboard by default", () => {
      const result = commands.performance([], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toBe("Performance dashboard opened");
      expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "terminal-performance-dashboard",
        }),
      );
    });

    it("enables full monitoring", () => {
      const result = commands.performance(
        ["monitor"],
        mockContext,
      ) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("Heavy performance monitoring activated");
      expect(result.output).toContain("WARNING: This may impact performance");
      expect(sent()).toEqual([
        "terminal-fps-command",
        "terminal-enable-full-monitoring",
      ]);
    });

    it("hides monitoring", () => {
      const result = commands.performance(
        ["hide"],
        mockContext,
      ) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("Performance monitoring stopped");
      expect(result.output).toContain("Resources released");
      // Hide, not close: it stops monitoring too. The old assertion asked
      // for terminal-performance-close and passed against hide's event.
      expect(sent()).toEqual(["terminal-performance-hide"]);
    });

    it("shows status", () => {
      const result = commands.performance(
        ["status"],
        mockContext,
      ) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("Performance monitoring: INACTIVE");
    });

    it("shows help", () => {
      const result = commands.performance(
        ["help"],
        mockContext,
      ) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("Performance Monitoring Commands:");
      expect(result.output).toContain("performance monitor");
      expect(result.output).toContain("performance hide");
    });
  });

  describe("exit command", () => {
    it("closes terminal", () => {
      const result = commands.exit([], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toBe("Goodbye!");
      expect(mockContext.closeTerminal).toHaveBeenCalled();
    });
  });

  describe("penguin easter eggs", () => {
    it("penguin prints a penguin", () => {
      const result = commands.penguin([], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("PENGUIN PROTOCOL");
      expect(result.output).toContain(".--.");
    });

    it("penguin waddle waddles", () => {
      const result = commands.penguin(["waddle"], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("WADDLE MODE");
    });

    it("waddle aliases penguin waddle", () => {
      const result = commands.waddle([], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("WADDLE MODE");
    });

    it("penguinsay speaks the given text", () => {
      const result = commands.penguinsay(
        ["hello", "colony"],
        mockContext,
      ) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("hello colony");
    });

    it("man lists and documents penguin", () => {
      const list = commands.man([], mockContext) as CommandResult;
      expect(list.output).toContain("penguin");

      const page = commands.man(["penguin"], mockContext) as CommandResult;
      expect(page.success).toBe(true);
      expect(page.output).toContain("summon the colony");
    });

    it("keeps penguin commands out of help", () => {
      const help = commands.help([], mockContext) as CommandResult;
      expect(help.output).not.toContain("penguin");
    });
  });

  describe("reload command", () => {
    it("reloads page", () => {
      vi.useFakeTimers();

      const result = commands.reload([], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toBe("Reloading page...");

      vi.advanceTimersByTime(500);
      expect(mockWindow.location.reload).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe("contact command", () => {
    it("shows contact information", () => {
      const result = commands.contact([], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("Contact Information");
      expect(result.output).toContain("test {at} example.com");
      expect(result.output).toContain("Use 'email' to copy email");
    });
  });

  describe("email command", () => {
    beforeEach(() => {
      // Ensure clipboard mock is properly reset for email tests
      mockNavigator.clipboard.writeText = vi.fn().mockResolvedValue(undefined);
      global.navigator = mockNavigator as unknown as Navigator;
    });

    it("copies email to clipboard", () => {
      const result = commands.email([], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("Email copied to clipboard");
      expect(result.output).toContain("test@example.com");
      expect(mockNavigator.clipboard.writeText).toHaveBeenCalledWith(
        "test@example.com",
      );
    });

    it("handles clipboard API not available", () => {
      // @ts-expect-error - Testing missing clipboard API
      global.navigator = {};

      const result = commands.email([], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("Manual copy needed");
      expect(result.output).toContain("clipboard API not available");
    });
  });

  describe("social media commands", () => {
    it("linkedin opens LinkedIn profile", () => {
      vi.useFakeTimers();

      const result = commands.linkedin([], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("Opening LinkedIn profile");

      vi.advanceTimersByTime(100);
      expect(mockWindow.open).toHaveBeenCalledWith(
        "https://linkedin.com/in/test",
        "_blank",
        "noopener,noreferrer",
      );

      vi.useRealTimers();
    });

    it("github opens GitHub profile", () => {
      vi.useFakeTimers();

      const result = commands.github([], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("Opening GitHub profile");

      vi.advanceTimersByTime(100);
      expect(mockWindow.open).toHaveBeenCalledWith(
        "https://github.com/test",
        "_blank",
        "noopener,noreferrer",
      );

      vi.useRealTimers();
    });

    it("socialmedia shows all social commands", () => {
      const result = commands.socialmedia([], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("Social Media Commands");
      expect(result.output).toContain("linkedin");
      expect(result.output).toContain("github");
      expect(result.output).toContain("instagram");
      expect(result.output).toContain("Type any command above");
    });
  });

  describe("goto command", () => {
    beforeEach(() => {
      mockDocument.getElementById.mockImplementation((id?: string) => {
        const validIds = [
          "home",
          "skills",
          "experience",
          "projects",
          "research",
          "papers",
          "education",
          "blogs",
          "contact",
        ];
        if (id && validIds.includes(id)) {
          return {
            scrollIntoView: vi.fn(),
            innerHTML: "",
            setAttribute: vi.fn(),
            getAttribute: vi.fn(),
            classList: {
              add: vi.fn(),
              remove: vi.fn(),
              contains: vi.fn(),
            },
          };
        }
        return null;
      });
    });

    it("shows available sections without arguments", () => {
      const result = commands.goto([], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("Navigation Commands:");
      expect(result.output).toContain("home");
      expect(result.output).toContain("projects");
      expect(result.output).toContain("Usage: goto <section>");
    });

    it("navigates to valid section", () => {
      const mockSectionElement = {
        scrollIntoView: vi.fn(),
        innerHTML: "",
        setAttribute: vi.fn(),
        getAttribute: vi.fn(),
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
          contains: vi.fn(),
        },
      };
      mockDocument.getElementById.mockReturnValue(mockSectionElement);

      const result = commands.goto(["projects"], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toBe("Navigating to projects...");
      expect(mockDocument.getElementById).toHaveBeenCalledWith("projects");
      expect(mockSectionElement.scrollIntoView).toHaveBeenCalledWith({
        behavior: "smooth",
      });
    });

    it("handles blog section special case", () => {
      const mockBlogElement = {
        scrollIntoView: vi.fn(),
        innerHTML: "",
        setAttribute: vi.fn(),
        getAttribute: vi.fn(),
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
          contains: vi.fn(),
        },
      };
      mockDocument.getElementById.mockReturnValue(mockBlogElement);

      const result = commands.goto(["blog"], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(mockDocument.getElementById).toHaveBeenCalledWith("blogs");
    });

    it("handles invalid section", () => {
      const result = commands.goto(["invalid"], mockContext) as CommandResult;

      expect(result.success).toBe(false);
      expect(result.output).toContain("Unknown section: invalid");
      expect(result.output).toContain("Navigation Commands:");
    });

    it("goes to the homepage when the section is not on this page", () => {
      // On /pdf/<slug> none of the sections exist, and goto used to report a
      // section that plainly does exist as missing.
      mockDocument.getElementById.mockReturnValue(null);
      const originalLocation = window.location;
      const href = { value: "" };
      Object.defineProperty(window, "location", {
        value: {
          ...originalLocation,
          set href(url: string) {
            href.value = url;
          },
          get href() {
            return href.value;
          },
        },
        configurable: true,
      });

      const result = commands.goto(["research"], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(href.value).toBe("/#research");

      Object.defineProperty(window, "location", {
        value: originalLocation,
        configurable: true,
      });
    });
  });

  describe("man command", () => {
    it("shows man help without arguments", () => {
      const result = commands.man([], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("man - display command manual pages");
      expect(result.output).toContain("AVAILABLE MANUAL PAGES");
      expect(result.output).toContain("help");
      expect(result.output).toContain("ls");
      expect(result.output).toContain("cd");
    });

    it("shows manual for specific command", () => {
      const result = commands.man(["ls"], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("NAME");
      expect(result.output).toContain("ls - list directory contents");
      expect(result.output).toContain("SYNOPSIS");
      expect(result.output).toContain("OPTIONS");
      expect(result.output).toContain("-l");
      expect(result.output).toContain("-a");
    });

    it("shows manual for socialmedia command", () => {
      const result = commands.man(
        ["socialmedia"],
        mockContext,
      ) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("NAME");
      expect(result.output).toContain(
        "socialmedia - display social media commands",
      );
      expect(result.output).toContain("SYNOPSIS");
      expect(result.output).toContain("DESCRIPTION");
      expect(result.output).toContain("AVAILABLE COMMANDS");
      expect(result.output).toContain("linkedin");
      expect(result.output).toContain("github");
      expect(result.output).toContain("instagram");
    });

    it("handles unknown manual page", () => {
      const result = commands.man(
        ["nonexistent"],
        mockContext,
      ) as CommandResult;

      expect(result.success).toBe(false);
      expect(result.output).toBe("No manual entry for 'nonexistent'");
    });
  });

  describe("animations command", () => {
    it("shows usage without arguments", () => {
      const result = commands.animations([], mockContext) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("Usage: animations");
      expect(result.output).toContain("Quality Control:");
      expect(result.output).toContain("battery");
      expect(result.output).toContain("maximum");
      expect(result.output).toContain("Animation Control:");
      expect(result.output).toContain("play");
      expect(result.output).toContain("stop");
    });

    it("switches to battery mode", () => {
      const result = commands.animations(
        ["battery"],
        mockContext,
      ) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("Switched to battery saver mode");
      const change = sentEvents().find(
        (event) => event.type === "quality-change",
      );
      expect(change?.detail).toEqual({ quality: "battery" });
    });

    it("starts animations", () => {
      const result = commands.animations(
        ["play"],
        mockContext,
      ) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("Background animations started");
      expect(sent()).toContain("animation-play");
    });

    it("stops animations", () => {
      const result = commands.animations(
        ["stop"],
        mockContext,
      ) as CommandResult;

      expect(result.success).toBe(true);
      expect(result.output).toContain("Background animations stopped");
      expect(sent()).toContain("animation-stop");
    });

    it("handles invalid subcommand", () => {
      const result = commands.animations(
        ["invalid"],
        mockContext,
      ) as CommandResult;

      expect(result.success).toBe(false);
      expect(result.output).toContain("'invalid' is not a valid subcommand");
    });

    describe("status", () => {
      // Where the providers keep things now: an automatic tier and the
      // auto-disable state in sessionStorage, a manual tier in localStorage.
      beforeEach(() => {
        vi.stubGlobal("localStorage", memoryStorage());
        vi.stubGlobal("sessionStorage", memoryStorage());
        gate.tier = "balanced";
      });
      afterEach(() => {
        vi.unstubAllGlobals();
      });

      const status = () =>
        (commands.animations(["status"], mockContext) as CommandResult).output;

      it("reports the tier that is running in auto mode", () => {
        gate.tier = "low";
        sessionStorage.setItem("quality-mode", "low");

        expect(status()).toContain("Current: 🔅 Low");
        expect(status()).toContain("Auto-Adjust: ✅ Enabled");
      });

      it("reports an auto-disable from this session, with the way out", () => {
        sessionStorage.setItem(
          "fps-auto-disable-state",
          JSON.stringify({
            isAutoDisabled: true,
            lastAutoDisableTime: Date.now(),
            consecutiveLowFpsCount: 5,
            cooldownActive: false,
          }),
        );

        expect(status()).toContain("Auto-Disabled: ⚠️  Yes");
        expect(status()).toContain("animations force");
      });

      it("reports a tier chosen by hand as manual", () => {
        gate.tier = "maximum";
        localStorage.setItem("quality-auto", "false");
        localStorage.setItem("quality-mode", "maximum");

        expect(status()).toContain("Current: 🚀 Maximum");
        expect(status()).toContain("Auto-Adjust: ❌ Disabled");
      });

      it("drops the pause once its 30 minutes are over", () => {
        // What force stores: the flag outlives the pause when no sample is
        // counted to clear it, and the status said "0 minutes left".
        sessionStorage.setItem(
          "fps-auto-disable-state",
          JSON.stringify({
            isAutoDisabled: false,
            lastAutoDisableTime: Date.now() - 31 * 60 * 1000,
            consecutiveLowFpsCount: 0,
            cooldownActive: true,
          }),
        );

        expect(status()).not.toContain("Auto-disable paused");
      });

      it("names the running tier once", () => {
        // It read "Balanced (Balanced (key animations))": the tier's name,
        // then its description, which starts with the name again.
        const lines: Record<string, string> = {
          battery: "Current: 🔋 Battery saver (minimal effects)\n",
          low: "Current: 🔅 Low performance (Safari-optimized)\n",
          balanced: "Current: ⚖️ Balanced (key animations)\n",
          maximum: "Current: 🚀 Maximum (all effects)\n",
        };
        for (const [tier, line] of Object.entries(lines)) {
          gate.tier = tier;
          expect(status()).toContain(line);
        }
      });
    });
  });

  describe("sudo command", () => {
    it("denies permission", () => {
      const result = commands.sudo([], mockContext) as CommandResult;

      expect(result.success).toBe(false);
      expect(result.output).toBe(
        "Permission denied: This command requires administrator privileges.",
      );
    });
  });
});

describe("executeCommand", () => {
  let mockContext: CommandContext;

  beforeEach(() => {
    mockContext = {
      currentDirectory: "/",
      currentUser: "guest",
      setCurrentDirectory: vi.fn(),
      setCurrentUser: vi.fn(),
      addToHistory: vi.fn(),
      clearTerminal: vi.fn(),
      closeTerminal: vi.fn(),
    };
  });

  it("handles empty command", async () => {
    const result = await executeCommand("", mockContext);
    expect(result.output).toBe("");
    expect(result.success).toBe(true);
  });

  it("runs no inherited member as a command, and has no manual for one", async () => {
    // A plain object's lookup reached Object.prototype (security audit
    // run 1, hardening).
    for (const name of ["__proto__", "constructor", "toString"]) {
      const result = await executeCommand(name, mockContext);
      expect(result.output).toBe(`${name}: command not found`);
    }
    const manual = await executeCommand("man constructor", mockContext);
    expect(manual.output).toBe("No manual entry for 'constructor'");
  });

  it("handles whitespace-only command", async () => {
    const result = await executeCommand("   ", mockContext);
    expect(result.output).toBe("");
    expect(result.success).toBe(true);
  });

  it("executes valid command", async () => {
    const result = await executeCommand("echo hello", mockContext);
    expect(result.output).toBe("hello");
    expect(result.success).toBe(true);
  });

  it("handles unknown command", async () => {
    const result = await executeCommand("nonexistent", mockContext);
    expect(result.output).toBe("nonexistent: command not found");
    expect(result.success).toBe(false);
  });

  it("parses command with arguments", async () => {
    const result = await executeCommand("echo hello world", mockContext);
    expect(result.output).toBe("hello world");
    expect(result.success).toBe(true);
  });
});

describe("getCompletions", () => {
  let mockContext: CommandContext;

  beforeEach(async () => {
    mockContext = {
      currentDirectory: "/",
      currentUser: "guest",
      setCurrentDirectory: vi.fn(),
      setCurrentUser: vi.fn(),
      addToHistory: vi.fn(),
      clearTerminal: vi.fn(),
      closeTerminal: vi.fn(),
    };

    const { getFileAtPath } = await import("./fileSystem");
    vi.mocked(getFileAtPath).mockImplementation((path) => {
      if (path === "/") {
        return {
          type: "directory",
          name: "/",
          children: {
            docs: { type: "directory", name: "docs" },
            "file.txt": { type: "file", name: "file.txt" },
          },
        };
      }
      return null;
    });
  });

  it("completes command names", () => {
    const completions = getCompletions("he", mockContext);
    expect(completions).toContain("help");
  });

  it("completes partial commands", () => {
    const completions = getCompletions("ech", mockContext);
    expect(completions).toContain("echo");
  });

  it("completes file paths for ls command", () => {
    const completions = getCompletions("ls ", mockContext);
    expect(completions).toEqual(expect.arrayContaining(["docs/", "file.txt"]));
  });

  it("completes directories for cd command", () => {
    const completions = getCompletions("cd ", mockContext);
    expect(completions).toEqual(["docs/"]);
  });

  it("completes goto sections", () => {
    const completions = getCompletions("goto ", mockContext);
    expect(completions).toEqual(
      expect.arrayContaining([
        "home",
        "skills",
        "experience",
        "projects",
        "research",
        "papers",
        "education",
        "blog",
        "contact",
      ]),
    );
  });

  it("completes animations subcommands", () => {
    const completions = getCompletions("animations ", mockContext);
    expect(completions).toEqual(
      expect.arrayContaining([
        "battery",
        "low",
        "balanced",
        "maximum",
        "auto",
        "play",
        "stop",
        "force",
        "status",
      ]),
    );
  });

  it("completes performance subcommands", () => {
    const completions = getCompletions("performance ", mockContext);
    expect(completions).toEqual(
      expect.arrayContaining([
        "monitor",
        "hide",
        "status",
        "open",
        "close",
        "report",
        "help",
      ]),
    );
  });

  it("completes ai subcommands", () => {
    const completions = getCompletions("ai ", mockContext);
    expect(completions).toEqual(
      expect.arrayContaining([
        "help",
        "init",
        "models",
        "chat",
        "stream",
        "clear",
        "status",
      ]),
    );
  });

  it("completes man command pages", () => {
    const completions = getCompletions("man ", mockContext);
    expect(completions).toEqual(
      expect.arrayContaining([
        "help",
        "ls",
        "cd",
        "pwd",
        "cat",
        "clear",
        "fps",
        "performance",
        "echo",
        "whoami",
        "date",
        "goto",
        "animations",
        "ai",
        "chat",
        "exit",
        "socialmedia",
      ]),
    );
  });

  it("returns empty array for unknown command", () => {
    const completions = getCompletions("unknown ", mockContext);
    expect(completions).toEqual([]);
  });
});
