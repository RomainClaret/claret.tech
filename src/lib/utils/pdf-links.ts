/**
 * pdf.js's link annotations, made usable from the keyboard.
 *
 * pdf.js wraps each link of a PDF in a `<section tabindex="1000">` around an
 * `<a>` that has no name. A positive tabindex goes ahead of everything else
 * in a page's Tab order: on `/pdf/<slug>` the first Tab presses walked these
 * wrappers (21 on the CV, 2,184 on the PhD thesis) ahead even of the skip
 * links, and a dialog that cycled through its controls counted each link
 * twice. A link with no name is announced as "link" and nothing else: web
 * and mail links are named here by their address, links within the document
 * by the text printed under them (pdf-link-names.ts).
 */

/**
 * A web or mail link's name: its address as people write it, without the
 * scheme, a leading "www." or a trailing slash. Null for anything else, such
 * as a link within the document ("#"), whose name would need the text under
 * it.
 */
export function linkName(href: string): string | null {
  if (href.startsWith("mailto:")) {
    return decode(href.slice("mailto:".length).split("?")[0]) || null;
  }
  const web = /^https?:\/\/(?:www\.)?(.+?)\/?$/i.exec(href);
  return web ? decode(web[1]) : null;
}

function decode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text; // a stray "%": keep it as written
  }
}

/** A link's name by its annotation id (pdf-link-names.ts), if known. */
export type LinkNameLookup = (id: string) => string | null;

/** One link's wrapper: out of the Tab order, its link named if it can be:
 *  by the PDF's own title, else its address, else the text under it. */
function fixLinkAnnotation(wrapper: HTMLElement, nameOf?: LinkNameLookup) {
  if (wrapper.tabIndex > 0) wrapper.tabIndex = -1;
  const link = wrapper.querySelector("a");
  if (
    !link ||
    link.hasAttribute("aria-label") ||
    link.title ||
    link.textContent?.trim()
  ) {
    return;
  }
  const id = wrapper.getAttribute("data-annotation-id");
  const name =
    wrapper.title ||
    linkName(link.getAttribute("href") ?? "") ||
    (id ? nameOf?.(id) : null);
  if (name) link.setAttribute("aria-label", name);
}

/** Fixes the link annotations already under `scope`: also the way names
 *  reach links that were on screen before their page was named. */
export function fixLinkAnnotations(
  scope: ParentNode,
  nameOf?: LinkNameLookup,
): void {
  scope
    .querySelectorAll<HTMLElement>(".annotationLayer > .linkAnnotation")
    .forEach((wrapper) => fixLinkAnnotation(wrapper, nameOf));
}

/**
 * Fixes every link annotation under `root`, now and as pdf.js adds them;
 * returns the disconnect. pdf.js appends each wrapper after an await, so
 * none is in place yet when react-pdf reports the layer rendered, and every
 * zoom rebuilds the layers. Only additions to an annotation layer are read,
 * so the text layers' many spans cost a class check each.
 */
export function watchLinkAnnotations(
  root: HTMLElement,
  nameOf?: LinkNameLookup,
): () => void {
  fixLinkAnnotations(root, nameOf);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (!(record.target as Element).classList?.contains("annotationLayer")) {
        continue;
      }
      record.addedNodes.forEach((node) => {
        if (
          node instanceof HTMLElement &&
          node.classList.contains("linkAnnotation")
        ) {
          fixLinkAnnotation(node, nameOf);
        }
      });
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  return () => observer.disconnect();
}
