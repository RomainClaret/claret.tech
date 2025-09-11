import { useState, useEffect } from "react";
import {
  getConferenceLogo,
  AVAILABLE_CONFERENCE_LOGOS,
} from "@/lib/utils/conference-logos";

/**
 * Hook to detect and load conference/journal logos
 * @param venue - The venue string from the publication
 * @returns Object with logo URL and loading state
 */
export function useConferenceLogo(venue?: string) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!venue) {
      setIsLoading(false);
      return;
    }

    // Check if a logo exists for this venue
    const logo = getConferenceLogo(venue, AVAILABLE_CONFERENCE_LOGOS);
    setLogoUrl(logo);
    setIsLoading(false);
  }, [venue]);

  return { logoUrl, isLoading };
}
