import { EventEmitter } from "node:events";
import https from "node:https";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGitHubData } from "./fetch-external-data";

/**
 * The pinned repositories reach anonymous callers of /api/fetch-github and
 * the /profile.json snapshot, both publicly cached. What GitHub answers
 * depends on the token's scope, so only public repositories may come back
 * (security audit run 1, lead 9). GitHub is faked at https.request.
 */
function answer(nodes: object[]) {
  const sent: string[] = [];
  vi.spyOn(https, "request").mockImplementation(((
    _options: unknown,
    callback: (res: EventEmitter & { statusCode: number }) => void,
  ) => {
    const req = Object.assign(new EventEmitter(), {
      write: (chunk: string) => sent.push(chunk),
      end: () => {
        const res = Object.assign(new EventEmitter(), { statusCode: 200 });
        callback(res);
        res.emit(
          "data",
          JSON.stringify({
            data: {
              user: {
                name: "R",
                pinnedItems: {
                  totalCount: nodes.length,
                  edges: nodes.map((node) => ({ node })),
                },
              },
            },
          }),
        );
        res.emit("end");
      },
      destroy: () => {},
    });
    return req;
  }) as unknown as typeof https.request);
  return sent;
}

const config = {
  githubToken: "test-token",
  githubUsername: "testuser",
  useGithubData: "true",
};

describe("fetchGitHubData", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns public pinned repositories only", async () => {
    const sent = answer([
      { name: "public-one", isPrivate: false },
      { name: "private-one", isPrivate: true },
      { name: "unmarked" },
    ]);

    const user = await fetchGitHubData(config);

    const { query, variables } = JSON.parse(sent.join(""));
    expect(query).toMatch(/\bisPrivate\b/);
    expect(variables).toEqual({ username: "testuser" });
    expect(user?.pinnedItems.edges.map((edge) => edge.node.name)).toEqual([
      "public-one",
    ]);
    expect(user?.pinnedItems.totalCount).toBe(1);
  });

  it("passes the username as a variable, not as query text", async () => {
    const sent = answer([]);

    await fetchGitHubData({ ...config, githubUsername: 'x") { id } #' });

    const { query, variables } = JSON.parse(sent.join(""));
    expect(query).not.toContain('x")');
    expect(query).toContain("user(login: $username)");
    expect(variables.username).toBe('x") { id } #');
  });
});
