import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({ fetchGitHubData: vi.fn() }));
vi.mock("@/lib/api/fetch-external-data", () => ({
  fetchGitHubData: mocks.fetchGitHubData,
}));

import * as route from "./route";

/**
 * Projects falls back on /profile.json when /api/fetch-github fails. Nothing
 * had ever built that file, so production answered 404 and the fallback
 * could not work. The deploy build now saves it, once, from GitHub.
 */
const user = {
  name: "Romain Claret",
  pinnedItems: {
    totalCount: 1,
    edges: [{ node: { name: "emr-hyperneat", id: "R_1" } }],
  },
};

describe("GET /profile.json", () => {
  beforeEach(() => {
    vi.stubEnv("GITHUB_TOKEN", "token");
    vi.stubEnv("GH_USERNAME", "RomainClaret");
    vi.stubEnv("USE_GITHUB_DATA", "true");
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is built once, at build time", () => {
    expect(route.dynamic).toBe("force-static");
  });

  it("answers the pinned repositories in the API's shape", async () => {
    mocks.fetchGitHubData.mockResolvedValue(user);

    const response = await route.GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: user });
    // The build's env, and no file written: the answer is the snapshot.
    expect(mocks.fetchGitHubData).toHaveBeenCalledWith(
      {
        githubToken: "token",
        githubUsername: "RomainClaret",
        useGithubData: "true",
      },
      true,
    );
  });

  // As /api/fetch-github with GitHub data off: no data, and no error status,
  // which CI's e2e builds logged as a console error on every page load.
  it("answers no data, with a 200, when the build has GitHub data off", async () => {
    mocks.fetchGitHubData.mockResolvedValue(null);

    const response = await route.GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: null });
    expect(console.warn).not.toHaveBeenCalled();
  });

  // Next prerenders a 404 but runs a 5xx route on every request.
  it("answers 404, and says why in the build log, when GitHub fails", async () => {
    mocks.fetchGitHubData.mockRejectedValue(new Error("status code: 401"));

    const response = await route.GET();

    expect(response.status).toBe(404);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("profile.json"),
      "status code: 401",
    );
  });
});
