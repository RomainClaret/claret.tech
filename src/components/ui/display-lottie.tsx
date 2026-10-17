"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import type { LottieRefCurrentProps } from "lottie-react";
import { withLoadFallback } from "@/lib/utils/load-fallback";
import { logError } from "@/lib/utils/dev-logger";
import { useHydrated } from "@/lib/hooks/useHydrated";

interface DisplayLottieProps {
  animationData: object;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
  onComplete?: () => void;
  width?: string | number;
  height?: string | number;
  style?: React.CSSProperties;
}

// The player's box while its code loads, and for good if that cannot be
// fetched.
const PlayerPlaceholder = () => (
  <div
    className="animate-pulse bg-transparent"
    style={{ width: "100%", height: "200px" }}
  />
);

// Dynamic imports for heavy libraries. When the player's chunk cannot be
// fetched, the animation's box stays empty and the splash plays on: React.lazy
// threw while rendering, and the error boundary around the whole site, the
// splash's nearest, replaced the page with its error screen.
const Lottie = dynamic(
  withLoadFallback(
    () => import("lottie-react").then((mod) => mod.default),
    PlayerPlaceholder,
    { onError: (error) => logError(error, "Lottie chunk") },
  ),
  { ssr: false, loading: PlayerPlaceholder },
);

export function DisplayLottie({
  animationData,
  loop = true,
  autoplay = true,
  className = "",
  onComplete,
  width = "100%",
  height = "auto",
  style = {},
}: DisplayLottieProps) {
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const isClient = useHydrated();

  useEffect(() => {
    if (lottieRef.current && !autoplay) {
      lottieRef.current.stop();
    }
  }, [autoplay]);

  const defaultStyle: React.CSSProperties = {
    width,
    height,
    backgroundColor: "transparent",
    ...style,
  };

  if (!isClient) {
    return (
      <div
        className={`${className} animate-pulse bg-transparent`}
        style={defaultStyle}
      />
    );
  }

  return (
    <div className={className} style={{ backgroundColor: "transparent" }}>
      <Lottie
        lottieRef={lottieRef}
        animationData={animationData}
        loop={loop}
        autoplay={autoplay}
        onComplete={onComplete}
        style={defaultStyle}
        rendererSettings={{
          preserveAspectRatio: "xMidYMid slice",
        }}
      />
    </div>
  );
}
