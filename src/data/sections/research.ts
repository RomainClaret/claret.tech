// Research section data
export interface ResearchProject {
  title: string;
  subtitle: string;
  description: string;
  shortDescription?: string;
  tags: string[];
  status: "active" | "completed" | "ongoing";
  yearsSpent: number;
  links?: {
    name: string;
    url: string;
  }[];
  image?: string;
  highlights?: string[];
  icon?: string;
  color?: string;
  year?: string;
  expandedHighlightDescriptions?: string[];
}

export const researchSection = {
  display: true,
  title: "The Evolution Lab",
  subtitle: {
    highlightedText:
      "Started trying to simulate the brain. Ended up evolving intelligence",
    normalText:
      "—every field I touched was teaching me the same lesson: you can't engineer minds, you grow them.",
  },
  journeyDescription:
    "Started by breaking toys to build robots. Then breaking computers to make them smarter. Learned to code to control them. Studied physics and mathematics to simulate their brains. Dove into electronics and micro mechanics to build better bodies. Mastered computer science to let them take action. Explored AI to make them intelligent. Every step revealed I was still missing something. The lifelong obsession led to one insight: stop trying to create robots—let them evolve. Let them emerge. Watch them surprise you. Now breeding neural networks that think compositionally, that can develop their own architectures, letting robots rise from accelerated artificial selection. Why not give them billions of simulated years to evolve if we can? Current mission: making evolution 100x-1000x faster so robots can finally think for themselves, not just execute our code. From childhood tinkerer to researcher, the mission hasn't changed—just the approach. The journey from breaking toys to breeding minds taught me: you don't build intelligence, you create conditions for it to emerge. And maybe the next kid breaking toys won't wait 30+ years for answers.",
  journeyShortDescription:
    "Most researchers find their field. I had a question that wouldn't let me settle: child me wanted thinking robots. Pursued that dream through physics, mechanics, neuroscience, AI—until they all revealed the same truth: minds don't work, they evolve. The irony? Decades of education had turned me into the robot, trained to engineer things. I can't escape that mindset, but now I'm breeding artificial life into existence, watching intelligence arise—not from architecture, not from code, not from engineering, but from chaos. The way intelligence actually begins.",
  journeyBadge: "30+ Years in the Making",

  // Configuration for research section UI
  publicationNote: "Will be public upon publication",
  highlightLabels: ["Compositional", "Evolutionary", "Growing", "Lifelong"],
  highlightIcons: ["Brain", "Zap", "Shield", "Sparkles"],

  projects: [
    {
      title: "GEENNS: Compositional Intelligence Through Evolution",
      subtitle: "Lifetime Research Project (PhD Phase)",
      shortDescription:
        "Teaching neural networks to think in components, not patterns. A neuroevolution algorithm combining spatial organization with emergent architectures.",
      description:
        "Five years converging on one insight: intelligence is compositional. Humans decompose problems, delegate to mental specialists, then compose solutions. GEENNS (Grid-based Emergent Evolution of Neocortical Network Substrates) implements this computationally. Published research proved the foundation works. Now evolving the next layer: specialized networks (CPPNs) that coordinate like a mental ecosystem. Each grid becomes a time step computational network, mappers learn to connect the tasks to them, solutions emerge from internal composition. Currently making this computationally viable—compressed 8-year bottlenecks to months through systematic optimization.",
      tags: [
        "Neuroevolution",
        "Lifelong Learning",
        "Compositional AI",
        "Evolutionary Computation",
      ],
      status: "active" as const,
      yearsSpent: 5,
      icon: "Brain",
      color: "139, 92, 246",
      year: "2020-Present",
      highlights: [
        "Compositional reasoning: Decompose → Process → Recompose",
        "CPPN architecture: Mental ecosystem of specialized components",
        "Published results proving foundation",
        "Scalable implementation using JAX for high-performance computing",
      ],
      expandedHighlightDescriptions: [
        "Inspired by how humans actually solve problems. We don't memorize solutions—we break them down, process parts separately, then combine results. GEENNS does this computationally.",
        "CPPNs for connectivity patterns + 2 per task for I/O mapping. Like having specialized brain regions that coordinate. Evolution discovers optimal specializations, not me.",
        "Beat previous ES-HyperNEAT benchmark (23.90% → 29%) through systematic optimization. 2013 trials exploring 3+ billion configurations. Foundation validated, published, and proven.",
        "Identified bottlenecks (O(log n) for millions of queries). Developing O(1) solutions. TPE optimization, mixture-of-experts validation, connectivity metrics—making the impossible possible.",
      ],
      links: [
        {
          name: "GitHub Repository",
          url: "https://github.com/RomainClaret/geenns",
        },
      ],
    },
    {
      title: "GraphQA: Engineer Intelligence to Think Slow",
      subtitle: "Master's Thesis",
      shortDescription:
        "Built zero-shot conversational AI using sub-knowledge graphs. It proved to me that engineering creates brittle intelligence.",
      description:
        "While everyone was fine-tuning BERT, I spent 900+ hours building conversational AI from first principles. Zero-shot learning through pure algorithmic orchestration. Sub-knowledge graphs extracted from Wikidata. Modular architecture where specialized components handled different aspects of understanding. It worked, but that wasn't the point. Watching my engineered system take 182 seconds to answer 'What's the capital of France?'—while humans do it in 200ms—revealed the truth: intelligence doesn't follow flowcharts. You can't engineer emergence. This thesis was my last attempt at building intelligence top-down. Modular with an optimized pipeline, and still... dead. No adaptation, no surprise, just expensive graph traversal.",
      tags: [
        "NLP",
        "Conversational AI",
        "Graph-based QA",
        "Zero-Shot Learning",
      ],
      status: "completed" as const,
      yearsSpent: 1,
      icon: "Bot",
      color: "59, 130, 246",
      year: "2020",
      highlights: [
        "Sub-knowledge graphs as context holders (good idea, wrong implementation)",
        "Proved that engineering ≠ intelligence",
      ],
      links: [
        {
          name: "Read Thesis",
          url: "/pdfs/RomainClaret_Msc_Thesis.pdf",
        },
        {
          name: "Code Repository",
          url: "https://github.com/RomainClaret/mse.thesis.code",
        },
      ],
    },
    {
      title: "Overclouds: When Privacy Met Democracy",
      subtitle: "Bachelor's Thesis",
      shortDescription:
        "Built anonymous, decentralized data sharing right through the browser. It taught me distributed systems are about trust, not technology.",
      description:
        "Is it possible to provide distributed storage that prevents spying WITHOUT opening Pandora's box for illegal content? That was the question. Overclouds was born—anonymous, decentralized data sharing through any browser. No installation, no corporate servers, no single point of failure. WebRTC for peer connections, WebTorrent for distribution, Ethereum for consensus. But here's what I actually built: a foundation for digital democracy. The network votes on everything—from storage limits to banned content types—what's allowed, who's trusted, what gets preserved. A 'Data Tribunal' where random peers judge flagged content. Proof-of-Participation rewarding good behavior. The technical parts worked: encrypted chunks spreading across browsers, webapps loading from hashes, serverless peer discovery. But the real discovery? You can't engineer trust—you have to grow it through consensus. This thesis planted the seed: stop building systems, start evolving them.",
      tags: ["Blockchain", "WebRTC", "P2P Networks", "Digital Democracy"],
      status: "completed" as const,
      yearsSpent: 1,
      icon: "Shield",
      color: "245, 158, 11",
      year: "2016",
      highlights: [
        "Browser-only P2P: No software installation required",
        "Consensus everything: Network votes on rules, content, and trust",
      ],
      links: [
        {
          name: "OverClouds Project",
          url: "https://github.com/RomainClaret/OverClouds",
        },
        {
          name: "Read Thesis",
          url: "/pdfs/RomainClaret_Bsc_Thesis.pdf",
        },
      ],
    },
    {
      title: "When Senses Collide: Visual-Vestibular Integration",
      subtitle: "Pre-Undergrad Research",
      shortDescription:
        "Watched brains fuse conflicting senses into truth. First proof that intelligence emerges from integration, not selection.",
      description:
        "Fresh out of high school at Harvard's Jenks Lab, studying how brains judge motion when eyes and inner ear disagree. Expected to find one sense winning. Found something else entirely: Bayesian optimal integration. The brain weights each sense by its precision at that frequency—vision below 2 Hz, vestibular above, perfect crossover at the boundary. Not picking the best input, but mathematically fusing all inputs weighted by reliability. Months on motion platforms, thousands of trials, watching biological intelligence optimize in real-time. No algorithm programmed this behavior—evolution discovered the math. Published in J Neurophysiol while still a teenager, but the real discovery was personal: intelligence isn't about having the right sensors or the right rules. It's about integration patterns that emerge, not ones you design. The brain was already doing what I would attempt fifteen years later—specialized components (senses), dynamic weighting (Bayesian fusion), optimal integration (emergent, not engineered). I just didn't know it yet.",
      tags: [
        "Sensory Fusion",
        "Bayesian Integration",
        "Pattern Recognition",
        "Psychophysics",
      ],
      status: "completed" as const,
      yearsSpent: 1,
      icon: "Ear",
      color: "236, 72, 153",
      year: "2010",
      highlights: [
        "First exposure to emergence over engineering",
        "Proved brain performs Bayesian optimal integration naturally",
        "Discovered frequency-dependent sensory dominance crossover",
      ],
      links: [
        {
          name: "Journal Publication",
          url: "https://journals.physiology.org/doi/abs/10.1152/jn.00332.2013",
        },
        {
          name: "Conference Poster",
          url: "https://docs.google.com/gview?url=https://claret.tech/pdfs/poster_visual_vestibular_integration_in_sensory_recognition_thresholds_2010.pdf",
        },
      ],
    },
  ] as ResearchProject[],
};
