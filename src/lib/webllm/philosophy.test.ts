import { describe, it, expect } from "vitest";
import { isPhilosophicalQuestion } from "./philosophy";

describe("isPhilosophicalQuestion", () => {
  it.each([
    "What is the purpose of GEENNS?",
    "Why does evolution work?",
    "Does he use simulation?",
    "What's the meaning of EMR?",
    "Is the return type void?",
    "Being able to batch it on a GPU matters, right?",
    "Is this a good approach?",
  ])("leaves an ordinary question alone: %s", (question) => {
    expect(isPhilosophicalQuestion(question)).toBe(false);
  });

  it.each([
    "What is the meaning of life?",
    "Can a machine have consciousness?",
    "Is this all absurd?",
    "Do we have free will?",
    "Does entropy always win?",
  ])("recognizes a philosophical question: %s", (question) => {
    expect(isPhilosophicalQuestion(question)).toBe(true);
  });
});
