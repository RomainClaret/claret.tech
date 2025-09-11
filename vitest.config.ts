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
      poolOptions: {
        forks: {
          singleFork: true, // Use single fork for stability
          maxForks: 1, // Only 1 fork at a time
          minForks: 1,
        },
      },
      // File parallelism control
      fileParallelism: false, // Run test files sequentially
      // Timeout configuration optimized for different test types
      testTimeout: 30000, // Standardized 30s timeout
      hookTimeout: 30000, // Standardized 30s hook timeout
      teardownTimeout: 10000, // 10s teardown timeout for cleanup
      // Disable parallel execution to improve test stability
      maxConcurrency: 1, // Only 1 test at a time
      isolate: true, // Enable isolation to prevent test pollution
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
      ],
      coverage: {
        enabled: !isCI, // Disable in CI to save memory
        provider: "v8" as const,
        reporter: ["text", "json", "html"],
        exclude: [
          "node_modules/",
          ".next/",
          "src/test/",
          "**/*.d.ts",
          "**/*.config.*",
          "**/mockData.ts",
        ],
      },
      // CI-specific reporter configuration (avoiding deprecated 'basic')
      reporters: isCI ? ["default"] : ["verbose"],
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };

  // Note: Removed CI-specific exclusions that were breaking explicit test commands
  // The CI workflow explicitly runs test:components, test:contexts, test:hooks, test:lib-dom
  // These commands target specific test files and need those files available

  return baseConfig;
});
