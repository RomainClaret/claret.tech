import { useEffect, useState, useRef } from "react";
import ColorThief from "colorthief";
import precomputedColors from "@/lib/utils/precomputed-colors.json";
import { logError, logWarning } from "@/lib/utils/dev-logger";

// Cache for extracted colors to avoid re-processing
const colorCache = new Map<string, string>();

export function useColorExtraction(
  imageSrc: string,
  fallbackColor: string = "rgb(85, 25, 139)",
): { color: string; isLoading: boolean } {
  const [extractedColor, setExtractedColor] = useState<string>(fallbackColor);
  const [isLoading, setIsLoading] = useState(true);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const colorThiefRef = useRef<ColorThief | null>(null);

  useEffect(() => {
    // Check precomputed colors first
    if (precomputedColors[imageSrc as keyof typeof precomputedColors]) {
      const precomputedColor =
        precomputedColors[imageSrc as keyof typeof precomputedColors];
      setExtractedColor(precomputedColor);
      setIsLoading(false);
      return;
    }

    // Check cache second
    if (colorCache.has(imageSrc)) {
      setExtractedColor(colorCache.get(imageSrc)!);
      setIsLoading(false);
      return;
    }

    // Initialize ColorThief only on client side
    if (typeof window !== "undefined" && !colorThiefRef.current) {
      colorThiefRef.current = new ColorThief();
    }

    const extractColor = async () => {
      try {
        // Validate image source
        if (!imageSrc || imageSrc.trim() === "") {
          setExtractedColor(fallbackColor);
          setIsLoading(false);
          return;
        }

        setIsLoading(true);

        // Create a new image element
        const img = new Image();
        img.crossOrigin = "anonymous";

        // Set up load handler
        img.onload = () => {
          try {
            if (colorThiefRef.current) {
              // Extract dominant color
              const dominantColor = colorThiefRef.current.getColor(img);

              if (dominantColor && dominantColor.length === 3) {
                let [r, g, b] = dominantColor;

                // Calculate luminance to detect colors that are too light or too dark
                const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

                // Adjust colors that are too light or too dark for better glow visibility
                if (luminance > 0.7 || luminance < 0.25) {
                  // Convert to HSL for better brightness control
                  const max = Math.max(r, g, b) / 255;
                  const min = Math.min(r, g, b) / 255;
                  const l = (max + min) / 2;
                  const d = max - min;

                  let h = 0;
                  let s = 0;

                  if (d !== 0) {
                    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

                    switch (max) {
                      case r / 255:
                        h = ((g / 255 - b / 255) / d + (g < b ? 6 : 0)) / 6;
                        break;
                      case g / 255:
                        h = ((b / 255 - r / 255) / d + 2) / 6;
                        break;
                      case b / 255:
                        h = ((r / 255 - g / 255) / d + 4) / 6;
                        break;
                    }
                  }

                  // Adjust lightness to optimal range (0.4-0.6) for glow visibility
                  let newL = l;
                  if (luminance > 0.7) {
                    // Darken light colors
                    newL = Math.min(0.5, l * 0.7);
                  } else if (luminance < 0.25) {
                    // Brighten dark colors
                    newL = Math.max(0.45, l * 2);
                  }

                  // Boost saturation for more vibrant colors
                  const newS = Math.min(1, s * 1.5);

                  // Convert back to RGB
                  const hue2rgb = (p: number, q: number, t: number) => {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1 / 6) return p + (q - p) * 6 * t;
                    if (t < 1 / 2) return q;
                    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                    return p;
                  };

                  const q =
                    newL < 0.5 ? newL * (1 + newS) : newL + newS - newL * newS;
                  const p = 2 * newL - q;

                  r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
                  g = Math.round(hue2rgb(p, q, h) * 255);
                  b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

                  // Ensure colors are in optimal range for visibility
                  r = Math.max(60, Math.min(200, r));
                  g = Math.max(60, Math.min(200, g));
                  b = Math.max(60, Math.min(200, b));
                }

                // Convert RGB array to CSS rgb string
                const rgbString = `rgb(${r}, ${g}, ${b})`;

                // Cache the result
                colorCache.set(imageSrc, rgbString);

                // Update state
                setExtractedColor(rgbString);
              }
            }
          } catch (error) {
            logWarning(
              `Color extraction failed for ${imageSrc}: ${error}`,
              "color-extraction:extract",
            );
            // Keep fallback color
          } finally {
            setIsLoading(false);
          }
        };

        // Set up error handler
        img.onerror = () => {
          logWarning(
            `Failed to load image for color extraction: ${imageSrc}`,
            "color-extraction:image-load",
          );
          setIsLoading(false);
          // Keep fallback color
        };

        // Store ref and load image
        imgRef.current = img;
        img.src = imageSrc;
      } catch (error) {
        logError(error, "color-extraction:setup");
        setIsLoading(false);
      }
    };

    extractColor();

    // Cleanup
    return () => {
      if (imgRef.current) {
        imgRef.current.onload = null;
        imgRef.current.onerror = null;
        imgRef.current = null;
      }
    };
  }, [imageSrc, fallbackColor]);

  return { color: extractedColor, isLoading };
}

// Additional helper to extract color palette if needed
export function useColorPalette(
  imageSrc: string,
  colorCount: number = 5,
): { palette: string[]; isLoading: boolean } {
  const [palette, setPalette] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const colorThiefRef = useRef<ColorThief | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && !colorThiefRef.current) {
      colorThiefRef.current = new ColorThief();
    }

    const extractPalette = async () => {
      try {
        setIsLoading(true);

        const img = new Image();
        img.crossOrigin = "anonymous";

        img.onload = () => {
          try {
            if (colorThiefRef.current) {
              const colorPalette = colorThiefRef.current.getPalette(
                img,
                colorCount,
              );

              if (colorPalette && colorPalette.length > 0) {
                const rgbStrings = colorPalette.map(
                  (color) => `rgb(${color[0]}, ${color[1]}, ${color[2]})`,
                );
                setPalette(rgbStrings);
              }
            }
          } catch (error) {
            logWarning(
              `Palette extraction failed: ${error}`,
              "color-extraction:palette",
            );
          } finally {
            setIsLoading(false);
          }
        };

        img.onerror = () => {
          setIsLoading(false);
        };

        img.src = imageSrc;
      } catch (error) {
        logError(error, "color-extraction:palette-setup");
        setIsLoading(false);
      }
    };

    extractPalette();
  }, [imageSrc, colorCount]);

  return { palette, isLoading };
}

// Helper to determine if a color is light or dark
export function isLightColor(rgbString: string): boolean {
  const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return false;

  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5;
}

// Helper to darken or lighten a color
export function adjustColorBrightness(
  rgbString: string,
  factor: number,
): string {
  const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return rgbString;

  const r = Math.round(Math.min(255, Math.max(0, parseInt(match[1]) * factor)));
  const g = Math.round(Math.min(255, Math.max(0, parseInt(match[2]) * factor)));
  const b = Math.round(Math.min(255, Math.max(0, parseInt(match[3]) * factor)));

  return `rgb(${r}, ${g}, ${b})`;
}
