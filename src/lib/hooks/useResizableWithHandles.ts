import { useRef, useCallback, useEffect } from "react";

interface Size {
  width: number;
  height: number;
}

interface Position {
  x: number;
  y: number;
}

type ResizeDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

interface UseResizableWithHandlesOptions {
  size: Size;
  position: Position;
  onSizeChange: (size: Size) => void;
  onPositionChange?: (position: Position) => void;
  minSize?: Size;
  maxSize?: Size;
  disabled?: boolean;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
}

export function useResizableWithHandles({
  size,
  position,
  onSizeChange,
  onPositionChange,
  minSize = { width: 200, height: 100 },
  maxSize = {
    width: typeof window !== "undefined" ? window.innerWidth : 1920,
    height: typeof window !== "undefined" ? window.innerHeight : 1080,
  },
  disabled = false,
  onResizeStart,
  onResizeEnd,
}: UseResizableWithHandlesOptions) {
  const isResizingRef = useRef(false);
  const resizeDirectionRef = useRef<ResizeDirection | null>(null);
  const startSizeRef = useRef({ width: 0, height: 0 });
  const startPosRef = useRef({ x: 0, y: 0 });
  const startMouseRef = useRef({ x: 0, y: 0 });

  // Refs to store current values for stable event handlers
  const currentSizeRef = useRef(size);
  const currentPositionRef = useRef(position);
  const onSizeChangeRef = useRef(onSizeChange);
  const onPositionChangeRef = useRef(onPositionChange);
  const minSizeRef = useRef(minSize);
  const maxSizeRef = useRef(maxSize);

  // Update refs when props change
  useEffect(() => {
    currentSizeRef.current = size;
    currentPositionRef.current = position;
    onSizeChangeRef.current = onSizeChange;
    onPositionChangeRef.current = onPositionChange;
    minSizeRef.current = minSize;
    maxSizeRef.current = maxSize;
  }, [size, position, onSizeChange, onPositionChange, minSize, maxSize]);

  // Add throttling to prevent excessive state updates during resize
  const lastUpdateTimeRef = useRef(0);
  const throttleDelay = 16; // ~60fps

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current || !resizeDirectionRef.current) return;

    e.preventDefault();

    // Throttle mouse move events to prevent excessive state updates
    const now = Date.now();
    if (now - lastUpdateTimeRef.current < throttleDelay) {
      return;
    }
    lastUpdateTimeRef.current = now;

    const deltaX = e.clientX - startMouseRef.current.x;
    const deltaY = e.clientY - startMouseRef.current.y;
    const direction = resizeDirectionRef.current;

    let newWidth = startSizeRef.current.width;
    let newHeight = startSizeRef.current.height;
    let newX = startPosRef.current.x;
    let newY = startPosRef.current.y;

    // Calculate new dimensions based on resize direction
    if (direction.includes("e")) {
      newWidth = startSizeRef.current.width + deltaX;
    }
    if (direction.includes("w")) {
      newWidth = startSizeRef.current.width - deltaX;
    }
    if (direction.includes("s")) {
      newHeight = startSizeRef.current.height + deltaY;
    }
    if (direction.includes("n")) {
      newHeight = startSizeRef.current.height - deltaY;
    }

    // Apply constraints FIRST
    const constrainedWidth = Math.max(
      minSizeRef.current.width,
      Math.min(newWidth, maxSizeRef.current.width),
    );
    const constrainedHeight = Math.max(
      minSizeRef.current.height,
      Math.min(newHeight, maxSizeRef.current.height),
    );

    // THEN calculate position based on actual size change after constraints
    if (direction.includes("w")) {
      newX =
        startPosRef.current.x + (startSizeRef.current.width - constrainedWidth);
    }
    if (direction.includes("n")) {
      newY =
        startPosRef.current.y +
        (startSizeRef.current.height - constrainedHeight);
    }

    // Ensure the window stays within viewport bounds
    const maxX = window.innerWidth - constrainedWidth;
    const maxY = window.innerHeight - constrainedHeight;
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));

    // Use the constrained dimensions
    newWidth = constrainedWidth;
    newHeight = constrainedHeight;

    // Only call callbacks if values have actually changed
    const hasChangeInSize =
      newWidth !== currentSizeRef.current.width ||
      newHeight !== currentSizeRef.current.height;
    const hasChangeInPosition =
      newX !== currentPositionRef.current.x ||
      newY !== currentPositionRef.current.y;

    if (hasChangeInSize) {
      onSizeChangeRef.current({ width: newWidth, height: newHeight });
    }
    if (onPositionChangeRef.current && hasChangeInPosition) {
      onPositionChangeRef.current({ x: newX, y: newY });
    }
  }, []);

  // Store onResizeEnd in a ref to keep callback stable
  const onResizeEndRef = useRef(onResizeEnd);
  useEffect(() => {
    onResizeEndRef.current = onResizeEnd;
  }, [onResizeEnd]);

  // Store handlers in refs to maintain stable references
  const handleMouseMoveRef = useRef(handleMouseMove);
  const handleMouseUpRef = useRef<((e: MouseEvent) => void) | null>(null);

  useEffect(() => {
    handleMouseMoveRef.current = handleMouseMove;
  }, [handleMouseMove]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current) return;

    e.preventDefault();
    e.stopPropagation();

    isResizingRef.current = false;
    resizeDirectionRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    (
      document.body.style as CSSStyleDeclaration & { webkitUserSelect: string }
    ).webkitUserSelect = "";

    onResizeEndRef.current?.();

    // Remove global event listeners (must match capture flag)
    document.removeEventListener("mousemove", handleMouseMoveRef.current, true);
    document.removeEventListener("mouseup", handleMouseUpRef.current!, true);
  }, []);

  // Store the handleMouseUp ref
  handleMouseUpRef.current = handleMouseUp;

  // Store current props in refs for stable access
  const sizeRef = useRef(size);
  const positionRef = useRef(position);
  const disabledRef = useRef(disabled);
  const onResizeStartRef = useRef(onResizeStart);

  useEffect(() => {
    sizeRef.current = size;
    positionRef.current = position;
    disabledRef.current = disabled;
    onResizeStartRef.current = onResizeStart;
  }, [size, position, disabled, onResizeStart]);

  const startResize = useCallback(
    (direction: ResizeDirection, e: MouseEvent) => {
      if (disabledRef.current) return;

      e.preventDefault();
      e.stopPropagation();

      isResizingRef.current = true;
      resizeDirectionRef.current = direction;
      startSizeRef.current = { ...sizeRef.current };
      startPosRef.current = { ...positionRef.current };
      startMouseRef.current = { x: e.clientX, y: e.clientY };

      // Set cursor based on direction
      const cursorMap: Record<ResizeDirection, string> = {
        n: "ns-resize",
        s: "ns-resize",
        e: "ew-resize",
        w: "ew-resize",
        ne: "nesw-resize",
        sw: "nesw-resize",
        nw: "nwse-resize",
        se: "nwse-resize",
      };

      document.body.style.cursor = cursorMap[direction];
      document.body.style.userSelect = "none";
      (
        document.body.style as CSSStyleDeclaration & {
          webkitUserSelect: string;
        }
      ).webkitUserSelect = "none";

      onResizeStartRef.current?.();

      // Add global event listeners with capture to ensure we get events first
      document.addEventListener("mousemove", handleMouseMoveRef.current, true);
      document.addEventListener("mouseup", handleMouseUpRef.current!, true);
    },
    [],
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (handleMouseMoveRef.current) {
        document.removeEventListener(
          "mousemove",
          handleMouseMoveRef.current,
          true,
        );
      }
      if (handleMouseUpRef.current) {
        document.removeEventListener("mouseup", handleMouseUpRef.current, true);
      }
    };
  }, []);

  return {
    startResize,
    isResizing: isResizingRef.current,
  };
}
