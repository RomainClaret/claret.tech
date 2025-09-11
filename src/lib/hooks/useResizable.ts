import { useRef, useEffect, useCallback } from "react";

interface Size {
  width: number;
  height: number;
}

interface Position {
  x: number;
  y: number;
}

type ResizeDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

interface UseResizableOptions {
  size: Size;
  position: Position;
  onSizeChange: (size: Size) => void;
  onPositionChange?: (position: Position) => void;
  minSize?: Size;
  maxSize?: Size;
  handleSize?: number;
  disabled?: boolean;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
}

export function useResizable({
  size,
  position,
  onSizeChange,
  onPositionChange,
  minSize = { width: 200, height: 100 },
  maxSize = {
    width: typeof window !== "undefined" ? window.innerWidth : 1920,
    height: typeof window !== "undefined" ? window.innerHeight : 1080,
  },
  handleSize = 8,
  disabled = false,
  onResizeStart,
  onResizeEnd,
}: UseResizableOptions) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const isResizingRef = useRef(false);
  const resizeDirectionRef = useRef<ResizeDirection | null>(null);
  const startSizeRef = useRef({ width: 0, height: 0 });
  const startPosRef = useRef({ x: 0, y: 0 });
  const startMouseRef = useRef({ x: 0, y: 0 });

  const getResizeDirection = useCallback(
    (e: MouseEvent, element: HTMLElement): ResizeDirection | null => {
      const rect = element.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const { width, height } = rect;

      const tolerance = handleSize;

      const isNorth = y < tolerance;
      const isSouth = y > height - tolerance;
      const isWest = x < tolerance;
      const isEast = x > width - tolerance;

      if (isNorth && isWest) return "nw";
      if (isNorth && isEast) return "ne";
      if (isSouth && isWest) return "sw";
      if (isSouth && isEast) return "se";
      if (isNorth) return "n";
      if (isSouth) return "s";
      if (isWest) return "w";
      if (isEast) return "e";

      return null;
    },
    [handleSize],
  );

  const getCursorStyle = (direction: ResizeDirection | null): string => {
    switch (direction) {
      case "n":
      case "s":
        return "ns-resize";
      case "e":
      case "w":
        return "ew-resize";
      case "ne":
      case "sw":
        return "nesw-resize";
      case "nw":
      case "se":
        return "nwse-resize";
      default:
        return "";
    }
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const element = elementRef.current;
      if (!element) return;

      if (isResizingRef.current && resizeDirectionRef.current) {
        e.preventDefault();

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
          newX = startPosRef.current.x + deltaX;
        }
        if (direction.includes("s")) {
          newHeight = startSizeRef.current.height + deltaY;
        }
        if (direction.includes("n")) {
          newHeight = startSizeRef.current.height - deltaY;
          newY = startPosRef.current.y + deltaY;
        }

        // Apply constraints
        newWidth = Math.max(minSize.width, Math.min(newWidth, maxSize.width));
        newHeight = Math.max(
          minSize.height,
          Math.min(newHeight, maxSize.height),
        );

        // Adjust position if resizing from left or top
        if (direction.includes("w")) {
          const widthDiff = startSizeRef.current.width - newWidth;
          newX = startPosRef.current.x + widthDiff;
        }
        if (direction.includes("n")) {
          const heightDiff = startSizeRef.current.height - newHeight;
          newY = startPosRef.current.y + heightDiff;
        }

        // Ensure the window stays within viewport bounds
        const maxX = window.innerWidth - newWidth;
        const maxY = window.innerHeight - newHeight;
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        onSizeChange({ width: newWidth, height: newHeight });
        if (onPositionChange && (newX !== position.x || newY !== position.y)) {
          onPositionChange({ x: newX, y: newY });
        }
      } else if (!disabled) {
        // Update cursor based on mouse position
        const direction = getResizeDirection(e, element);
        element.style.cursor = getCursorStyle(direction);
      }
    },
    [
      disabled,
      position,
      minSize,
      maxSize,
      getResizeDirection,
      onSizeChange,
      onPositionChange,
    ],
  );

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      if (!isResizingRef.current) return;

      e.preventDefault();

      isResizingRef.current = false;
      resizeDirectionRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      onResizeEnd?.();

      // Remove global event listeners
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    },
    [handleMouseMove, onResizeEnd],
  );

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      const element = elementRef.current;
      if (!element || disabled) return;

      const direction = getResizeDirection(e, element);
      if (!direction) return;

      e.preventDefault();

      isResizingRef.current = true;
      resizeDirectionRef.current = direction;
      startSizeRef.current = { ...size };
      startPosRef.current = { ...position };
      startMouseRef.current = { x: e.clientX, y: e.clientY };

      document.body.style.cursor = getCursorStyle(direction);
      document.body.style.userSelect = "none";

      onResizeStart?.();

      // Add global event listeners
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- getCursorStyle is a pure function that doesn't need to be in deps
    },
    [
      disabled,
      size,
      position,
      getResizeDirection,
      handleMouseMove,
      handleMouseUp,
      onResizeStart,
    ],
  );

  const handleMouseLeave = useCallback(() => {
    const element = elementRef.current;
    if (element && !isResizingRef.current) {
      element.style.cursor = "";
    }
  }, []);

  // Touch support
  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled) return;

      const touch = e.touches[0];
      const mouseEvent = new MouseEvent("mousedown", {
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0,
      });

      handleMouseDown(mouseEvent);
    },
    [disabled, handleMouseDown],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isResizingRef.current || disabled) return;

      e.preventDefault();
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent("mousemove", {
        clientX: touch.clientX,
        clientY: touch.clientY,
      });

      handleMouseMove(mouseEvent);
    },
    [disabled, handleMouseMove],
  );

  const handleTouchEnd = useCallback(
    (_e: TouchEvent) => {
      if (!isResizingRef.current) return;

      const mouseEvent = new MouseEvent("mouseup", {});
      handleMouseUp(mouseEvent);
    },
    [handleMouseUp],
  );

  const setRef = useCallback(
    (element: HTMLDivElement | null) => {
      if (elementRef.current && !disabled) {
        // Clean up old element
        elementRef.current.removeEventListener("mousedown", handleMouseDown);
        elementRef.current.removeEventListener("mousemove", handleMouseMove);
        elementRef.current.removeEventListener("mouseleave", handleMouseLeave);
        elementRef.current.removeEventListener("touchstart", handleTouchStart);
        elementRef.current.removeEventListener("touchmove", handleTouchMove);
        elementRef.current.removeEventListener("touchend", handleTouchEnd);
      }

      elementRef.current = element;

      if (element && !disabled) {
        // Set up new element
        element.addEventListener("mousedown", handleMouseDown);
        element.addEventListener("mousemove", handleMouseMove);
        element.addEventListener("mouseleave", handleMouseLeave);
        element.addEventListener("touchstart", handleTouchStart, {
          passive: false,
        });
        element.addEventListener("touchmove", handleTouchMove, {
          passive: false,
        });
        element.addEventListener("touchend", handleTouchEnd);
      }
    },
    [
      disabled,
      handleMouseDown,
      handleMouseMove,
      handleMouseLeave,
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
    ],
  );

  useEffect(() => {
    return () => {
      // Clean up any lingering event listeners
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return {
    ref: setRef,
    isResizing: isResizingRef.current,
  };
}
