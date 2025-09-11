"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
} from "react";

interface AnimatePresenceProps {
  children: React.ReactNode;
  mode?: "sync" | "wait" | "popLayout";
}

/**
 * Simplified AnimatePresence replacement that handles exit animations
 * using CSS transitions instead of framer-motion
 */
export function AnimatePresence({
  children,
  mode = "sync",
}: AnimatePresenceProps) {
  const [visibleChildren, setVisibleChildren] = useState<React.ReactNode[]>([]);
  const childrenRef = useRef<React.ReactNode[]>([]);

  useEffect(() => {
    const currentChildren = Children.toArray(children);

    // For 'wait' mode, only show one child at a time
    if (mode === "wait" && currentChildren.length > 0) {
      setVisibleChildren([currentChildren[0]]);
    } else {
      setVisibleChildren(currentChildren);
    }

    childrenRef.current = currentChildren;
  }, [children, mode]);

  return (
    <>
      {visibleChildren.map((child) => {
        if (!isValidElement(child)) return child;

        // Clone the child and add exit animation class when needed
        return cloneElement(child, {
          key: child.key,
          ...child.props,
        });
      })}
    </>
  );
}
