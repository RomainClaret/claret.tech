// Theme configuration - Migrated from _globalColor.scss
// This file contains all color and theme variables for the portfolio

export const theme = {
  colors: {
    // Button colors
    button: {
      primary: "#55198b",
      hover: "#8c43ce",
      topHover: "#000000",
    },

    // Text colors for light theme
    light: {
      title: "#000000",
      text: "#000000",
      subtitle: "#868e96",
      cardSubtitle: "#666666",
      talkCardSubtitle: "#7f8287",
      blogCardTitle: "#262626",
    },

    // Text colors for dark theme
    dark: {
      text: "#ffffff",
    },

    // Toggle switch
    toggle: {
      check: "#2196f3",
      sliderBg: "#cccccc",
    },

    // GitHub specific colors
    github: {
      repoCardLanguageBg: "#0000ff",
      repoCardColor: "rgb(88, 96, 105)",
      repoCardStatsColor: "rgb(106, 115, 125)",
      repoNameColor: "rgb(36, 41, 46)",
      profileCardLocationText: "#ffebcd",
      profileCardBorder: "#6c63ff",
    },

    // Background colors
    background: {
      light: {
        primary: "#ffffff",
        secondary: "rgb(255, 255, 255)",
        tertiary: "#f5f2f4",
      },
      dark: {
        primary: "#171c28",
      },
      blogCardContainer: "#586069",
    },

    // Box shadows
    shadows: {
      light: {
        default: "rgba(0, 0, 0, 0.1)",
        dark: "rgba(0, 0, 0, 0.2)",
        darker: "rgba(0, 0, 0, 0.3)",
      },
      dark: {
        default: "#d9dbdf",
        secondary: "#ffffff",
      },
    },

    // Gradients
    gradients: {
      primary: "linear-gradient(270deg, #8c43ce 0%, #55198b 100%)",
      buttonCard: "linear-gradient(270deg, #55198b 0%, #55198b 100%)",
      header: "linear-gradient(270deg, #171c28 0%, #171c28 100%)",
      socialMediaCard: "linear-gradient(270deg, #00C9FF 0%, #92FE9D 100%)",
    },

    // Social media brand colors
    socialMedia: {
      facebook: "#3b5998",
      instagram: "#e4405f",
      linkedin: "#0077b5",
      twitter: "#1da1f2",
      medium: "#00ab6c",
      github: "#333333",
      gitlab: "#fc6d26",
      stackoverflow: "#f48024",
      orcid: "#a6ce39",
    },

    // Additional UI colors
    ui: {
      border: "#e0e0e0",
      divider: "rgba(0, 0, 0, 0.12)",
      disabled: "rgba(0, 0, 0, 0.26)",
      hint: "rgba(0, 0, 0, 0.54)",
      icon: "rgba(0, 0, 0, 0.54)",
      selected: "rgba(0, 0, 0, 0.08)",
    },
  },

  // Typography
  typography: {
    fontFamily: {
      primary:
        'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      code: '"JetBrains Mono", "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    },
    fontSize: {
      xs: "0.75rem", // 12px
      sm: "0.875rem", // 14px
      base: "1rem", // 16px
      lg: "1.125rem", // 18px
      xl: "1.25rem", // 20px
      "2xl": "1.5rem", // 24px
      "3xl": "1.875rem", // 30px
      "4xl": "2.25rem", // 36px
      "5xl": "3rem", // 48px
      "6xl": "3.75rem", // 60px
      "7xl": "4.5rem", // 72px
      "8xl": "6rem", // 96px
      "9xl": "8rem", // 128px
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
    lineHeight: {
      none: 1,
      tight: 1.25,
      snug: 1.375,
      normal: 1.5,
      relaxed: 1.625,
      loose: 2,
    },
  },

  // Spacing scale
  spacing: {
    0: "0px",
    1: "0.25rem", // 4px
    2: "0.5rem", // 8px
    3: "0.75rem", // 12px
    4: "1rem", // 16px
    5: "1.25rem", // 20px
    6: "1.5rem", // 24px
    7: "1.75rem", // 28px
    8: "2rem", // 32px
    9: "2.25rem", // 36px
    10: "2.5rem", // 40px
    12: "3rem", // 48px
    16: "4rem", // 64px
    20: "5rem", // 80px
    24: "6rem", // 96px
    32: "8rem", // 128px
    40: "10rem", // 160px
    48: "12rem", // 192px
    56: "14rem", // 224px
    64: "16rem", // 256px
  },

  // Border radius
  borderRadius: {
    none: "0px",
    sm: "0.125rem", // 2px
    default: "0.25rem", // 4px
    md: "0.375rem", // 6px
    lg: "0.5rem", // 8px
    xl: "0.75rem", // 12px
    "2xl": "1rem", // 16px
    "3xl": "1.5rem", // 24px
    full: "9999px",
  },

  // Breakpoints
  breakpoints: {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1536px",
  },

  // Z-index scale
  zIndex: {
    0: 0,
    10: 10,
    20: 20,
    30: 30,
    40: 40,
    50: 50,
    auto: "auto",
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modal: 1040,
    popover: 1050,
    tooltip: 1060,
  },
};

// Helper function to get theme value
export const getThemeValue = (path: string) => {
  const keys = path.split(".");
  let value: Record<string, unknown> = theme as Record<string, unknown>;

  for (const key of keys) {
    value = value[key] as Record<string, unknown>;
    if (!value) return undefined;
  }

  return value;
};

// CSS variables for dynamic theming
export const generateCSSVariables = (isDark: boolean) => {
  const root = document.documentElement;

  // Text colors
  root.style.setProperty(
    "--color-text-primary",
    isDark ? theme.colors.dark.text : theme.colors.light.text,
  );
  root.style.setProperty(
    "--color-text-secondary",
    isDark ? theme.colors.dark.text : theme.colors.light.subtitle,
  );
  root.style.setProperty(
    "--color-text-title",
    isDark ? theme.colors.dark.text : theme.colors.light.title,
  );

  // Background colors
  root.style.setProperty(
    "--color-bg-primary",
    isDark
      ? theme.colors.background.dark.primary
      : theme.colors.background.light.primary,
  );
  root.style.setProperty(
    "--color-bg-secondary",
    isDark
      ? theme.colors.background.dark.primary
      : theme.colors.background.light.secondary,
  );

  // Shadows
  root.style.setProperty(
    "--shadow-default",
    isDark
      ? theme.colors.shadows.dark.default
      : theme.colors.shadows.light.default,
  );
};

export default theme;
