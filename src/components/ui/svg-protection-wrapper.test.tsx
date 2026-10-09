import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { SVGProtectionWrapper } from "./svg-protection-wrapper";

/**
 * The wrapper used to watch every write to a circle's `r`. framer-motion
 * animates `r` with setAttribute on every frame, so each frame of the hero's
 * constellation pulses queued a scan of every circle on the page. Writes are
 * already sanitised by the setAttribute guard in layout.tsx; the wrapper now
 * covers insertions and, periodically, anything else.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

function makeCircle(r?: string) {
  const circle = document.createElementNS(SVG_NS, "circle");
  if (r !== undefined) circle.setAttribute("r", r);
  return circle;
}

let svg: SVGSVGElement;

// MutationObserver callbacks run as microtasks: flush those, then the timers.
async function settle(ms: number) {
  await act(async () => {
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  document.body.appendChild(svg);
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("SVGProtectionWrapper", () => {
  it("does not scan the page when a circle's radius is animated", async () => {
    const circle = makeCircle("4");
    svg.appendChild(circle);
    render(
      <SVGProtectionWrapper>
        <div />
      </SVGProtectionWrapper>,
    );
    await settle(200); // past the initial check

    const scan = vi.spyOn(Element.prototype, "querySelectorAll");
    for (let frame = 0; frame < 10; frame++) {
      circle.setAttribute("r", String(4 + frame / 10));
    }
    await settle(50);

    expect(scan).not.toHaveBeenCalled();
  });

  it("fixes a circle inserted without a radius", async () => {
    render(
      <SVGProtectionWrapper>
        <div />
      </SVGProtectionWrapper>,
    );
    await settle(200);

    const circle = makeCircle();
    svg.appendChild(circle);
    await settle(20);

    expect(circle.getAttribute("r")).toBe("4");
  });

  it("checks only the inserted subtree, once for a burst of insertions", async () => {
    for (let i = 0; i < 50; i++) svg.appendChild(makeCircle("4"));
    render(
      <SVGProtectionWrapper>
        <div />
      </SVGProtectionWrapper>,
    );
    await settle(200);

    const scan = vi.spyOn(Element.prototype, "querySelectorAll");
    const group = document.createElementNS(SVG_NS, "g");
    const broken = makeCircle();
    group.appendChild(broken);
    svg.appendChild(group);
    svg.appendChild(makeCircle("4"));
    await settle(20);

    expect(broken.getAttribute("r")).toBe("4");
    expect(scan.mock.contexts).not.toContain(document.documentElement);
  });

  it("repairs a removed radius on its periodic check, but not while the tab is hidden", async () => {
    const circle = makeCircle("4");
    svg.appendChild(circle);
    render(
      <SVGProtectionWrapper>
        <div />
      </SVGProtectionWrapper>,
    );
    await settle(200);
    circle.removeAttribute("r");

    Object.defineProperty(document, "hidden", {
      value: true,
      configurable: true,
    });
    try {
      await settle(5000);
      expect(circle.getAttribute("r")).toBeNull();
    } finally {
      // Drop the own property so the prototype getter shows through again.
      delete (document as { hidden?: boolean }).hidden;
    }

    await settle(5000);
    expect(circle.getAttribute("r")).toBe("4");
  });
});
