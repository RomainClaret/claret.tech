"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { LottieRefCurrentProps } from "lottie-react";

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

// Dynamic imports for heavy libraries
const Lottie = dynamic(() => import("lottie-react"), {
  ssr: false,
  loading: () => (
    <div
      className="animate-pulse bg-transparent"
      style={{ width: "100%", height: "200px" }}
    />
  ),
});

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
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

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
