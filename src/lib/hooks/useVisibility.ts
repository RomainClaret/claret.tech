import { useEffect, useState, useRef, RefObject } from "react";

/**
 * Hook to detect if an element is visible in the viewport
 * Uses IntersectionObserver for performance
 */
export function useVisibility<T extends HTMLElement>(
  threshold: number = 0.1,
  rootMargin: string = "0px",
): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof window === "undefined") return;

    // Check if IntersectionObserver is supported
    if (!window.IntersectionObserver) {
      // Fallback: assume visible
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      {
        threshold,
        rootMargin,
      },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold, rootMargin]);

  return [ref, isVisible];
}

/**
 * Hook to detect if the page/tab is visible
 * Uses Page Visibility API
 */
export function usePageVisibility(): boolean {
  const [isPageVisible, setIsPageVisible] = useState(true);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden);
    };

    // Set initial value
    setIsPageVisible(!document.hidden);

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return isPageVisible;
}

/**
 * Hook that combines element and page visibility
 * Animation should only run when both element and page are visible
 */
export function useAnimationVisibility<T extends HTMLElement>(
  threshold: number = 0.1,
  rootMargin: string = "0px",
): [RefObject<T>, boolean] {
  const [ref, isElementVisible] = useVisibility<T>(threshold, rootMargin);
  const isPageVisible = usePageVisibility();

  return [ref, isElementVisible && isPageVisible];
}
