#!/usr/bin/env python3
"""Split Montserrat into the Latin file the site preloads and a range for the rest.

The full font (public/fonts/Montserrat-Regular.woff2, 79 KB) carries 969
code points, among them Cyrillic, Greek and Vietnamese the site does not
show. Every visit preloaded all of it. This writes:

- public/fonts/Montserrat-Regular-latin.woff2: the code points in LATIN,
  with the OpenType features browsers apply on their own (kerning,
  ligatures, contextual forms, fractions) plus tnum, the one other feature
  the site asks for (tabular-nums in progress-ring.tsx). The glyphs only
  other features reach (small caps, oldstyle and superior figures,
  stylistic alternates) are left out: 501 glyphs instead of 913, and
  25.9 KB instead of 40.5 KB. Text renders as before; a page that starts
  using another feature needs it added to EXTRA_FEATURES.
- src/lib/fonts/montserrat-ranges.json: LATIN, and "rest", every other
  code point the full font has, as CSS unicode-range lists.

layout.tsx preloads the Latin file through next/font with unicode-range
LATIN (written out there as a literal, which next/font requires; a test
checks it against the JSON) and declares the full font for "rest", so a
page that uses one of those characters still gets Montserrat for it.

Requires fontTools and brotli, for instance in a throwaway environment:
    python3 -m venv /tmp/fontenv && /tmp/fontenv/bin/pip install fonttools brotli
    /tmp/fontenv/bin/python scripts/subset-montserrat.py
"""

import json
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
FULL = ROOT / "public/fonts/Montserrat-Regular.woff2"
LATIN_FILE = ROOT / "public/fonts/Montserrat-Regular-latin.woff2"
RANGES_FILE = ROOT / "src/lib/fonts/montserrat-ranges.json"

# Basic Latin, Latin-1 and Latin Extended-A (European names, common in
# author lists), the spacing accents, general punctuation, currency,
# letterlike symbols, arrows, mathematical operators and ligatures.
LATIN = (
    "U+0000-017F,U+0192,U+0218-021B,U+02BB-02BC,U+02C6-02C7,U+02C9,"
    "U+02D8-02DD,U+2000-206F,U+20A0-20CF,U+2100-214F,U+2190-21FF,"
    "U+2200-22FF,U+FB00-FB06,U+FEFF,U+FFFD"
)

# Features the site's CSS turns on beyond the browsers' defaults, which
# fontTools keeps on its own: tnum for tabular-nums (progress-ring.tsx).
EXTRA_FEATURES = ["tnum"]


def parse(ranges: str) -> set[int]:
    points: set[int] = set()
    for part in ranges.split(","):
        low, _, high = part.strip().removeprefix("U+").partition("-")
        points.update(range(int(low, 16), int(high or low, 16) + 1))
    return points


def to_ranges(points: list[int]) -> str:
    spans: list[list[int]] = []
    for point in sorted(points):
        if spans and point == spans[-1][1] + 1:
            spans[-1][1] = point
        else:
            spans.append([point, point])
    return ",".join(
        f"U+{low:04X}" if low == high else f"U+{low:04X}-{high:04X}"
        for low, high in spans
    )


def main() -> None:
    covered = set(TTFont(FULL).getBestCmap())
    latin = parse(LATIN)
    rest = sorted(covered - latin)

    options = subset.Options()
    options.layout_features = [*options.layout_features, *EXTRA_FEATURES]
    options.flavor = "woff2"
    font = TTFont(FULL)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=sorted(covered & latin))
    subsetter.subset(font)
    font.save(LATIN_FILE)

    RANGES_FILE.parent.mkdir(parents=True, exist_ok=True)
    RANGES_FILE.write_text(
        json.dumps({"latin": LATIN, "rest": to_ranges(rest)}, indent=2) + "\n"
    )
    print(
        f"{LATIN_FILE.name}: {LATIN_FILE.stat().st_size} bytes, "
        f"{len(covered & latin)} code points; {len(rest)} left to the full font"
    )


if __name__ == "__main__":
    main()
