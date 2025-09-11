import { describe, it, expect, vi } from "vitest";

// Save original Buffer if it exists
const originalBuffer = global.Buffer;

// Ensure btoa/atob are available IMMEDIATELY before any modules load
// This fixes batch mode isolation issues where modules load before setup
if (typeof window !== "undefined") {
  if (!window.btoa) {
    window.btoa = (str: string) => {
      // Use the original Buffer if available
      if (originalBuffer && typeof originalBuffer.from === "function") {
        return originalBuffer.from(str).toString("base64");
      }
      // Simple fallback for testing
      return "base64encodedstring";
    };
  }
  if (!window.atob) {
    window.atob = (str: string) => {
      // Use the original Buffer if available
      if (originalBuffer && typeof originalBuffer.from === "function") {
        return originalBuffer.from(str, "base64").toString();
      }
      // Simple fallback for testing
      return str;
    };
  }
}

// Also set on global for consistency
if (typeof global !== "undefined") {
  if (typeof global.btoa === "undefined") {
    global.btoa = (str: string) => {
      // Use the original Buffer if available
      if (originalBuffer && typeof originalBuffer.from === "function") {
        return originalBuffer.from(str).toString("base64");
      }
      // Simple fallback for testing
      return "base64encodedstring";
    };
  }
  if (typeof global.atob === "undefined") {
    global.atob = (str: string) => {
      // Use the original Buffer if available
      if (originalBuffer && typeof originalBuffer.from === "function") {
        return originalBuffer.from(str, "base64").toString();
      }
      // Simple fallback for testing
      return str;
    };
  }
}

import { validateRadius } from "./svg-validation";

// Don't mock getBlurDataURL - we want to test the real implementation
vi.mock("./image-utils", async () => {
  const actual =
    await vi.importActual<typeof import("./image-utils")>("./image-utils");
  return {
    ...actual,
    // Keep real implementations
  };
});

import {
  getOptimizedImagePath,
  getBlurDataURL,
  imageOptimizationConfig,
  imageSizes,
} from "./image-utils";

describe("Utility Validation Functions", () => {
  describe("SVG Validation", () => {
    describe("validateRadius", () => {
      it("returns fallback for undefined radius", () => {
        expect(validateRadius(undefined)).toBe("4");
        expect(validateRadius(undefined, "10")).toBe("10");
      });

      it("returns fallback for null radius", () => {
        expect(validateRadius(null)).toBe("4");
        expect(validateRadius(null, "8")).toBe("8");
      });

      it("returns fallback for NaN radius", () => {
        expect(validateRadius(NaN)).toBe("4");
        expect(validateRadius(NaN, "12")).toBe("12");
      });

      it("returns fallback for empty string radius", () => {
        expect(validateRadius("")).toBe("4");
        expect(validateRadius("", "6")).toBe("6");
      });

      it("returns fallback for string 'undefined'", () => {
        expect(validateRadius("undefined")).toBe("4");
        expect(validateRadius("undefined", "15")).toBe("15");
      });

      it("returns fallback for string 'NaN'", () => {
        expect(validateRadius("NaN")).toBe("4");
        expect(validateRadius("NaN", "20")).toBe("20");
      });

      it("returns fallback for string 'null'", () => {
        expect(validateRadius("null")).toBe("4");
        expect(validateRadius("null", "25")).toBe("25");
      });

      it("converts valid numbers to strings", () => {
        expect(validateRadius(5)).toBe("5");
        expect(validateRadius(10.5)).toBe("10.5");
        expect(validateRadius(0)).toBe("0");
        expect(validateRadius(-5)).toBe("-5");
      });

      it("preserves valid string numbers", () => {
        expect(validateRadius("8")).toBe("8");
        expect(validateRadius("12.5")).toBe("12.5");
        expect(validateRadius("0")).toBe("0");
        expect(validateRadius("-3")).toBe("-3");
      });

      it("converts non-numeric values to strings", () => {
        expect(validateRadius("auto")).toBe("auto");
        expect(validateRadius("50%")).toBe("50%");
        expect(validateRadius("2rem")).toBe("2rem");
        expect(validateRadius("inherit")).toBe("inherit");
      });

      it("handles boolean values", () => {
        expect(validateRadius(true)).toBe("true");
        expect(validateRadius(false)).toBe("false");
      });

      it("handles array values", () => {
        expect(validateRadius([1, 2, 3])).toBe("1,2,3");
        expect(validateRadius([])).toBe("4"); // Empty array -> empty string -> fallback
      });

      it("handles object values", () => {
        const obj = { radius: 10 };
        expect(validateRadius(obj)).toBe("[object Object]");
      });

      it("never returns undefined even with invalid fallback", () => {
        const result = validateRadius(undefined, "");
        expect(result).toBe("");
        expect(typeof result).toBe("string");
      });

      it("accepts optional component and context parameters", () => {
        const result = validateRadius(undefined, "4", "MyComponent", {
          debug: true,
        });
        expect(result).toBe("4");
      });

      it("uses correct default fallback value", () => {
        expect(validateRadius(undefined)).toBe("4");
      });

      it("handles edge case with zero", () => {
        expect(validateRadius(0)).toBe("0");
        expect(validateRadius("0")).toBe("0");
      });

      it("handles very large numbers", () => {
        const largeNumber = Number.MAX_SAFE_INTEGER;
        expect(validateRadius(largeNumber)).toBe(String(largeNumber));
      });

      it("handles very small numbers", () => {
        const smallNumber = Number.MIN_VALUE;
        expect(validateRadius(smallNumber)).toBe(String(smallNumber));
      });

      it("handles Infinity", () => {
        expect(validateRadius(Infinity)).toBe("Infinity");
        expect(validateRadius(-Infinity)).toBe("-Infinity");
      });
    });
  });

  describe("Image Utilities", () => {
    describe("getOptimizedImagePath", () => {
      it("returns the original path unchanged", () => {
        const testPath = "/images/test.jpg";
        expect(getOptimizedImagePath(testPath)).toBe(testPath);
      });

      it("preserves webp paths", () => {
        const webpPath = "/images/optimized.webp";
        expect(getOptimizedImagePath(webpPath)).toBe(webpPath);
      });

      it("preserves external URLs", () => {
        const externalUrl = "https://example.com/image.png";
        expect(getOptimizedImagePath(externalUrl)).toBe(externalUrl);
      });

      it("preserves relative paths", () => {
        const relativePath = "./assets/logo.svg";
        expect(getOptimizedImagePath(relativePath)).toBe(relativePath);
      });

      it("handles empty string", () => {
        expect(getOptimizedImagePath("")).toBe("");
      });
    });

    describe("getBlurDataURL", () => {
      it("returns data URL with SVG base64 format", () => {
        const result = getBlurDataURL();
        expect(result).toMatch(/^data:image\/svg\+xml;base64,/);
        expect(typeof result).toBe("string");
      });

      it("can be called multiple times", () => {
        const result1 = getBlurDataURL();
        const result2 = getBlurDataURL();
        expect(result1).toMatch(/^data:image\/svg\+xml;base64,/);
        expect(result2).toMatch(/^data:image\/svg\+xml;base64,/);
      });

      it("returns consistent format", () => {
        const result1 = getBlurDataURL();
        const result2 = getBlurDataURL();
        expect(result1).toBe(result2);
      });
    });

    describe("imageOptimizationConfig", () => {
      it("has correct quality setting", () => {
        expect(imageOptimizationConfig.quality).toBe(85);
      });

      it("includes modern image formats", () => {
        expect(imageOptimizationConfig.formats).toEqual([
          "image/avif",
          "image/webp",
        ]);
      });

      it("has proper cache TTL", () => {
        expect(imageOptimizationConfig.minimumCacheTTL).toBe(31536000); // 1 year in seconds
      });

      it("formats array is readonly", () => {
        // This tests the 'as const' assertion
        expect(Array.isArray(imageOptimizationConfig.formats)).toBe(true);
      });
    });

    describe("imageSizes", () => {
      it("has thumbnail size", () => {
        expect(imageSizes.thumbnail).toEqual({ width: 150, height: 150 });
      });

      it("has small size", () => {
        expect(imageSizes.small).toEqual({ width: 320, height: 240 });
      });

      it("has medium size", () => {
        expect(imageSizes.medium).toEqual({ width: 640, height: 480 });
      });

      it("has large size", () => {
        expect(imageSizes.large).toEqual({ width: 1024, height: 768 });
      });

      it("has full size", () => {
        expect(imageSizes.full).toEqual({ width: 1920, height: 1080 });
      });

      it("maintains aspect ratios for responsive sizes", () => {
        // Check that most sizes maintain 4:3 aspect ratio (except thumbnail which is square)
        const checkAspectRatio = (
          size: { width: number; height: number },
          expected: number,
        ) => {
          const ratio = size.width / size.height;
          expect(Math.abs(ratio - expected)).toBeLessThan(0.01);
        };

        expect(imageSizes.thumbnail.width).toBe(imageSizes.thumbnail.height); // Square
        checkAspectRatio(imageSizes.small, 4 / 3);
        checkAspectRatio(imageSizes.medium, 4 / 3);
        checkAspectRatio(imageSizes.large, 4 / 3);
        checkAspectRatio(imageSizes.full, 16 / 9);
      });

      it("sizes increase progressively", () => {
        const sizes = [
          imageSizes.thumbnail,
          imageSizes.small,
          imageSizes.medium,
          imageSizes.large,
          imageSizes.full,
        ];

        for (let i = 1; i < sizes.length; i++) {
          if (i === 1) {
            // Skip thumbnail to small comparison since thumbnail is square
            continue;
          }
          expect(sizes[i].width).toBeGreaterThan(sizes[i - 1].width);
          expect(sizes[i].height).toBeGreaterThan(sizes[i - 1].height);
        }
      });

      it("all sizes have positive dimensions", () => {
        Object.values(imageSizes).forEach((size) => {
          expect(size.width).toBeGreaterThan(0);
          expect(size.height).toBeGreaterThan(0);
        });
      });

      it("all dimensions are integers", () => {
        Object.values(imageSizes).forEach((size) => {
          expect(Number.isInteger(size.width)).toBe(true);
          expect(Number.isInteger(size.height)).toBe(true);
        });
      });
    });
  });
});
