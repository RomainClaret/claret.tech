"use client";

import { createContext, useContext } from "react";

/**
 * Whether the visitor can see the page: false while the splash covers it on
 * arrival (AppWrapper provides it), true everywhere else, tests included.
 * What is there only to be seen waits for it: a deep link's highlight
 * started with the link, and the splash covered about 2 of its 2.6 s.
 */
export const PageShownContext = createContext(true);

export const usePageShown = () => useContext(PageShownContext);
