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
  // Core activities with associated technologies
  coreActivities: [
    {
      icon: "🧬",
      title: "Evolutionary AI: Growing Intelligence Instead of Training It",
      description:
        "I evolve networks instead of training them. It takes longer and costs more compute. What comes back is behavior I did not write, and working out what that behavior is worth is most of the job.",
      expandedDescription:
        "My master's thesis was a question-answering system built from engineered parts. It worked, and it was brittle in places nobody had planned for. Symbolic reasoning, distributed agents and fuzzy logic went the same way. What kept failing was designing the whole thing by hand, so I stopped. Now evolution builds the networks and I study what it finds. In my GECCO'24 study, settings found on one image task carried over to a harder one, though not to simple logic tasks. A small result, but the kind I care about: something that still holds when the problem changes.",
      technologies: ["NEAT/CPPNs/ES-HyperNEAT", "JAX/TensorNEAT"],
    },
    {
      icon: "🔬",
      title: "Research Through Systematic Exploration",
      description:
        "Used more CPU hours than is sensible. The useful part was rarely the best score. It was learning which settings still held up when the task changed.",
      expandedDescription:
        "I breed populations rather than training single networks: mutate, select, repeat. Most of the work is finding settings under which that loop gets anywhere. My GECCO'24 study searched those settings with a guided method rather than at random. On MNIST it beat random search and earlier results for that algorithm, and the settings carried over to Fashion-MNIST, though not to simple logic tasks. The score was never the point. Making evolution fast enough to run at that scale took the rest of my PhD.",
      technologies: ["Hyperparameter Optimization", "Distributed Computing"],
    },
    {
      icon: "🤖",
      title: "Thinking in Parts: Specialists That Learn to Work Together",
      description:
        "The networks I grow solve problems in parts: specialists that evolve separately, then learn to work together. It is messier than one big network, and you can look at the parts one at a time.",
      expandedDescription:
        "The idea behind GEENNS is that a mind is a team of specialists rather than one big network. Evolution grows small specialist networks, freezes the ones that work, and then evolves coordinators that decide how to combine them for each new task. In the PhD prototype, the same frozen specialists carried over to new tasks without retraining. What they do along the way is often not what I would have designed, and a fair part of it is redundant. The mess is the point. The mess is intelligence.",
      technologies: ["Compositional Architectures", "Emergent Behaviors"],
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
   * Each panel leads with a short framing line so the bullets underneath have
   * something to attach to. Read as a bare list they lose their referent: a
   * bullet starting "Measuring it honestly" under a heading that just says
   * "Current Focus" gives the reader no way to work out what "it" is.
   *
   * `description` has to read well in a narrow four-across card, so keep it to
   * one sentence. `expandedDescription` is what Read more swaps in.
   */
  researchInterests: {
    "Current Focus": {
      description:
        "What I am working on now, and the problem sitting under it.",
      expandedDescription:
        "Everything here follows from one choice: grow the networks rather than train them. That buys adaptability, and it costs you every familiar way of checking your work, because the usual tests assume the system learned from us. So half this list is the research and half is building the instruments to judge it.",
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
      expandedDescription:
        "Optimization gives you the best answer to the question you asked. Adaptation gives you something that still works once the question changes. Biology has been running the second experiment for a few billion years, and almost nothing it produced was designed.",
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
      expandedDescription:
        "Long runs, systematic sweeps, and a lot of dead ends. These are the rules I keep relearning: test it before you trust it, measure what you actually claim, and build the tool yourself when the tool does not exist. Most of the useful signal arrived through failures I had not planned for.",
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
      expandedDescription:
        "I would rather have a good argument than easy agreement, and rather spend three years on a question that matters than three months on one that scores well. If you think I am wrong about any of this, bring evidence and I will listen.",
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
