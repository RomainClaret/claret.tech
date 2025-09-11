import { useRef, useEffect, useCallback } from "react";

interface Position {
  x: number;
  y: number;
}

interface UseDraggableOptions {
  position: Position;
  onPositionChange: (position: Position) => void;
  handle?: React.RefObject<HTMLElement>;
  bounds?: "parent" | "window" | DOMRect;
  disabled?: boolean;
  grid?: [number, number];
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export function useDraggable({
  position,
  onPositionChange,
  handle,
  bounds = "window",
  disabled = false,
  grid,
  onDragStart,
  onDragEnd,
}: UseDraggableOptions) {
  const isDraggingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const startMouseRef = useRef({ x: 0, y: 0 });

  const getBounds = useCallback(() => {
    if (bounds === "window") {
      return {
        left: 0,
        top: 0,
        right: window.innerWidth,
        bottom: window.innerHeight,
      };
    } else if (bounds === "parent" && handle?.current) {
      const parent = handle.current.offsetParent as HTMLElement;
      if (parent) {
        return {
          left: 0,
          top: 0,
          right: parent.clientWidth,
          bottom: parent.clientHeight,
        };
      }
    } else if (bounds instanceof DOMRect) {
      return bounds;
    }
    return null;
  }, [bounds, handle]);

  const constrainToBounds = useCallback(
    (pos: Position, elementWidth: number, elementHeight: number) => {
      const rect = getBounds();
      if (!rect) return pos;

      // Ensure the element stays within bounds
      const constrainedX = Math.max(
        rect.left,
        Math.min(pos.x, rect.right - elementWidth),
      );
      const constrainedY = Math.max(
        rect.top,
        Math.min(pos.y, rect.bottom - elementHeight),
      );

      return { x: constrainedX, y: constrainedY };
    },
    [getBounds],
  );

  const snapToGrid = useCallback(
    (pos: Position) => {
      if (!grid) return pos;

      const [gridX, gridY] = grid;
      return {
        x: Math.round(pos.x / gridX) * gridX,
        y: Math.round(pos.y / gridY) * gridY,
      };
    },
    [grid],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingRef.current || disabled) return;

      e.preventDefault();

      const deltaX = e.clientX - startMouseRef.current.x;
      const deltaY = e.clientY - startMouseRef.current.y;

      let newPosition = {
        x: startPosRef.current.x + deltaX,
        y: startPosRef.current.y + deltaY,
      };

      // Get the dragged element's dimensions
      const draggedElement = handle?.current?.parentElement;
      if (draggedElement) {
        const { offsetWidth, offsetHeight } = draggedElement;
        newPosition = constrainToBounds(newPosition, offsetWidth, offsetHeight);
      }

      // Snap to grid if enabled
      newPosition = snapToGrid(newPosition);

      onPositionChange(newPosition);
    },
    [disabled, handle, constrainToBounds, snapToGrid, onPositionChange],
  );

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingRef.current) return;

      e.preventDefault();
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      onDragEnd?.();

      // Clean up event listeners (must match capture flag)
      document.removeEventListener("mousemove", handleMouseMove, true);
      document.removeEventListener("mouseup", handleMouseUp, true);
    },
    [handleMouseMove, onDragEnd],
  );

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (disabled) return;

      // Only allow dragging with left mouse button
      if (e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();

      isDraggingRef.current = true;
      startPosRef.current = { ...position };
      startMouseRef.current = { x: e.clientX, y: e.clientY };

      // Set cursor and prevent text selection
      document.body.style.cursor = "move";
      document.body.style.userSelect = "none";
      document.body.style.webkitUserSelect = "none";

      onDragStart?.();

      // Add event listeners with capture to ensure we get events first
      document.addEventListener("mousemove", handleMouseMove, true);
      document.addEventListener("mouseup", handleMouseUp, true);
    },
    [disabled, position, handleMouseMove, handleMouseUp, onDragStart],
  );

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
      if (!isDraggingRef.current || disabled) return;

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
      if (!isDraggingRef.current) return;

      const mouseEvent = new MouseEvent("mouseup", {});
      handleMouseUp(mouseEvent);
    },
    [handleMouseUp],
  );

  useEffect(() => {
    const element = handle?.current;

    if (!element || disabled) return;

    // Mouse events
    element.addEventListener("mousedown", handleMouseDown);

    // Touch events
    element.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    element.addEventListener("touchmove", handleTouchMove, { passive: false });
    element.addEventListener("touchend", handleTouchEnd);

    return () => {
      element.removeEventListener("mousedown", handleMouseDown);
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);

      // Clean up any lingering event listeners (must match capture flag)
      document.removeEventListener("mousemove", handleMouseMove, true);
      document.removeEventListener("mouseup", handleMouseUp, true);
    };
  }, [
    handle,
    disabled,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  ]);

  return {
    isDragging: isDraggingRef.current,
  };
}
