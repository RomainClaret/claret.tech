import { loadOnIntent } from "@/lib/utils/load-on-intent";

/**
 * The terminal loads when a visitor reaches for it, not after the splash: its
 * component and commands, plus the 290 KB xterm chunk that its stylesheet
 * import pulls in (next.config.mjs groups every @xterm module into one
 * chunk). AppWrapper mounts <Terminal> on the first open; the navigation's
 * toggle spreads terminalIntent, so pointing at it or focusing it starts the
 * download before the click.
 */
const terminal = loadOnIntent(() => import("@/components/terminal/Terminal"));

export const loadTerminal = terminal.load;
/** The module, once anything (a load or a preload) has fetched it. */
export const loadedTerminal = terminal.loaded;

export const terminalIntent = {
  onPointerEnter: terminal.preload,
  onFocus: terminal.preload,
} as const;
