"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { logError } from "@/lib/utils/dev-logger";

type WindowState = "normal" | "minimized" | "maximized";

interface Position {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

interface TerminalState {
  isOpen: boolean;
  windowState: WindowState;
  position: Position;
  size: Size;
  lastNormalState?: {
    position: Position;
    size: Size;
  };
  currentUser: string;
}

interface TerminalContextType extends TerminalState {
  setIsOpen: (open: boolean) => void;
  toggleTerminal: () => void;
  setWindowState: (state: WindowState) => void;
  setPosition: (position: Position) => void;
  setSize: (size: Size) => void;
  setCurrentUser: (username: string) => void;
  minimize: () => void;
  maximize: () => void;
  restore: () => void;
  isDragging: boolean;
  setIsDragging: (value: boolean) => void;
}

const STORAGE_KEY = "terminal-state";

// Default values - center the terminal on screen with bounds checking
const DEFAULT_POSITION = {
  x:
    typeof window !== "undefined"
      ? Math.max(
          20,
          Math.min((window.innerWidth - 800) / 2, window.innerWidth - 820),
        )
      : 100,
  y:
    typeof window !== "undefined"
      ? Math.max(
          20,
          Math.min((window.innerHeight - 600) / 2, window.innerHeight - 620),
        )
      : 100,
};
const DEFAULT_SIZE = { width: 800, height: 600 };
const MIN_SIZE = { width: 400, height: 200 };

const TerminalContext = createContext<TerminalContextType | undefined>(
  undefined,
);

function loadStoredState(): Partial<TerminalState> {
  if (typeof window === "undefined") return {};

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate stored position is within viewport
      if (parsed.position) {
        parsed.position.x = Math.max(
          0,
          Math.min(parsed.position.x, window.innerWidth - 100),
        );
        parsed.position.y = Math.max(
          0,
          Math.min(parsed.position.y, window.innerHeight - 100),
        );
      }
      return parsed;
    }
  } catch (error) {
    logError(error, "Terminal State Load");
  }
  return {};
}

function saveState(state: TerminalState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    logError(error, "Terminal State Save");
  }
}

// Function to constrain terminal to viewport bounds
const constrainToBounds = (
  pos: Position,
  sz: Size,
): { position: Position; size: Size } => {
  const viewportWidth =
    typeof window !== "undefined" ? window.innerWidth : 1200;
  const viewportHeight =
    typeof window !== "undefined" ? window.innerHeight : 800;
  const padding = 20; // Minimum padding from edges

  const constrainedPos = { ...pos };
  const constrainedSize = { ...sz };

  // Constrain size first
  constrainedSize.width = Math.min(sz.width, viewportWidth - padding * 2);
  constrainedSize.height = Math.min(sz.height, viewportHeight - padding * 2);

  // Then constrain position
  // Left edge
  if (constrainedPos.x < padding) {
    constrainedPos.x = padding;
  }
  // Right edge
  if (constrainedPos.x + constrainedSize.width > viewportWidth - padding) {
    constrainedPos.x = viewportWidth - constrainedSize.width - padding;
  }
  // Top edge
  if (constrainedPos.y < padding) {
    constrainedPos.y = padding;
  }
  // Bottom edge
  if (constrainedPos.y + constrainedSize.height > viewportHeight - padding) {
    constrainedPos.y = viewportHeight - constrainedSize.height - padding;
  }

  return { position: constrainedPos, size: constrainedSize };
};

// Helper to check if position/size values have actually changed
const hasChanged = (
  prev: { position: Position; size: Size },
  next: { position: Position; size: Size },
): boolean => {
  return (
    prev.position.x !== next.position.x ||
    prev.position.y !== next.position.y ||
    prev.size.width !== next.size.width ||
    prev.size.height !== next.size.height
  );
};

export function TerminalProvider({ children }: { children: React.ReactNode }) {
  const storedState = loadStoredState();

  const [isOpen, setIsOpen] = useState(false);
  // Initialize with constrained values
  const initialPosition = storedState.position || DEFAULT_POSITION;
  const initialSize = storedState.size || DEFAULT_SIZE;
  const { position: constrainedInitialPos, size: constrainedInitialSize } =
    typeof window !== "undefined"
      ? constrainToBounds(initialPosition, initialSize)
      : { position: initialPosition, size: initialSize };

  const [windowState, setWindowState] = useState<WindowState>(
    storedState.windowState || "normal",
  );
  const [position, setPositionState] = useState<Position>(
    constrainedInitialPos,
  );
  const [size, setSizeState] = useState<Size>(constrainedInitialSize);
  const [lastNormalState, setLastNormalState] = useState(
    storedState.lastNormalState,
  );
  const [currentUser, setCurrentUser] = useState<string>(
    storedState.currentUser || "guest",
  );
  const [isDragging, setIsDragging] = useState(false);

  // Use refs to track if we're already in a resize operation to prevent cascading updates
  const isResizingRef = useRef(false);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sizeRef = useRef(size);
  const positionRef = useRef(position);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep refs up to date
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  // Wrapped setters with bounds checking and loop prevention
  const setPosition = useCallback(
    (newPosition: Position) => {
      if (isResizingRef.current) return; // Prevent cascading updates during resize

      const { position: constrainedPos } = constrainToBounds(
        newPosition,
        sizeRef.current,
      );
      setPositionState(constrainedPos);
    },
    [], // No dependencies - uses ref instead
  );

  const setSize = useCallback(
    (newSize: Size) => {
      if (isResizingRef.current) return; // Prevent cascading updates during resize

      isResizingRef.current = true;
      const { position: constrainedPos, size: constrainedSize } =
        constrainToBounds(positionRef.current, newSize);

      setSizeState(constrainedSize);
      if (
        constrainedPos.x !== positionRef.current.x ||
        constrainedPos.y !== positionRef.current.y
      ) {
        setPositionState(constrainedPos);
      }

      // Clear resize flag after a brief delay to allow state updates to complete
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = setTimeout(() => {
        isResizingRef.current = false;
      }, 50);
    },
    [], // No dependencies - uses ref instead
  );

  // Save state to localStorage whenever it changes (debounced)
  useEffect(() => {
    if (isOpen) {
      // Clear any pending save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Debounce save to prevent frequent writes during dragging/resizing
      saveTimeoutRef.current = setTimeout(
        () => {
          const state: TerminalState = {
            isOpen,
            windowState,
            position,
            size,
            lastNormalState,
            currentUser,
          };
          saveState(state);
        },
        isDragging ? 500 : 100,
      ); // Longer delay when dragging
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    isOpen,
    windowState,
    position,
    size,
    lastNormalState,
    currentUser,
    isDragging,
  ]);

  // Monitor viewport changes and constrain terminal bounds with debouncing
  const viewportResizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (
      !isOpen ||
      windowState === "maximized" ||
      isResizingRef.current ||
      isDragging
    )
      return;

    const handleViewportResize = () => {
      // Clear any pending resize operations
      if (viewportResizeTimeoutRef.current) {
        clearTimeout(viewportResizeTimeoutRef.current);
      }

      // Debounce viewport resize to prevent rapid state updates
      viewportResizeTimeoutRef.current = setTimeout(() => {
        const current = { position, size };
        const constrained = constrainToBounds(position, size);

        // Only update if constraints were actually applied
        if (hasChanged(current, constrained)) {
          isResizingRef.current = true;

          if (
            constrained.position.x !== position.x ||
            constrained.position.y !== position.y
          ) {
            setPositionState(constrained.position);
          }
          if (
            constrained.size.width !== size.width ||
            constrained.size.height !== size.height
          ) {
            setSizeState(constrained.size);
          }

          // Clear resize flag
          setTimeout(() => {
            isResizingRef.current = false;
          }, 50);
        }
      }, 100); // 100ms debounce
    };

    // Listen for window resize
    window.addEventListener("resize", handleViewportResize);
    return () => {
      window.removeEventListener("resize", handleViewportResize);
      if (viewportResizeTimeoutRef.current) {
        clearTimeout(viewportResizeTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, windowState, isDragging]); // position/size intentionally excluded to prevent loops

  const toggleTerminal = () => {
    setIsOpen((prev) => !prev);
  };

  const minimize = () => {
    if (windowState === "normal") {
      setLastNormalState({ position, size });
    }
    setWindowState("minimized");
  };

  const maximize = () => {
    if (windowState === "normal") {
      setLastNormalState({ position, size });
    }
    setWindowState("maximized");
  };

  const restore = () => {
    if (lastNormalState) {
      // Apply bounds constraints when restoring
      const { position: constrainedPos, size: constrainedSize } =
        constrainToBounds(lastNormalState.position, lastNormalState.size);
      setPositionState(constrainedPos);
      setSizeState(constrainedSize);
    }
    setWindowState("normal");
  };

  const contextValue: TerminalContextType = {
    isOpen,
    windowState,
    position,
    size,
    lastNormalState,
    currentUser,
    setIsOpen,
    toggleTerminal,
    setWindowState,
    setPosition,
    setSize,
    setCurrentUser,
    minimize,
    maximize,
    restore,
    isDragging,
    setIsDragging,
  };

  return (
    <TerminalContext.Provider value={contextValue}>
      {children}
    </TerminalContext.Provider>
  );
}

export function useTerminal() {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error("useTerminal must be used within a TerminalProvider");
  }
  return context;
}

// Export constants for use in other components
export { MIN_SIZE, DEFAULT_SIZE, DEFAULT_POSITION };
