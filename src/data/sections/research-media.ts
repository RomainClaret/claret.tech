/**
 * Pictures and animations a research card's details dialog shows, by the
 * project's anchorId. Like research-details.ts, this comes with the dialog's
 * code (ResearchDetailsDialog.tsx): none of it is in the page's first
 * JavaScript, and none of the files loads before the dialog opens.
 *
 * The files are in public/images/research/<anchorId>/, which
 * Research.test.tsx holds to this list both ways. /images is served as
 * immutable for a year (next.config.mjs), so a changed file needs a new
 * name: under the old one, a returning visitor keeps the old file.
 *
 * How the breeder's exports became these files (2026-11):
 * - Pictures, 256 x 256: `cwebp -q 90 -m 6 -sharp_yuv -metadata none`, or
 *   `-lossless -z 9` where that is smaller (flat colors). The Fields view,
 *   exported at 1280 px with 10 px a cell, is cut to 256 px by
 *   `magick -filter point -resize 256x256` (2 px a cell) and saved lossless.
 * - Animations, from the breeder's lineage GIFs (Make a GIF), checked frame
 *   by frame against them:
 *   AV1: `ffmpeg -fps_mode cfr -r 5/6 -c:v libaom-av1 -crf 32 -b:v 0
 *   -cpu-used 4 -row-mt 1 -tune-content screen -pix_fmt yuv420p -an`, about
 *   a third of H.264's size. One frame per 1.2 s, the GIF's own step, so its
 *   3.6 s last frame becomes three: kept as one long frame, WebKit showed it
 *   for 1.2 s (a duration of 24.0 s where Chromium read 26.4), and at 5 fps
 *   the repeated frames doubled the file.
 *   H.264: `ffmpeg -fps_mode cfr -r 5 -c:v libx264 -preset veryslow
 *   -tune stillimage -crf 24 -profile:v high -level 4.0 -pix_fmt yuv420p
 *   -movflags +faststart -an`. A constant 5 fps because the MP4 lost the
 *   GIF's long last frame; yuv420p because from a GIF x264 picks 4:4:4,
 *   which Safari cannot play; level 4.0 because veryslow's 16 reference
 *   frames otherwise need level 5.0.
 *   Poster: the GIF's last frame, `cwebp -lossless -z 9`, smaller than lossy
 *   on these flat colors.
 */

export interface ResearchPicture {
  /** A 256 x 256 WebP. */
  src: string;
  /** What the picture shows, for screen readers. */
  alt: string;
  /** Shown under the picture, where it needs saying what it is. */
  caption?: string;
}

export interface ResearchAnimation {
  /** The video's accessible name: it takes the focus. */
  label: string;
  /**
   * In the order a browser should try them: AV1 in WebM with its codecs,
   * which a browser without AV1 skips without downloading, then H.264 in MP4
   * with none. The last resort carries no codecs: a wrong string would hide
   * it from the browsers that need it.
   */
  sources: { src: string; type: string }[];
  /** The last frame: shown before it plays, and until Play under reduced motion. */
  poster: string;
  width: number;
  height: number;
  /** Shown under it, and its description: it is silent, and its labels are small. */
  caption: string;
}

export interface ResearchMediaGroup {
  /** The section's heading in the dialog. */
  title: string;
  pictures: ResearchPicture[];
  animation?: ResearchAnimation;
}

const BREEDER = "/images/research/evolvable-vocabulary";

/** AV1 Main profile, level 3.1, 8 bits: what ffprobe reads in both films. */
const AV1_WEBM = 'video/webm; codecs="av01.0.05M.08"';

export const researchMedia: Partial<Record<string, ResearchMediaGroup[]>> = {
  "evolvable-vocabulary": [
    {
      title: "CPPN mode",
      pictures: [
        {
          src: `${BREEDER}/cppn-1.webp`,
          alt: "Teal and blue light glowing between two dark rounded shapes",
        },
        {
          src: `${BREEDER}/cppn-2.webp`,
          alt: "Thin magenta and blue edges of light curving around a dark center",
        },
        {
          src: `${BREEDER}/cppn-3.webp`,
          alt: "A glowing green ring around a dark disc, like an eye, on dark blue",
        },
        {
          src: `${BREEDER}/cppn-4.webp`,
          alt: "Blue, teal and magenta light tracing the rim of a dark hollow",
        },
        {
          src: `${BREEDER}/cppn-5.webp`,
          alt: "Concentric rings of magenta, blue and green around a small blue circle",
        },
        {
          src: `${BREEDER}/cppn-6.webp`,
          alt: "A round blue shape over two curved blue wings, with a pink patch, on bright green",
        },
        {
          src: `${BREEDER}/cppn-7.webp`,
          alt: "Folds of sky blue and crimson, like draped cloth, with dark creases",
        },
        {
          src: `${BREEDER}/g19_08.webp`,
          alt: "Rings of red, yellow and pink around a red center, broken at the sides by dark ripples",
        },
      ],
      animation: {
        label: "Animation: how g19_08 was bred in CPPN mode",
        sources: [
          { src: `${BREEDER}/g19_08-lineage.webm`, type: AV1_WEBM },
          { src: `${BREEDER}/g19_08-lineage.mp4`, type: "video/mp4" },
        ],
        poster: `${BREEDER}/g19_08-lineage.webp`,
        width: 1152,
        height: 800,
        caption:
          "How g19_08 was bred, one generation a frame from its random start. Each frame shows the picture, the CPPN that draws it, and what breeding changed: green for what was added, orange dashes for what was removed, yellow for what mutation changed, blue for what came from the second parent. Open it full screen to read the labels.",
      },
    },
    {
      title: "Substrate mode",
      pictures: [
        {
          src: `${BREEDER}/g20_05.webp`,
          alt: "Soft blobs of green, blue, orange and pink outlined in black, on yellow",
          caption: "g20_05, drawn by its substrate",
        },
        {
          src: `${BREEDER}/g20_05-fields.webp`,
          alt: "Four soft quarters: orange in two opposite corners, blue and near black in the others",
          caption:
            "Its CPPN over the substrate's plane: blue where positive, orange where negative",
        },
      ],
      animation: {
        label: "Animation: how g20_05 was bred in substrate mode",
        sources: [
          { src: `${BREEDER}/g20_05-lineage.webm`, type: AV1_WEBM },
          { src: `${BREEDER}/g20_05-lineage.mp4`, type: "video/mp4" },
        ],
        poster: `${BREEDER}/g20_05-lineage.webp`,
        width: 1200,
        height: 864,
        caption:
          "How g20_05 was bred in substrate mode. The CPPN (lower right) answers how strongly two points of a plane connect; the substrate built from its answers (lower left) draws the picture. The same colors mark what each generation changed.",
      },
    },
  ],
};
