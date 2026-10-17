"use client";

import { Children } from "react";

interface AnimatePresenceProps {
  children: React.ReactNode;
  mode?: "sync" | "wait" | "popLayout";
}

/**
 * The site's stand-in for framer-motion's AnimatePresence, without its exit
 * animations: children show and leave in the commit that adds or removes
 * them. In "wait" mode only the first child shows. (It copied them into
 * state after each commit, one commit late.)
 */
export function AnimatePresence({
  children,
  mode = "sync",
}: AnimatePresenceProps) {
  const current = Children.toArray(children);
  return <>{mode === "wait" ? current.slice(0, 1) : current}</>;
}
