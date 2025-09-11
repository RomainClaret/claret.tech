// Kudos research stories and articles
// These are enhanced versions of research papers with storytelling elements

export interface KudosArticle {
  id: string;
  title: string;
  storyTitle?: string; // Alternative title for the story version
  authors: string[];
  date: string;
  doi: string;
  kudosUrl: string;
  description: string; // Short description
  storyDescription?: string; // Enhanced story description from Kudos
  highlights?: string[]; // Key findings or highlights
  perspectives?: string; // Research perspective quote
  applications?: string[]; // Potential applications
  tags?: string[];
  image?: string;
  venue?: string;
  publisher?: string;
}

export const kudosArticles: KudosArticle[] = [
  {
    id: "gecco-2024-tuning-evolution",
    title:
      "Tuning Evolution: Optimizing Algorithms for Self-Adapting Neural Networks",
    storyTitle:
      "Teaching AI to Evolve: A Journey Through 3 Billion Possibilities",
    authors: [
      "Romain Claret",
      "Michael O'Neill",
      "Paul Cotofrei",
      "Kilian Stoffel",
    ],
    date: "2024-07-01",
    doi: "10.1145/3638530.3664144",
    kudosUrl:
      "https://www.growkudos.com/publications/10.1145%252F3638530.3664144/reader",
    description:
      "Achieved 29% MNIST accuracy with ES-HyperNEAT through systematic TPE optimization, beating previous 23.90% benchmark while proving transferability to Fashion-MNIST.",
    storyDescription:
      "We explored over 3 billion configuration possibilities to enhance ES-HyperNEAT, an algorithm for evolving neural networks. Using advanced optimization techniques, we achieved better accuracy than random search and discovered that optimal settings can transfer between different tasks. This research makes evolutionary algorithms more efficient and adaptable, opening doors for autonomous vehicles, personalized healthcare, and adaptive robotics.",
    highlights: [
      "Explored over 3 billion configuration possibilities",
      "Achieved 29% MNIST accuracy, beating the previous 23.90% benchmark",
      "Demonstrated hyperparameter transferability across different datasets",
      "Advanced neuroevolution techniques for more efficient evolutionary processes",
    ],
    perspectives:
      "We are captivated by the potential of evolutionary algorithms to create neural networks that adapt both their structure and connections.",
    applications: [
      "Autonomous vehicles that adapt to new environments",
      "Healthcare systems with personalized treatment adaptation",
      "Robotics with flexible behavioral patterns",
      "Self-optimizing AI systems",
    ],
    tags: [
      "Neuroevolution",
      "ES-HyperNEAT",
      "Hyperparameter Optimization",
      "TPE",
      "MNIST",
      "Fashion-MNIST",
      "Neural Networks",
      "Evolutionary Algorithms",
    ],
    // Image will be fetched dynamically from Kudos page
    venue: "GECCO '24 Companion",
    publisher: "ACM",
  },
];

// Helper function to get Kudos widget URLs
export function getKudosWidgetUrls(doi: string) {
  const encodedDoi = encodeURIComponent(doi);
  return {
    article: `https://api.growkudos.com/widgets/article-v2/${encodedDoi}`,
    resources: `https://api.growkudos.com/widgets/resources-v2/${encodedDoi}`,
    useKudos: `https://api.growkudos.com/widgets/use_kudos/${encodedDoi}`,
  };
}

// Helper function to format Kudos article for blog display
export function formatKudosArticleForBlog(article: KudosArticle) {
  return {
    title: article.storyTitle || article.title,
    description: article.storyDescription || article.description,
    url: article.kudosUrl,
    date: article.date,
    author: "Romain Claret", // Always show just primary author for blog cards
    tags: article.tags,
    image: article.image,
    type: "research-story" as const,
    venue: article.venue,
    publisher: article.publisher,
    doi: article.doi,
    highlights: article.highlights,
    applications: article.applications,
    perspectives: article.perspectives,
  };
}
