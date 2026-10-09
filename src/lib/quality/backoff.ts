import { QualityMode } from "./mode";
import type { QualityDecisionState } from "./decide";
import { readStorage, writeStorage } from "@/lib/utils/safe-storage";

/**
 * The automatic loop's memory of what failed, kept for the session next to
 * the tier it picked (sessionStorage "quality-mode").
 *
 * Kept only in memory, a reload restored the tier but not its backoff: a
 * machine demoted from MAXIMUM was back at BALANCED with nothing blocked,
 * upgraded about 16 s later and stuttered again, on every reload, and the
 * 1, 5 and 30 minute escalation never built up. The last toast's time is
 * kept too: the 5 minute cap on quality toasts started over on each reload.
 */
export type Backoff = Pick<
  QualityDecisionState,
  "demotions" | "recoverTo" | "lastToastAt"
>;

const KEY = "quality-backoff";
const TIERS = new Set<string>(Object.values(QualityMode));

export function saveBackoff({
  demotions,
  recoverTo,
  lastToastAt,
}: Backoff): void {
  // JSON has no Infinity (a tier closed for the session, or the startup
  // check's block): MAX_VALUE compares the same way.
  const json = JSON.stringify(
    { demotions, recoverTo, lastToastAt },
    (_, value) => (value === Infinity ? Number.MAX_VALUE : value),
  );
  writeStorage("session", KEY, json);
}

/** What was saved this session, keeping only well-formed entries. */
export function loadBackoff(): Backoff {
  const backoff: Backoff = { demotions: {}, recoverTo: null, lastToastAt: 0 };
  try {
    const raw = readStorage("session", KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return backoff;
    const { demotions, recoverTo, lastToastAt } = parsed as Record<
      string,
      unknown
    >;
    if (demotions && typeof demotions === "object") {
      for (const [tier, record] of Object.entries(demotions)) {
        const { count, blockedUntil } = (record ?? {}) as Record<
          string,
          unknown
        >;
        if (
          TIERS.has(tier) &&
          typeof count === "number" &&
          typeof blockedUntil === "number"
        ) {
          backoff.demotions[tier as QualityMode] = { count, blockedUntil };
        }
      }
    }
    if (typeof recoverTo === "string" && TIERS.has(recoverTo)) {
      backoff.recoverTo = recoverTo as QualityMode;
    }
    if (typeof lastToastAt === "number" && Number.isFinite(lastToastAt)) {
      backoff.lastToastAt = lastToastAt;
    }
  } catch {
    // Not JSON: nothing saved that can be used.
  }
  return backoff;
}
