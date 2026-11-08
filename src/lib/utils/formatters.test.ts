import { describe, it, expect, afterEach, vi } from "vitest";
import { formatDate, formatFileSizeDisplay } from "./formatters";

describe("formatFileSizeDisplay", () => {
  describe("Bytes to KB conversion", () => {
    it("formats bytes under 1024 as KB", () => {
      expect(formatFileSizeDisplay(0)).toBe("0 KB");
      expect(formatFileSizeDisplay(1)).toBe("1 KB");
      expect(formatFileSizeDisplay(512)).toBe("512 KB");
      expect(formatFileSizeDisplay(1023)).toBe("1023 KB");
    });
  });

  describe("Bytes to MB conversion", () => {
    it("formats bytes 1024 and above as MB", () => {
      expect(formatFileSizeDisplay(1024)).toBe("1.0 MB");
      expect(formatFileSizeDisplay(1536)).toBe("1.5 MB");
      expect(formatFileSizeDisplay(2048)).toBe("2.0 MB");
      expect(formatFileSizeDisplay(2560)).toBe("2.5 MB");
    });

    it("rounds MB values to one decimal place", () => {
      expect(formatFileSizeDisplay(1126)).toBe("1.1 MB"); // 1.09765625 -> 1.1
      expect(formatFileSizeDisplay(1331)).toBe("1.3 MB"); // 1.29980469 -> 1.3
      expect(formatFileSizeDisplay(1945)).toBe("1.9 MB"); // 1.89941406 -> 1.9
    });

    it("handles large file sizes", () => {
      expect(formatFileSizeDisplay(10485760)).toBe("10240.0 MB"); // 10 MB in bytes
      expect(formatFileSizeDisplay(52428800)).toBe("51200.0 MB"); // 50 MB in bytes
      expect(formatFileSizeDisplay(104857600)).toBe("102400.0 MB"); // 100 MB in bytes
    });

    it("handles very large file sizes", () => {
      expect(formatFileSizeDisplay(1073741824)).toBe("1048576.0 MB"); // 1 GB in bytes
      expect(formatFileSizeDisplay(5368709120)).toBe("5242880.0 MB"); // 5 GB in bytes
    });
  });

  describe("Edge cases", () => {
    it("handles decimal input gracefully", () => {
      expect(formatFileSizeDisplay(1023.9)).toBe("1023.9 KB");
      expect(formatFileSizeDisplay(1024.1)).toBe("1.0 MB");
      expect(formatFileSizeDisplay(1536.7)).toBe("1.5 MB");
    });

    it("handles negative numbers", () => {
      expect(formatFileSizeDisplay(-1)).toBe("-1 KB");
      expect(formatFileSizeDisplay(-1024)).toBe("-1024 KB"); // Negative numbers use absolute value for comparison
    });

    it("handles zero correctly", () => {
      expect(formatFileSizeDisplay(0)).toBe("0 KB");
    });

    it("handles very small positive numbers", () => {
      expect(formatFileSizeDisplay(0.1)).toBe("0.1 KB");
      expect(formatFileSizeDisplay(0.5)).toBe("0.5 KB");
    });
  });

  describe("Precision and rounding", () => {
    it("correctly rounds edge cases around KB/MB boundary", () => {
      expect(formatFileSizeDisplay(1023.9)).toBe("1023.9 KB");
      expect(formatFileSizeDisplay(1024.0)).toBe("1.0 MB");
      expect(formatFileSizeDisplay(1024.1)).toBe("1.0 MB");
    });

    it("maintains one decimal place precision for MB", () => {
      expect(formatFileSizeDisplay(1229)).toBe("1.2 MB"); // 1.19921875 -> 1.2
      expect(formatFileSizeDisplay(1434)).toBe("1.4 MB"); // 1.40039062 -> 1.4
      expect(formatFileSizeDisplay(1638)).toBe("1.6 MB"); // 1.59960938 -> 1.6
    });

    it("handles fractions that round to exact decimals", () => {
      expect(formatFileSizeDisplay(1843)).toBe("1.8 MB"); // 1.79980469 -> 1.8
      expect(formatFileSizeDisplay(2150)).toBe("2.1 MB"); // 2.09960938 -> 2.1
      expect(formatFileSizeDisplay(3277)).toBe("3.2 MB"); // 3.19824219 -> 3.2
    });
  });

  describe("Real-world file sizes", () => {
    it("formats typical document sizes", () => {
      expect(formatFileSizeDisplay(50)).toBe("50 KB"); // Small text file
      expect(formatFileSizeDisplay(500)).toBe("500 KB"); // Medium document
      expect(formatFileSizeDisplay(2048)).toBe("2.0 MB"); // Large document
    });

    it("formats typical image sizes", () => {
      expect(formatFileSizeDisplay(150)).toBe("150 KB"); // Small image
      expect(formatFileSizeDisplay(800)).toBe("800 KB"); // Medium image
      expect(formatFileSizeDisplay(5120)).toBe("5.0 MB"); // Large image
    });

    it("formats typical video/audio sizes", () => {
      expect(formatFileSizeDisplay(10240)).toBe("10.0 MB"); // Short video
      expect(formatFileSizeDisplay(51200)).toBe("50.0 MB"); // Medium video
      expect(formatFileSizeDisplay(512000)).toBe("500.0 MB"); // Large video
    });
  });
});

describe("formatDate", () => {
  // In UTC whatever the machine's zone: the same day for every visitor.
  const originalZone = process.env.TZ;
  afterEach(() => {
    if (originalZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalZone;
  });
  const DAY: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };

  it.each(["UTC", "America/New_York", "Pacific/Kiritimati"])(
    "gives a date-only value its own day, in %s",
    (zone) => {
      process.env.TZ = zone;
      // A kudos article's date: it read "Jun 30, 2024" west of UTC.
      expect(formatDate("2024-07-01", DAY)).toBe("Jul 1, 2024");
    },
  );

  it.each(["UTC", "America/New_York", "Pacific/Kiritimati"])(
    "gives a feed's timestamp its UTC day, in %s",
    (zone) => {
      process.env.TZ = zone;
      // Medium's RSS pubDate; 14 hours east of UTC it read Apr 26.
      expect(formatDate("Thu, 25 Apr 2019 12:34:56 GMT", DAY)).toBe(
        "Apr 25, 2019",
      );
    },
  );

  it("formats in US English whatever the options", () => {
    // This Mac and CI's runners both default to en-US, which hid a dropped
    // locale: here a missing one formats in German, as a visitor's might.
    const toLocaleDateString = Date.prototype.toLocaleDateString;
    const german = vi
      .spyOn(Date.prototype, "toLocaleDateString")
      .mockImplementation(function (
        this: Date,
        locales?: Intl.LocalesArgument,
        options?: Intl.DateTimeFormatOptions,
      ) {
        return toLocaleDateString.call(this, locales ?? "de-DE", options);
      });
    try {
      expect(formatDate("2024-07-01", {})).toBe("7/1/2024");
      expect(
        formatDate("2024-07-01T00:00:00Z", {
          month: "short",
          year: "numeric",
        }),
      ).toBe("Jul 2024");
    } finally {
      german.mockRestore();
    }
  });

  it("gives null for an empty or unreadable value", () => {
    expect(formatDate("", DAY)).toBeNull();
    expect(formatDate(undefined, DAY)).toBeNull();
    expect(formatDate("not a date", DAY)).toBeNull();
  });
});
