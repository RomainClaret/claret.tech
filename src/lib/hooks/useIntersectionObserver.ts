import { useEffect, useState, useRef, RefObject } from "react";
import { logWarning } from "@/lib/utils/dev-logger";

interface UseIntersectionObserverOptions {
  threshold?: number | number[];
  root?: Element | null;
  rootMargin?: string;
}

export function useIntersectionObserver(
  options: UseIntersectionObserverOptions = {},
): [RefObject<HTMLDivElement>, boolean] {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    // Check if IntersectionObserver is supported
    if (typeof IntersectionObserver === "undefined") {
      // Only log in non-test environments to avoid test stderr pollution
      if (typeof process === "undefined" || process.env.NODE_ENV !== "test") {
        logWarning(
          "IntersectionObserver is not supported in this environment",
          "intersection-observer:unsupported",
        );
      }
      return;
    }

    let observer: IntersectionObserver;

    try {
      observer = new IntersectionObserver(
        (entries) => {
          // Handle callback errors gracefully - check for valid entries array
          if (!entries || entries.length === 0) {
            return;
          }

          const entry = entries[0];
          if (entry) {
            setIsIntersecting(entry.isIntersecting);
          }
        },
        {
          threshold: options.threshold || 0.1,
          root: options.root || null,
          rootMargin: options.rootMargin || "0px",
        },
      );

      observer.observe(target);
    } catch (error) {
      // Only log in non-test environments to avoid test stderr pollution
      if (typeof process === "undefined" || process.env.NODE_ENV !== "test") {
        logWarning(
          `Failed to create IntersectionObserver: ${error}`,
          "intersection-observer:create-failed",
        );
      }
      return;
    }

    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  }, [options.threshold, options.root, options.rootMargin]);

  return [targetRef, isIntersecting];
}
