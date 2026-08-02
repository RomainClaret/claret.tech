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
  /**
   * Deep-link hash for this project, e.g. #geenns. Same idea as
   * `Paper.anchorId` and `WorkExperience.anchorId`. Once a value is published,
   * treat it as permanent: people share these.
   */
  anchorId?: string;
}

export const researchSection = {
  display: true,
  title: "The Evolution Lab",
  subtitle: {
    highlightedText:
      "Started trying to simulate the brain. Ended up evolving intelligence",
    normalText:
      "Every field I touched taught me the same lesson: minds have to grow. Engineering them top-down never worked for me.",
  },
  journeyDescription:
    "Started by breaking toys to build robots. Then breaking computers to make them smarter. Learned to code to control them. Studied physics and mathematics to simulate their brains. Dove into electronics and micro mechanics to build better bodies. Mastered computer science to let them take action. Explored AI to make them intelligent. Every step revealed I was still missing something. The lifelong obsession led to one insight: stop trying to create robots. Set the conditions, let them evolve, and pay attention to what shows up. Now breeding neural networks that think compositionally, that can develop their own architectures, letting robots rise from accelerated artificial selection. Why not give them billions of simulated years to evolve if we can? Current mission: making evolution 100x-1000x faster so robots can finally think for themselves instead of executing our code. From childhood tinkerer to researcher, the mission hasn't changed. Just the approach. The journey from breaking toys to breeding minds taught me to create the conditions for intelligence to emerge; building it directly kept failing. And maybe the next kid breaking toys won't wait 30+ years for answers.",
  journeyShortDescription:
    "Most researchers find their field. I had a question that wouldn't let me settle: child me wanted thinking robots. Pursued that dream through physics, mechanics, neuroscience, AI, until they all revealed the same truth: minds evolve into existence. The irony? Decades of education had turned me into the robot, trained to engineer things. I can't escape that mindset, but now I'm breeding artificial life into existence, watching behavior arise from chaos rather than from architecture, code, or engineering. Whether that is where intelligence actually begins is the question, not the conclusion.",
  journeyBadge: "30+ Years in the Making",

  // Configuration for research section UI
  publicationNote: "Will be public upon publication",
  highlightLabels: ["Compositional", "Evolutionary", "Growing", "Lifelong"],
  highlightIcons: ["Brain", "Zap", "Shield", "Sparkles"],

  projects: [
    {
      title: "GEENNS: Compositional Intelligence Through Evolution",
      anchorId: "geenns",
      subtitle: "Lifetime Research Project (Post-PhD Phase)",
      shortDescription:
        "Intelligence is not one big network. It is a collaboration of specialists that evolution grows, freezes, and learns to recombine. GEENNS pushes that to its hard edge: get the collaboration itself to emerge, so behavior comes from evolution rather than from copying us or a dataset. The PhD proved the parts can be frozen and reused. Making the whole emerge is the work now.",
      description:
        "After years of chasing thinking machines, one lesson stuck: you grow a mind, you do not wire it together. GEENNS (Grid-based Emergent Evolution of Neocortical Network Substrates) takes that literally. Evolution grows small specialist networks, inspired by the repeated microcircuits of the cortex, freezes them, then evolves separate coordinators that decide how to combine them for each new task. Nothing is hand-designed: the specialists and the way they cooperate are both discovered by evolution, not by me. The PhD is the proof of concept, and it works. Frozen specialists, composed by evolved coordinators, solve problems a single network cannot, and the same specialists carry over to new tasks without retraining. The frontier I am on now is the harder half: getting the collaboration itself to emerge. Specialists that carve out their own roles without being told to. Coordination that transfers to problems it has never seen. Behavior that, when it shows up on its own, is worth studying for what it is, not for how closely it imitates a human or a training set. Further out sits the long vision: substrates that grow their own architecture and keep adapting, so knowledge accumulates as reusable, evolvable components instead of weights that get overwritten, and a mind can learn across a lifetime without forgetting what it already knew.",
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
        "A mind as a team of specialists: split a problem into parts, hand each to a network that grew for it, then combine their answers",
        "Grown, not engineered: evolution discovers the specialists and how they cooperate, so behavior emerges instead of being coded",
        "The live frontier: roles that specialists claim on their own, coordination that carries to unseen problems, wholes that outdo their parts",
        "Freeze and reuse: settled specialists stay fixed while new tasks only add coordination, a path to learning across a lifetime without forgetting",
      ],
      expandedHighlightDescriptions: [
        "The bet is easy to say and hard to earn: intelligence is a collaboration of specialists, and the collaboration itself has to be evolvable. A problem gets split, handed to networks that each grew for a piece of it, and their answers composed into one. The proof of concept already does this, evolved specialists solving compound problems that a single network fails.",
        "I design nothing by hand. Evolution grows each specialist's wiring, and evolution grows the coordinators that decide how the specialists work together. My job is to set the conditions and the pressure, then watch what the search finds. The structure and the cooperation are discovered, not authored.",
        "Each specialist is a small evolved circuit repeated across a grid, inspired by the cortex without copying it: one template, many behaviors, depending on how it gets wired in. The roadmap lets these substrates grow and adapt like living tissue rather than sit as fixed graphs, so a network can develop and keep changing after it is born.",
        "For a new task the specialists stay frozen and only the coordination evolves, so hard-won skills are reused instead of retrained. That is the road to learning across a lifetime without overwriting the past. The honest status: today's composition is still task-specific, but the signal for something more general is already there in the population, and pulling it out into genuine emergent reasoning is the open problem I am on.",
      ],
      links: [
        {
          name: "GitHub Repository",
          url: "https://github.com/RomainClaret/geenns",
        },
        {
          name: "Read the Introduction in PhD Thesis (Chapter 7)",
          url: "/pdfs/RomainClaret_PhD_Thesis_chapter_7.pdf",
        },
      ],
    },
    {
      title: "Emerging Behaviors: Intelligence Without a Human Template",
      anchorId: "emerging-behaviors",
      subtitle: "Active Research Direction",
      shortDescription:
        "Networks that are grown rather than trained never see human data, so what they do has no obligation to resemble anything we would recognize. I study that on its own terms. The open problem is telling behavior that is genuinely new from behavior that only looks new to us, because every measure we have is calibrated on human data.",
      description:
        "An evolutionary algorithm keeps a population of candidate networks, varies them at random, keeps the ones that do best, and repeats. Nothing in that loop ever sees human data. The networks are grown, not trained, so nothing in the process shapes them toward looking intelligent to us. Mostly they do not, and that is the part worth studying rather than the part to correct. We mostly judge machine intelligence by how closely it resembles our own. That works while machines learn from our data, and fails for anything that does not. The thesis work made these systems fast enough to run at a scale where their behavior is worth looking at. What is missing is a way to tell whether what they do is genuinely new or only looks new to us. That turns out to be a measurement problem rather than a philosophical one. The common approach scores novelty by asking a large model how unusual something looks. That measures distance in a space the model learned from us, so behavior lying outside it has no coordinates there and cannot be separated from noise. Apparent emergence then says more about the instrument than about the system. So the work is an instrument that never looks at human data, and a test system small enough to calibrate it on. Today I have the systems and the claim. I do not have the measure, which is why I keep saying evolution finds behaviors I never programmed and cannot yet prove it.",
      tags: [
        "Artificial Life",
        "Emergence",
        "Open-Endedness",
        "Evaluation",
        "Neuroevolution",
      ],
      status: "active" as const,
      yearsSpent: 1,
      icon: "Sparkles",
      color: "34, 197, 94",
      year: "2026-Present",
      highlights: [
        "Grown, not trained: nothing in the evolutionary loop ever sees human data",
        "Judged on its own terms: resemblance to human behavior is a poor test for a system that never learned from humans",
        "The instrument problem: novelty scored by a large model measures distance in a space learned from us, so anything outside it reads as noise",
        "The aim: a measure that never appeals to human data, and a system simple enough to calibrate it on",
      ],
      expandedHighlightDescriptions: [
        "An evolutionary algorithm keeps a population of candidate networks, varies them at random, keeps the ones that do best, and repeats. There is no training set anywhere in that loop and no human demonstration to copy. Whatever the population settles on came out of selection pressure and the task, so it has no particular reason to look like anything a person would have written.",
        "Judging machine intelligence by how closely it resembles our own is a reasonable test while a system learns from our data. It stops being reasonable for a system that never did. A network solving a task in a way nobody would recognize has not failed that test. The test was aimed at something else.",
        "The common way to score novelty is to ask a large model how unusual something looks. That measures distance in a space the model learned from us, so behavior falling outside the space has no coordinates in it and cannot be told apart from noise. Whatever the instrument was not built to see gets recorded as nothing, and what survives the filter is mostly whatever happened to resemble us.",
        "So the work is a measure that never appeals to human data at any step, and a system small enough that I can check the measure against something I already understand. Calibration is the harder half, because an instrument nobody can validate is just a number with a story attached. Today I have the systems and the claim, and not the measure.",
      ],
    },
    {
      title: "Scaling Adaptive Substrate Neuroevolution",
      anchorId: "phd-thesis",
      subtitle: "PhD Thesis",
      shortDescription:
        "Grow a big network from a tiny recipe, the way DNA grows a body. It never worked in practice. My thesis diagnoses why, then redesigns it to run at real scale.",
      description:
        "A small evolved recipe, DNA-like, can generate a large network's substrate (its neuron placement and connections), scaling far beyond hand-design. The promise is real; the practical utility was not. This thesis examines ES-HyperNEAT, the canonical algorithm, and identifies three structural barriers. First, the performance ceiling on tasks like MNIST is structural, not a search failure: extensive Bayesian hyperparameter optimization cannot break it. Second, a central bias: the encoding's generators all peak at the image center, so evolved substrates collapse onto a small central cluster of inputs, blind to the rest; partitioning the input across region-specialized experts more than doubles accuracy. Third, the quadtree produces a different graph per genome, which parallel hardware cannot batch. EMR-HyperNEAT resolves this by inverting substrate discovery (evaluate a fixed grid of candidate positions in parallel and filter by variance), turning the substrate into a tensor that runs on any JAX-supported hardware. Because the substrate is now a tensor, biological mechanisms (recurrence, per-node functions, neuromodulation) become columns appended to a matrix rather than algorithm redesigns, and substrates can be frozen and recombined by evolved mappers: the door to GEENNS. The contribution is diagnostic, not competitive: indirect encoding will not outperform gradient-trained systems yet, but adaptive substrate neuroevolution can now run at the scale where its broader question becomes tractable.",
      tags: [
        "EMR-HyperNEAT",
        "Neuroevolution",
        "Bio-inspired",
        "ES-HyperNEAT",
        "Scaling",
        "GPU Acceleration",
      ],
      status: "completed" as const,
      yearsSpent: 5.7,
      icon: "Scaling",
      color: "59, 130, 246",
      year: "2026",
      highlights: [
        "Showed ES-HyperNEAT's accuracy ceiling is structural, not a hyperparameter-search failure",
        "Diagnosed the central bias: evolved substrates collapse onto a central cluster of inputs, blind to most of the image by construction",
        "Partitioned the input across region-specialized experts, substantially improving accuracy by breaking the central collapse",
        "Reformulated substrate discovery (EMR-HyperNEAT) for parallel hardware: per-generation GPU speedup, plus a tensor substrate representation that admits new extensions like recurrence, per-node functions, and neuromodulation",
        "Opened the door to GEENNS: substrates can be frozen and recombined by evolved mapper networks for compositional reuse",
      ],
      links: [
        {
          name: "Read Thesis",
          url: "/pdfs/RomainClaret_PhD_Thesis.pdf",
        },
        {
          name: "EMR-HyperNEAT",
          url: "https://github.com/RomainClaret/emr-hyperneat",
        },
        {
          name: "ES-HyperNEAT Studies",
          url: "https://github.com/RomainClaret/es-hyperneat-optimization-studies",
        },
        {
          name: "JAX-ES-HyperNEAT Repository",
          url: "https://github.com/RomainClaret/jax-es-hyperneat",
        },
      ],
    },
    {
      title: "GraphQA: Engineer Intelligence to Think Slow",
      anchorId: "graphqa",
      subtitle: "Master's Thesis",
      shortDescription:
        "Built zero-shot conversational AI using sub-knowledge graphs. It proved to me that engineering creates brittle intelligence.",
      description:
        "While everyone was fine-tuning BERT, I spent 900+ hours building conversational AI from first principles. Zero-shot learning through pure algorithmic orchestration. Sub-knowledge graphs extracted from Wikidata. Modular architecture where specialized components handled different aspects of understanding. It worked, but that wasn't the point. Watching my engineered system take 182 seconds to answer 'What's the capital of France?' while humans do it in 200ms revealed the truth: intelligence doesn't follow flowcharts. You can't engineer emergence. This thesis was my last attempt at building intelligence top-down. Modular with an optimized pipeline, and still... dead. No adaptation, no surprise, just expensive graph traversal.",
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
      anchorId: "overclouds",
      subtitle: "Bachelor's Thesis",
      shortDescription:
        "Built anonymous, decentralized data sharing right through the browser. It taught me that distributed systems stand or fall on trust.",
      description:
        "Is it possible to provide distributed storage that prevents spying WITHOUT opening Pandora's box for illegal content? That was the question. Overclouds was born: anonymous, decentralized data sharing through any browser. No installation, no corporate servers, no single point of failure. WebRTC for peer connections, WebTorrent for distribution, Ethereum for consensus. But here's what I actually built: a foundation for digital democracy. The network votes on everything, from storage limits to banned content types, what's allowed, who's trusted, what gets preserved. A 'Data Tribunal' where random peers judge flagged content. Proof-of-Participation rewarding good behavior. The technical parts worked: encrypted chunks spreading across browsers, webapps loading from hashes, serverless peer discovery. But the real discovery? Trust resisted engineering; it grew through consensus. This thesis planted the seed: evolve systems instead of building them.",
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
          name: "Read Thesis",
          url: "/pdfs/RomainClaret_Bsc_Thesis.pdf",
        },
        {
          name: "Code Repository",
          url: "https://github.com/RomainClaret/OverClouds",
        },
      ],
    },
    {
      title: "When Senses Collide: Visual-Vestibular Integration",
      anchorId: "vestibular-integration",
      subtitle: "Pre-Undergrad Research",
      shortDescription:
        "Watched brains fuse conflicting senses into truth. My first proof that intelligence comes from integrating senses rather than selecting one.",
      description:
        "Fresh out of high school at Harvard's Jenks Lab, studying how brains judge motion when eyes and inner ear disagree. Expected to find one sense winning. Found something else entirely: Bayesian optimal integration. The brain weights each sense by its precision at that frequency. Vision below 2 Hz, vestibular above, perfect crossover at the boundary. Instead of picking the best input, the brain mathematically fuses all inputs weighted by reliability. Months on motion platforms, thousands of trials, watching biological intelligence optimize in real time. No algorithm programmed this behavior. Evolution discovered the math. Published in J Neurophysiol while still a teenager, but the real discovery was personal: intelligence doesn't come from having the right sensors or the right rules. It comes from integration patterns that emerge on their own. The brain was already doing what I would attempt fifteen years later: specialized components (senses), dynamic weighting (Bayesian fusion), and integration that emerges instead of being engineered. I just didn't know it yet.",
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
        "Found the exact crossover where the brain flips from trusting the eyes to the inner ear",
      ],
      links: [
        {
          name: "Journal Publication",
          url: "https://journals.physiology.org/doi/abs/10.1152/jn.00332.2013",
        },
        {
          name: "Conference Poster",
          url: "/pdfs/poster_visual_vestibular_integration_in_sensory_recognition_thresholds_2010.pdf",
        },
      ],
    },
  ] as ResearchProject[],
};
