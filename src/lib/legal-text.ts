import { readFileSync } from "node:fs";
import path from "node:path";
import { renderMarkdownToHtml } from "@/lib/utils/markdown-server";

/** The legal texts at the repository's root, which the legal modals show. */
export type LegalFile = "PRIVACY-POLICY.md" | "TERMS-OF-SERVICE.md";

/**
 * A legal text as its modal reads it: the markdown and the HTML rendered
 * from it. Read when the site is built (its routes are static), so a
 * missing file fails the build. The routes used to read it on each visit
 * and fall back to copies written into their code, which had drifted from
 * the files (dates, missing sections) and which the modals could not even
 * show: they carried no HTML.
 */
export function legalText(file: LegalFile): { content: string; html: string } {
  const content = readFileSync(path.join(process.cwd(), file), "utf8");
  return { content, html: renderMarkdownToHtml(content) };
}
