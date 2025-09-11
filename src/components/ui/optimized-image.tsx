"use client";

import Image from "next/image";
import { useState } from "react";
import { getBlurDataURL } from "@/lib/utils/image-utils";
import { cn } from "@/lib/utils";
import { logError } from "@/lib/utils/dev-logger";

interface OptimizedImageProps
  extends Omit<
    React.ImgHTMLAttributes<HTMLImageElement>,
    "src" | "alt" | "width" | "height" | "loading"
  > {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  loading?: "lazy" | "eager";
  enableBlur?: boolean;
  fallbackSrc?: string;
  crossOrigin?: "anonymous" | "use-credentials";
  placeholder?: "blur" | "empty";
  blurDataURL?: string;
  quality?: number;
}

export function OptimizedImage({
  src,
  fallbackSrc,
  alt,
  className,
  enableBlur = true,
  priority = false,
  loading = "lazy",
  fill,
  width,
  height,
  sizes,
  style,
  crossOrigin,
  placeholder,
  blurDataURL,
  quality,
  ...props
}: OptimizedImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    logError(
      `Image failed to load: ${currentSrc}`,
      "OptimizedImage.handleError",
    );

    // Try fallback if available
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      return;
    }

    // If we have a WebP image, try the PNG version
    if (currentSrc.endsWith(".webp")) {
      const pngPath = currentSrc.replace(/\.webp$/i, ".png");
      if (pngPath !== currentSrc) {
        setCurrentSrc(pngPath);
        return;
      }
    }

    // If we have a PNG image, try the JPG version
    if (currentSrc.endsWith(".png")) {
      const jpgPath = currentSrc.replace(/\.png$/i, ".jpg");
      if (jpgPath !== currentSrc) {
        setCurrentSrc(jpgPath);
        return;
      }
    }

    // All fallbacks exhausted
    setHasError(true);
    setIsLoading(false);
  };

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  // If all sources failed, show error state
  if (hasError) {
    return (
      <div
        className={cn(
          "relative overflow-hidden bg-muted/20 flex items-center justify-center",
          className,
        )}
        style={style}
      >
        <div className="text-muted-foreground text-xs text-center p-2">
          <p>Image unavailable</p>
        </div>
      </div>
    );
  }

  // Use provided placeholder and blurDataURL or defaults
  const actualPlaceholder = placeholder || (enableBlur ? "blur" : "empty");
  const actualBlurDataURL =
    blurDataURL || (enableBlur ? getBlurDataURL() : undefined);

  return (
    <Image
      {...props}
      src={currentSrc}
      alt={alt}
      fill={fill}
      width={!fill ? width : undefined}
      height={!fill ? height : undefined}
      sizes={sizes}
      className={cn(
        "transition-all duration-700",
        isLoading && enableBlur ? "scale-110 blur-lg" : "scale-100 blur-0",
        className,
      )}
      style={style}
      loading={priority ? "eager" : loading}
      priority={priority}
      placeholder={actualPlaceholder}
      blurDataURL={actualBlurDataURL}
      quality={quality}
      crossOrigin={crossOrigin}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
}
