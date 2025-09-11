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

      const handleMouseMove = (e: MouseEvent) => {
        // Cancel any pending animation frame
        if (dragAnimationFrameRef.current) {
          cancelAnimationFrame(dragAnimationFrameRef.current);
        }

        // Use requestAnimationFrame to throttle updates
        dragAnimationFrameRef.current = requestAnimationFrame(() => {
          const deltaX = e.clientX - dragStartPos.current.x;
          const deltaY = e.clientY - dragStartPos.current.y;

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
        });
      };

      const handleMouseUp = () => {
        // Cancel any pending animation frame
        if (dragAnimationFrameRef.current) {
          cancelAnimationFrame(dragAnimationFrameRef.current);
          dragAnimationFrameRef.current = null;
        }
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

        const writePrompt = () => {
          const promptSymbol = currentUserRef.current === "guest" ? "%" : "$";
          const prompt = `\x1b[32m${currentUserRef.current}@Claret.Tech\x1b[0m ${promptSymbol} `;
          term.write(prompt);
        };

        // Helper functions for line wrapping

        // Calculate the visual length of the prompt (without escape codes)
        const getPromptLength = () => {
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
          if (!text) return;

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
          const code = data.charCodeAt(0);

          // Handle Ctrl+C - always allow cancellation
          if (code === 3) {
            if (isCommandRunningRef.current) {
              // Cancel running command
              if (currentCommandAbortControllerRef.current) {
                currentCommandAbortControllerRef.current.abort();
                term.write("^C\r\n");
                term.writeln("Command cancelled by user");
                term.writeln("");
                writePrompt();
                isCommandRunningRef.current = false;
                currentCommandAbortControllerRef.current = null;
                return;
              }
            } else {
              // Cancel current input
              inputBufferRef.current = "";
              cursorPosRef.current = 0;
              updatePermanentBackup();
              historyIndexRef.current = commandHistoryRef.current.length;
              term.write("^C\r\n");
              writePrompt();
              return;
            }
          }

          // Don't process other input while a command is running
          if (isCommandRunningRef.current) return;

          // Handle special keys
          if (code === 1) {
            // Ctrl+A - Move cursor to beginning of line
            if (cursorPosRef.current > 0) {
              cursorPosRef.current = 0;
              updatePermanentBackup();
              // Calculate prompt length: "user@Claret.Tech $ " or "user@Claret.Tech % "
              const promptSymbol =
                currentUserRef.current === "guest" ? "%" : "$";
              const promptText = `${currentUserRef.current}@Claret.Tech ${promptSymbol} `;
              const promptLength = promptText.length;
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
            const command = inputBufferRef.current.trim();

            if (command) {
              commandHistoryRef.current.push(command);
              historyIndexRef.current = commandHistoryRef.current.length;

              // Execute command
              isCommandRunningRef.current = true;

              // Create abort controller for this command
              const abortController = new AbortController();
              currentCommandAbortControllerRef.current = abortController;

              executeCommand(command, {
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
                writer: (text: string) => term.write(text),
                abortController,
              })
                .then((result) => {
                  // Only process result if command wasn't aborted
                  if (!abortController.signal.aborted) {
                    if (result.output) {
                      term.writeln(result.output);
                    }
                    if (command === "clear") {
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
            updatePermanentBackup();
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
        });

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
