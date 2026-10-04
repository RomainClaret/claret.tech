/**
 * Whether a chat message is a philosophical question, which switches the
 * terminal assistant into its "harder questions" mode.
 *
 * Kept out of client.ts, which loads the WebLLM runtime, so it can be tested.
 *
 * Whole words only, and only words that rarely appear in an ordinary question
 * about the research. Substring matching on "why", "purpose", "meaning",
 * "simulation", "void" and "being" used to send questions like "What is the
 * purpose of GEENNS?" into a monologue about the void.
 */
const PHILOSOPHICAL_TERMS = [
  "meaning of life",
  "purpose of life",
  "existence",
  "consciousness",
  "death",
  "chaos",
  "humanity",
  "god",
  "transcend",
  "entropy",
  "dread",
  "free will",
  "determinism",
  "absurd",
  "existential",
  "nihilism",
  "nothingness",
];

const PHILOSOPHICAL_PATTERN = new RegExp(
  `\\b(?:${PHILOSOPHICAL_TERMS.map((term) =>
    term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  ).join("|")})\\b`,
  "i",
);

export function isPhilosophicalQuestion(text: string): boolean {
  return PHILOSOPHICAL_PATTERN.test(text);
}
