import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  // ESLint's own recommended rules, first: typescript-eslint's config after
  // it turns off for .ts and .tsx those the compiler already checks
  // (no-undef among them).
  js.configs.recommended,
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
      // `{true && <span />}` is how a test renders a conditional child, and
      // Playwright's fixtures take a destructuring first argument, empty
      // when none is used.
      "no-constant-binary-expression": "off",
      "no-empty-pattern": "off",
    },
  },
  // Playwright's fixtures receive a function named `use`: not React's.
  {
    files: ["tests/**"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  // The CommonJS scripts (the postinstall's, the prebuild's, the
  // publications fetch): require() is how they load modules.
  {
    files: ["scripts/**/*.js"],
    languageOptions: { sourceType: "commonjs" },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Built, or copied in by the postinstall: not written here.
  globalIgnores([
    "coverage/**",
    ".next/**",
    "out/**",
    "public/pyodide/**",
    "public/pdf.worker.min.mjs",
  ]),
]);
