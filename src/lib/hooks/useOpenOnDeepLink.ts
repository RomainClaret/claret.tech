"use client";

import { useState } from "react";

/**
 * A card's expanded state that opens when the card becomes the deep-linked
 * one (useCardDeepLink), in the same render, and is the reader's to toggle
 * otherwise. The earlier effect opened it one render later.
 */
export function useOpenOnDeepLink(isDeepLinked: boolean) {
  const [isExpanded, setIsExpanded] = useState(isDeepLinked);
  const [wasDeepLinked, setWasDeepLinked] = useState(isDeepLinked);
  if (isDeepLinked !== wasDeepLinked) {
    setWasDeepLinked(isDeepLinked);
    if (isDeepLinked) setIsExpanded(true);
  }
  return [isExpanded, setIsExpanded] as const;
}
