import {
  getConferenceLogo,
  AVAILABLE_CONFERENCE_LOGOS,
} from "@/lib/utils/conference-logos";
import { useTheme } from "@/components/ui/theme-provider";
import { useHydrated } from "@/lib/hooks/useHydrated";

/**
 * Hook to detect and load conference/journal logos. Theme-aware: in dark
 * theme, venues with a registered `_white` logo variant get that one, and the
 * logo swaps live when the theme toggles. None in the server's HTML or while
 * hydrating: which variant fits is the visitor's theme, known in the browser.
 * @param venue - The venue string from the publication
 * @returns Object with logo URL and loading state
 */
export function useConferenceLogo(venue?: string) {
  const { theme } = useTheme();
  const hydrated = useHydrated();
  const logoUrl =
    hydrated && venue
      ? getConferenceLogo(venue, AVAILABLE_CONFERENCE_LOGOS, { theme })
      : null;
  return { logoUrl, isLoading: !hydrated };
}
