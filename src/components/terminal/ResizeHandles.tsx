import React, { forwardRef, useImperativeHandle, useRef } from "react";

type ResizeDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

interface ResizeHandlesProps {
  onResizeStart?: (direction: ResizeDirection, event: React.MouseEvent) => void;
  debug?: boolean;
}

export interface ResizeHandlesRef {
  handles: {
    n: HTMLDivElement | null;
    ne: HTMLDivElement | null;
    e: HTMLDivElement | null;
    se: HTMLDivElement | null;
    s: HTMLDivElement | null;
    sw: HTMLDivElement | null;
    w: HTMLDivElement | null;
    nw: HTMLDivElement | null;
  };
}

export const ResizeHandles = forwardRef<ResizeHandlesRef, ResizeHandlesProps>(
  ({ onResizeStart, debug = false }, ref) => {
    const handlesRef = useRef<ResizeHandlesRef["handles"]>({
      n: null,
      ne: null,
      e: null,
      se: null,
      s: null,
      sw: null,
      w: null,
      nw: null,
    });

    // Component lifecycle effect
    React.useEffect(() => {
      return () => {
        // Component unmounted
      };
    }, [debug]);

    useImperativeHandle(ref, () => ({
      handles: handlesRef.current,
    }));

    const handleMouseDown =
      (direction: ResizeDirection) => (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onResizeStart?.(direction, e);
      };

    const baseHandleClass = "absolute pointer-events-auto select-none";
    const debugClass = debug ? "bg-red-500/50 border-2 border-red-500" : "";
    const cornerHandleClass = `${baseHandleClass} w-4 h-4 ${debug ? debugClass : "bg-transparent hover:bg-green-500/50 border border-transparent hover:border-green-500"}`;
    const edgeHandleClassHorizontal = `${baseHandleClass} h-2 left-4 right-4 ${debug ? debugClass : "bg-transparent hover:bg-green-500/30 border-y border-transparent hover:border-green-500"}`;
    const edgeHandleClassVertical = `${baseHandleClass} w-2 top-4 bottom-4 ${debug ? debugClass : "bg-transparent hover:bg-green-500/30 border-x border-transparent hover:border-green-500"}`;

    return (
      <>
        {/* Corner handles - positioned at edges with slight extension */}
        <div
          ref={(el) => {
            handlesRef.current.nw = el;
          }}
          className={`${cornerHandleClass} -top-1 -left-1 cursor-nwse-resize resize-handle`}
          onMouseDown={handleMouseDown("nw")}
        />
        <div
          ref={(el) => {
            handlesRef.current.ne = el;
          }}
          className={`${cornerHandleClass} -top-1 -right-1 cursor-nesw-resize resize-handle`}
          onMouseDown={handleMouseDown("ne")}
        />
        <div
          ref={(el) => {
            handlesRef.current.se = el;
          }}
          className={`${cornerHandleClass} -bottom-1 -right-1 cursor-nwse-resize resize-handle`}
          data-testid="resize-handle"
          onMouseDown={handleMouseDown("se")}
        />
        <div
          ref={(el) => {
            handlesRef.current.sw = el;
          }}
          className={`${cornerHandleClass} -bottom-1 -left-1 cursor-nesw-resize resize-handle`}
          onMouseDown={handleMouseDown("sw")}
        />

        {/* Edge handles - positioned at edges with slight extension */}
        <div
          ref={(el) => {
            handlesRef.current.n = el;
          }}
          className={`${edgeHandleClassHorizontal} -top-1 cursor-ns-resize resize-handle`}
          onMouseDown={handleMouseDown("n")}
        />
        <div
          ref={(el) => {
            handlesRef.current.e = el;
          }}
          className={`${edgeHandleClassVertical} -right-1 cursor-ew-resize resize-handle`}
          onMouseDown={handleMouseDown("e")}
        />
        <div
          ref={(el) => {
            handlesRef.current.s = el;
          }}
          className={`${edgeHandleClassHorizontal} -bottom-1 cursor-ns-resize resize-handle`}
          onMouseDown={handleMouseDown("s")}
        />
        <div
          ref={(el) => {
            handlesRef.current.w = el;
          }}
          className={`${edgeHandleClassVertical} -left-1 cursor-ew-resize resize-handle`}
          onMouseDown={handleMouseDown("w")}
        />
      </>
    );
  },
);

ResizeHandles.displayName = "ResizeHandles";
