"use client";

import { useId, type KeyboardEvent } from "react";
import { DetailsSection } from "@/components/ui/details-dialog";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import type {
  ResearchAnimation,
  ResearchMediaGroup,
} from "@/data/sections/research-media";

/** Every picture is a 256 x 256 square (research-media.ts). */
const PICTURE_SIZE = 256;

/**
 * A research card's pictures and animations, in its details dialog
 * (research-media.ts): one section a group, its pictures in a grid, then its
 * animation. Plain <img>: the files are already at about their display size,
 * and the image optimizer's transformations are counted on the site's plan
 * (next.config.mjs).
 */
export function ResearchMedia({ groups }: { groups: ResearchMediaGroup[] }) {
  return (
    <>
      {groups.map((group) => (
        <DetailsSection key={group.title} title={group.title}>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {group.pictures.map((picture) => (
              <li key={picture.src}>
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={picture.src}
                    alt={picture.alt}
                    width={PICTURE_SIZE}
                    height={PICTURE_SIZE}
                    decoding="async"
                    className="aspect-square w-full rounded-lg border border-border object-cover"
                  />
                  {picture.caption && (
                    <figcaption className="mt-1 text-xs text-muted-foreground">
                      {picture.caption}
                    </figcaption>
                  )}
                </figure>
              </li>
            ))}
          </ul>
          {group.animation && <Animation animation={group.animation} />}
        </DetailsSection>
      ))}
    </>
  );
}

/**
 * A lineage animation: a silent video with the browser's own controls, which
 * pause it (WCAG 2.2.2), scrub through the generations and go full screen,
 * where its small labels are readable.
 *
 * It plays by itself, muted and looping, unless the visitor asks for reduced
 * motion: then it waits on its poster, its last frame, downloads nothing,
 * and Play is the visitor's, as with the skills manifesto. The setting comes
 * from the system (useReducedMotion), not from useAnimationGate: an open
 * dialog holds the page's motion gate (useOverlayLock), so the gate would
 * keep every animation in a dialog still.
 *
 * tabIndex 0: the dialog's focus trap (useModalDialog) moves only between
 * elements whose tabIndex is 0, and a video's is -1 by default, so Tab never
 * reached it. Focused, Space or Enter plays and pauses it (playOrPause).
 */
function Animation({ animation }: { animation: ResearchAnimation }) {
  const reduceMotion = useReducedMotion();
  const captionId = useId();

  return (
    <figure className="mt-4">
      <video
        controls
        muted
        loop
        playsInline
        tabIndex={0}
        onKeyDownCapture={playOrPause}
        onKeyUp={playOrPause}
        aria-label={animation.label}
        aria-describedby={captionId}
        autoPlay={!reduceMotion}
        preload={reduceMotion ? "none" : "auto"}
        poster={animation.poster}
        width={animation.width}
        height={animation.height}
        className="h-auto w-full rounded-lg border border-border bg-muted"
      >
        {animation.sources.map((source) => (
          <source key={source.src} src={source.src} type={source.type} />
        ))}
      </video>
      <figcaption
        id={captionId}
        className="mt-2 text-xs leading-relaxed text-muted-foreground"
      >
        {animation.caption}
      </figcaption>
    </figure>
  );
}

/**
 * Space or Enter on a focused animation plays or pauses it, once a press, on
 * the key's release. Chromium does that for Space by itself, WebKit does not
 * (Playwright's WebKit on macOS, 2026-11-04): a keyboard could reach the
 * video there but never stop it. So both halves of the press are handled
 * here, and the keydown is prevented in the capture phase, before it reaches
 * the video: Chromium toggles from a listener on the video itself, which a
 * handler at the root runs after, so its toggle came first and this one
 * undid it (paused, then played again). Prevented that early, Chromium
 * leaves it, and the dialog does not scroll. A held key repeats its keydown
 * only, so it still toggles once.
 */
function playOrPause(event: KeyboardEvent<HTMLVideoElement>) {
  if (event.key !== " " && event.key !== "Enter") return;
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  event.preventDefault();
  if (event.type !== "keyup") return;
  const video = event.currentTarget;
  if (video.paused) {
    // Refused (no decoder for either file, a power-saving mode): the
    // controls go on showing it paused, which is the truth.
    video.play().catch(() => {});
  } else {
    video.pause();
  }
}
