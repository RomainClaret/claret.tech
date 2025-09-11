// Test script for the last-commit API endpoint

async function testLastCommitAPI() {
  try {
    console.log("Testing local API endpoint...");
    const response = await fetch("http://localhost:3000/api/last-commit");
    const data = await response.json();

    console.log("Response:", data);

    if (data.lastCommitDate) {
      console.log("✅ Success! Last commit date:", data.lastCommitDate);
    } else if (data.error) {
      console.log("⚠️  API returned with error:", data.error);
    }
  } catch (error) {
    console.error("❌ Failed to fetch:", error.message);
    console.log("\nMake sure the development server is running on port 3000");
  }
}

// Also test the GitHub API directly
async function testGitHubAPI() {
  try {
    console.log("\nTesting GitHub API directly...");
    const response = await fetch(
      "https://api.github.com/repos/RomainClaret/claret.tech/commits?per_page=1",
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`GitHub API responded with ${response.status}`);
    }

    const data = await response.json();
    if (data && data.length > 0) {
      const date = new Date(data[0].commit.author.date)
        .toISOString()
        .split("T")[0];
      console.log("✅ GitHub API works! Last commit date:", date);
      console.log("   Commit message:", data[0].commit.message);
      console.log("   Author:", data[0].commit.author.name);
    }
  } catch (error) {
    console.error("❌ GitHub API error:", error.message);
  }
}

// Run both tests
(async () => {
  await testGitHubAPI();
  console.log("\n" + "=".repeat(50) + "\n");
  await testLastCommitAPI();
})();
