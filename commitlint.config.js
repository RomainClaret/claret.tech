module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Customize rules if needed
    "type-enum": [
      2,
      "always",
      [
        "feat", // New feature
        "fix", // Bug fix
        "docs", // Documentation only changes
        "style", // Changes that do not affect the meaning of the code
        "refactor", // Code change that neither fixes a bug nor adds a feature
        "perf", // Performance improvement
        "test", // Adding missing tests or correcting existing tests
        "chore", // Changes to the build process or auxiliary tools
        "revert", // Reverts a previous commit
        "build", // Changes that affect the build system or external dependencies
        "ci", // Changes to CI configuration files and scripts
      ],
    ],
    "subject-case": [
      2,
      "never",
      ["sentence-case", "start-case", "pascal-case", "upper-case"],
    ],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "type-case": [2, "always", "lower-case"],
    "type-empty": [2, "never"],
  },
};
