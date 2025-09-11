// External data fetching utilities - Migrated from fetch.js
// This file handles fetching data from GitHub and Medium APIs

import fs from "fs/promises";
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
        url: string;
        id: string;
        diskUsage: number;
        primaryLanguage: {
          name: string;
          color: string;
        } | null;
      };
    }>;
  };
}

interface MediumPost {
  title: string;
  pubDate: string;
  link: string;
  guid: string;
  author: string;
  thumbnail: string;
  description: string;
  content: string;
  categories: string[];
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

// Helper function to make HTTPS requests
function httpsRequest(
  options: https.RequestOptions,
  postData?: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
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
  skipFileWrite = false,
): Promise<GitHubUser | null> {
  if (!config.useGithubData || config.useGithubData !== "true") {
    return null;
  }

  if (!config.githubUsername) {
    throw new Error(ERROR_MESSAGES.noUserName);
  }

  const query = `
    query {
      user(login: "${config.githubUsername}") {
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
                stargazers {
                  totalCount
                }
                url
                id
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
    const response = await httpsRequest(options, JSON.stringify({ query }));
    const data = JSON.parse(response);

    if (data.errors) {
      throw new Error(ERROR_MESSAGES.requestFailed);
    }

    // Save to file for build-time usage (skip in API routes)
    if (!skipFileWrite) {
      await fs.writeFile(
        "./public/profile.json",
        JSON.stringify(data, null, 2),
      );
    }

    return data.data.user;
  } catch (error) {
    logError(error, "GitHub fetch error");
    throw error;
  }
}

// Fetch Medium blog posts
export async function fetchMediumData(
  config: FetchConfig,
): Promise<MediumPost[] | null> {
  if (!config.mediumUsername) {
    return null;
  }

  const options: https.RequestOptions = {
    hostname: "api.rss2json.com",
    path: `/v1/api.json?rss_url=https://medium.com/feed/@${config.mediumUsername}`,
    port: 443,
    method: "GET",
  };

  try {
    const response = await httpsRequest(options);
    const data = JSON.parse(response);

    if (data.status !== "ok") {
      throw new Error(ERROR_MESSAGES.requestFailedMedium);
    }

    // Save to file for build-time usage
    await fs.writeFile("./public/blogs.json", JSON.stringify(data, null, 2));

    return data.items;
  } catch (error) {
    logError(error, "Medium fetch error");
    throw error;
  }
}

// Main fetch function to be called during build
export async function fetchExternalData(): Promise<void> {
  const config: FetchConfig = {
    githubToken: process.env.REACT_APP_GITHUB_TOKEN || process.env.GITHUB_TOKEN,
    githubUsername: process.env.GH_USERNAME,
    useGithubData: process.env.USE_GITHUB_DATA,
    mediumUsername: process.env.MEDIUM_USERNAME,
  };

  const promises: Promise<unknown>[] = [];

  if (config.useGithubData === "true") {
    promises.push(fetchGitHubData(config));
  }

  if (config.mediumUsername) {
    promises.push(fetchMediumData(config));
  }

  await Promise.all(promises);
}

// For Next.js build process
if (require.main === module) {
  fetchExternalData().catch((error) => {
    logError(error, "Error fetching external data");
    process.exit(1);
  });
}
