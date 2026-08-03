"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { AnimatePresence } from "@/components/ui/animate-presence";
import { executeCommand, getCompletions } from "@/lib/terminal/commands";
import { useTerminal, MIN_SIZE } from "@/lib/terminal/terminal-context";
import { useResizableWithHandles } from "@/lib/hooks/useResizableWithHandles";
import { ResizeHandles } from "./ResizeHandles";
import { terminalConfig } from "@/data/portfolio";
import { useShouldReduceAnimations } from "@/lib/hooks/useSafari";
import { cn } from "@/lib/utils";
import { logError } from "@/lib/utils/dev-logger";
import "@xterm/xterm/css/xterm.css";

// Type imports for TypeScript
import type { Terminal as XTermType } from "@xterm/xterm";
import type { FitAddon as FitAddonType } from "@xterm/addon-fit";
// Types only: the terminal must not pull in any interactive mode's
// implementation, or the Python client would land in the terminal chunk.
import type { LineMode, PromptMode } from "@/lib/terminal/line-mode";

interface TerminalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Terminal({ isOpen, onClose }: TerminalProps) {
  const shouldReduceAnimations = useShouldReduceAnimations();
  const terminalRef = useRef<HTMLDivElement>(null);
  const [headerElement, setHeaderElement] = useState<HTMLDivElement | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTermType | null>(null);
  const fitAddonRef = useRef<FitAddonType | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Callback ref for header to ensure immediate attachment
  const headerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      setHeaderElement(node);
    }
  }, []);
  const [currentDirectory, setCurrentDirectory] = useState("/");
  const currentDirectoryRef = useRef("/");
  const commandHistoryRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const inputBufferRef = useRef("");
  const cursorPosRef = useRef(0);
  const isCommandRunningRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(true);
  const [isTerminalReady, setIsTerminalReady] = useState(false);
  const currentCommandAbortControllerRef = useRef<AbortController | null>(null);
  // Which prompt to draw. Modelled as a mode rather than a cached string,
  // because the shell prompt is derived from currentUserRef and login/logout
  // change it at runtime.
  const promptModeRef = useRef<PromptMode>({ kind: "shell" });
  // Set while an interactive command (the Python REPL) owns the input line.
  const lineModeRef = useRef<LineMode | null>(null);
  // Distinguishes the current command run from an earlier, cancelled one.
  // Without it, an aborted command's promise settles later and clears the
  // running flag out from under whatever is running by then.
  const commandSeqRef = useRef(0);
  // Set when the terminal closes: any late write from a settling Python run
  // must not reach the disposed xterm.
  const outputSinkDetachedRef = useRef(false);
  // Distinguishes REPL submissions the same way commandSeqRef does for shell
  // commands. Ctrl+C redraws the prompt itself, so the interrupted run's
  // .finally() must not redraw a second one.
  const replSeqRef = useRef(0);
  // The half-typed line set aside when the user starts scrolling back through
  // history, restored on the way past the newest entry. readline does this;
  // without it, arrowing up and back down silently discards what you typed.
  const replDraftRef = useRef("");

  // Terminal state from context
  const {
    windowState,
    position,
    size,
    currentUser,
    setPosition,
    setSize,
    setCurrentUser,
    minimize,
    maximize,
    restore,
    isDragging,
    setIsDragging,
  } = useTerminal();

  // Keep a ref to the current user to always have the latest value
  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Keep directory ref in sync with state
  useEffect(() => {
    currentDirectoryRef.current = currentDirectory;
  }, [currentDirectory]);

  // Stable directory setter callback
  const stableSetCurrentDirectory = useCallback((path: string) => {
    setCurrentDirectory(path);
    currentDirectoryRef.current = path;
  }, []);

  // State for visual feedback
  const [isResizing, setIsResizing] = useState(false);

  // Manual dragging implementation
  const dragStartPos = useRef({ x: 0, y: 0 });
  const dragStartWindowPos = useRef({ x: 0, y: 0 });
  const dragAnimationFrameRef = useRef<number | null>(null);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (windowState === "maximized") return;

      e.preventDefault();
      e.stopPropagation();

      setIsDragging(true);
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      dragStartWindowPos.current = { ...position };

      // Where the pointer last was, waiting to be turned into a window
      // position. It lives out here rather than inside the frame callback so
      // that mouseup can flush it: the callback used to be the only place that
      // wrote the position, so a drag whose final mousemove and mouseup landed
      // in the same frame had that move cancelled and never applied. WebKit
      // batches pointer events aggressively enough that this was frequently
      // the only move of the whole drag, and the window did not travel at all.
      let pendingPointer: { x: number; y: number } | null = null;

      const applyPendingPointer = () => {
        if (!pendingPointer) return;

        const deltaX = pendingPointer.x - dragStartPos.current.x;
        const deltaY = pendingPointer.y - dragStartPos.current.y;
        pendingPointer = null;

        const newX = Math.max(
          0,
          Math.min(
            dragStartWindowPos.current.x + deltaX,
            window.innerWidth - size.width,
          ),
        );
        const newY = Math.max(
          0,
          Math.min(
            dragStartWindowPos.current.y + deltaY,
            window.innerHeight - size.height,
          ),
        );

        setPosition({ x: newX, y: newY });
      };

      const handleMouseMove = (e: MouseEvent) => {
        pendingPointer = { x: e.clientX, y: e.clientY };

        // Coalesce to one position write per frame. A frame is already booked,
        // so it will pick up the coordinates just stored; rescheduling would
        // only churn.
        if (dragAnimationFrameRef.current) return;

        dragAnimationFrameRef.current = requestAnimationFrame(() => {
          dragAnimationFrameRef.current = null;
          applyPendingPointer();
        });
      };

      const handleMouseUp = () => {
        // Cancel any pending animation frame
        if (dragAnimationFrameRef.current) {
          cancelAnimationFrame(dragAnimationFrameRef.current);
          dragAnimationFrameRef.current = null;
        }
        // Apply whatever that frame would have applied, rather than dropping
        // the last movement of every drag on the floor.
        applyPendingPointer();
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.body.style.webkitUserSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "move";
      document.body.style.userSelect = "none";
      document.body.style.webkitUserSelect = "none";
    },
    [
      windowState,
      position,
      size.width,
      size.height,
      setPosition,
      setIsDragging,
    ],
  );

  // Refs check effect
  useEffect(() => {
    // Refs are available
  }, [headerElement, isOpen, windowState, position, size]);

  // Component lifecycle effect
  useEffect(() => {
    return () => {
      // Component unmounted
    };
  }, [isOpen]);

  // Resizable functionality
  const { startResize } = useResizableWithHandles({
    size,
    position,
    onSizeChange: setSize,
    onPositionChange: setPosition,
    minSize: MIN_SIZE,
    maxSize: {
      width: typeof window !== "undefined" ? window.innerWidth - 20 : 1900,
      height: typeof window !== "undefined" ? window.innerHeight - 20 : 1060,
    },
    disabled: windowState !== "normal",
    onResizeStart: () => setIsResizing(true),
    onResizeEnd: () => setIsResizing(false),
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reset state when terminal closes
  useEffect(() => {
    if (!isOpen) {
      // Clean up when terminal closes
      setHasInitialized(false);
      setIsLoading(true);
      setIsTerminalReady(false);

      // The React component stays mounted across open/close, so any
      // interactive mode has to be torn down explicitly. Without this,
      // reopening shows a ">>> " prompt for a shell, and an in-flight write
      // callback would target the disposed xterm below.
      //
      // Detaching the sink is what makes the ordering safe: shutdown() below
      // runs a microtask later and rejects any in-flight run, whose handler
      // writes an error message. By then xterm is disposed, so the write has
      // to become a no-op rather than a throw.
      outputSinkDetachedRef.current = true;
      lineModeRef.current = null;
      promptModeRef.current = { kind: "shell" };
      inputBufferRef.current = "";
      cursorPosRef.current = 0;
      commandSeqRef.current++;
      isCommandRunningRef.current = false;
      currentCommandAbortControllerRef.current = null;

      // Release the interpreter and its heap, which is hundreds of megabytes.
      // Unconditional: it was previously gated on a REPL having been active,
      // so closing after a one-shot `python -c` (or after exit()) leaked the
      // whole interpreter until the idle timer happened to fire. The dynamic
      // import is what keeps the client out of the bundle for a terminal that
      // never ran Python; webpack resolves it from cache if it was loaded.
      void import("@/lib/python/pyodide-client")
        .then(({ pythonClient }) => pythonClient.shutdown())
        .catch(() => {
          /* never loaded, nothing to release */
        });

      // Dispose of xterm if it exists
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
        fitAddonRef.current = null;
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || hasInitialized) return;

    // Dynamically import xterm and its dependencies
    const loadTerminal = async () => {
      try {
        setIsLoading(true);

        // Dynamic imports
        const [{ Terminal: XTerm }, { FitAddon }, { WebLinksAddon }] =
          await Promise.all([
            import("@xterm/xterm"),
            import("@xterm/addon-fit"),
            import("@xterm/addon-web-links"),
          ]);

        // CSS will be imported via the Terminal component's lazy loading

        // Check if container is available
        if (!terminalRef.current) {
          logError("Terminal container not available", "Terminal");
          setIsLoading(false);
          return;
        }

        // Initialize xterm
        const term = new XTerm({
          theme: {
            background: "#000000",
            foreground: "#00f900",
            cursor: "#00f900",
            cursorAccent: "#000000",
            selectionBackground: "#00f900",
            selectionForeground: "#000000",
          },
          fontFamily:
            'JetBrains Mono, Inconsolata, Consolas, "Courier New", monospace',
          fontSize: 14,
          cursorBlink: true,
          cursorStyle: "block",
          allowTransparency: false,
          scrollback: 1000,
          windowsMode: false,
          cols: 80,
          rows: 24,
          convertEol: true,
        });

        // Add addons
        const fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();

        term.loadAddon(fitAddon);
        term.loadAddon(webLinksAddon);

        term.open(terminalRef.current!);

        // Fix autofill warning for xterm's helper elements
        const fixAutofillWarning = () => {
          // Check for both textarea and input elements without ID
          const elements = terminalRef.current?.querySelectorAll(
            "textarea:not([id]), input:not([id])",
          );

          elements?.forEach((element, index) => {
            if (!element.getAttribute("id")) {
              element.setAttribute("id", `xterm-helper-${index}`);
              element.setAttribute("name", `xterm-input-${index}`);
              element.setAttribute("autocomplete", "off");
              element.setAttribute("aria-hidden", "true");
            }
          });
        };

        // Try immediately after open
        fixAutofillWarning();

        // Use MutationObserver to catch dynamically added elements
        let observer: MutationObserver | null = null;
        if (terminalRef.current) {
          observer = new MutationObserver(() => {
            fixAutofillWarning();
          });

          observer.observe(terminalRef.current, {
            childList: true,
            subtree: true,
          });
        }

        // Also try after a delay as fallback
        setTimeout(fixAutofillWarning, 500);

        // Store refs
        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Ensure proper fitting and focus after render
        setTimeout(() => {
          fitAddon.fit();
          term.focus();
        }, 50);

        outputSinkDetachedRef.current = false;

        const writePrompt = () => {
          const mode = promptModeRef.current;
          if (mode.kind === "custom") {
            term.write(mode.text);
            return;
          }
          const promptSymbol = currentUserRef.current === "guest" ? "%" : "$";
          const prompt = `\x1b[32m${currentUserRef.current}@Claret.Tech\x1b[0m ${promptSymbol} `;
          term.write(prompt);
        };

        // Helper functions for line wrapping

        // Calculate the visual length of the prompt (without escape codes).
        // Every cursor calculation on the line depends on this matching what
        // writePrompt actually drew, so both read the same mode.
        const getPromptLength = () => {
          const mode = promptModeRef.current;
          if (mode.kind === "custom") return mode.length;
          const promptSymbol = currentUserRef.current === "guest" ? "%" : "$";
          return `${currentUserRef.current}@Claret.Tech ${promptSymbol} `
            .length;
        };

        // Calculate how many lines the current input takes up
        const getWrappedLineCount = (text: string, termCols: number) => {
          if (!text) return 1;

          const promptLen = getPromptLength();
          const firstLineCapacity = termCols - promptLen;

          if (text.length <= firstLineCapacity) {
            return 1;
          }

          // Text spills into subsequent lines
          const remainingChars = text.length - firstLineCapacity;
          const additionalLines = Math.ceil(remainingChars / termCols);
          return 1 + additionalLines;
        };

        // Convert buffer position to row/col position accounting for wrapping
        const bufferPosToRowCol = (
          bufferPos: number,
          text: string,
          termCols: number,
        ) => {
          const promptLen = getPromptLength();

          // First line has less space due to prompt
          const firstLineCapacity = termCols - promptLen;

          if (bufferPos <= firstLineCapacity) {
            // Position is on the first line
            return { row: 0, col: promptLen + bufferPos };
          }

          // Position is on subsequent lines
          const remainingPos = bufferPos - firstLineCapacity;
          const additionalRows = Math.floor(remainingPos / termCols);
          const col = remainingPos % termCols;

          return { row: additionalRows + 1, col };
        };

        // Convert row/col position to buffer position
        const rowColToBufferPos = (
          row: number,
          col: number,
          termCols: number,
        ) => {
          const promptLen = getPromptLength();

          if (row === 0) {
            // First line - account for prompt
            return Math.max(0, col - promptLen);
          }

          // Subsequent lines
          const firstLineCapacity = termCols - promptLen;
          const subsequentChars = (row - 1) * termCols + col;
          return firstLineCapacity + subsequentChars;
        };

        // Properly wrap input text for display, accounting for prompt length
        const wrapInputText = (text: string, termCols: number) => {
          if (!text) return [""];

          const promptLen = getPromptLength();
          const lines: string[] = [];
          let currentLine = "";
          let availableWidth = termCols - promptLen; // First line has less space due to prompt

          for (let i = 0; i < text.length; i++) {
            const char = text[i];

            if (currentLine.length >= availableWidth) {
              // Need to wrap to next line
              lines.push(currentLine);
              currentLine = char;
              availableWidth = termCols; // Subsequent lines use full width
            } else {
              currentLine += char;
            }
          }

          // Add the last line if there's content
          if (currentLine.length > 0 || lines.length === 0) {
            lines.push(currentLine);
          }

          return lines;
        };

        // Write wrapped input text with proper line breaks
        const writeWrappedInput = (term: XTermType, text: string) => {
          if (!text) return;

          const wrappedLines = wrapInputText(text, term.cols);

          for (let i = 0; i < wrappedLines.length; i++) {
            if (i === 0) {
              // First line - just write the text (prompt already written)
              term.write(wrappedLines[i]);
            } else {
              // Subsequent lines - move to next line and write
              term.write("\r\n" + wrappedLines[i]);
            }
          }
        };

        // Clear all input content from current position
        const clearWrappedInput = (term: XTermType, text: string) => {
          if (!text) {
            // Still wipe the current row rather than returning. Every caller
            // follows this with writePrompt(), so bailing out here leaves the
            // existing prompt on screen and the caller draws a second one
            // beside it: ">>> >>> ". That desyncs the line editor, which
            // measures one prompt while two are drawn.
            term.write("\r" + " ".repeat(term.cols) + "\r");
            return;
          }

          // Calculate where our input starts (beginning of prompt line)
          const currentPos = bufferPosToRowCol(
            cursorPosRef.current,
            text,
            term.cols,
          );

          // Move cursor to the beginning of the prompt line where our input started
          if (currentPos.row > 0) {
            term.write(`\x1b[${currentPos.row}A`); // Move up to first line of input
          }
          term.write("\r"); // Move to beginning of line

          // Clear from current position to end of screen
          // This clears all wrapped content without affecting previous terminal output
          term.write("\x1b[0J"); // Clear from cursor to end of screen
        };

        // Write welcome message
        if (terminalConfig.welcomeMessages) {
          terminalConfig.welcomeMessages.forEach((message) => {
            term.writeln(message);
          });
        }
        term.writeln("");
        writePrompt();

        // Handle window resize with proper debouncing and state preservation
        let resizeTimeoutRef: NodeJS.Timeout | null = null;
        let isResizingRef = false;
        // CRITICAL: We maintain a permanent copy of input that's never truncated
        let permanentInputBackup = "";
        let permanentCursorBackup = 0;

        // Update permanent backup whenever input changes
        const updatePermanentBackup = () => {
          if (!isCommandRunningRef.current) {
            permanentInputBackup = inputBufferRef.current;
            permanentCursorBackup = cursorPosRef.current;
          }
        };

        // Forget the saved line outright.
        //
        // updatePermanentBackup cannot do this job at submit time: it is gated
        // on !isCommandRunningRef, and that flag is already true by the time a
        // dispatched command clears the buffer. The backup would keep the text
        // that was just executed, and the next window resize would restore it
        // into an empty prompt, so the following keystrokes get appended to a
        // command that already ran.
        const clearPermanentBackup = () => {
          permanentInputBackup = "";
          permanentCursorBackup = 0;
        };

        // Replace the input line with an entry from an interactive mode's
        // history. Index history.length means "past the newest", i.e. the
        // empty line the user was typing before they started scrolling back.
        const recallFromLineMode = (mode: LineMode, direction: -1 | 1) => {
          const next = mode.historyIndex.current + direction;
          if (next < 0 || next > mode.history.length) return;

          // Leaving the live line: remember it so Down-arrow can bring it back.
          if (mode.historyIndex.current === mode.history.length) {
            replDraftRef.current = inputBufferRef.current;
          }

          const oldText = inputBufferRef.current;
          // Reads cursorPosRef, so it has to run before the buffer changes.
          clearWrappedInput(term, oldText);

          mode.historyIndex.current = next;
          inputBufferRef.current =
            next === mode.history.length
              ? replDraftRef.current
              : mode.history[next];
          cursorPosRef.current = inputBufferRef.current.length;
          updatePermanentBackup();

          writePrompt();
          writeWrappedInput(term, inputBufferRef.current);
        };

        const handleResize = () => {
          // Clear any pending resize operations
          if (resizeTimeoutRef) {
            clearTimeout(resizeTimeoutRef);
          }

          // Use the permanent backup which is never truncated by xterm
          if (permanentInputBackup && !isCommandRunningRef.current) {
            isResizingRef = true;
          }

          // Fit the terminal immediately for responsive feel
          fitAddon.fit();

          // Debounce the input restoration to prevent flickering during resize
          resizeTimeoutRef = setTimeout(() => {
            if (xtermRef.current && isResizingRef && permanentInputBackup) {
              const term = xtermRef.current;

              // Restore from permanent backup which was never truncated
              inputBufferRef.current = permanentInputBackup;
              cursorPosRef.current = permanentCursorBackup;

              // Clear current display and re-render with new line wrapping
              const currentPos = bufferPosToRowCol(
                permanentCursorBackup,
                permanentInputBackup,
                term.cols,
              );

              // Move to start of input area
              if (currentPos.row > 0) {
                term.write(`\x1b[${currentPos.row}A`);
              }
              term.write("\r");

              // Clear the entire input area
              term.write("\x1b[0J");

              // Re-write with new terminal width using proper wrapping
              writePrompt();
              writeWrappedInput(term, permanentInputBackup);

              // Restore cursor position
              const offsetFromEnd =
                permanentInputBackup.length - permanentCursorBackup;
              if (offsetFromEnd > 0) {
                const targetPos = bufferPosToRowCol(
                  permanentCursorBackup,
                  permanentInputBackup,
                  term.cols,
                );
                const endPos = bufferPosToRowCol(
                  permanentInputBackup.length,
                  permanentInputBackup,
                  term.cols,
                );

                if (endPos.row > targetPos.row) {
                  term.write(`\x1b[${endPos.row - targetPos.row}A`);
                }
                if (endPos.col > targetPos.col) {
                  term.write(`\x1b[${endPos.col - targetPos.col}D`);
                } else if (endPos.col < targetPos.col) {
                  term.write(`\x1b[${targetPos.col - endPos.col}C`);
                }
              }

              // Cursor position already restored from permanent backup
            }

            // Reset resize state but keep permanent backup
            isResizingRef = false;
          }, 150); // Increased debounce delay for better stability
        };
        window.addEventListener("resize", handleResize);

        // Handle keyboard input
        const onData = term.onData((data) => {
          // A paste arrives as one chunk. In an interactive mode it may span
          // several lines, and the branches below key off the FIRST character,
          // so a multi-line paste would otherwise be spliced into the buffer
          // with its newlines intact and rejected by codeop as "multiple
          // statements", while a paste starting with a newline matched no
          // branch at all and vanished. Replay it a line at a time instead.
          if (lineModeRef.current && data.length > 1 && /[\r\n]/.test(data)) {
            const mode = lineModeRef.current;
            const lines = data.replace(/\r\n?/g, "\n").split("\n");

            // Serialized, not a plain loop: each submitted line is an async
            // round trip to the worker, and keystrokes are deliberately
            // discarded while one is in flight. Feeding them all synchronously
            // means every line after the first is dropped.
            void (async () => {
              for (let index = 0; index < lines.length; index++) {
                while (mode.busy.current) {
                  await new Promise((resolve) => setTimeout(resolve, 10));
                }
                // The user may have left the REPL while the paste was replaying.
                if (lineModeRef.current !== mode) return;

                // Feed the text, then the Enter that submits it. The final
                // fragment has no trailing newline, so it is left in the buffer
                // for the user to finish or submit themselves.
                if (lines[index]) handleData(lines[index]);
                if (index < lines.length - 1) handleData("\r");
              }
            })();
            return;
          }
          handleData(data);
        });

        function handleData(data: string) {
          const code = data.charCodeAt(0);

          // Handle Ctrl+C - always allow cancellation
          if (code === 3) {
            // An interactive mode owns the interrupt: only it knows whether
            // this abandons a half-typed block or kills a running statement.
            if (lineModeRef.current) {
              const mode = lineModeRef.current;
              inputBufferRef.current = "";
              cursorPosRef.current = 0;
              updatePermanentBackup();
              mode.historyIndex.current = mode.history.length;
              term.write("\r\n");
              // Claim the redraw before onInterrupt() rejects the in-flight
              // run: its .finally() would otherwise draw a second prompt on
              // the same row, leaving 8 columns drawn where getPromptLength()
              // reports 4 and desyncing every later cursor calculation.
              replSeqRef.current++;
              mode.onInterrupt();
              promptModeRef.current = { kind: "custom", ...mode.prompt() };
              writePrompt();
              return;
            }

            if (isCommandRunningRef.current) {
              // Cancel running command
              commandSeqRef.current++;
              if (currentCommandAbortControllerRef.current) {
                currentCommandAbortControllerRef.current.abort();
              }
              term.write("^C\r\n");
              term.writeln("Command canceled by user");
              term.writeln("");
              writePrompt();
              isCommandRunningRef.current = false;
              currentCommandAbortControllerRef.current = null;
              // Same reason as the Enter path: the flag was still set when the
              // buffer was cleared, so the backup has to be dropped explicitly.
              clearPermanentBackup();
              return;
            }

            // Cancel current input
            inputBufferRef.current = "";
            cursorPosRef.current = 0;
            updatePermanentBackup();
            historyIndexRef.current = commandHistoryRef.current.length;
            term.write("^C\r\n");
            writePrompt();
            return;
          }

          // Discard input while an interactive mode is busy with a statement.
          // This is deliberately not isCommandRunningRef: that flag also gates
          // updatePermanentBackup, so holding it for a whole REPL session would
          // silently break input restoration on window resize.
          if (lineModeRef.current?.busy.current) return;

          // Don't process other input while a command is running
          if (!lineModeRef.current && isCommandRunningRef.current) return;

          // Ctrl+D - end of input. Only meaningful to an interactive mode; in
          // the shell it is ignored rather than silently closing the terminal.
          if (code === 4) {
            if (lineModeRef.current && inputBufferRef.current === "") {
              lineModeRef.current.onEof();
            }
            return;
          }

          // Handle special keys
          if (code === 1) {
            // Ctrl+A - Move cursor to beginning of line
            if (cursorPosRef.current > 0) {
              cursorPosRef.current = 0;
              updatePermanentBackup();
              // Must come from getPromptLength, not a second inline copy of the
              // shell prompt: at a 4-column ">>> " prompt the hardcoded version
              // would jump 16 columns into the user's own text.
              const promptLength = getPromptLength();
              // Move cursor to right after the prompt
              term.write(`\r\x1b[${promptLength}C`);
            }
          } else if (code === 5) {
            // Ctrl+E - Move cursor to end of line
            if (cursorPosRef.current < inputBufferRef.current.length) {
              const moveRight =
                inputBufferRef.current.length - cursorPosRef.current;
              cursorPosRef.current = inputBufferRef.current.length;
              updatePermanentBackup();
              // Move cursor to the end
              term.write(`\x1b[${moveRight}C`);
            }
          } else if (code === 13) {
            // Enter
            term.write("\r\n");

            // An interactive mode takes the raw line: leading whitespace is
            // significant in Python, so it must not be trimmed away.
            if (lineModeRef.current) {
              const mode = lineModeRef.current;
              const line = inputBufferRef.current;
              inputBufferRef.current = "";
              cursorPosRef.current = 0;
              updatePermanentBackup();

              mode.busy.current = true;
              const seq = ++replSeqRef.current;
              void mode
                .onLine(line)
                .catch((error: Error) => {
                  term.writeln(`Error: ${error.message}`);
                })
                .finally(() => {
                  mode.busy.current = false;
                  // Exiting swaps the prompt back to the shell and prints its
                  // own prompt, so only redraw while the mode is still live.
                  if (lineModeRef.current !== mode) return;
                  // Ctrl+C already redrew the prompt for this run. Redrawing
                  // again would put two on one row.
                  if (replSeqRef.current !== seq) return;
                  // Re-read the prompt: an unfinished block switches it to the
                  // continuation form, and the wrap math needs the new width.
                  promptModeRef.current = { kind: "custom", ...mode.prompt() };
                  writePrompt();
                });
              return;
            }

            const command = inputBufferRef.current.trim();

            if (command) {
              commandHistoryRef.current.push(command);
              historyIndexRef.current = commandHistoryRef.current.length;

              // Execute command
              isCommandRunningRef.current = true;

              // Create abort controller for this command
              const abortController = new AbortController();
              currentCommandAbortControllerRef.current = abortController;
              // Claim this run. A cancelled command's promise still settles
              // later, and without this check it would clear the running flag
              // belonging to whatever started in the meantime.
              const seq = ++commandSeqRef.current;
              const isCurrentRun = () => commandSeqRef.current === seq;

              executeCommand(command, {
                currentDirectory: currentDirectoryRef.current,
                // Read through the ref: the effect that built this closure only
                // reruns on open, so the captured state value goes stale as
                // soon as someone logs in.
                currentUser: currentUserRef.current,
                setCurrentDirectory: stableSetCurrentDirectory,
                setCurrentUser,
                addToHistory: (line: string) =>
                  commandHistoryRef.current.push(line),
                clearTerminal: () => term.clear(),
                closeTerminal: () => onClose(),
                terminalCols: term.cols,
                terminalRows: term.rows,
                writer: (text: string) => {
                  if (outputSinkDetachedRef.current) return;
                  term.write(text);
                },
                abortController,
                enterLineMode: (mode) => {
                  lineModeRef.current = mode;
                  promptModeRef.current = { kind: "custom", ...mode.prompt() };
                  // The REPL owns interrupts from here, so the shell's abort
                  // controller must not keep claiming Ctrl+C.
                  currentCommandAbortControllerRef.current = null;
                  isCommandRunningRef.current = false;
                  inputBufferRef.current = "";
                  cursorPosRef.current = 0;
                  // Drawn here rather than in the result handler, which is
                  // suppressed precisely so it does not add a second prompt.
                  writePrompt();
                },
                exitLineMode: () => {
                  lineModeRef.current = null;
                  promptModeRef.current = { kind: "shell" };
                  inputBufferRef.current = "";
                  cursorPosRef.current = 0;
                  writePrompt();
                },
              })
                .then((result) => {
                  if (!isCurrentRun()) return;
                  // Only process result if command wasn't aborted
                  if (!abortController.signal.aborted) {
                    if (result.output) {
                      term.writeln(result.output);
                    }
                    if (result.suppressPrompt) {
                      // The command already drew its own prompt.
                    } else if (command === "clear") {
                      // Write prompt immediately after clear
                      writePrompt();
                    } else if (command !== "exit") {
                      term.writeln("");
                      writePrompt();
                    }
                  }
                  isCommandRunningRef.current = false;
                  currentCommandAbortControllerRef.current = null;
                })
                .catch((error) => {
                  if (!isCurrentRun()) return;
                  // Handle command execution errors
                  if (!abortController.signal.aborted) {
                    term.writeln(`Command error: ${error.message}`);
                    term.writeln("");
                    writePrompt();
                  }
                  isCommandRunningRef.current = false;
                  currentCommandAbortControllerRef.current = null;
                });
            } else {
              writePrompt();
            }

            inputBufferRef.current = "";
            cursorPosRef.current = 0;
            clearPermanentBackup();
          } else if (code === 127) {
            // Backspace
            if (cursorPosRef.current > 0) {
              const oldText = inputBufferRef.current;
              const oldLineCount = getWrappedLineCount(oldText, term.cols);

              inputBufferRef.current =
                inputBufferRef.current.slice(0, cursorPosRef.current - 1) +
                inputBufferRef.current.slice(cursorPosRef.current);
              cursorPosRef.current--;
              updatePermanentBackup();

              const newLineCount = getWrappedLineCount(
                inputBufferRef.current,
                term.cols,
              );

              // Check if we need full re-render (line count changed or multi-line text)
              if (oldLineCount !== newLineCount || oldLineCount > 1) {
                // Clear all wrapped lines and re-render
                clearWrappedInput(term, oldText);
                writePrompt();
                writeWrappedInput(term, inputBufferRef.current);

                // Position cursor correctly
                const offsetFromEnd =
                  inputBufferRef.current.length - cursorPosRef.current;
                if (offsetFromEnd > 0) {
                  const targetPos = bufferPosToRowCol(
                    cursorPosRef.current,
                    inputBufferRef.current,
                    term.cols,
                  );
                  const endPos = bufferPosToRowCol(
                    inputBufferRef.current.length,
                    inputBufferRef.current,
                    term.cols,
                  );

                  // Navigate to correct position
                  if (endPos.row > targetPos.row) {
                    term.write(`\x1b[${endPos.row - targetPos.row}A`);
                  }
                  if (endPos.col > targetPos.col) {
                    term.write(`\x1b[${endPos.col - targetPos.col}D`);
                  }
                }
              } else {
                // Single line optimization - just re-render the line
                term.write("\r" + " ".repeat(term.cols) + "\r");
                writePrompt();
                writeWrappedInput(term, inputBufferRef.current);

                // Position cursor correctly
                const offsetFromEnd =
                  inputBufferRef.current.length - cursorPosRef.current;
                if (offsetFromEnd > 0) {
                  term.write(`\x1b[${offsetFromEnd}D`);
                }
              }
            }
          } else if (code === 9) {
            // Tab indents inside an interactive mode. Shell completion here
            // would be actively harmful: it replaces the whole buffer when the
            // input contains no space, so it would eat a Python line. Tab is
            // also the only way to indent a block body in raw mode.
            if (lineModeRef.current) {
              const indent = "    ";
              const oldText = inputBufferRef.current;
              const pos = cursorPosRef.current;

              // Full re-render rather than an in-place write: correct wherever
              // the cursor sits, and Tab is rare enough that the extra redraw
              // costs nothing. clearWrappedInput reads cursorPosRef, so it has
              // to run before the position is updated, and it returns early on
              // an empty buffer, which would leave the existing prompt on
              // screen and have writePrompt draw a second one beside it.
              clearWrappedInput(term, oldText);

              inputBufferRef.current =
                oldText.slice(0, pos) + indent + oldText.slice(pos);
              cursorPosRef.current = pos + indent.length;
              updatePermanentBackup();

              writePrompt();
              writeWrappedInput(term, inputBufferRef.current);

              // Put the cursor back where it belongs when indenting mid-line.
              if (cursorPosRef.current < inputBufferRef.current.length) {
                const targetPos = bufferPosToRowCol(
                  cursorPosRef.current,
                  inputBufferRef.current,
                  term.cols,
                );
                const endPos = bufferPosToRowCol(
                  inputBufferRef.current.length,
                  inputBufferRef.current,
                  term.cols,
                );
                if (endPos.row > targetPos.row) {
                  term.write(`\x1b[${endPos.row - targetPos.row}A`);
                }
                if (endPos.col > targetPos.col) {
                  term.write(`\x1b[${endPos.col - targetPos.col}D`);
                } else if (endPos.col < targetPos.col) {
                  term.write(`\x1b[${targetPos.col - endPos.col}C`);
                }
              }
              return;
            }

            // Tab - autocomplete
            const completions = getCompletions(inputBufferRef.current, {
              currentDirectory: currentDirectoryRef.current,
              currentUser,
              setCurrentDirectory: stableSetCurrentDirectory,
              setCurrentUser,
              addToHistory: (line: string) =>
                commandHistoryRef.current.push(line),
              clearTerminal: () => term.clear(),
              closeTerminal: () => onClose(),
              terminalCols: term.cols,
              terminalRows: term.rows,
            });
            if (completions.length === 1) {
              // For command completions (no space in input), replace entirely
              if (!inputBufferRef.current.includes(" ")) {
                inputBufferRef.current = completions[0];
                updatePermanentBackup();
              } else {
                // For file/directory completions, preserve the command part
                const parts = inputBufferRef.current.split(/\s+/);

                // If the completion already includes path separators, use it as is
                if (completions[0].includes("/")) {
                  parts[parts.length - 1] = completions[0];
                } else {
                  // Otherwise, complete the partial filename
                  parts[parts.length - 1] = completions[0];
                }
                inputBufferRef.current = parts.join(" ");
                updatePermanentBackup();
              }
              cursorPosRef.current = inputBufferRef.current.length;

              term.write("\r" + " ".repeat(term.cols) + "\r");
              writePrompt();
              writeWrappedInput(term, inputBufferRef.current);
            } else if (completions.length > 1) {
              term.writeln("");
              term.writeln(completions.join("  "));
              writePrompt();
              writeWrappedInput(term, inputBufferRef.current);
            }
          } else if (data === "\x1b[A") {
            // In an interactive mode the arrows walk that mode's own history
            // unconditionally, which is what readline does and what anyone at a
            // Python prompt expects. Sharing the shell's history ring would
            // also mean a later shell Up-arrow replays "for i in range(3):"
            // straight into the command dispatcher.
            if (lineModeRef.current) {
              recallFromLineMode(lineModeRef.current, -1);
              return;
            }
            // Up arrow - history if empty, otherwise navigate in wrapped text
            if (inputBufferRef.current === "") {
              // Navigate history when input is empty
              if (historyIndexRef.current > 0) {
                historyIndexRef.current--;
                inputBufferRef.current =
                  commandHistoryRef.current[historyIndexRef.current];
                cursorPosRef.current = inputBufferRef.current.length;
                updatePermanentBackup();

                term.write("\r" + " ".repeat(term.cols) + "\r");
                writePrompt();
                writeWrappedInput(term, inputBufferRef.current);
              }
            } else {
              // Navigate within wrapped text when there's input
              const currentPos = bufferPosToRowCol(
                cursorPosRef.current,
                inputBufferRef.current,
                term.cols,
              );

              if (currentPos.row > 0) {
                // Move up one visual line in wrapped text
                const newBufferPos = rowColToBufferPos(
                  currentPos.row - 1,
                  currentPos.col,
                  term.cols,
                );
                const clampedPos = Math.min(
                  newBufferPos,
                  inputBufferRef.current.length,
                );

                if (clampedPos !== cursorPosRef.current) {
                  cursorPosRef.current = clampedPos;
                  updatePermanentBackup();
                  term.write(`\x1b[A`); // Move up one line visually

                  // Adjust horizontal position if needed
                  const newPos = bufferPosToRowCol(
                    cursorPosRef.current,
                    inputBufferRef.current,
                    term.cols,
                  );
                  if (newPos.col < currentPos.col) {
                    const diff = currentPos.col - newPos.col;
                    term.write(`\x1b[${diff}D`);
                  }
                }
              } else if (historyIndexRef.current > 0) {
                // Already on the first visual row, so keep walking history the
                // way Down-arrow does. Without this, recall stopped dead after
                // one entry: the first Up filled the input buffer, so every
                // later Up took this wrapped-text branch, and a single-line
                // command has row 0, so nothing happened. `help` advertises
                // Up/Down for history, and only the first step worked.
                historyIndexRef.current--;
                inputBufferRef.current =
                  commandHistoryRef.current[historyIndexRef.current];
                cursorPosRef.current = inputBufferRef.current.length;
                updatePermanentBackup();

                term.write("\r" + " ".repeat(term.cols) + "\r");
                writePrompt();
                writeWrappedInput(term, inputBufferRef.current);
              } else {
                // At top of text, move cursor to beginning of input (position 0)
                if (cursorPosRef.current > 0) {
                  // Calculate how far to move left to reach position 0
                  const currentPos = bufferPosToRowCol(
                    cursorPosRef.current,
                    inputBufferRef.current,
                    term.cols,
                  );
                  const targetPos = bufferPosToRowCol(
                    0,
                    inputBufferRef.current,
                    term.cols,
                  );

                  // Move to the beginning of input (after prompt)
                  cursorPosRef.current = 0;
                  updatePermanentBackup();

                  // Navigate to position 0 visually
                  if (currentPos.row > targetPos.row) {
                    term.write(`\x1b[${currentPos.row - targetPos.row}A`);
                  }
                  if (currentPos.col > targetPos.col) {
                    term.write(`\x1b[${currentPos.col - targetPos.col}D`);
                  }
                }
              }
            }
          } else if (data === "\x1b[B") {
            if (lineModeRef.current) {
              recallFromLineMode(lineModeRef.current, 1);
              return;
            }
            // Down arrow - history if empty, otherwise navigate in wrapped text
            if (inputBufferRef.current === "") {
              // Navigate history when input is empty
              if (
                historyIndexRef.current <
                commandHistoryRef.current.length - 1
              ) {
                historyIndexRef.current++;
                inputBufferRef.current =
                  commandHistoryRef.current[historyIndexRef.current];
                cursorPosRef.current = inputBufferRef.current.length;
                updatePermanentBackup();

                term.write("\r" + " ".repeat(term.cols) + "\r");
                writePrompt();
                writeWrappedInput(term, inputBufferRef.current);
              } else if (
                historyIndexRef.current ===
                  commandHistoryRef.current.length - 1 &&
                commandHistoryRef.current.length > 0
              ) {
                // Only clear if we actually have history
                historyIndexRef.current++;
                inputBufferRef.current = "";
                cursorPosRef.current = 0;
                updatePermanentBackup();

                term.write("\r" + " ".repeat(term.cols) + "\r");
                writePrompt();
              }
              // If no history at all, do nothing
            } else {
              // Navigate within wrapped text when there's input
              const currentPos = bufferPosToRowCol(
                cursorPosRef.current,
                inputBufferRef.current,
                term.cols,
              );
              const maxPos = bufferPosToRowCol(
                inputBufferRef.current.length,
                inputBufferRef.current,
                term.cols,
              );

              if (currentPos.row < maxPos.row) {
                // Move down one visual line in wrapped text
                const newBufferPos = rowColToBufferPos(
                  currentPos.row + 1,
                  currentPos.col,
                  term.cols,
                );
                const clampedPos = Math.min(
                  newBufferPos,
                  inputBufferRef.current.length,
                );

                if (clampedPos !== cursorPosRef.current) {
                  cursorPosRef.current = clampedPos;
                  updatePermanentBackup();
                  term.write(`\x1b[B`); // Move down one line visually

                  // Adjust horizontal position if at end of text
                  const newPos = bufferPosToRowCol(
                    cursorPosRef.current,
                    inputBufferRef.current,
                    term.cols,
                  );
                  if (newPos.col > currentPos.col) {
                    const diff = newPos.col - currentPos.col;
                    term.write(`\x1b[${diff}C`);
                  } else if (newPos.col < currentPos.col) {
                    const diff = currentPos.col - newPos.col;
                    term.write(`\x1b[${diff}D`);
                  }
                }
              } else if (
                historyIndexRef.current <
                commandHistoryRef.current.length - 1
              ) {
                // At bottom of text, allow history navigation if user wants to replace
                historyIndexRef.current++;
                const oldText = inputBufferRef.current;
                inputBufferRef.current =
                  commandHistoryRef.current[historyIndexRef.current];
                cursorPosRef.current = inputBufferRef.current.length;
                updatePermanentBackup();

                clearWrappedInput(term, oldText);
                writePrompt();
                writeWrappedInput(term, inputBufferRef.current);
              } else if (
                historyIndexRef.current ===
                  commandHistoryRef.current.length - 1 &&
                commandHistoryRef.current.length > 0
              ) {
                // Return to empty input
                historyIndexRef.current++;
                const oldText = inputBufferRef.current;
                inputBufferRef.current = "";
                cursorPosRef.current = 0;
                updatePermanentBackup();

                clearWrappedInput(term, oldText);
                writePrompt();
              }
            }
          } else if (data === "\x1b[D") {
            // Left arrow
            if (cursorPosRef.current > 0) {
              cursorPosRef.current--;
              updatePermanentBackup();
              term.write(data);
            }
          } else if (data === "\x1b[C") {
            // Right arrow
            if (cursorPosRef.current < inputBufferRef.current.length) {
              cursorPosRef.current++;
              updatePermanentBackup();
              term.write(data);
            }
          } else if (code >= 32) {
            // Printable characters
            const oldLineCount = getWrappedLineCount(
              inputBufferRef.current,
              term.cols,
            );
            const oldText = inputBufferRef.current;

            inputBufferRef.current =
              inputBufferRef.current.slice(0, cursorPosRef.current) +
              data +
              inputBufferRef.current.slice(cursorPosRef.current);
            updatePermanentBackup();

            const newLineCount = getWrappedLineCount(
              inputBufferRef.current,
              term.cols,
            );
            const isAtEnd = cursorPosRef.current === oldText.length;
            const isSingleChar = data.length === 1;

            // Check if we need to re-render due to line wrapping changes
            // Only clear/re-render when typing in the middle, not at the end
            if (
              !isAtEnd &&
              (oldLineCount !== newLineCount ||
                oldLineCount > 1 ||
                newLineCount > 1)
            ) {
              // Typing in middle of wrapped text - need full re-render
              clearWrappedInput(term, oldText);

              // Rewrite prompt and all text
              writePrompt();
              writeWrappedInput(term, inputBufferRef.current);

              // Update cursor position
              cursorPosRef.current += data.length;
              updatePermanentBackup();

              // Move cursor to correct position if not at end
              const offsetFromEnd =
                inputBufferRef.current.length - cursorPosRef.current;
              if (offsetFromEnd > 0) {
                // Calculate position in wrapped text
                const targetPos = bufferPosToRowCol(
                  cursorPosRef.current,
                  inputBufferRef.current,
                  term.cols,
                );
                const endPos = bufferPosToRowCol(
                  inputBufferRef.current.length,
                  inputBufferRef.current,
                  term.cols,
                );

                // Move up if needed
                if (endPos.row > targetPos.row) {
                  term.write(`\x1b[${endPos.row - targetPos.row}A`);
                }

                // Move horizontally
                if (endPos.col > targetPos.col) {
                  term.write(`\x1b[${endPos.col - targetPos.col}D`);
                } else if (endPos.col < targetPos.col) {
                  term.write(`\x1b[${targetPos.col - endPos.col}C`);
                }
              }
            } else if (isAtEnd && isSingleChar) {
              // Check if we need to wrap when typing at the end
              const currentPos = bufferPosToRowCol(
                cursorPosRef.current,
                inputBufferRef.current,
                term.cols,
              );

              // Check if adding this character would exceed the line width
              const promptLen = getPromptLength();
              const isFirstLine = currentPos.row === 0;
              const currentLineWidth = isFirstLine
                ? term.cols - promptLen
                : term.cols;
              const currentColPos = isFirstLine
                ? currentPos.col - promptLen
                : currentPos.col;

              if (currentColPos >= currentLineWidth) {
                // Need to wrap - reflow all text to handle multi-line properly
                clearWrappedInput(term, oldText);

                cursorPosRef.current++;
                updatePermanentBackup();

                writePrompt();
                writeWrappedInput(term, inputBufferRef.current);
              } else {
                // No wrap needed, just write the character
                term.write(data);
                cursorPosRef.current++;
                updatePermanentBackup();
              }
            } else if (isSingleChar && oldLineCount === 1) {
              // Typing in the middle of single line - optimized update
              const remainingText = inputBufferRef.current.slice(
                cursorPosRef.current + 1,
              );

              // Hide cursor to prevent flashing
              term.write("\x1b[?25l");

              // Write new character and shift remaining text
              term.write(data + remainingText);
              cursorPosRef.current++;
              updatePermanentBackup();

              // Move cursor back to correct position
              if (remainingText.length > 0) {
                term.write(`\x1b[${remainingText.length}D`);
              }

              // Show cursor again
              term.write("\x1b[?25h");
            } else {
              // Multi-character input (paste)
              if (isAtEnd) {
                // Pasting at end - need full re-render to handle wrapping
                clearWrappedInput(term, oldText);

                cursorPosRef.current += data.length;
                updatePermanentBackup();
                writePrompt();
                writeWrappedInput(term, inputBufferRef.current);
              } else {
                // Pasting in middle - need full re-render
                clearWrappedInput(term, oldText);

                cursorPosRef.current += data.length;
                updatePermanentBackup();
                writePrompt();
                writeWrappedInput(term, inputBufferRef.current);

                // Position cursor correctly
                const offsetFromEnd =
                  inputBufferRef.current.length - cursorPosRef.current;
                if (offsetFromEnd > 0) {
                  const targetPos = bufferPosToRowCol(
                    cursorPosRef.current,
                    inputBufferRef.current,
                    term.cols,
                  );
                  const endPos = bufferPosToRowCol(
                    inputBufferRef.current.length,
                    inputBufferRef.current,
                    term.cols,
                  );

                  if (endPos.row > targetPos.row) {
                    term.write(`\x1b[${endPos.row - targetPos.row}A`);
                  }
                  if (endPos.col > targetPos.col) {
                    term.write(`\x1b[${endPos.col - targetPos.col}D`);
                  } else if (endPos.col < targetPos.col) {
                    term.write(`\x1b[${targetPos.col - endPos.col}C`);
                  }
                }
              }
            }
          }
        }

        if (isMountedRef.current) {
          setIsLoading(false);
          setIsTerminalReady(true);
          setHasInitialized(true);
        }

        // Cleanup
        return () => {
          window.removeEventListener("resize", handleResize);
          observer?.disconnect();
          onData.dispose();
          term.dispose();
          xtermRef.current = null;
          fitAddonRef.current = null;
        };
      } catch (error) {
        logError(error, "Terminal Load");
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    // Wait for DOM to be ready with retry mechanism
    let retryCount = 0;
    const maxRetries = 10;

    const tryLoadTerminal = () => {
      if (terminalRef.current && !hasInitialized) {
        loadTerminal();
      } else if (retryCount < maxRetries && !hasInitialized) {
        retryCount++;
        setTimeout(tryLoadTerminal, 200);
      } else if (!hasInitialized) {
        logError(
          "Failed to load terminal after maximum retries",
          "Terminal Retry",
        );
        setIsLoading(false);
      }
    };

    const timer = setTimeout(tryLoadTerminal, 200);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, hasInitialized]); // currentDirectory, onClose, and stableSetCurrentDirectory are stable or intentionally excluded

  // Handle loading state based on initialization
  useEffect(() => {
    if (isOpen && !hasInitialized) {
      setIsLoading(true);
    }
  }, [isOpen, hasInitialized]);

  // Additional effect for handling resize when terminal is already loaded
  useEffect(() => {
    if (!isOpen || !fitAddonRef.current || windowState === "minimized") return;

    const handleResize = () => {
      // Add a small delay to ensure dimensions are updated
      setTimeout(() => {
        fitAddonRef.current?.fit();
      }, 50);
    };

    handleResize(); // Fit on mount
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen, windowState, size]);

  // Handle window button clicks
  const handleMinimize = useCallback(() => {
    minimize();
  }, [minimize]);

  const handleMaximize = useCallback(() => {
    if (windowState === "maximized") {
      restore();
    } else {
      maximize();
    }
  }, [windowState, maximize, restore]);

  // Calculate styles based on window state
  const getWindowStyles = () => {
    switch (windowState) {
      case "minimized":
        return {
          width: "300px",
          height: "44px", // Just the header
          top: `${position.y}px`,
          left: `${position.x}px`,
        };
      case "maximized":
        return {
          width: "calc(100vw - 40px)",
          height: "calc(100vh - 40px)",
          top: "20px",
          left: "20px",
        };
      default: // normal
        return {
          width: `${size.width}px`,
          height: `${size.height}px`,
          top: `${position.y}px`,
          left: `${position.x}px`,
        };
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          ref={containerRef}
          role="application"
          aria-label="Terminal console"
          aria-describedby="terminal-help-text"
          aria-live="polite"
          aria-atomic="false"
          data-testid="terminal"
          tabIndex={0}
          className="fixed terminal"
          style={{
            ...getWindowStyles(),
            zIndex: 10000, // Higher than toast (9999)
            userSelect: "none",
            WebkitUserSelect: "none",
            MozUserSelect: "none",
            msUserSelect: "none",
            position: "fixed", // Ensure position is set
            opacity: isTerminalReady || windowState === "minimized" ? 1 : 0,
            transition: "opacity 300ms ease-in-out",
          }}
        >
          <span id="terminal-help-text" className="sr-only">
            Interactive terminal with AI capabilities. Type &apos;help&apos; for
            available commands, &apos;ai init&apos; to start AI chat, or use Tab
            for autocomplete. Navigate command history with arrow keys.
          </span>

          {/* Terminal Content Container */}
          <div
            className={`bg-black rounded-lg shadow-2xl border overflow-hidden w-full h-full ${
              windowState === "minimized" ? "resize-none" : ""
            } ${
              isDragging
                ? "border-blue-500"
                : isResizing
                  ? "border-yellow-500"
                  : "border-green-500/50"
            }`}
            style={{
              userSelect: "none",
              WebkitUserSelect: "none",
              position: "relative", // Ensure this is a positioning context
            }}
          >
            {/* Resize Handles - Positioned absolute within terminal container */}
            {windowState === "normal" && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ zIndex: 100 }} // High z-index for resize handles
              >
                <ResizeHandles
                  debug={false}
                  onResizeStart={(direction, e) => {
                    startResize(direction, e.nativeEvent);
                  }}
                />
              </div>
            )}
            {/* Terminal Header */}
            <div
              ref={headerRef}
              data-testid="terminal-header"
              className="group flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-green-500/30 cursor-move select-none hover:bg-gray-800 transition-colors relative"
              style={{
                userSelect: "none",
                WebkitUserSelect: "none",
                zIndex: 10, // Higher than resize handles to ensure dragging works
              }}
              onMouseDown={handleDragStart}
            >
              <div className="flex items-center gap-2">
                <div
                  className="flex gap-1.5"
                  aria-describedby="window-controls-desc"
                >
                  <span id="window-controls-desc" className="sr-only">
                    macOS-style window controls. Red button closes, yellow
                    minimizes, green maximizes.
                  </span>
                  <button
                    onClick={onClose}
                    className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                    aria-label="Close terminal"
                    title="Close"
                  />
                  <button
                    onClick={
                      windowState === "minimized" ? restore : handleMinimize
                    }
                    className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    aria-label={
                      windowState === "minimized"
                        ? "Restore terminal"
                        : "Minimize terminal"
                    }
                    title={windowState === "minimized" ? "Restore" : "Minimize"}
                  />
                  <button
                    onClick={handleMaximize}
                    className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
                    aria-label={
                      windowState === "maximized"
                        ? "Restore terminal"
                        : "Maximize terminal"
                    }
                    title={windowState === "maximized" ? "Restore" : "Maximize"}
                  />
                </div>
                <span className="text-green-500 text-sm font-mono">
                  Terminal - {currentDirectory === "/" ? "~" : currentDirectory}
                </span>
                {/* Drag indicator */}
                <div className="flex gap-0.5 opacity-30 group-hover:opacity-60 transition-opacity">
                  <div className="w-1 h-1 bg-green-500 rounded-full"></div>
                  <div className="w-1 h-1 bg-green-500 rounded-full"></div>
                  <div className="w-1 h-1 bg-green-500 rounded-full"></div>
                </div>
              </div>
              {windowState === "minimized" && (
                <button
                  onClick={restore}
                  className="text-green-500 text-xs hover:text-green-400 transition-colors"
                  aria-label="Restore terminal"
                >
                  Restore
                </button>
              )}
            </div>

            {/* Terminal Body - Hidden with CSS when minimized */}
            <div
              className="relative h-[calc(100%-44px)] pointer-events-auto"
              style={{
                display: windowState === "minimized" ? "none" : "block",
              }}
            >
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black pointer-events-none z-10">
                  <div
                    className={cn(
                      "text-green-500 font-mono",
                      !shouldReduceAnimations && "animate-pulse",
                    )}
                  >
                    Loading terminal...
                  </div>
                </div>
              )}
              <div
                ref={terminalRef}
                tabIndex={-1}
                className="h-full w-full select-none bg-black px-2"
                style={{
                  minHeight: "100px",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                }}
                aria-live="polite"
                aria-label="Terminal output"
              />
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
