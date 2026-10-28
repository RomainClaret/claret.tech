// External data fetching utilities - Migrated from fetch.js
// This file handles fetching data from GitHub and Medium APIs

import https from "https";
import { logError } from "@/lib/utils/dev-logger";

interface GitHubUser {
  name: string;
  bio: string;
  avatarUrl: string;
  location: string;
  pinnedItems: {
    totalCount: number;
    edges: Array<{
      node: {
        name: string;
        description: string;
        forkCount: number;
        stargazers: {
          totalCount: number;
        };
        stargazerCount?: number;
        url: string;
        id: string;
        isPrivate?: boolean;
        diskUsage: number;
        primaryLanguage: {
          name: string;
          color: string;
        } | null;
      };
    }>;
  };
}

interface FetchConfig {
  githubToken?: string;
  githubUsername?: string;
  useGithubData?: string; // Environment variables are strings
  mediumUsername?: string;
}

const ERROR_MESSAGES = {
  noUserName:
    "GitHub Username was found to be undefined. Please set all relevant environment variables.",
  requestFailed:
    "The request to GitHub didn't succeed. Check if GitHub token in your .env file is correct.",
  requestFailedMedium:
    "The request to Medium didn't succeed. Check if Medium username in your .env file is correct.",
};

// Default timeout for external API requests (8 seconds)
const REQUEST_TIMEOUT_MS = 8000;

// Helper function to make HTTPS requests with timeout
function httpsRequest(
  options: https.RequestOptions,
  postData?: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Add timeout to request options
    const optionsWithTimeout = {
      ...options,
      timeout: REQUEST_TIMEOUT_MS,
    };

    const req = https.request(optionsWithTimeout, (res) => {
      let data = "";

      if (res.statusCode !== 200) {
        reject(new Error(`Request failed with status code: ${res.statusCode}`));
        return;
      }

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        resolve(data);
      });
    });

    // Handle timeout event
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });

    req.on("error", (error) => {
      reject(error);
    });

    if (postData) {
      req.write(postData);
    }

    req.end();
  });
}

// Fetch GitHub profile data
export async function fetchGitHubData(
  config: FetchConfig,
): Promise<GitHubUser | null> {
  if (!config.useGithubData || config.useGithubData !== "true") {
    return null;
  }

  if (!config.githubUsername) {
    throw new Error(ERROR_MESSAGES.noUserName);
  }

  const query = `
    query($username: String!) {
      user(login: $username) {
        name
        bio
        avatarUrl
        location
        pinnedItems(first: 6, types: [REPOSITORY]) {
          totalCount
          edges {
            node {
              ... on Repository {
                name
                description
                forkCount
                stargazerCount
                url
                id
                isPrivate
                diskUsage
                primaryLanguage {
                  name
                  color
                }
              }
            }
          }
        }
      }
    }
  `;

  const options: https.RequestOptions = {
    hostname: "api.github.com",
    path: "/graphql",
    port: 443,
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.githubToken}`,
      "User-Agent": "Node",
      "Content-Type": "application/json",
    },
  };

  try {
    const response = await httpsRequest(
      options,
      JSON.stringify({ query, variables: { username: config.githubUsername } }),
    );
    const data = JSON.parse(response);

    if (data.errors) {
      throw new Error(ERROR_MESSAGES.requestFailed);
    }

    // Public pins only, whatever the token can read: the answer is public
    // and cached (security audit run 1, lead 9). A pin not marked public is
    // dropped, and the count is what is kept. Stars come as stargazerCount
    // (a fine-grained token is refused the stargazers connection) and leave
    // in the stargazers.totalCount shape the cards read.
    const user = data.data.user as GitHubUser;
    const edges = user.pinnedItems.edges
      .filter((edge) => edge.node.isPrivate === false)
      .map(({ node: { stargazerCount, ...node } }) => ({
        node: { ...node, stargazers: { totalCount: stargazerCount ?? 0 } },
      }));
    return {
      ...user,
      pinnedItems: { ...user.pinnedItems, totalCount: edges.length, edges },
    };
  } catch (error) {
    // Anything token-shaped redacted, as /api/fetch-all-repos does.
    const message = error instanceof Error ? error.message : String(error);
    logError(
      new Error(
        message.replace(/\b(gh[pousr]_|github_pat_)[A-Za-z0-9_]+/g, "$1…"),
      ),
      "GitHub fetch error",
    );
    throw error;
  }
}
