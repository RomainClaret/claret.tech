// Blog section data
import { mediumUsername } from "@/lib/utils/medium-username";

export const blogSection = {
  display: true,
  title: "Thoughts & Tales",
  subtitle: {
    highlightedText: "The noise that doesn't fit in a paper",
    normalText:
      "Research insights, creative fiction, technical rants, philosophical spirals. Some polished, most not.",
  },
  displayMediumBlogs: true,
  displayKudosArticles: true, // Enable Kudos research stories
  mediumUsername: mediumUsername(),
  kudosProfileUrl: "https://www.growkudos.com/profile/romain_claret",
  blogs: [
    // Fallback blogs in case Medium fetch fails
    {
      url: `https://medium.com/@${mediumUsername()}`,
      title: "Visit my Medium profile",
      description:
        "Research notes, fiction, and the occasional rant, on Medium.",
      image: "",
    },
  ],
};
