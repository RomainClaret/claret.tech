import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useResizableWithHandles } from "./useResizableWithHandles";

/**
 * The terminal window's resize handles: a press on a handle starts a resize,
 * moves resize within the limits and the viewport, and the release ends it
 * and stops listening.
 */

let now = 1000;
const press = (x: number, y: number) =>
  new MouseEvent("mousedown", { clientX: x, clientY: y, cancelable: true });
const move = (x: number, y: number) => {
  // Past the hook's 16 ms throttle.
  now += 20;
  document.dispatchEvent(
    new MouseEvent("mousemove", { clientX: x, clientY: y, cancelable: true }),
  );
};
const release = () =>
  document.dispatchEvent(new MouseEvent("mouseup", { cancelable: true }));

function setup(
  overrides: Partial<Parameters<typeof useResizableWithHandles>[0]> = {},
) {
  const onSizeChange = vi.fn();
  const onPositionChange = vi.fn();
  const onResizeStart = vi.fn();
  const onResizeEnd = vi.fn();
  const hook = renderHook(() =>
    useResizableWithHandles({
      size: { width: 600, height: 400 },
      position: { x: 100, y: 100 },
      onSizeChange,
      onPositionChange,
      onResizeStart,
      onResizeEnd,
      minSize: { width: 300, height: 200 },
      maxSize: { width: 900, height: 700 },
      ...overrides,
    }),
  );
  return {
    ...hook,
    onSizeChange,
    onPositionChange,
    onResizeStart,
    onResizeEnd,
  };
}

beforeEach(() => {
  now = 1000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  window.innerWidth = 1280;
  window.innerHeight = 800;
});

afterEach(() => {
  release();
  vi.restoreAllMocks();
});

describe("useResizableWithHandles", () => {
  it("grows the window from its bottom-right corner, within the limits", () => {
    const { result, onSizeChange, onPositionChange, onResizeStart } = setup();

    result.current.startResize("se", press(700, 500));
    expect(onResizeStart).toHaveBeenCalledTimes(1);
    expect(document.body.style.cursor).toBe("nwse-resize");

    move(750, 560);
    expect(onSizeChange).toHaveBeenLastCalledWith({ width: 650, height: 460 });
    expect(onPositionChange).not.toHaveBeenCalled();

    move(2000, 2000);
    expect(onSizeChange).toHaveBeenLastCalledWith({ width: 900, height: 700 });
  });

  it("moves the window as it grows from its left edge", () => {
    const { result, onSizeChange, onPositionChange } = setup();

    result.current.startResize("w", press(100, 300));
    move(60, 300);

    expect(onSizeChange).toHaveBeenLastCalledWith({ width: 640, height: 400 });
    expect(onPositionChange).toHaveBeenLastCalledWith({ x: 60, y: 100 });
  });

  it("stops at the release, and stops listening", () => {
    const { result, onSizeChange, onResizeEnd } = setup();

    result.current.startResize("e", press(700, 300));
    move(720, 300);
    release();

    expect(onResizeEnd).toHaveBeenCalledTimes(1);
    expect(document.body.style.cursor).toBe("");
    const calls = onSizeChange.mock.calls.length;
    move(800, 300);
    expect(onSizeChange).toHaveBeenCalledTimes(calls);
  });

  it("does nothing while disabled", () => {
    const { result, onSizeChange, onResizeStart } = setup({ disabled: true });

    result.current.startResize("se", press(700, 500));
    move(750, 560);

    expect(onResizeStart).not.toHaveBeenCalled();
    expect(onSizeChange).not.toHaveBeenCalled();
  });

  it("stops listening when the window unmounts mid-resize", () => {
    const { result, onSizeChange, unmount } = setup();

    result.current.startResize("e", press(700, 300));
    unmount();
    move(800, 300);

    expect(onSizeChange).not.toHaveBeenCalled();
  });
});
