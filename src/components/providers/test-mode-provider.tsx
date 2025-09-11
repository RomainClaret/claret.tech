"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface TestModeContextType {
  isTestMode: boolean;
}

const TestModeContext = createContext<TestModeContextType>({
  isTestMode: false,
});

export const useTestMode = () => useContext(TestModeContext);

export function TestModeProvider({ children }: { children: React.ReactNode }) {
  const [isTestMode] = useState(() => {
    // Initialize immediately on client
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const isPlaywright = urlParams.get("playwright") === "true";
      const isE2ETest =
        process.env.NODE_ENV === "test" ||
        window.location.search.includes("playwright");
      return isPlaywright || isE2ETest;
    }
    return false;
  });

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
