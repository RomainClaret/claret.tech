// Papers section data
export interface Paper {
  title: string;
  date: string;
  subtitle: string;
  shortDescription?: string; // Optional: Shows in collapsed state, expands to full subtitle
  status?: "to-appear" | "presented" | "preprint"; // Optional: explicit status badge (defaults to Published)
  anchorId?: string; // Optional: deep-link hash (BibTeX-style key), e.g. #claret2026quadtree
  paperPdf?: string; // local /pdfs/ paper PDF (renders a Read Paper chip)
  posterPdf?: string; // local /pdfs/ poster PDF (renders a Read Poster chip)
  presentationPdf?: string; // local /pdfs/ slides PDF (renders a Read Presentation chip)
  videoUrl?: string; // video presentation link, e.g. YouTube (renders a Watch Video button)
  bibtex?: string; // verbatim curated BibTeX entry (copied by the BibTeX button)
  image: string;
  footerLink: {
    name: string;
    url: string;
  }[];
}

export const papersSection = {
  display: true,
  title: "The Paper Trail",
  subtitle: {
    highlightedText: "Leaving breadcrumbs of a longer journey",
    normalText:
      "Documenting discoveries that captured what I knew at the time. Looking back, they were all converging.",
  },
  papersCards: [
    {
      title:
        "On Scaling Coordinate-Based Neuroevolution: The Quadtree Bottleneck in ES-HyperNEAT",
      date: "2026",
      status: "to-appear",
      anchorId: "claret2026quadtree",
      bibtex:
        "@article{claret2026quadtree,\n  title={On Scaling Coordinate-Based Neuroevolution: The Quadtree Bottleneck in ES-HyperNEAT},\n  author={Claret, Romain and O'Neill, Michael and Cotofrei, Paul and Stoffel, Kilian},\n  journal={arXiv preprint arXiv:XXXX.XXXXX},\n  year={2026}\n}",
      shortDescription:
        "A JAX GPU implementation (JAX-ESHN) pinpoints why ES-HyperNEAT resists scaling: each CPPN discovers its own substrate positions, blocking population-level vectorization.",
      subtitle:
        "ES-Hyper-NEAT evolves substrate topology through adaptive quadtree subdivision; no implementation with full population-level GPU parallelization exists. We present JAX-ESHN, a JAX-based implementation targeting GPU parallelization with batched CPPN queries, and benchmark it against the CPU-based PUREPLES Baseline across five tasks: XOR, Parity-3, circle classification, sine regression, and CartPole. The core limitation is structural: each CPPN discovers a unique set of substrate positions, preventing population-level vectorization via vmap. On XOR (GPU), Baseline runtime scales exponentially with depth while JAX-ESHN's construction cost (compilation plus first-generation evaluation) plateaus at deep substrates, so JAX-ESHN solves reliably where the Baseline rarely succeeds, with lower runtime variance. A CPU-vs-CPU multi-benchmark control reproduces the same steep-versus-shallow scaling divergence across Boolean, continuous, and control task types, confirming it is a property of the substrate-discovery implementation, not of GPU hardware. An alternative data structure (Hierarchical Spatial Hash Grid) fails because precomputing positions eliminates the adaptive sparsity essential to ES-HyperNEAT. These findings define the structural constraints any substrate-discovery method must satisfy to scale coordinate-based neuroevolution; the companion EMR-HyperNEAT reformulation, which replaces adaptive subdivision with eager evaluation of a static multi-resolution grid, satisfies them and resolves the bottleneck this paper characterizes.",
      image: "/images/jax_es_hyperneat.webp",
      footerLink: [
        // Re-enable once the arXiv ID is known:
        // { name: "arXiv", url: "https://arxiv.org/abs/XXXX.XXXXX" },
        {
          name: "Code",
          url: "https://github.com/RomainClaret/jax-es-hyperneat",
        },
      ],
    },
    {
      title: "Neuroevolution to Simultaneously Execute Heterogeneous Tasks",
      date: "2023",
      status: "presented",
      anchorId: "claret2023debs",
      shortDescription:
        "Scaling neuroevolution for heterogeneous tasks using a universal knowledge representation.",
      subtitle:
        "A poster presented at the 17th ACM International Conference on Distributed and Event-based Systems (DEBS 2023), June 27-30, Neuchâtel, Switzerland. It asks one question: what is an optimal approach for a universal knowledge representation in neuroevolution for various heterogeneous tasks with fixed input and output neurons? The poster proposes a nature-inspired NEAT variation built around a universal knowledge format, so the same evolved networks can perform heterogeneous tasks without task-specific wiring. Objectives: extend NEAT to context-free heterogeneous tasks, combine artificial intelligence and neuroscience research, and explore scalable artificial collective intelligence for complex environments. The methodology evaluates on task-specific and heterogeneous tasks, comparing against x-NEAT variants and deep learning models. The proposed architecture has agents collectively weaving universal knowledge, an early sketch of the GEENNS framework (Graph-Embedded Evolving Neural Networks Synergy): universal knowledge representation, multitask learning, prediction consensus, continual learning, and more.",
      image: "/images/debs_2023.webp",
      posterPdf: "/pdfs/poster_DEBS_2023.pdf",
      footerLink: [],
    },
    {
      title: "Blockchain, a techie overview",
      date: "2016",
      status: "preprint",
      anchorId: "claret2016blockchain",
      shortDescription:
        "Demystifying blockchain when everyone thought it would change everything. Technical reality vs. religious fervor.",
      subtitle:
        "Written at peak blockchain hysteria. While everyone proclaimed revolution, I documented reality: consensus mechanisms with serious trade-offs. Explored three evolutionary paths for crypto (spoiler: none are utopian), dissected verification protocols (PoW wastes energy, PoS enables plutocracy), cataloged attack vectors everyone ignored. The takeaway: blockchain is A digital consensus, not THE digital consensus. MaidSafe was already doing distributed consensus differently. The paper that said what techies were thinking but investors didn't want to hear.",
      image: "/images/paper_blockchain_2016.webp",
      paperPdf: "/pdfs/paper_blockchain_small_techie_overview_2016.pdf",
      footerLink: [],
    },
  ] as Paper[],
};
