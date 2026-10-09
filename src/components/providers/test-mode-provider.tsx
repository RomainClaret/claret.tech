"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useIsomorphicLayoutEffect } from "@/lib/hooks/useIsomorphicLayoutEffect";

interface TestModeContextType {
  isTestMode: boolean;
}

const TestModeContext = createContext<TestModeContextType>({
  isTestMode: false,
});

export const useTestMode = () => useContext(TestModeContext);

export function TestModeProvider({ children }: { children: React.ReactNode }) {
  // Unit tests: known at build time, the same on server and client. The
  // ?playwright=true of an end-to-end run is in the URL, which the page
  // generated at build time cannot know: read after hydration, before the
  // first paint.
  const [isTestMode, setIsTestMode] = useState(process.env.NODE_ENV === "test");
  useIsomorphicLayoutEffect(() => {
    if (
      new URLSearchParams(window.location.search).get("playwright") === "true"
    ) {
      setIsTestMode(true);
    }
  }, []);

  useEffect(() => {
    // Set data attributes after mount
    if (isTestMode && typeof window !== "undefined") {
      document.documentElement.setAttribute("data-test-mode", "true");
      document.body.setAttribute("data-test-mode", "true");
    }
  }, [isTestMode]);

  return (
    <TestModeContext.Provider value={{ isTestMode }}>
      {children}
    </TestModeContext.Provider>
  );
}
