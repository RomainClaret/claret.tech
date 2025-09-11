// Blog section data
export const blogSection = {
  display: true,
  title: "Thoughts & Tales",
  subtitle: {
    highlightedText: "The noise that doesn't fit in a paper",
    normalText:
      "—research insights, creative fiction, technical rants, philosophical spirals. Some polished, most not.",
  },
  displayMediumBlogs: true,
  displayKudosArticles: true, // Enable Kudos research stories
  mediumUsername: process.env.NEXT_PUBLIC_MEDIUM_USERNAME || "romainclaret",
  kudosProfileUrl: "https://www.growkudos.com/profile/romain_claret",
  blogs: [
    // Fallback blogs in case Medium fetch fails
    {
      url: "https://medium.com/@romainclaret",
      title: "Visit my Medium profile",
      description:
        "Check out my articles on Medium where I write about AI, research, and technology.",
      image: "",
    },
  ],
};
