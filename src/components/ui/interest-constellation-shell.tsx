import { cn } from "@/lib/utils";

/** The constellation's glows, shared by the shell and the real component. */
export function ConstellationFilters() {
  return (
    <defs>
      <filter id="glow">
        <feGaussianBlur stdDeviation="4" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="textGlow">
        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
        <feComponentTransfer in="coloredBlur" result="brighterBlur">
          <feFuncA
            type="discrete"
            tableValues="0 .8 .8 .8 .8 .8 .8 .8 .8 .8 .8 .8 .8 .8 .8 .8 .8"
          />
        </feComponentTransfer>
        <feMerge>
          <feMergeNode in="brighterBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

/**
 * The interest constellation as the page's HTML has it: its frame and its
 * glows, before the code that draws the orbit arrives. That code
 * (interest-constellation.tsx) loads after hydration, on screens wide enough
 * to show it; until then, and on phones, this stands in its place, the same
 * markup as the component's first render (interest-constellation-shell.test.tsx).
 */
export function ConstellationShell({ className }: { className?: string }) {
  return (
    <div className={cn("relative w-full", className)}>
      <div
        className="hidden md:block relative pointer-events-none"
        style={{ zIndex: 10 }}
      >
        <svg
          className="overflow-visible"
          width="1000"
          height="1000"
          viewBox="-500 -500 1000 1000"
          preserveAspectRatio="xMidYMid meet"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
          }}
        >
          <ConstellationFilters />
        </svg>
      </div>
    </div>
  );
}
