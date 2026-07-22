import { useState, useEffect } from "react";
import {
  getConferenceLogo,
  AVAILABLE_CONFERENCE_LOGOS,
} from "@/lib/utils/conference-logos";
import { useTheme } from "@/components/ui/theme-provider";

/**
 * Hook to detect and load conference/journal logos. Theme-aware: in dark
 * theme, venues with a registered `_white` logo variant get that one, and the
 * logo swaps live when the theme toggles.
 * @param venue - The venue string from the publication
 * @returns Object with logo URL and loading state
 */
export function useConferenceLogo(venue?: string) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { theme } = useTheme();

  useEffect(() => {
    if (!venue) {
      setIsLoading(false);
      return;
    }

    // Check if a logo exists for this venue
    const logo = getConferenceLogo(venue, AVAILABLE_CONFERENCE_LOGOS, {
      theme,
    });
    setLogoUrl(logo);
    setIsLoading(false);
  }, [venue, theme]);

  return { logoUrl, isLoading };
}
