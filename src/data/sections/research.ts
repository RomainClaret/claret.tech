// Research section data
export interface ResearchProject {
  title: string;
  subtitle: string;
  description: string;
  shortDescription?: string;
  tags: string[];
  status: "active" | "completed" | "ongoing";
  /**
   * How long the work took, in years. Ignored when `researchStart` is set.
   */
  yearsSpent: number;
  /**
   * When ongoing work began, as "YYYY-MM". Set this instead of trusting
   * `yearsSpent` for a project that is still running: the elapsed time is
   * computed against today, so the figure cannot go stale the day after it is
   * written.
   */
  researchStart?: string;
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
  /**
   * Set to false to keep a card off the site for now, for example while the
   * paper behind it is under double-blind review. A hidden card is left out
   * of the grid, the stats, the deep links and the reader routes. Its text
   * still ships in the page's JavaScript and in the git history, so this hides
   * a card and does not make it private.
   */
  display?: boolean;
}

/**
 * Whether a project appears on the site. Everything that reads the projects
 * list goes through this: a card left out of the grid alone would still show
 * up in the counts, the deep links and the reader routes.
 */
export function isDisplayed(project: ResearchProject): boolean {
  return project.display !== false;
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
    "Started by breaking toys to build robots. Then breaking computers to make them smarter. Learned to code to control them. Studied physics and mathematics to simulate their brains. Dove into electronics and micro mechanics to build better bodies. Studied computer science to let them act, and AI to make them clever. Every step showed me I was still missing something, and eventually the missing piece was the approach itself: stop building the mind, set the conditions, let it evolve, and pay attention to what shows up. The PhD made that fast enough to try at a useful scale. Now the work is GEENNS: minds grown as teams of evolved specialists that learn to work together and keep learning without forgetting, and the harder question of how to tell genuinely new behavior from behavior that only looks new to us. The kid breaking toys wanted thinking robots. The approach changed. The question did not.",
  journeyShortDescription:
    "Most researchers find their field. I had a question that wouldn't let me settle: child me wanted thinking robots. Pursued that dream through physics, mechanics, neuroscience, AI, until they all revealed the same truth: minds evolve into existence. The irony? Decades of education had turned me into the robot, trained to engineer things. I can't escape that mindset, but now I'm breeding artificial life into existence, watching behavior arise from chaos rather than from architecture, code, or engineering. Whether that is where intelligence actually begins is the question, not the conclusion.",
  journeyBadge: "A Lifelong Question",

  /**
   * Research time that has no project card of its own, in years.
   *
   * 1 year of R&D at Versicherix, plus 1 year 6 months on the Artificialkind
   * project. Both are real research periods, neither has a card, so they are
   * added to the Evolution Lab's "Years of Research" total here rather than
   * folded into some project's yearsSpent - which would misstate that
   * project's duration and hide where the time came from.
   */
  additionalResearchYears: 1 + 1.5,

  // Configuration for research section UI
  publicationNote: "Will be public upon publication",
  highlightLabels: ["Compositional", "Evolutionary", "Growing", "Lifelong"],
  highlightIcons: ["Brain", "Zap", "Shield", "Sparkles"],

  projects: [
    {
      title: "GEENNS: Growing Minds That Keep Learning",
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
      // Counted as 0 on purpose. This runs 2020-Present, which the
      // PhD's 5.75 already covers in full, and its post-PhD phase is the same
      // present-day work emerging-behaviors now counts from its start date.
      // Giving it a number again would count those years twice.
      yearsSpent: 0,
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
          url: "/pdfs/thesis_PHD_chapter_7.pdf",
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
      yearsSpent: 0, // unused: researchStart drives this one
      researchStart: "2026-07",
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
      title: "Breeding with an Evolvable Vocabulary",
      anchorId: "evolvable-vocabulary",
      subtitle: "Active Research Direction",
      shortDescription:
        "An interactive image breeder where the genome's vocabulary can vary: which functions a node computes, and how it combines its inputs. Exploring how that choice shapes what can be bred.",
      description:
        "You breed an image by clicking. A grid of pictures appears, you pick the ones you like, their offspring become the next grid, and after a few minutes you have something nobody designed. Picbreeder made that idea famous, and later work has changed who does the choosing: crowds, aesthetic measures, and lately vision-language models. This breeder turns a different knob: the vocabulary, meaning the set of functions a node in the genome can compute and the way it combines its inputs before computing anything. The vocabulary is the material, like the difference between oils and watercolor, or between a synthesizer with one oscillator and one with a full bank, and it may shape which images can be reached at all. The questions behind it: does what is in a palette matter more than how much is in it, how much does the way a node combines its inputs matter, and is an image a palette can express also one its search can find? Two versions are online: the latest, with the most controls, lets you shape both the CPPN and the substrate; a simpler one gives control over the CPPN only.",
      tags: [
        "Interactive Evolution",
        "Generative Art",
        "CPPNs",
        "Neuroevolution",
        "Evolvability",
      ],
      status: "active" as const,
      // Counted as 0 on purpose: this runs alongside emerging-behaviors, which
      // already counts the present-day post-PhD time from its start date.
      // A start date here would count those months twice.
      yearsSpent: 0,
      icon: "Sparkles",
      color: "168, 85, 247",
      year: "2026-Present",
      links: [
        // The play versions, latest first. The study will have a link of its own.
        {
          name: "Play: CPPN and Substrate",
          url: "https://picbreeder.claret.tech",
        },
        {
          name: "Play: CPPN Only",
          url: "https://picbreeder-cppn.claret.tech",
        },
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
      // 5 years 9 months.
      yearsSpent: 5.75,
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
          url: "/pdfs/thesis_PHD.pdf",
        },
        {
          name: "Read Presentation",
          url: "/pdfs/presentation_PHD_2026_claret2026.pdf",
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
        "Built zero-shot conversational AI from sub-knowledge graphs. It convinced me that intelligence engineered by hand stays brittle.",
      description:
        "I spent 900+ hours building conversational AI from first principles: zero-shot question answering through algorithmic orchestration, with sub-knowledge graphs extracted from Wikidata and a modular architecture where each component handled one part of understanding. It worked, but that wasn't the point. Watching it take 182 seconds to answer 'What's the capital of France?', something a person answers in a fraction of a second, taught me more than the accuracy did. Every part did exactly what I designed and nothing more. This thesis was my last attempt at building intelligence top-down.",
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
        "Convinced me to stop engineering intelligence by hand",
      ],
      links: [
        {
          name: "Read Thesis",
          url: "/pdfs/thesis_MSC.pdf",
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
        "Is it possible to provide distributed storage that prevents spying WITHOUT opening Pandora's box for illegal content? That was the question. Overclouds was born: anonymous, decentralized data sharing through any browser. No installation, no corporate servers, no single point of failure. WebRTC for peer connections, WebTorrent for distribution, Ethereum for consensus. The part I cared about most was governance: the network votes on everything, from storage limits to banned content types, what's allowed, who's trusted, what gets preserved. A 'Data Tribunal' where random peers judge flagged content. Proof-of-Participation rewarding good behavior. The technical parts worked: encrypted chunks spreading across browsers, webapps loading from hashes, serverless peer discovery. Trust resisted engineering; it grew through consensus. This thesis planted the seed: evolve systems instead of building them.",
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
          url: "/pdfs/thesis_BSC.pdf",
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
        "Watched brains fuse conflicting senses into one estimate. The first time I saw intelligence come from combining senses rather than picking one.",
      description:
        "Fresh out of high school at Harvard's Jenks Lab, I helped study how the brain judges motion when the eyes and the inner ear disagree. I expected one sense to win. What the lab found instead was optimal integration: the brain weights each sense by how precise it is at that frequency, vision at low frequencies and the inner ear at higher ones, and fuses them rather than picking one. Months on motion platforms and thousands of trials, watching a biological system do math nobody programmed into it. My part ended up on a poster at the Society for Neuroscience meeting that November, and the lab's full results appeared later in the Journal of Neurophysiology. What stayed with me was personal: the intelligence was not in any single sensor or rule, but in how they were combined. The brain was already doing what I would attempt a decade later: specialized components (the senses), weighting by reliability, and integration that emerges instead of being engineered. I just didn't know it yet.",
      tags: [
        "Sensory Fusion",
        "Bayesian Integration",
        "Pattern Recognition",
        "Psychophysics",
      ],
      status: "completed" as const,
      // 3 months.
      yearsSpent: 0.25,
      icon: "Ear",
      color: "236, 72, 153",
      year: "2010",
      highlights: [
        "First exposure to emergence over engineering",
        "Worked on the study showing the brain combines vision and balance close to the statistical optimum",
        "Found the exact crossover where the brain flips from trusting the eyes to the inner ear",
      ],
      links: [
        {
          name: "Journal Publication",
          url: "https://journals.physiology.org/doi/abs/10.1152/jn.00332.2013",
        },
        {
          name: "Conference Poster",
          url: "/pdfs/poster_SNF_2010_visual_vestibular_integration_in_sensory_recognition_thresholds.pdf",
        },
      ],
    },
  ] as ResearchProject[],
};
