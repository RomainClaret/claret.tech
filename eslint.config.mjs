import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "react/display-name": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  // The tests, unit and end to end. `any` stands in for what a mock does
  // not need typed; a test component may write a variable outside it to
  // hand a value to the test; mocks render a plain <img>.
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "src/test/**", "tests/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/globals": "off",
      "@next/next/no-img-element": "off",
    },
  },
  // Playwright's fixtures receive a function named `use`: not React's.
  {
    files: ["tests/**"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  // Lint covers the site's source and its tests, not the scripts.
  globalIgnores(["scripts/**/*.js", "coverage/**", ".next/**", "out/**"]),
]);
