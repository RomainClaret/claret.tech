import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode: _mode }) => {
  const isCI = !!(
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.BUILD_NUMBER ||
    process.env.RUN_ID ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.TRAVIS ||
    process.env.JENKINS_URL ||
    process.env.TEAMCITY_VERSION
  );

  // Base configuration
  const baseConfig = {
    plugins: [react()],
    test: {
      environment: "jsdom" as const,
      environmentOptions: {
        jsdom: {
          url: "http://localhost:3000",
          pretendToBeVisual: true,
        },
      },
      globals: true,
      setupFiles: ["./src/test/polyfills.ts", "./src/test/setup.ts"],
      pool: "forks" as const, // Use forks for better isolation between tests
      // One fork at a time. Vitest 4 moved poolOptions to the top level; its
      // singleFork would be maxWorkers 1 with isolate off, but isolate stays
      // on below: each file gets a fresh fork, so one file's globals cannot
      // leak into the next.
      maxWorkers: 1,
      // File parallelism control
      fileParallelism: false, // Run test files sequentially
      // Timeout configuration optimized for different test types
      testTimeout: 30000, // Standardized 30s timeout
      hookTimeout: 30000, // Standardized 30s hook timeout
      teardownTimeout: 10000, // 10s teardown timeout for cleanup
      // Disable parallel execution to improve test stability
      maxConcurrency: 1, // Only 1 test at a time
      isolate: true, // Enable isolation to prevent test pollution
      // Vitest 5 caches transformed modules on disk by default
      // (node_modules/.vitest-cache) and reuses them across runs; a stale
      // entry would make a local run test old code. CI starts clean anyway.
      fsModuleCache: false,
      // Add retry for flaky tests in CI
      retry: isCI ? 1 : 0, // Retry once in CI
      // Clear and restore mocks between tests
      clearMocks: true,
      restoreMocks: true,
      mockReset: true,
      // Base exclusions - always exclude these
      exclude: [
        "**/node_modules/**",
        "**/.next/**",
        "**/tests/**",
        "**/tests-examples/**",
        "**/e2e/**",
        "**/*.spec.ts",
        // Claude Code's agent worktrees (gitignored): full copies of src/,
        // which directory filters such as `vitest run src/contexts` match.
        "**/.claude/**",
      ],
      coverage: {
        enabled: !isCI, // Disable in CI to save memory
        provider: "v8" as const,
        // Vitest 4 reports only the files the tests load unless include is
        // set: the whole source, as coverage.all did before.
        include: ["src/**/*.{ts,tsx}"],
        // Absolute: the default ("./coverage") resolves against the cwd, so a
        // run started from src/ wrote a 13 MB report to src/coverage, which no
        // ignore rule covers (.gitignore has /coverage, anchored to the root).
        reportsDirectory: path.resolve(import.meta.dirname, "coverage"),
        reporter: ["text", "json", "html"],
        exclude: [
          "node_modules/",
          ".next/",
          // Vendored and served as is (Pyodide, the pdf.js worker): v8 read
          // each one for the report and printed an ENOENT per missing
          // source map. The one tested file, sw.js, runs through
          // `new Function`, which v8 cannot attribute to it anyway.
          "public/",
          // Vitest 5 matches exclude patterns as written: "src/test/" no
          // longer covers the folder's files.
          "src/test/**",
          "**/*.d.ts",
          "**/*.config.*",
          "**/mockData.ts",
        ],
      },
      // CI-specific reporter configuration. Vitest 4's "verbose" is a flat
      // list; "tree" is what "verbose" printed before.
      reporters: isCI ? ["default"] : ["tree"],
    },
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
  };

  // Note: Removed CI-specific exclusions that were breaking explicit test commands
  // The CI workflow explicitly runs test:components, test:contexts, test:hooks, test:lib-dom
  // These commands target specific test files and need those files available

  return baseConfig;
});
