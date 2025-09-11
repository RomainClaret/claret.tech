// Papers section data
export interface Paper {
  title: string;
  date: string;
  subtitle: string;
  shortDescription?: string; // Optional: Shows in collapsed state, expands to full subtitle
  image: string;
  footerLink: {
    name: string;
    url: string;
  }[];
}

export const papersSection = {
  display: true,
  title: "Academic Contributions",
  subtitle: {
    highlightedText: "Leaving breadcrumbs of a longer journey",
    normalText:
      "—documenting discoveries that captured what I knew at the time. Looking back, they were all converging.",
  },
  papersCards: [
    {
      title: "Blockchain, a techie overview",
      date: "2016",
      shortDescription:
        "Demystifying blockchain when everyone thought it would change everything. Technical reality vs. religious fervor.",
      subtitle:
        "Written at peak blockchain hysteria. While everyone proclaimed revolution, I documented reality: consensus mechanisms with serious trade-offs. Explored three evolutionary paths for crypto (spoiler: none are utopian), dissected verification protocols (PoW wastes energy, PoS enables plutocracy), catalogued attack vectors everyone ignored. Key insight: blockchain is A digital consensus, not THE digital consensus. MaidSafe was already doing distributed consensus differently. The paper that said what techies were thinking but investors didn't want to hear.",
      image: "/images/paper_blockchain_2016.webp",
      footerLink: [
        {
          name: "Paper",
          url: "/pdfs/paper_blockchain_small_techie_overview_2016.pdf",
        },
      ],
    },
  ] as Paper[],
};
