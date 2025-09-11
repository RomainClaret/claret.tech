import { describe, it, expect } from "vitest";
import { users, defaultUser, getUser, listUsernames } from "./users";

describe("Terminal User System", () => {
  describe("users object", () => {
    it("has a guest user", () => {
      expect(users.guest).toBeDefined();
      expect(users.guest.username).toBe("guest");
      expect(users.guest.displayName).toBe("Guest User");
    });

    it("guest user has valid home directory", () => {
      const guest = users.guest;
      expect(guest.homeDirectory).toBeDefined();
      expect(guest.homeDirectory.type).toBe("directory");
      expect(guest.homeDirectory.name).toBe("home");
      expect(guest.homeDirectory.children).toBeDefined();
    });

    it("guest user home directory has expected files", () => {
      const homeDir = users.guest.homeDirectory;
      const children = homeDir.children!;

      expect(children[".profile"]).toBeDefined();
      expect(children[".secrets"]).toBeDefined();
      expect(children["README.md"]).toBeDefined();
    });

    it("guest profile file has correct content", () => {
      const profileFile = users.guest.homeDirectory.children![".profile"];
      expect(profileFile.type).toBe("file");
      expect(profileFile.hidden).toBe(true);
      expect(profileFile.content).toContain('export USER="guest"');
      expect(profileFile.content).toContain('export HOME="/home/guest"');
      expect(profileFile.content).toContain("# Profile for guest");
    });

    it("guest secrets file has correct content", () => {
      const secretsFile = users.guest.homeDirectory.children![".secrets"];
      expect(secretsFile.type).toBe("file");
      expect(secretsFile.hidden).toBe(true);
      expect(secretsFile.content).toContain("🔐 guest's secret vault");
      expect(secretsFile.content).toContain("Nothing to see here... yet.");
    });

    it("guest README has correct content", () => {
      const readmeFile = users.guest.homeDirectory.children!["README.md"];
      expect(readmeFile.type).toBe("file");
      expect(readmeFile.content).toContain("# Welcome, guest!");
      expect(readmeFile.content).toContain("This is your home directory");
    });
  });

  describe("defaultUser", () => {
    it("is the guest user", () => {
      expect(defaultUser).toBe(users.guest);
      expect(defaultUser.username).toBe("guest");
    });
  });

  describe("getUser", () => {
    it("returns guest user for valid username", () => {
      const user = getUser("guest");
      expect(user).toBe(users.guest);
      expect(user?.username).toBe("guest");
    });

    it("is case insensitive", () => {
      expect(getUser("GUEST")).toBe(users.guest);
      expect(getUser("Guest")).toBe(users.guest);
      expect(getUser("gUeSt")).toBe(users.guest);
    });

    it("returns null for non-existent user", () => {
      expect(getUser("nonexistent")).toBeNull();
      expect(getUser("admin")).toBeNull();
      expect(getUser("user")).toBeNull();
      expect(getUser("")).toBeNull();
    });

    it("handles special characters gracefully", () => {
      expect(getUser("guest@domain.com")).toBeNull();
      expect(getUser("guest-user")).toBeNull();
      expect(getUser("guest_user")).toBeNull();
    });
  });

  describe("listUsernames", () => {
    it("returns array with guest username", () => {
      const usernames = listUsernames();
      expect(Array.isArray(usernames)).toBe(true);
      expect(usernames).toContain("guest");
    });

    it("has correct number of users", () => {
      const usernames = listUsernames();
      expect(usernames.length).toBe(Object.keys(users).length);
    });

    it("matches users object keys", () => {
      const usernames = listUsernames();
      const usersKeys = Object.keys(users);
      expect(usernames.sort()).toEqual(usersKeys.sort());
    });
  });

  describe("User interface", () => {
    it("guest user has all required properties", () => {
      const guest = users.guest;
      expect(guest.username).toBeDefined();
      expect(guest.displayName).toBeDefined();
      expect(guest.homeDirectory).toBeDefined();

      // Optional properties
      expect(guest.publicKey).toBeUndefined();
      expect(guest.isAdmin).toBeUndefined();
    });

    it("home directory follows VirtualFile interface", () => {
      const homeDir = users.guest.homeDirectory;
      expect(homeDir.type).toBe("directory");
      expect(homeDir.name).toBe("home");
      expect(homeDir.children).toBeDefined();
      expect(typeof homeDir.children).toBe("object");
    });
  });

  describe("Home directory file structure", () => {
    it("hidden files are properly marked", () => {
      const children = users.guest.homeDirectory.children!;
      expect(children[".profile"].hidden).toBe(true);
      expect(children[".secrets"].hidden).toBe(true);
      expect(children["README.md"].hidden).toBeUndefined();
    });

    it("all files have correct type", () => {
      const children = users.guest.homeDirectory.children!;
      Object.values(children).forEach((file) => {
        expect(["file", "directory"]).toContain(file.type);
      });
    });

    it("all files have names", () => {
      const children = users.guest.homeDirectory.children!;
      Object.values(children).forEach((file) => {
        expect(file.name).toBeDefined();
        expect(typeof file.name).toBe("string");
        expect(file.name.length).toBeGreaterThan(0);
      });
    });

    it("files have content", () => {
      const children = users.guest.homeDirectory.children!;
      [".profile", ".secrets", "README.md"].forEach((fileName) => {
        const file = children[fileName];
        expect(file.content).toBeDefined();
        expect(typeof file.content).toBe("string");
        expect(file.content!.length).toBeGreaterThan(0);
      });
    });
  });
});
