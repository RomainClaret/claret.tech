/**
 * A paper card's research area, guessed from its title and abstract (or
 * subtitle). It picks the card's colour until its image or venue logo
 * gives one (Papers.tsx).
 *
 * Words count whole. Matched as substrings, "revolution" and "three
 * evolutionary paths" filed the Blockchain paper under neuroevolution, and
 * an "ai" inside a word filed the vestibular poster under machine
 * learning. HyperNEAT and NEAT are neuroevolution's own words: the
 * early-stopping paper says "evolutionary" but never "evolution".
 *
 * The curated papers' abstracts arrive after the page
 * (publication-abstracts.json), so their titles have to file them alone,
 * or a card would change colour when its abstract comes. Two of those
 * titles say only "Evolved" and "Evolving".
 */
export type ResearchArea =
  "neuroevolution" | "ml" | "nlp" | "blockchain" | "neuroscience" | "general";

const AREAS: [ResearchArea, string[]][] = [
  [
    "neuroevolution",
    [
      "neural",
      "evolution",
      "evolved",
      "evolving",
      "neuroevolution",
      "hyperneat",
      "neat",
    ],
  ],
  ["ml", ["machine learning", "deep learning", "ai"]],
  ["nlp", ["language", "nlp", "chatbot", "question"]],
  ["blockchain", ["blockchain", "distributed", "ledger"]],
  ["neuroscience", ["vestibular", "perception", "brain"]],
];

const MATCHERS = AREAS.map(
  ([area, words]) =>
    [area, new RegExp(`\\b(${words.join("|")})\\b`, "i")] as const,
);

export function researchAreaOf(item: {
  title: string;
  abstract?: string;
  subtitle?: string;
}): ResearchArea {
  const text = `${item.title} ${item.abstract ?? item.subtitle ?? ""}`;
  return MATCHERS.find(([, words]) => words.test(text))?.[0] ?? "general";
}
