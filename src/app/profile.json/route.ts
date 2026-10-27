import { NextResponse } from "next/server";
import { fetchGitHubData } from "@/lib/api/fetch-external-data";

/**
 * The pinned repositories as the deploy build saw them, which Projects reads
 * when /api/fetch-github fails at run time. Built once, at build time, from
 * the build's env (the deploy workflow gives it the token, GH_USERNAME and
 * USE_GITHUB_DATA), so a visit costs GitHub nothing. The answer has the API's
 * own shape.
 *
 * With GitHub data off it answers no data, as /api/fetch-github does: a 200,
 * so CI's e2e builds log no console error for it. When GitHub fails it
 * answers 404, never 5xx: Next prerenders a route's answer only below 400,
 * or a 404, and would run this handler on every request otherwise
 * (next/dist/export/routes/app-route.js).
 */
export const dynamic = "force-static";

export async function GET() {
  try {
    const data = await fetchGitHubData({
      githubToken: process.env.GITHUB_TOKEN,
      githubUsername: process.env.GH_USERNAME,
      useGithubData: process.env.USE_GITHUB_DATA,
    });
    // fetchGitHubData answers null only with USE_GITHUB_DATA off.
    return NextResponse.json({ success: true, data });
  } catch (error) {
    // GitHub down, or the token refused: this build ships no snapshot.
    console.warn(
      "profile.json: no snapshot of the pinned repositories:",
      error instanceof Error ? error.message : error,
    );
  }
  return NextResponse.json(
    { success: false, error: "No snapshot in this build" },
    { status: 404 },
  );
}
