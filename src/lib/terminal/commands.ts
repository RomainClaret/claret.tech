// Terminal command implementations

import { getFileAtPath, resolvePath } from "./fileSystem";
import { aiCommands } from "./ai-commands";
import { getUser, listUsernames } from "./users";
import { contactInfo } from "@/data/sections/contact";
import { socialMediaLinks } from "@/data/sections/social";
import { generateASCIIProgressBar } from "@/components/ui/progress-bar";

export interface CommandContext {
  currentDirectory: string;
  currentUser: string;
  setCurrentDirectory: (path: string) => void;
  setCurrentUser: (username: string) => void;
  addToHistory: (line: string) => void;
  clearTerminal: () => void;
  closeTerminal: () => void;
  terminalCols?: number;
  terminalRows?: number;
  writer?: (text: string) => void;
  abortController?: AbortController;
}

export interface CommandResult {
  output: string;
  success: boolean;
}

export type CommandFunction = (
  args: string[],
  context: CommandContext,
) => CommandResult | Promise<CommandResult>;

export const commands: Record<string, CommandFunction> = {
  help: () => {
    const systemCommands = [
      { cmd: "help", desc: "Show this help message" },
      { cmd: "man [command]", desc: "Display command manual pages" },
      {
        cmd: "fps",
        desc: "Open lightweight FPS monitor (no performance impact)",
      },
      { cmd: "performance [action]", desc: "Performance monitoring controls" },
    ];

    const posixCommands = [
      { cmd: "ls [path]", desc: "List directory contents" },
      { cmd: "cd <path>", desc: "Change directory" },
      { cmd: "pwd", desc: "Print working directory" },
      { cmd: "cat <file>", desc: "Display file contents" },
      { cmd: "clear", desc: "Clear the terminal" },
      { cmd: "echo <text>", desc: "Display text" },
      { cmd: "whoami", desc: "Display current user" },
      { cmd: "date", desc: "Display current date and time" },
      { cmd: "exit", desc: "Close the terminal" },
    ];

    const websiteCommands = [
      { cmd: "goto <section>", desc: "Navigate to any website section" },
      { cmd: "resume", desc: "Display resume/CV information" },
      { cmd: "contact", desc: "Show contact information" },
      { cmd: "email", desc: "Copy email to clipboard" },
      { cmd: "socialmedia", desc: "Show all social media commands" },
      {
        cmd: "animations <command>",
        desc: "Control quality and background animations",
      },
      { cmd: "reload", desc: "Refresh the webpage" },
    ];

    const aiCommands = [
      { cmd: "ai <command>", desc: "AI assistant commands" },
      { cmd: "chat <message>", desc: "Chat with AI assistant" },
    ];

    // Calculate max command length across all categories
    const allCommands = [
      ...systemCommands,
      ...posixCommands,
      ...websiteCommands,
      ...aiCommands,
    ];
    const maxCmdLength = Math.max(...allCommands.map((c) => c.cmd.length));

    const formatCommands = (cmds: typeof systemCommands) =>
      cmds
        .map(({ cmd, desc }) => `  ${cmd.padEnd(maxCmdLength + 2)} ${desc}`)
        .join("\n");

    return {
      output: `\x1b[1m\x1b[33mHybrid Terminal\x1b[0m - Mix of POSIX and custom website commands

\x1b[1m\x1b[36mSystem Commands:\x1b[0m
${formatCommands(systemCommands)}

\x1b[1m\x1b[36mPOSIX-like Commands:\x1b[0m
${formatCommands(posixCommands)}

\x1b[1m\x1b[36mWebsite Commands:\x1b[0m
${formatCommands(websiteCommands)}

\x1b[1m\x1b[36mAI Assistant:\x1b[0m
${formatCommands(aiCommands)}

\x1b[1m\x1b[36mNavigation:\x1b[0m
  Use Tab for command completion
  Use Up/Down arrows for command history
  Use Ctrl+C to cancel current input`,
      success: true,
    };
  },

  ls: (args, context) => {
    const showHidden =
      args.includes("-a") || args.includes("--all") || args.includes("-la");
    const longFormat = args.includes("-l") || args.includes("-la");
    const targetPath = args.find((arg) => !arg.startsWith("-")) || ".";
    const resolvedPath = resolvePath(context.currentDirectory, targetPath);
    const target = getFileAtPath(resolvedPath);

    if (!target) {
      return {
        output: `ls: cannot access '${targetPath}': No such file or directory`,
        success: false,
      };
    }

    if (target.type === "file") {
      if (longFormat) {
        const date = new Date().toISOString().split("T")[0];
        return {
          output: `-rw-r--r-- 42 ${date} ${target.name}`,
          success: true,
        };
      }
      return {
        output: target.name,
        success: true,
      };
    }

    if (!target.children) {
      return {
        output: "",
        success: true,
      };
    }

    const entries = Object.values(target.children)
      .filter((file) => showHidden || !file.hidden)
      .map((file) => {
        const isDir = file.type === "directory";
        const name = file.name + (isDir ? "/" : "");

        if (longFormat) {
          const date = new Date().toISOString().split("T")[0];
          const perms = isDir ? "drwxr-xr-x" : "-rw-r--r--";
          const size = isDir ? "-" : "42";
          return `${perms} ${size} ${date} ${name}`;
        }

        return name;
      })
      .sort();

    if (longFormat) {
      return {
        output: entries.join("\n"),
        success: true,
      };
    }

    return {
      output: entries.join("  "),
      success: true,
    };
  },

  cd: (args, context) => {
    if (args.length === 0) {
      context.setCurrentDirectory("/");
      return { output: "", success: true };
    }

    const targetPath = args[0];
    const resolvedPath = resolvePath(context.currentDirectory, targetPath);
    const target = getFileAtPath(resolvedPath);

    if (!target) {
      return {
        output: `cd: no such file or directory: ${targetPath}`,
        success: false,
      };
    }

    if (target.type !== "directory") {
      return {
        output: `cd: not a directory: ${targetPath}`,
        success: false,
      };
    }

    context.setCurrentDirectory(resolvedPath);
    return { output: "", success: true };
  },

  pwd: (args, context) => ({
    output: context.currentDirectory,
    success: true,
  }),

  cat: (args, context) => {
    if (args.length === 0) {
      return {
        output: "cat: missing file operand",
        success: false,
      };
    }

    const outputs: string[] = [];
    let hasError = false;

    for (const filename of args) {
      const resolvedPath = resolvePath(context.currentDirectory, filename);
      const file = getFileAtPath(resolvedPath);

      if (!file) {
        outputs.push(`cat: ${filename}: No such file or directory`);
        hasError = true;
        continue;
      }

      if (file.type === "directory") {
        outputs.push(`cat: ${filename}: Is a directory`);
        hasError = true;
        continue;
      }

      outputs.push(file.content || "");
    }

    return {
      output: outputs.join("\n"),
      success: !hasError,
    };
  },

  clear: (args, context) => {
    context.clearTerminal();
    // Note: The prompt will be written by the terminal after command execution
    return { output: "", success: true };
  },

  fps: () => {
    // Dispatch event to trigger performance monitor (lightweight FPS only)
    window.dispatchEvent(new CustomEvent("terminal-fps-command"));
    return {
      output:
        "🎯 FPS monitor activated (lightweight mode)\nUse performance commands for full monitoring",
      success: true,
    };
  },

  performance: (args) => {
    const action = args[0]?.toLowerCase();

    switch (action) {
      case "monitor":
      case "full":
        // Start heavy performance monitoring and show overlay
        window.dispatchEvent(new CustomEvent("terminal-fps-command"));
        window.dispatchEvent(
          new CustomEvent("terminal-enable-full-monitoring"),
        );
        return {
          output:
            "⚠️  Heavy performance monitoring activated\n" +
            "📊 Full CPU/GPU/Memory monitoring enabled\n" +
            "🔍 Performance overlay displayed\n\n" +
            "⚡ WARNING: This may impact performance\n" +
            "Use 'performance hide' to stop monitoring",
          success: true,
        };

      case "hide":
        // Stop heavy monitoring and hide overlay
        window.dispatchEvent(new CustomEvent("terminal-performance-close"));
        return {
          output:
            "🔇 Performance monitoring stopped\n" +
            "📊 Overlay hidden\n" +
            "⚡ Resources released",
          success: true,
        };

      case "status":
        // Check monitoring status without starting it
        const isActive = document.querySelector(
          "[data-performance-monitor-active]",
        );
        return {
          output: isActive
            ? "📊 Performance monitoring: ACTIVE\n⚡ Heavy monitoring is running and may impact performance"
            : "📊 Performance monitoring: INACTIVE\n⚡ No performance impact",
          success: true,
        };

      case "close":
        window.dispatchEvent(new CustomEvent("terminal-performance-close"));
        return { output: "Performance dashboard closed", success: true };

      case "report":
        // Start report generation process
        window.dispatchEvent(new CustomEvent("terminal-performance-report"));

        // Set up progress monitoring
        let progressOutput = "Generating performance report...\n";

        // Listen for progress updates
        const progressListener = (event: CustomEvent) => {
          const { phase, progress } = event.detail || {};
          progressOutput = `${phase}\n${generateASCIIProgressBar(progress)}\n`;
        };

        const completeListener = () => {
          progressOutput =
            "✅ Performance report generated successfully!\nUse 'performance' to view the full dashboard.";
          window.removeEventListener(
            "performance-report-progress",
            progressListener as EventListener,
          );
          window.removeEventListener(
            "performance-report-complete",
            completeListener,
          );
        };

        const errorListener = () => {
          progressOutput =
            "❌ Failed to generate performance report. Please try again.";
          window.removeEventListener(
            "performance-report-progress",
            progressListener as EventListener,
          );
          window.removeEventListener("performance-report-error", errorListener);
        };

        window.addEventListener(
          "performance-report-progress",
          progressListener as EventListener,
        );
        window.addEventListener(
          "performance-report-complete",
          completeListener,
        );
        window.addEventListener("performance-report-error", errorListener);

        return {
          output: progressOutput,
          success: true,
          isAsync: true,
          progressCallback: () => progressOutput,
        };

      case "help":
        return {
          output: `Performance Monitoring Commands:
  performance monitor    🔥 Enable heavy monitoring (CPU/GPU/Memory) + overlay
  performance hide       🔇 Disable all monitoring + hide overlay  
  performance status     📊 Check monitoring status (no performance impact)
  performance            📈 Open full performance dashboard
  performance close      ❌ Close the dashboard
  performance report     📋 Generate performance report
  performance help       ❓ Show this help
  
⚠️  Heavy monitoring may impact performance - use only when needed!`,
          success: true,
        };

      case undefined:
      case "":
      case "open":
      default:
        // Generate access token for security
        const token = Math.random().toString(36).substring(2, 15);
        window.dispatchEvent(
          new CustomEvent("terminal-performance-dashboard", {
            detail: { token, timestamp: Date.now() },
          }),
        );
        return { output: "Performance dashboard opened", success: true };
    }
  },

  echo: (args) => ({
    output: args.join(" "),
    success: true,
  }),

  whoami: (_args, context) => ({
    output: context.currentUser,
    success: true,
  }),

  login: (args, context) => {
    if (args.length === 0) {
      return { output: "Usage: login <username>", success: false };
    }

    const username = args[0];
    const user = getUser(username);

    if (!user) {
      return {
        output: `User '${username}' not found. Try 'users' to see available users.`,
        success: false,
      };
    }

    context.setCurrentUser(username);
    context.setCurrentDirectory("/");

    return {
      output: `\x1b[32mWelcome, ${user.displayName}!\x1b[0m\n\nYou are now logged in as '${username}'. ${user.isAdmin ? "(Admin privileges granted)" : ""}\n`,
      success: true,
    };
  },

  logout: (_args, context) => {
    const previousUser = context.currentUser;
    context.setCurrentUser("guest");
    context.setCurrentDirectory("/");

    return {
      output: `Logged out from '${previousUser}'. You are now logged in as 'guest'.`,
      success: true,
    };
  },

  users: () => {
    const usernames = listUsernames();
    const userList = usernames
      .map((username) => {
        const user = getUser(username);
        return `  ${username}${user?.isAdmin ? " (admin)" : ""} - ${user?.displayName || "Unknown"}`;
      })
      .join("\n");

    return {
      output: `Available users:\n${userList}\n\nUse 'login <username>' to switch users.`,
      success: true,
    };
  },

  date: () => ({
    output: new Date().toString(),
    success: true,
  }),

  sudo: (_args) => {
    return {
      output:
        "Permission denied: This command requires administrator privileges.",
      success: false,
    };
  },

  exit: (args, context) => {
    context.closeTerminal();
    return { output: "Goodbye!", success: true };
  },

  reload: () => {
    setTimeout(() => {
      window.location.reload();
    }, 500); // Small delay to allow terminal to show response
    return { output: "Reloading page...", success: true };
  },

  resume: () => {
    const lines = [
      "",
      "\x1b[1m\x1b[36mRomain Claret - Resume/CV\x1b[0m",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      "📄 Full resume available on the portfolio website",
      "🎓 PhD Researcher in Neuroevolution & Compositional Thinking",
      "🏛️ University of Neuchâtel, Switzerland",
      "",
      "To view my complete resume, navigate to the",
      "Experience and Education sections on this website.",
      "",
      "Use 'goto experience' or 'goto education' to explore.",
      "",
    ];

    return { output: lines.join("\n"), success: true };
  },

  contact: () => {
    const lines = [
      "",
      "\x1b[1m\x1b[36mContact Information\x1b[0m",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      `📧 Email: ${contactInfo.emailAddress}`,
      `🐦 Twitter: ${contactInfo.twitterUrl}`,
      "",
      contactInfo.subtitle.highlightedText,
      contactInfo.subtitle.normalText,
      "",
      "Use 'email' to copy email to clipboard",
      "Use 'linkedin' or 'github' for social profiles",
      "",
    ];

    return { output: lines.join("\n"), success: true };
  },

  linkedin: () => {
    setTimeout(() => {
      window.open(socialMediaLinks.linkedin, "_blank");
    }, 100);
    return {
      output: `Opening LinkedIn profile: ${socialMediaLinks.linkedin}`,
      success: true,
    };
  },

  github: () => {
    setTimeout(() => {
      window.open(socialMediaLinks.github, "_blank");
    }, 100);
    return {
      output: `Opening GitHub profile: ${socialMediaLinks.github}`,
      success: true,
    };
  },

  email: () => {
    const email = contactInfo.emailAddress.replace(" {at} ", "@");

    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(email)
        .then(() => {
          // Success handled in the return message
        })
        .catch(() => {
          // Fallback handled in the return message
        });
      return { output: `Email copied to clipboard: ${email}`, success: true };
    } else {
      // Fallback for browsers without clipboard API
      return {
        output: `Email: ${email}\n(Manual copy needed - clipboard API not available)`,
        success: true,
      };
    }
  },

  orcid: () => {
    setTimeout(() => {
      window.open(socialMediaLinks.orcid, "_blank");
    }, 100);
    return {
      output: `Opening ORCID profile: ${socialMediaLinks.orcid}`,
      success: true,
    };
  },

  gitlab: () => {
    setTimeout(() => {
      window.open(socialMediaLinks.gitlab, "_blank");
    }, 100);
    return {
      output: `Opening GitLab profile: ${socialMediaLinks.gitlab}`,
      success: true,
    };
  },

  medium: () => {
    setTimeout(() => {
      window.open(socialMediaLinks.medium, "_blank");
    }, 100);
    return {
      output: `Opening Medium profile: ${socialMediaLinks.medium}`,
      success: true,
    };
  },

  stackoverflow: () => {
    setTimeout(() => {
      window.open(socialMediaLinks.stackoverflow, "_blank");
    }, 100);
    return {
      output: `Opening Stack Overflow profile: ${socialMediaLinks.stackoverflow}`,
      success: true,
    };
  },

  instagram: () => {
    setTimeout(() => {
      window.open(socialMediaLinks.instagram, "_blank");
    }, 100);
    return {
      output: `Opening Instagram profile: ${socialMediaLinks.instagram}`,
      success: true,
    };
  },

  reddit: () => {
    setTimeout(() => {
      window.open(socialMediaLinks.reddit, "_blank");
    }, 100);
    return {
      output: `Opening Reddit profile: ${socialMediaLinks.reddit}`,
      success: true,
    };
  },

  socialmedia: () => {
    const lines = [
      "",
      "\x1b[1m\x1b[36mSocial Media Commands\x1b[0m",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      "Open social media profiles in new tabs:",
      "",
      "  \x1b[32mlinkedin\x1b[0m      LinkedIn profile",
      "  \x1b[32mgithub\x1b[0m        GitHub repositories",
      "  \x1b[32morcid\x1b[0m         ORCID academic profile",
      "  \x1b[32mgitlab\x1b[0m        GitLab repositories",
      "  \x1b[32mmedium\x1b[0m        Medium blog posts",
      "  \x1b[32mstackoverflow\x1b[0m Stack Overflow profile",
      "  \x1b[32minstagram\x1b[0m     Instagram (@weak_intelligence)",
      "  \x1b[32mreddit\x1b[0m        Reddit profile",
      "",
      "Type any command above to open the corresponding profile.",
      "",
    ];

    return { output: lines.join("\n"), success: true };
  },

  about: () => {
    const lines = [
      "",
      "\x1b[1m\x1b[36mRomain Claret\x1b[0m",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      "PhD Researcher. Evolving Artificial Intelligence. Switzerland.",
      "",
      "romclaret@gmail.com",
      "github.com/RomainClaret",
      "",
    ];

    return { output: lines.join("\n"), success: true };
  },

  skills: () => {
    const lines = [
      "",
      "\x1b[1m\x1b[36mSkills\x1b[0m",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      "Python, JAX, PyTorch",
      "TypeScript, React, Node.js",
      "Neuroevolution, ML, RL",
      "AWS, Docker, Kubernetes",
      "",
    ];

    return { output: lines.join("\n"), success: true };
  },

  experience: () => {
    const lines = [
      "",
      "\x1b[1m\x1b[36mExperience\x1b[0m",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      "PhD Researcher - University of Neuchâtel (2022-Present)",
      "Software Engineer - Various (2015-Present)",
      "",
    ];

    return { output: lines.join("\n"), success: true };
  },

  projects: () => {
    const lines = [
      "",
      "\x1b[1m\x1b[36mProjects\x1b[0m",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      "A little bit of everything",
      "",
      "github.com/RomainClaret",
      "",
    ];

    return { output: lines.join("\n"), success: true };
  },

  education: () => {
    const lines = [
      "",
      "\x1b[1m\x1b[36mEducation\x1b[0m",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      "PhD Computer Science - University of Neuchâtel (2022-2025)",
      "MSc Software Engineering - HES-SO (2018-2020)",
      "BSc Computer Science - HES-SO (2015-2018)",
      "",
    ];

    return { output: lines.join("\n"), success: true };
  },

  goto: (args) => {
    const commands = [
      "",
      "Navigation Commands:",
      "",
      "  home         - Go to introduction section",
      "  skills       - View technical skills",
      "  experience   - Browse work experience",
      "  projects     - Explore projects",
      "  research     - Explore research & innovation",
      "  papers       - Read academic papers",
      "  education    - View education history",
      "  blog         - Read blog posts",
      "  contact      - Get in touch",
      "",
      "Usage: goto <section>",
      "Example: goto projects",
      "",
    ];

    if (args.length === 0) {
      return { output: commands.join("\n"), success: true };
    }

    const section = args[0].toLowerCase();
    const validSections = [
      "home",
      "skills",
      "experience",
      "projects",
      "research",
      "papers",
      "education",
      "blog",
      "contact",
    ];

    if (!validSections.includes(section)) {
      return {
        output: [`Unknown section: ${section}`, "", ...commands].join("\n"),
        success: false,
      };
    }

    // Navigate to section
    const element = document.getElementById(
      section === "blog" ? "blogs" : section,
    );
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      return { output: `Navigating to ${section}...`, success: true };
    }

    return { output: `Section not found: ${section}`, success: false };
  },

  man: (args) => {
    // Manual pages for all commands
    const manuals: Record<string, string[]> = {
      help: [
        "\x1b[1mNAME\x1b[0m",
        "    help - display available commands",
        "",
        "\x1b[1mSYNOPSIS\x1b[0m",
        "    help",
        "",
        "\x1b[1mDESCRIPTION\x1b[0m",
        "    Display a list of all available commands with brief descriptions.",
        "    Commands marked as hidden will not appear in this list.",
        "",
        "\x1b[1mEXAMPLE\x1b[0m",
        "    help",
      ],

      ls: [
        "\x1b[1mNAME\x1b[0m",
        "    ls - list directory contents",
        "",
        "\x1b[1mSYNOPSIS\x1b[0m",
        "    ls [OPTIONS] [PATH]",
        "",
        "\x1b[1mDESCRIPTION\x1b[0m",
        "    List information about files and directories at the specified PATH",
        "    (current directory by default).",
        "",
        "\x1b[1mOPTIONS\x1b[0m",
        "    -l      Use long listing format showing permissions, size, and date",
        "    -a      Show all files including hidden files (starting with .)",
        "    -la     Combine -l and -a options",
        "",
        "\x1b[1mEXAMPLES\x1b[0m",
        "    ls              List current directory",
        "    ls -l           Long format listing",
        "    ls -a           Show hidden files",
        "    ls docs/        List contents of docs directory",
      ],

      cd: [
        "\x1b[1mNAME\x1b[0m",
        "    cd - change directory",
        "",
        "\x1b[1mSYNOPSIS\x1b[0m",
        "    cd [PATH]",
        "",
        "\x1b[1mDESCRIPTION\x1b[0m",
        "    Change the current working directory to PATH. If no PATH is given,",
        "    change to the root directory (/).",
        "",
        "\x1b[1mEXAMPLES\x1b[0m",
        "    cd              Change to root directory",
        "    cd docs         Change to docs directory",
        "    cd ..           Go up one directory",
        "    cd /docs        Change to /docs (absolute path)",
      ],

      pwd: [
        "\x1b[1mNAME\x1b[0m",
        "    pwd - print working directory",
        "",
        "\x1b[1mSYNOPSIS\x1b[0m",
        "    pwd",
        "",
        "\x1b[1mDESCRIPTION\x1b[0m",
        "    Display the absolute path of the current working directory.",
        "",
        "\x1b[1mEXAMPLE\x1b[0m",
        "    pwd",
      ],

      cat: [
        "\x1b[1mNAME\x1b[0m",
        "    cat - concatenate and display files",
        "",
        "\x1b[1mSYNOPSIS\x1b[0m",
        "    cat FILE [FILE...]",
        "",
        "\x1b[1mDESCRIPTION\x1b[0m",
        "    Display the contents of one or more files. Multiple files are",
        "    concatenated in the order specified.",
        "",
        "\x1b[1mEXAMPLES\x1b[0m",
        "    cat README.md           Display README.md",
        "    cat file1 file2         Display file1 followed by file2",
        "    cat docs/guide.md       Display guide.md from docs directory",
      ],

      clear: [
        "\x1b[1mNAME\x1b[0m",
        "    clear - clear the terminal screen",
        "",
        "\x1b[1mSYNOPSIS\x1b[0m",
        "    clear",
        "",
        "\x1b[1mDESCRIPTION\x1b[0m",
        "    Clear the terminal screen, leaving only the command prompt.",
        "",
        "\x1b[1mEXAMPLE\x1b[0m",
        "    clear",
      ],

      fps: [
        "\x1b[1mNAME\x1b[0m",
        "    fps - open lightweight FPS performance monitor",
        "",
        "\x1b[1mSYNOPSIS\x1b[0m",
        "    fps",
        "",
        "\x1b[1mDESCRIPTION\x1b[0m",
        "    Open the lightweight real-time FPS monitor with minimal performance",
        "    impact. This mode only tracks frame rate, animations, and GPU layers",
        "    without CPU/GPU benchmarking or heavy resource monitoring.",
        "",
        "\x1b[1mMONITORING MODE\x1b[0m",
        "    Lightweight: Only FPS tracking (no performance impact)",
        "    • Real-time frame rate monitoring",
        "    • Animation and GPU layer counting",
        "    • Browser optimization status",
        "    • Safe for continuous use",
        "",
        "\x1b[1mGRANULAR CONTROLS\x1b[0m",
        "    The monitor UI includes toggle controls to selectively enable:",
        "    • CPU monitoring (benchmarking worker)",
        "    • GPU monitoring (WebGL performance tests)",
        "    • Memory tracking (heap usage analysis)",
        "    • Web Vitals (LCP, INP, CLS, FCP, TTFB)",
        "    • Network analysis (connection type, bandwidth)",
        "    • Resource tracking (transfer sizes, long tasks)",
        "    • Hardware detection (device capabilities)",
        "",
        "\x1b[1mFULL MONITORING\x1b[0m",
        "    For comprehensive monitoring with all features enabled, use:",
        "    performance full    (enables all monitoring systems)",
        "",
        "\x1b[1mEXAMPLE\x1b[0m",
        "    fps                 # Lightweight FPS monitor",
        "    performance full    # Heavy monitoring (all features)",
      ],

      echo: [
        "\x1b[1mNAME\x1b[0m",
        "    echo - display text",
        "",
        "\x1b[1mSYNOPSIS\x1b[0m",
        "    echo [TEXT...]",
        "",
        "\x1b[1mDESCRIPTION\x1b[0m",
        "    Display the specified text. Multiple arguments are joined with spaces.",
        "",
        "\x1b[1mEXAMPLES\x1b[0m",
        "    echo Hello World        Display 'Hello World'",
        "    echo                    Display empty line",
        "    echo Test 123           Display 'Test 123'",
      ],

      whoami: [
        "\x1b[1mNAME\x1b[0m",
        "    whoami - display current username",
        "",
        "\x1b[1mSYNOPSIS\x1b[0m",
        "    whoami",
        "",
        "\x1b[1mDESCRIPTION\x1b[0m",
        "    Display the username of the current user.",
        "",
        "\x1b[1mEXAMPLE\x1b[0m",
        "    whoami",
      ],

      date: [
        "\x1b[1mNAME\x1b[0m",
        "    date - display current date and time",
        "",
        "\x1b[1mSYNOPSIS\x1b[0m",
        "    date",
        "",
        "\x1b[1mDESCRIPTION\x1b[0m",
        "    Display the current system date and time.",
        "",
        "\x1b[1mEXAMPLE\x1b[0m",
        "    date",
      ],

      goto: [
        "\x1b[1mNAME\x1b[0m",
        "    goto - navigate to website sections",
        "",
        "\x1b[1mSYNOPSIS\x1b[0m",
        "    goto [SECTION]",
        "",
        "\x1b[1mDESCRIPTION\x1b[0m",
        "    Navigate to different sections of the website. Without arguments,",
        "    displays available sections.",
        "",
        "\x1b[1mSECTIONS\x1b[0m",
        "    home         Introduction section",
        "    skills       Technical skills",
        "    experience   Work experience",
        "    projects     Project showcase",
        "    research     Academic research",
        "    papers       Academic papers",
        "    education    Education history",
        "    blog         Blog posts",
        "    contact      Contact information",
        "",
        "\x1b[1mEXAMPLES\x1b[0m",
        "    goto                Show available sections",
        "    goto projects       Navigate to projects section",
      ],

      ai: [
        "\x1b[1mNAME\x1b[0m",
        "    ai - AI assistant commands",
        "",
        "\x1b[1mSYNOPSIS\x1b[0m",
        "    ai [SUBCOMMAND] [ARGS...]",
        "",
        "\x1b[1mDESCRIPTION\x1b[0m",
        "    Control and interact with the built-in AI assistant powered by WebLLM.",
        "",
        "\x1b[1mSUBCOMMANDS\x1b[0m",
        "    help            Show AI command help",
        "    init [model]    Initialize AI model (default: Llama 3.2 1B)",
        "    models          List available models",
        "    chat <message>  Send a message to the AI",
        "    stream <msg>    Chat with streaming responses",
        "    clear           Clear chat history",
        "    status          Show AI status",
        "",
        "\x1b[1mEXAMPLES\x1b[0m",
        "    ai init                 Initialize default model",
        "    ai chat Hello          Send 'Hello' to AI",
        "    ai status              Check if AI is ready",
      ],

      animations: [
        "\x1b[1mNAME\x1b[0m",
        "    animations - control quality and background animations",
        "",
        "\x1b[1mSYNOPSIS\x1b[0m",
        "    animations <command>",
        "",
        "\x1b[1mDESCRIPTION\x1b[0m",
        "    Control animation quality and background elements (neural networks, signals).",
        "    The quality system provides adaptive performance with 4 quality modes that",
        "    adjust FPS targets, effects, and visual complexity. Animation control allows",
        "    starting/stopping animations independently of quality settings.",
        "",
        "\x1b[1mQUALITY MODES\x1b[0m",
        "    battery     🔋 Battery saver mode (minimal effects, 60 FPS target)",
        "    low         🔅 Low performance mode (Safari-optimized, 50 FPS target)",
        "    balanced    ⚖️  Balanced mode (key animations, 45 FPS target)",
        "    maximum     🚀 Maximum quality mode (all effects, 30 FPS target)",
        "    auto        🤖 Auto quality adjustment based on real-time performance",
        "",
        "\x1b[1mANIMATION CONTROL\x1b[0m",
        "    play        🎬 Start background animations",
        "    stop        ⏸️  Stop background animations",
        "    force       💪 Force-enable animations (overrides auto-disable protection)",
        "",
        "\x1b[1mSTATUS & INFO\x1b[0m",
        "    status      📊 Show current quality mode and animation state",
        "",
        "\x1b[1mQUALITY FEATURES BY MODE\x1b[0m",
        "    Battery:    Static lines, no particles, minimal effects",
        "    Low:        Animated signals, Safari-safe, no WebGL effects",
        "    Balanced:   Glow effects, normal stroke width, balanced performance",
        "    Maximum:    Rainbow gradients, particles, blur effects, thick strokes",
        "",
        "\x1b[1mAUTO-DISABLE PROTECTION\x1b[0m",
        "    Animations automatically disable when FPS drops below 15 for 10+ seconds",
        "    to protect device performance. Use 'force' to override this protection.",
        "    A 30-minute cooldown prevents repeated auto-disables.",
        "",
        "\x1b[1mEXAMPLES\x1b[0m",
        "    animations balanced     Switch to balanced quality mode",
        "    animations auto         Enable auto quality adjustment",
        "    animations play         Start animations",
        "    animations stop         Stop animations",
        "    animations status       Show current quality and animation state",
        "    animations force        Override auto-disable protection",
      ],

      chat: [
        "\x1b[1mNAME\x1b[0m",
        "    chat - quick AI chat interface",
        "",
        "\x1b[1mSYNOPSIS\x1b[0m",
        "    chat <MESSAGE>",
        "",
        "\x1b[1mDESCRIPTION\x1b[0m",
        "    Send a message directly to the AI assistant. This is a shorthand",
        "    for 'ai chat'. The AI must be initialized first using 'ai init'.",
        "",
        "\x1b[1mEXAMPLES\x1b[0m",
        "    chat What is JavaScript?",
        "    chat Help me write a function",
      ],

      exit: [
        "\x1b[1mNAME\x1b[0m",
        "    exit - close the terminal",
        "",
        "\x1b[1mSYNOPSIS\x1b[0m",
        "    exit",
        "",
        "\x1b[1mDESCRIPTION\x1b[0m",
        "    Close the terminal window and end the session.",
        "",
        "\x1b[1mEXAMPLE\x1b[0m",
        "    exit",
      ],

      performance: [
        "\x1b[1mNAME\x1b[0m",
        "    performance - granular performance monitoring controls",
        "",
        "\x1b[1mSYNOPSIS\x1b[0m",
        "    performance [ACTION]",
        "",
        "\x1b[1mDESCRIPTION\x1b[0m",
        "    Control performance monitoring with granular feature selection.",
        "    By default, only lightweight FPS monitoring is enabled. Additional",
        "    monitoring features can be enabled via commands or UI toggles.",
        "",
        "\x1b[1mACTIONS\x1b[0m",
        "    monitor     Enable all monitoring features + show overlay",
        "    full        Enable all monitoring features + show overlay",
        "    hide        Disable monitoring + hide overlay",
        "    status      Check monitoring status (no performance impact)",
        "    (none)      Open performance dashboard",
        "    open        Open performance dashboard",
        "    close       Close the dashboard",
        "    report      Generate performance report",
        "    help        Show performance command help",
        "",
        "\x1b[1mMONITORING LEVELS\x1b[0m",
        "    Lightweight: FPS only (default, no performance impact)",
        "    Selective:   Choose specific features via UI toggles",
        "    Full:        All monitoring enabled (may impact performance)",
        "",
        "\x1b[1mGRANULAR CONTROLS\x1b[0m",
        "    The performance monitor UI includes toggle controls for:",
        "    • Web Vitals (LCP, INP, CLS, FCP, TTFB)",
        "    • CPU monitoring (benchmark worker)",
        "    • GPU monitoring (WebGL performance tests)",
        "    • Memory tracking (heap usage analysis)",
        "    • Network analysis (connection type, bandwidth)",
        "    • Resource tracking (transfer sizes, long tasks)",
        "    • Hardware detection (device capabilities)",
        "",
        "\x1b[1mDEFAULT BEHAVIOR\x1b[0m",
        "    • 'fps' command: Lightweight FPS-only monitoring",
        "    • 'performance full': All monitoring features enabled",
        "    • UI toggles: Individual feature control",
        "",
        "\x1b[1mPERFORMANCE IMPACT\x1b[0m",
        "    Features that may impact browser performance:",
        "    • CPU benchmark worker (intensive math operations)",
        "    • GPU monitoring with WebGL contexts",
        "    • Memory heap analysis",
        "    • Web Vitals performance observers",
        "    • Resource transfer size calculations",
        "",
        "\x1b[1mEXAMPLES\x1b[0m",
        "    fps                     Lightweight FPS monitor",
        "    performance full        Enable all monitoring + overlay",
        "    performance monitor     Same as 'full'",
        "    performance hide        Stop monitoring + release resources",
        "    performance status      Check monitoring status",
        "    performance             Open dashboard",
        "    performance close       Close dashboard",
        "    performance report      Generate performance report",
      ],

      socialmedia: [
        "\x1b[1mNAME\x1b[0m",
        "    socialmedia - display social media commands",
        "",
        "\x1b[1mSYNOPSIS\x1b[0m",
        "    socialmedia",
        "",
        "\x1b[1mDESCRIPTION\x1b[0m",
        "    Display all available social media commands with descriptions.",
        "    Each command opens the corresponding social profile in a new tab.",
        "",
        "\x1b[1mAVAILABLE COMMANDS\x1b[0m",
        "    linkedin        Open LinkedIn profile",
        "    github          Open GitHub repositories",
        "    orcid           Open ORCID academic profile",
        "    gitlab          Open GitLab repositories",
        "    medium          Open Medium blog posts",
        "    stackoverflow   Open Stack Overflow profile",
        "    instagram       Open Instagram profile (@weak_intelligence)",
        "    reddit          Open Reddit profile",
        "",
        "\x1b[1mEXAMPLE\x1b[0m",
        "    socialmedia     Show all social media commands",
      ],

      man: [
        "\x1b[1mNAME\x1b[0m",
        "    man - display command manual pages",
        "",
        "\x1b[1mSYNOPSIS\x1b[0m",
        "    man [COMMAND]",
        "",
        "\x1b[1mDESCRIPTION\x1b[0m",
        "    Display detailed documentation for commands. Without arguments,",
        "    shows this help and lists all documented commands.",
        "",
        "\x1b[1mEXAMPLES\x1b[0m",
        "    man             Show this help",
        "    man ls          Show manual for ls command",
        "    man cd          Show manual for cd command",
      ],
    };

    if (args.length === 0) {
      // Show man help and list of commands
      const availableCommands = Object.keys(manuals).sort();
      return {
        output: [
          ...manuals.man,
          "",
          "\x1b[1mAVAILABLE MANUAL PAGES\x1b[0m",
          availableCommands.map((cmd) => `    ${cmd}`).join("\n"),
          "",
          "Use 'man <command>' to read a specific manual page.",
        ].join("\n"),
        success: true,
      };
    }

    const command = args[0].toLowerCase();
    const manual = manuals[command];

    if (!manual) {
      return {
        output: `No manual entry for '${command}'`,
        success: false,
      };
    }

    return {
      output: manual.join("\n"),
      success: true,
    };
  },

  animations: (args) => {
    if (args.length === 0) {
      return {
        output: `Usage: animations <quality|control|status>
        
\x1b[1mQuality Control:\x1b[0m
  battery     Battery saver mode (minimal animations, 60 FPS)
  low         Low performance mode (Safari-optimized, 50 FPS)
  balanced    Balanced mode (key animations, 45 FPS)
  maximum     Maximum quality (all effects, 30 FPS)
  auto        Auto quality adjustment based on performance

\x1b[1mAnimation Control:\x1b[0m
  play        Start background animations
  stop        Stop background animations
  force       Force-enable animations (overrides auto-disable)
  
\x1b[1mStatus:\x1b[0m
  status      Show current quality and animation state`,
        success: true,
      };
    }

    const subcommand = args[0].toLowerCase();

    switch (subcommand) {
      // Quality control commands
      case "battery":
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("quality-change", {
              detail: { quality: "battery" },
            }),
          );
        }
        return {
          output:
            "🔋 Switched to battery saver mode (minimal animations, 60 FPS target)",
          success: true,
        };

      case "low":
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("quality-change", {
              detail: { quality: "low" },
            }),
          );
        }
        return {
          output:
            "🔅 Switched to low performance mode (Safari-optimized, 50 FPS target)",
          success: true,
        };

      case "balanced":
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("quality-change", {
              detail: { quality: "balanced" },
            }),
          );
        }
        return {
          output:
            "⚖️  Switched to balanced mode (key animations, 45 FPS target)",
          success: true,
        };

      case "maximum":
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("quality-change", {
              detail: { quality: "maximum" },
            }),
          );
        }
        return {
          output: "🚀 Switched to maximum quality (all effects, 30 FPS target)",
          success: true,
        };

      case "auto":
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("quality-auto"));
        }
        return {
          output: "🤖 Auto quality adjustment enabled",
          success: true,
        };

      // Animation control commands
      case "play":
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("animation-play"));
        }
        return {
          output: "🎬 Background animations started",
          success: true,
        };

      case "stop":
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("animation-stop"));
        }
        return {
          output: "⏸️  Background animations stopped",
          success: true,
        };

      case "force":
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("animation-force"));
        }
        return {
          output:
            "💪 Animations force-enabled! Auto-disable protection bypassed.",
          success: true,
        };

      case "status":
        // Get current quality and animation status from localStorage
        const statusInfo = {
          isPlaying: false,
          isAutoDisabled: false,
          cooldownActive: false,
          remainingCooldown: 0,
          quality: "balanced",
          isQualityAuto: true,
        };

        if (typeof window !== "undefined") {
          try {
            // Get animation preference
            const animationStored = localStorage.getItem(
              "background-animations-state",
            );
            if (animationStored) {
              const parsed = JSON.parse(animationStored);
              statusInfo.isPlaying =
                typeof parsed === "boolean" ? parsed : parsed.value;
            }

            // Get quality preference
            const qualityStored = localStorage.getItem("quality-mode");
            if (qualityStored) {
              statusInfo.quality = qualityStored;
            }

            // Get quality auto preference
            const qualityAutoStored = localStorage.getItem("quality-auto");
            if (qualityAutoStored) {
              statusInfo.isQualityAuto = JSON.parse(qualityAutoStored);
            }

            // Get auto-disable state
            const autoDisableStored = localStorage.getItem(
              "fps-auto-disable-state",
            );
            if (autoDisableStored) {
              const autoState = JSON.parse(autoDisableStored);
              statusInfo.isAutoDisabled = autoState.isAutoDisabled;
              statusInfo.cooldownActive =
                autoState.cooldownActive ||
                (autoState.lastAutoDisableTime > 0 &&
                  Date.now() - autoState.lastAutoDisableTime < 30 * 60 * 1000);

              if (
                statusInfo.cooldownActive &&
                autoState.lastAutoDisableTime > 0
              ) {
                const elapsed = Date.now() - autoState.lastAutoDisableTime;
                const remaining = Math.max(
                  0,
                  Math.ceil((30 * 60 * 1000 - elapsed) / (60 * 1000)),
                );
                statusInfo.remainingCooldown = remaining;
              }
            }
          } catch {
            // Use defaults if error
          }
        }

        const effectiveState =
          statusInfo.isPlaying && !statusInfo.isAutoDisabled;

        // Quality icons and descriptions
        const qualityIcon =
          {
            battery: "🔋",
            low: "🔅",
            balanced: "⚖️",
            maximum: "🚀",
          }[statusInfo.quality] || "⚖️";

        const qualityDesc =
          {
            battery: "Battery saver (minimal effects)",
            low: "Low performance (Safari-optimized)",
            balanced: "Balanced (key animations)",
            maximum: "Maximum (all effects)",
          }[statusInfo.quality] || "Balanced";

        let output = `\x1b[1mQuality & Animation Status:\x1b[0m

\x1b[1mQuality Mode:\x1b[0m
  Current: ${qualityIcon} ${statusInfo.quality.charAt(0).toUpperCase() + statusInfo.quality.slice(1)} (${qualityDesc})
  Auto-Adjust: ${statusInfo.isQualityAuto ? "✅ Enabled" : "❌ Disabled"}

\x1b[1mAnimation State:\x1b[0m
  User Preference: ${statusInfo.isPlaying ? "🎬 Playing" : "⏸️  Stopped"}
  Auto-Disabled: ${statusInfo.isAutoDisabled ? "⚠️  Yes (performance protection)" : "✅ No"}
  Effective State: ${effectiveState ? "🎬 Playing" : "⏸️  Stopped"}`;

        if (statusInfo.cooldownActive) {
          output += `\n  Cooldown: 🕐 ${statusInfo.remainingCooldown} minutes remaining`;
        }

        output += `\n\n\x1b[1mQuality Commands:\x1b[0m
  animations battery    - Switch to battery saver mode
  animations low        - Switch to low performance mode
  animations balanced   - Switch to balanced mode
  animations maximum    - Switch to maximum quality
  animations auto       - Enable auto quality adjustment

\x1b[1mAnimation Commands:\x1b[0m
  animations play       - Enable animations
  animations stop       - Disable animations`;

        if (statusInfo.isAutoDisabled || statusInfo.cooldownActive) {
          output += `\n  animations force      - Override auto-disable protection`;
        }

        return {
          output,
          success: true,
        };

      default:
        return {
          output: `animations: '${subcommand}' is not a valid subcommand
          
Usage: animations <battery|low|balanced|maximum|auto|play|stop|force|status>

Quality: battery, low, balanced, maximum, auto
Control: play, stop, force
Info: status`,
          success: false,
        };
    }
  },

  // Add AI commands
  ...aiCommands,
};

// Command not found handler
export async function executeCommand(
  commandLine: string,
  context: CommandContext,
): Promise<CommandResult> {
  const trimmed = commandLine.trim();
  if (!trimmed) {
    return { output: "", success: true };
  }

  const [commandName, ...args] = trimmed.split(/\s+/);
  const command = commands[commandName];

  if (!command) {
    return {
      output: `${commandName}: command not found`,
      success: false,
    };
  }

  return await command(args, context);
}

// Tab completion helper
export function getCompletions(
  input: string,
  context: CommandContext,
): string[] {
  const parts = input.split(/\s+/);

  // Command completion
  if (parts.length === 1) {
    const partial = parts[0].toLowerCase();
    return Object.keys(commands)
      .filter((cmd) => cmd.startsWith(partial))
      .sort();
  }

  // File/directory completion for certain commands
  const command = parts[0];
  if (["cd", "cat", "ls"].includes(command)) {
    const partial = parts[parts.length - 1] || "";
    const dirPath = partial.includes("/")
      ? resolvePath(
          context.currentDirectory,
          partial.substring(0, partial.lastIndexOf("/")),
        )
      : context.currentDirectory;

    const dir = getFileAtPath(dirPath);
    if (dir && dir.type === "directory" && dir.children) {
      const prefix = partial.includes("/")
        ? partial.substring(0, partial.lastIndexOf("/") + 1)
        : "";

      const basename = partial.substring(partial.lastIndexOf("/") + 1);

      return Object.values(dir.children)
        .filter((file) => {
          if (!file.name.startsWith(basename)) return false;
          // For cd command, only show directories
          if (command === "cd" && file.type !== "directory") return false;
          return true;
        })
        .map(
          (file) => prefix + file.name + (file.type === "directory" ? "/" : ""),
        )
        .sort();
    }
  }

  // Goto command completion
  if (command === "goto") {
    const sections = [
      "home",
      "skills",
      "experience",
      "projects",
      "research",
      "papers",
      "education",
      "blog",
      "contact",
    ];
    const partial = parts[1]?.toLowerCase() || "";
    return sections.filter((section) => section.startsWith(partial)).sort();
  }

  // Animations command completion
  if (command === "animations") {
    const subcommands = [
      "battery",
      "low",
      "balanced",
      "maximum",
      "auto",
      "play",
      "stop",
      "force",
      "status",
    ];
    const partial = parts[1]?.toLowerCase() || "";
    return subcommands.filter((sub) => sub.startsWith(partial)).sort();
  }

  // Performance command completion
  if (command === "performance") {
    const subcommands = [
      "monitor",
      "hide",
      "status",
      "open",
      "close",
      "report",
      "help",
    ];
    const partial = parts[1]?.toLowerCase() || "";
    return subcommands.filter((sub) => sub.startsWith(partial)).sort();
  }

  // AI command completion
  if (command === "ai") {
    const subcommands = [
      "help",
      "init",
      "models",
      "chat",
      "stream",
      "clear",
      "status",
    ];
    const partial = parts[1]?.toLowerCase() || "";
    return subcommands.filter((sub) => sub.startsWith(partial)).sort();
  }

  // Man command completion
  if (command === "man") {
    const documentedCommands = [
      "help",
      "man",
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
    ];
    const partial = parts[1]?.toLowerCase() || "";
    return documentedCommands.filter((cmd) => cmd.startsWith(partial)).sort();
  }

  return [];
}
