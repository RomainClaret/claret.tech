// Skills section data

export const skillsSection = {
  display: true,
  title: "Evolution Over Engineering",
  subtitle: {
    highlightedText: "Where everyone sees failure, I see evolution at work",
    normalText:
      "Building AI that assembles components instead of memorizing patterns, because adaptive behavior beats accuracy.",
  },
  skills: [
    "Connecting neuroscience, physics, psychology, and engineering to understand intelligence.",
    "Testing an absurd number of setups to find the few that actually work.",
    "Reducing 7-year bottlenecks to 6-month pipelines.",
    "When tools don't exist, I create them. From research pipelines to evolutionary frameworks.",
    "Publishing rigorous research on unconventional approaches.",
    "Helping students think systematically about complex problems.",
    "Breaking complex systems into components, understanding interactions, rebuilding understanding.",
    "Living in Python and JAX, bending them until evolution runs fast.",
    "Breeding whole populations of networks and keeping whatever survives.",
    "Five years pursuing one insight through multiple paradigms with systematic execution.",
    "Every 'wrong' approach revealed essential constraints and possibilities.",
    "Understanding when to stop controlling and start observing.",
    "From papers to documentation to making complex ideas accessible.",
    "Sharing tools, frameworks, and research code with the community.",
    "Willing to spend years on problems others abandon after months.",
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
        "While everyone's training networks the usual way, I'm evolving behaviors. Slower? Yes. More compute? Absolutely. But mine adapt when yours break.",
      expandedDescription:
        "Started with graph-based reasoning systems in 2020, before the transformer revolution. Realized we're building high-performing dead ends: record accuracy that dies the moment the world shifts. Explored symbolic reasoning, distributed agents, fuzzy logic. Each 'detour' revealed the same truth: intelligence has to grow. Now I evolve neural networks that discover behaviors I never programmed. In one published result, networks I evolved on one image task handled a different one they had never seen. Nobody told them to; they grew general instincts instead of memorizing answers. Evolved networks adapt because that's what evolution selects for. They survive change.",
      technologies: ["NEAT/CPPNs/ES-HyperNEAT", "JAX/TensorNEAT"],
    },
    {
      icon: "🔬",
      title: "Research Through Systematic Exploration",
      description:
        "Used more CPU hours than sensible. Set a record along the way, but the real signal was the behaviors carrying over to new problems on their own. That's when you know you're onto something fundamental.",
      expandedDescription:
        "I breed populations rather than training single networks. Each generation: mutations, selection pressure, survival of the most adaptable (rather than the most accurate). Along the way they set a record on a standard image test, but that was never the point. What matters is they carry their skills to new tasks without retraining. Like biological systems adapting to new environments. Currently developing methods to make evolution 100-1000x faster through systematic optimization, because waiting years to discover failure is masochism. Published at GECCO'24: proving systematic exploration beats random search, every time.",
      technologies: ["Hyperparameter Optimization", "Distributed Computing"],
    },
    {
      icon: "🤖",
      title: "Compositional Intelligence: AI That Thinks in Parts",
      description:
        "My networks solve problems by assembling solutions from components. Not elegant. Not efficient. But interpretable and adaptable.",
      expandedDescription:
        "Five years converging on this insight: intelligence is compositional rather than monolithic. Humans decompose, process, and recompose instead of memorizing. My research builds AI that thinks the same way. Networks that evolve specialized components, then learn to orchestrate them. They develop unexpected strategies: edge detectors here, pattern matchers there, weird routing behaviors I never designed. Remove connections? They route around damage. Change the task? They repurpose components. It's messy, redundant, and absolutely fascinating. Traditional AI gives you clean architectures that shatter on edge cases. Mine are biological messes that refuse to die. The mess is the point. The mess is intelligence.",
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
        "Emergent behaviors in bio-inspired artificial life, grown by evolution and never fitted to us",
        "Measuring emergence honestly, which nobody can do yet: every test for novel behavior is calibrated on human data, so behavior outside that space reads as noise",
        "Specialists that claim their own roles, and coordination that carries to problems it never saw",
        "Composition as reasoning: assemble solutions from evolved specialists, then get the assembly itself to emerge",
        "Lifelong learning without forgetting: reuse settled behaviors instead of overwriting them",
        "Interpretable by construction: a mind you can read as parts, not one opaque blob",
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
