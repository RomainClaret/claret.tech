/**
 * The Skills section's long texts: each core activity's story, by the
 * activity's title, and each philosophy card's framing, by its category.
 * None is on the page (a card shows its short text; these open in its
 * details dialog), so they come with the dialog's code
 * (SkillDetailsDialog.tsx), out of the page's first JavaScript.
 *
 * A card added to skills.ts needs its text here, by its title or category
 * (Skills.test.tsx, "Long texts", holds the two together).
 */
export const skillsDetails = {
  activities: {
    "Evolutionary AI: Growing Intelligence Instead of Training It":
      "My master's thesis was a question-answering system built from engineered parts. It worked, and it was brittle in places nobody had planned for. Symbolic reasoning, distributed agents and fuzzy logic went the same way. What kept failing was designing the whole thing by hand, so I stopped. Now evolution builds the networks and I study what it finds. In my GECCO'24 study, settings found on one image task carried over to a harder one, though not to simple logic tasks. A small result, but the kind I care about: something that still holds when the problem changes.",
    "Research Through Systematic Exploration":
      "I breed populations rather than training single networks: mutate, select, repeat. Most of the work is finding settings under which that loop gets anywhere. My GECCO'24 study searched those settings with a guided method rather than at random. On MNIST it beat random search and earlier results for that algorithm, and the settings carried over to Fashion-MNIST, though not to simple logic tasks. The score was never the point. Making evolution fast enough to run at that scale took the rest of my PhD.",
    "Thinking in Parts: Specialists That Learn to Work Together":
      "The idea behind GEENNS is that a mind is a team of specialists rather than one big network. Evolution grows small specialist networks, freezes the ones that work, and then evolves coordinators that decide how to combine them for each new task. In the PhD prototype, the same frozen specialists carried over to new tasks without retraining. What they do along the way is often not what I would have designed, and a fair part of it is redundant. The mess is the point. The mess is intelligence.",
  } as Record<string, string>,
  philosophy: {
    "Current Focus":
      "Everything here follows from one choice: grow the networks rather than train them. That buys adaptability, and it costs you every familiar way of checking your work, because the usual tests assume the system learned from us. So half this list is the research and half is building the instruments to judge it.",
    "Why Evolution":
      "Optimization gives you the best answer to the question you asked. Adaptation gives you something that still works once the question changes. Biology has been running the second experiment for a few billion years, and almost nothing it produced was designed.",
    "My Approach":
      "Long runs, systematic sweeps, and a lot of dead ends. These are the rules I keep relearning: test it before you trust it, measure what you actually claim, and build the tool yourself when the tool does not exist. Most of the useful signal arrived through failures I had not planned for.",
    Seeking:
      "I would rather have a good argument than easy agreement, and rather spend three years on a question that matters than three months on one that scores well. If you think I am wrong about any of this, bring evidence and I will listen.",
  } as Record<string, string>,
};
