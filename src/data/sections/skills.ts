// Skills section data

export const skillsSection = {
  display: true,
  title: "Evolution Over Engineering",
  subtitle: {
    highlightedText: "Evolution works mostly by failing, and so do I",
    normalText:
      "Building AI that assembles components instead of memorizing patterns, because adaptive behavior beats accuracy.",
  },
  skills: [
    "Connecting neuroscience, physics, psychology, and engineering to understand intelligence.",
    "Testing an absurd number of setups to find the few that actually work.",
    "Rewriting slow pipelines until an experiment finishes in time to matter.",
    "When the tool I need does not exist, I build it, usually a pipeline or an evolutionary framework.",
    "Publishing what I find, including where a method breaks.",
    "Teaching programming, mathematics and databases, and trying to make it stick.",
    "Taking systems apart to see how the pieces interact, then putting them back together.",
    "Living in Python and JAX, bending them until evolution runs fast.",
    "Breeding whole populations of networks and keeping whatever survives.",
    "Following one question through several fields until the answers started to line up.",
    "Keeping notes on what failed, because that is where the constraints show up.",
    "Understanding when to stop controlling and start observing.",
    "Writing it down so someone outside the field can follow it.",
    "Publishing the code with each paper, so anyone can rerun it.",
    "Happy to spend years on a problem if it is the right one.",
  ],
  // Core Expertise section configuration
  coreExpertiseSection: {
    title: "What I Actually Do",
    subtitle:
      "Breeding neural networks that surprise me, because real intelligence disobeys its creator.",
  },
  // Core activities with their technologies. A technology's icon is a Font
  // Awesome name that src/components/icons/tech-icons.tsx draws as a Lucide
  // icon (tech-icons.test.ts holds each to one). `description` is the card's
  // text; the story its dialog tells is in skills-details.ts, by title.
  coreActivities: [
    {
      icon: "🧬",
      title: "Evolutionary AI: Growing Intelligence Instead of Training It",
      description:
        "I evolve networks instead of training them. It takes longer and costs more compute. What comes back is behavior I did not write, and working out what that behavior is worth is most of the job.",
      technologies: [
        { name: "NEAT/CPPNs/ES-HyperNEAT", icon: "fas fa-dna" },
        { name: "JAX/TensorNEAT", icon: "fas fa-bolt" },
      ],
    },
    {
      icon: "🔬",
      title: "Research Through Systematic Exploration",
      description:
        "Used more CPU hours than is sensible. The useful part was rarely the best score. It was learning which settings still held up when the task changed.",
      technologies: [
        { name: "Hyperparameter Optimization", icon: "fas fa-sliders" },
        { name: "Distributed Computing", icon: "fas fa-network-wired" },
      ],
    },
    {
      icon: "🤖",
      title: "Thinking in Parts: Specialists That Learn to Work Together",
      description:
        "The networks I grow solve problems in parts: specialists that evolve separately, then learn to work together. It is messier than one big network, and you can look at the parts one at a time.",
      technologies: [
        { name: "Compositional Architectures", icon: "fas fa-puzzle-piece" },
        { name: "Emergent Behaviors", icon: "fas fa-seedling" },
      ],
    },
  ],
  frameworks: [
    "PUREPLES (until I killed it)",
    "TENSORNEAT (in therapy together)",
    "JAX (it's complicated)",
    "PyTorch (baselines to beat)",
    "NumPy (old reliable)",
    "Optuna (hyperparameter sadism)",
    "Your framework (if it survives)",
  ],
  languages: [
    { language: "French", proficiency: "Native", flag: "🇫🇷" },
    { language: "English", proficiency: "Academic", flag: "🇬🇧" },
    { language: "Russian", proficiency: "Семья", flag: "🇷🇺" },
    { language: "German", proficiency: "Fast Schweizerdeutsch", flag: "🇩🇪" },
    { language: "Python", proficiency: "Abusive Relationship", flag: "🐍" },
    { language: "Math", proficiency: "When Cornered", flag: "∑" },
  ],
  // Research Philosophy section configuration
  researchPhilosophySection: {
    title: "Research Philosophy",
    subtitle: "Building AI that adapts instead of memorizing",
  },
  /**
   * A card shows its panel's first bullet, the key point, so that one has to
   * stand alone. Read more opens the rest in a dialog, which leads with
   * `description`, a one-sentence framing line, then the longer framing in
   * skills-details.ts (by category), so the bullets underneath have
   * something to attach to. Read as a bare list they lose their referent: a
   * bullet starting "Measuring it honestly" under a heading that just says
   * "Current Focus" gives the reader no way to work out what "it" is.
   */
  researchInterests: {
    "Current Focus": {
      description:
        "What I am working on now, and the problem sitting under it.",
      bullets: [
        "GEENNS: a mind as a team of evolved specialists that claim their own roles and learn to work together",
        "Composition as reasoning: assemble solutions from evolved specialists, then get the assembly itself to emerge",
        "Lifelong learning without forgetting: reuse settled behaviors instead of overwriting them",
        "Emergent behaviors in bio-inspired artificial life, grown by evolution and never fitted to us",
        "Measuring emergence honestly: every test for novel behavior I know of is calibrated on human data, so behavior outside that space reads as noise",
        "An image breeder whose vocabulary can change, to see how the material shapes what evolution can reach",
      ],
    },
    "Why Evolution": {
      description: "Why I grow networks instead of training them.",
      bullets: [
        "Cockroaches outlived dinosaurs. Adaptation beats optimization every time the world moves",
        "Your brain runs on 20 watts of spaghetti code, and still outthinks every tidy system we design",
        "Every biological 'bug' turns out to be a feature somewhere else you weren't looking",
        "Messy survivors beat clean corpses. Robust and ugly outlasts elegant and brittle",
        "Evolution has no final version and no ship date, just whatever survives the next surprise",
        "Nobody designed the octopus or the immune system. Evolution found them by trying, failing, and keeping what worked",
      ],
    },
    "My Approach": {
      description: "How I work, mostly learned by wasting time first.",
      bullets: [
        "Test systematically, or watch a year of computing vanish proving nothing",
        "Grow behaviors, don't drill answers. One adapts to new problems, the other just recites the old ones",
        "Chase adaptability, not benchmark scores. A high score that breaks on contact was never worth much",
        "Failures are data, not mistakes. Every dead end quietly tells you where the real wall is",
        "Set the conditions, then get out of the way and watch what evolution does with them",
        "When the right tool doesn't exist yet, build it. The interesting problems never come with one",
      ],
    },
    Seeking: {
      description: "What I want from collaborators and from problems.",
      bullets: [
        "Collaborators who value adaptation over benchmarks, and a good argument over easy agreement",
        "Patience to let evolution surprise you, because the results worth having rarely arrive on schedule",
        "People who get that intelligence emerges on its own rather than being programmed in line by line",
        "A taste for building toward the unknown, not for acing today's test",
        "Wild theories, odd collaborations, and anyone convinced I'm wrong (bring proof)",
        "Problems worth spending years on, the kind most people abandon after a few months",
      ],
    },
  },
};
