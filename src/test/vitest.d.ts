/// <reference types="@testing-library/jest-dom" />

import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";
import "vitest";

declare module "vitest" {
  interface Assertion<T = unknown>
    extends TestingLibraryMatchers<
      ReturnType<typeof expect.stringContaining>,
      T
    > {
    toBeWithinRange(floor: number, ceiling: number): void;
  }

  interface AsymmetricMatchersContaining
    extends TestingLibraryMatchers<unknown, unknown> {
    toBeWithinRange(floor: number, ceiling: number): void;
  }
}
