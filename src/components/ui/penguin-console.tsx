"use client";

import { useEffect } from "react";

// One-time devtools easter egg: an ASCII penguin greets curious visitors who
// open the console. Renders nothing.
export function PenguinConsole() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as Window & { __penguinGreeted?: boolean };
    if (w.__penguinGreeted) return;
    w.__penguinGreeted = true;

    const art = [
      "     .--.",
      "    |o_o |",
      "    |:_/ |",
      "   //   \\ \\",
      "  (|     | )",
      " /'\\_   _/'\\",
      " \\___)=(___/",
    ].join("\n");

    // eslint-disable-next-line no-console
    console.log(
      `%c🐧 curious, are we?\n%c${art}\n%cThe colony approves. Type 'penguin' in the site terminal.`,
      "font-size:14px;font-weight:bold;color:#38bdf8",
      "font-family:monospace;color:#94a3b8",
      "color:#64748b",
    );
  }, []);

  return null;
}
