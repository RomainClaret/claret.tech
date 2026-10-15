import type { APIResponse, BrowserContext, Route } from "@playwright/test";

export type ChunkHandler = (
  route: Route,
  response: APIResponse,
  nth: number,
) => Promise<void>;

/**
 * Routes every chunk and hands each request for the one whose code contains
 * `marker` to `handle`, with its response and its number (1 for the first).
 * Returns the number of requests for it so far.
 *
 * A request counts once its response has been read, which is after the page
 * has asked for it: a stand-in shows its text as it mounts and starts its
 * try, so a count read the moment that text shows can still be 1 (1 run in
 * 10). Poll the count.
 */
export async function routeChunk(
  context: BrowserContext,
  marker: string,
  handle: ChunkHandler,
) {
  let requests = 0;
  await context.route(/\/_next\/static\/chunks\//, async (route) => {
    const response = await route.fetch();
    if ((await response.text()).includes(marker)) {
      await handle(route, response, ++requests);
      return;
    }
    await route.fulfill({ response });
  });
  return () => requests;
}
