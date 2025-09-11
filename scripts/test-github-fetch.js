// Test script for GitHub data fetching
async function testFetch() {
  // Load environment variables from .env.local if available
  try {
    const { config } = await import("dotenv");
    config({ path: ".env.local" });
  } catch (e) {
    console.log("dotenv not available, using existing environment variables");
  }

  // Ensure required environment variables are set
  if (!process.env.GITHUB_TOKEN) {
    console.error("❌ GITHUB_TOKEN environment variable is required");
    console.log("Please add GITHUB_TOKEN=your_token_here to .env.local");
    process.exit(1);
  }

  if (!process.env.GH_USERNAME) {
    process.env.GH_USERNAME = "RomainClaret"; // fallback
  }

  if (!process.env.USE_GITHUB_DATA) {
    process.env.USE_GITHUB_DATA = "true"; // fallback
  }

  console.log("Testing GitHub fetch with:");
  console.log("- Username:", process.env.GH_USERNAME);
  console.log(
    "- Token:",
    process.env.GITHUB_TOKEN ? "Set (hidden)" : "Not set",
  );
  console.log("- USE_GITHUB_DATA:", process.env.USE_GITHUB_DATA);

  try {
    const { fetchGitHubData } = await import(
      "../src/lib/api/fetch-external-data.ts"
    );

    const config = {
      githubToken: process.env.GITHUB_TOKEN,
      githubUsername: process.env.GH_USERNAME,
      useGithubData: process.env.USE_GITHUB_DATA,
    };

    const data = await fetchGitHubData(config);
    console.log("\nFetch successful!");
    console.log("User data:", {
      name: data?.name,
      bio: data?.bio?.substring(0, 50) + "...",
      location: data?.location,
      pinnedRepos: data?.pinnedItems?.edges?.length || 0,
    });
  } catch (error) {
    console.error("\nFetch failed:", error.message);
  }
}

testFetch();
