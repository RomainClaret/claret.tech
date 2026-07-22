// User system for the terminal
import { VirtualFile } from "./fileSystem";

export interface User {
  username: string;
  displayName: string;
  homeDirectory: VirtualFile;
  publicKey?: string; // For future GPG implementation
  isAdmin?: boolean;
}

// Create user-specific file systems
const createUserFileSystem = (
  username: string,
  customFiles?: { [key: string]: VirtualFile },
): VirtualFile => ({
  type: "directory",
  name: "home",
  children: {
    ".profile": {
      type: "file",
      name: ".profile",
      hidden: true,
      content: `# Profile for ${username}\n# This file is loaded when you login\n\nexport USER="${username}"\nexport HOME="/home/${username}"\n`,
    },
    ".secrets": {
      type: "file",
      name: ".secrets",
      hidden: true,
      content: `🔐 ${username}'s secret vault\n\n🐧 The colony sees everything.\n\nTry 'penguin' in the terminal, or 'cat .colony'.\n`,
    },
    ".colony": {
      type: "file",
      name: ".colony",
      hidden: true,
      content: `🐧🐧🐧🐧🐧🐧🐧\n🐧 the colony 🐧\n🐧🐧🐧🐧🐧🐧🐧\n\nAdaptation over accuracy. No flight, all survival.\n`,
    },
    "README.md": {
      type: "file",
      name: "README.md",
      content: `# Welcome, ${username}!\n\nThis is your home directory. Feel free to explore!\n`,
    },
    ...customFiles,
  },
});

// Predefined users
export const users: Record<string, User> = {
  guest: {
    username: "guest",
    displayName: "Guest User",
    homeDirectory: createUserFileSystem("guest"),
  },
};

// Get the default guest user
export const defaultUser = users.guest;

// Function to get user by username (case-insensitive)
export function getUser(username: string): User | null {
  const lowerUsername = username.toLowerCase();
  return users[lowerUsername] || null;
}

// Function to list all available usernames
export function listUsernames(): string[] {
  return Object.keys(users);
}
