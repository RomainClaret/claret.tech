import { describe, it, expect } from "vitest";
import {
  fixLinkAnnotations,
  linkName,
  watchLinkAnnotations,
} from "./pdf-links";

/**
 * pdf.js wraps each link of a PDF in a <section tabindex="1000"> around an
 * <a> with no name. The positive tabindex put every wrapper ahead of the
 * page's own controls (2,184 Tab presses on the PhD thesis before its skip
 * links), and each link was announced as nothing but "link".
 */

/** A link annotation as pdf.js 5 renders it. */
function wrapper(href: string, id = "1R") {
  const section = document.createElement("section");
  section.className = "linkAnnotation";
  section.setAttribute("data-annotation-id", id);
  section.tabIndex = 1000;
  const link = document.createElement("a");
  link.setAttribute("href", href);
  section.append(link);
  return section;
}

function annotationLayer() {
  const root = document.createElement("div");
  const layer = document.createElement("div");
  layer.className = "annotationLayer";
  root.append(layer);
  document.body.append(root);
  return { root, layer };
}

/** MutationObserver callbacks run as microtasks. */
const settle = () => new Promise((done) => setTimeout(done, 0));

describe("linkName", () => {
  it.each([
    ["https://doi.org/10.1000/1", "doi.org/10.1000/1"],
    ["https://www.claret.tech/", "claret.tech"],
    ["http://example.com/a%20b?x=1#y", "example.com/a b?x=1#y"],
    ["mailto:romain@example.com?subject=Hi", "romain@example.com"],
    ["https://example.com/%E0%A4%A", "example.com/%E0%A4%A"],
  ])("names %s as %s", (href, name) => {
    expect(linkName(href)).toBe(name);
  });

  it.each(["#", "javascript:void(0)", ""])("gives %j no name", (href) => {
    expect(linkName(href)).toBeNull();
  });
});

describe("watchLinkAnnotations", () => {
  it("takes the wrappers out of the Tab order and names web links", async () => {
    const { root, layer } = annotationLayer();
    layer.append(wrapper("https://orcid.org/0000-0002-5612-8471"));
    const stop = watchLinkAnnotations(root);
    // pdf.js adds the rest after an await, and again on every zoom.
    layer.append(wrapper("mailto:romain@example.com"));
    layer.append(wrapper("#"));
    await settle();

    const [orcid, mail, internal] = layer.querySelectorAll("section");
    expect([orcid, mail, internal].map((s) => s.tabIndex)).toEqual([
      -1, -1, -1,
    ]);
    expect(orcid.querySelector("a")).toHaveAttribute(
      "aria-label",
      "orcid.org/0000-0002-5612-8471",
    );
    expect(mail.querySelector("a")).toHaveAttribute(
      "aria-label",
      "romain@example.com",
    );
    // A link within the document: naming it needs the text under it.
    expect(internal.querySelector("a")).not.toHaveAttribute("aria-label");
    stop();
    root.remove();
  });

  it("keeps a name the PDF gave", async () => {
    const { root, layer } = annotationLayer();
    const stop = watchLinkAnnotations(root);
    const named = wrapper("https://doi.org/10.1000/1");
    named.querySelector("a")!.setAttribute("aria-label", "The paper");
    layer.append(named);
    await settle();

    expect(named.querySelector("a")).toHaveAttribute("aria-label", "The paper");
    stop();
    root.remove();
  });

  it("stops once disconnected", async () => {
    const { root, layer } = annotationLayer();
    const stop = watchLinkAnnotations(root);
    stop();
    layer.append(wrapper("https://doi.org/10.1000/1"));
    await settle();

    expect(layer.querySelector("section")!.tabIndex).toBe(1000);
    root.remove();
  });

  it("names a link within the document by the text under it", async () => {
    // Its name comes from the page's text (pdf-link-names.ts), by the
    // annotation id pdf.js gives both.
    const { root, layer } = annotationLayer();
    const names: Record<string, string> = { "98R": "Reference 5" };
    const stop = watchLinkAnnotations(root, (id) => names[id] ?? null);
    layer.append(wrapper("#", "98R"));
    layer.append(wrapper("https://doi.org/10.1000/1", "99R"));
    names["99R"] = "Reference 6";
    await settle();

    const [internal, web] = layer.querySelectorAll("a");
    expect(internal).toHaveAttribute("aria-label", "Reference 5");
    // An address still names its own link.
    expect(web).toHaveAttribute("aria-label", "doi.org/10.1000/1");
    stop();
    root.remove();
  });
});

describe("fixLinkAnnotations", () => {
  it("names the links already in place once their names are known", () => {
    const { root, layer } = annotationLayer();
    layer.append(wrapper("#", "98R"));
    const named = wrapper("#", "100R");
    named.querySelector("a")!.setAttribute("aria-label", "Figure 1");
    layer.append(named);

    fixLinkAnnotations(root, (id) => (id === "98R" ? "Reference 5" : "Other"));

    const [first, second] = layer.querySelectorAll("a");
    expect(first).toHaveAttribute("aria-label", "Reference 5");
    expect(second).toHaveAttribute("aria-label", "Figure 1");
    root.remove();
  });
});
