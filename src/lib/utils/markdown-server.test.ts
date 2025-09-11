/**
 * Markdown Server Utility Tests
 *
 * Tests the server-side markdown rendering utility that converts
 * markdown to HTML for legal documents and other content.
 * This utility is used by API routes to pre-render markdown content.
 */

import { describe, it, expect } from "vitest";
import { renderMarkdownToHtml } from "./markdown-server";

describe("renderMarkdownToHtml", () => {
  describe("Basic Functionality", () => {
    it("returns empty string for empty input", () => {
      expect(renderMarkdownToHtml("")).toBe("");
    });

    it("returns empty string for null input", () => {
      expect(renderMarkdownToHtml(null as any)).toBe("");
    });

    it("returns empty string for undefined input", () => {
      expect(renderMarkdownToHtml(undefined as any)).toBe("");
    });

    it("handles plain text without markdown", () => {
      const result = renderMarkdownToHtml("This is plain text.");
      expect(result).toBe("<p>This is plain text.</p>");
    });
  });

  describe("Headers", () => {
    it("converts h1 headers", () => {
      const result = renderMarkdownToHtml("# Header 1");
      expect(result).toBe("<h1>Header 1</h1>");
    });

    it("converts h2 headers", () => {
      const result = renderMarkdownToHtml("## Header 2");
      expect(result).toBe("<h2>Header 2</h2>");
    });

    it("converts h3 headers", () => {
      const result = renderMarkdownToHtml("### Header 3");
      expect(result).toBe("<h3>Header 3</h3>");
    });

    it("handles headers with multiple spaces", () => {
      const result = renderMarkdownToHtml("##   Header with spaces   ");
      expect(result).toBe("<h2>Header with spaces</h2>");
    });

    it("ignores h4 and higher headers", () => {
      const result = renderMarkdownToHtml("#### Header 4");
      expect(result).toBe("<p>#### Header 4</p>");
    });
  });

  describe("Paragraphs", () => {
    it("converts single line to paragraph", () => {
      const result = renderMarkdownToHtml("This is a paragraph.");
      expect(result).toBe("<p>This is a paragraph.</p>");
    });

    it("combines multiple consecutive lines into one paragraph", () => {
      const result = renderMarkdownToHtml("Line 1\nLine 2\nLine 3");
      expect(result).toBe("<p>Line 1 Line 2 Line 3</p>");
    });

    it("separates paragraphs with empty lines", () => {
      const result = renderMarkdownToHtml("Paragraph 1\n\nParagraph 2");
      expect(result).toBe("<p>Paragraph 1</p>\n<p>Paragraph 2</p>");
    });
  });

  describe("Lists", () => {
    it("converts unordered lists", () => {
      const markdown = "- Item 1\n- Item 2\n- Item 3";
      const result = renderMarkdownToHtml(markdown);
      expect(result).toBe(
        "<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>",
      );
    });

    it("converts ordered lists", () => {
      const markdown = "1. First item\n2. Second item\n3. Third item";
      const result = renderMarkdownToHtml(markdown);
      expect(result).toBe(
        "<ol><li>First item</li><li>Second item</li><li>Third item</li></ol>",
      );
    });

    it("handles lists with inline formatting", () => {
      const markdown = "- **Bold item**\n- *Italic item*";
      const result = renderMarkdownToHtml(markdown);
      expect(result).toBe(
        "<ul><li><strong>Bold item</strong></li><li><em>Italic item</em></li></ul>",
      );
    });

    it("handles mixed numbered lists", () => {
      const markdown = "1. First\n10. Tenth\n100. Hundredth";
      const result = renderMarkdownToHtml(markdown);
      expect(result).toBe(
        "<ol><li>First</li><li>Tenth</li><li>Hundredth</li></ol>",
      );
    });
  });

  describe("Blockquotes", () => {
    it("converts simple blockquotes", () => {
      const result = renderMarkdownToHtml("> This is a quote");
      expect(result).toBe("<blockquote><p>This is a quote</p></blockquote>");
    });

    it("converts multi-line blockquotes", () => {
      const markdown = "> Line 1\n> Line 2\n> Line 3";
      const result = renderMarkdownToHtml(markdown);
      expect(result).toBe(
        "<blockquote><p>Line 1 Line 2 Line 3</p></blockquote>",
      );
    });

    it("handles blockquotes with inline formatting", () => {
      const result = renderMarkdownToHtml(
        "> **Bold quote** with *italic* text",
      );
      expect(result).toBe(
        "<blockquote><p><strong>Bold quote</strong> with <em>italic</em> text</p></blockquote>",
      );
    });
  });

  describe("Inline Formatting", () => {
    it("converts bold text with double asterisks", () => {
      const result = renderMarkdownToHtml("This is **bold** text");
      expect(result).toBe("<p>This is <strong>bold</strong> text</p>");
    });

    it("converts italic text with single asterisks", () => {
      const result = renderMarkdownToHtml("This is *italic* text");
      expect(result).toBe("<p>This is <em>italic</em> text</p>");
    });

    it("handles mixed bold and italic", () => {
      const result = renderMarkdownToHtml("**Bold** and *italic* together");
      expect(result).toBe(
        "<p><strong>Bold</strong> and <em>italic</em> together</p>",
      );
    });

    it("handles nested formatting correctly", () => {
      const result = renderMarkdownToHtml("**Bold with *italic* inside**");
      expect(result).toBe(
        "<p><strong>Bold with <em>italic</em> inside</strong></p>",
      );
    });
  });

  describe("Links", () => {
    it("converts simple links", () => {
      const result = renderMarkdownToHtml("[Link text](https://example.com)");
      expect(result).toBe(
        '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">Link text</a></p>',
      );
    });

    it("converts links with titles", () => {
      const result = renderMarkdownToHtml("[Email](mailto:test@example.com)");
      expect(result).toBe(
        '<p><a href="mailto:test@example.com" target="_blank" rel="noopener noreferrer">Email</a></p>',
      );
    });

    it("handles multiple links in one paragraph", () => {
      const result = renderMarkdownToHtml(
        "Visit [Google](https://google.com) or [GitHub](https://github.com)",
      );
      expect(result).toBe(
        '<p>Visit <a href="https://google.com" target="_blank" rel="noopener noreferrer">Google</a> or <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a></p>',
      );
    });

    it("handles links with formatting", () => {
      const result = renderMarkdownToHtml(
        "[**Bold link**](https://example.com)",
      );
      expect(result).toBe(
        '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer"><strong>Bold link</strong></a></p>',
      );
    });
  });

  describe("Code", () => {
    it("handles inline code", () => {
      const result = renderMarkdownToHtml("Use `console.log()` for debugging");
      expect(result).toBe(
        "<p>Use <code>console.log()</code> for debugging</p>",
      );
    });

    it("handles multiple inline code spans", () => {
      const result = renderMarkdownToHtml("Use `const` or `let` for variables");
      expect(result).toBe(
        "<p>Use <code>const</code> or <code>let</code> for variables</p>",
      );
    });

    it("handles code blocks", () => {
      const markdown =
        "```\nfunction hello() {\n  console.log('Hello');\n}\n```";
      const result = renderMarkdownToHtml(markdown);
      expect(result).toBe(
        "<pre><code>function hello() {\n  console.log(&#39;Hello&#39;);\n}</code></pre>",
      );
    });

    it("handles code blocks with language specification", () => {
      const markdown = "```javascript\nconst x = 1;\n```";
      const result = renderMarkdownToHtml(markdown);
      expect(result).toBe("<pre><code>const x = 1;</code></pre>");
    });

    it("escapes HTML in code blocks", () => {
      const markdown = "```\n<div>HTML content</div>\n```";
      const result = renderMarkdownToHtml(markdown);
      expect(result).toBe(
        "<pre><code>&lt;div&gt;HTML content&lt;/div&gt;</code></pre>",
      );
    });

    it("escapes HTML in inline code", () => {
      const result = renderMarkdownToHtml("Use `<div>` elements");
      expect(result).toBe("<p>Use <code>&lt;div&gt;</code> elements</p>");
    });
  });

  describe("HTML Escaping", () => {
    it("escapes dangerous HTML in text", () => {
      const result = renderMarkdownToHtml("<script>alert('xss')</script>");
      expect(result).toBe(
        "<p>&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;</p>",
      );
    });

    it("escapes quotes in text", () => {
      const result = renderMarkdownToHtml(
        "Text with \"quotes\" and 'apostrophes'",
      );
      expect(result).toBe(
        "<p>Text with &quot;quotes&quot; and &#39;apostrophes&#39;</p>",
      );
    });

    it("escapes ampersands", () => {
      const result = renderMarkdownToHtml("R&D and Q&A");
      expect(result).toBe("<p>R&amp;D and Q&amp;A</p>");
    });
  });

  describe("Complex Documents", () => {
    it("handles privacy policy structure", () => {
      const markdown = `# Privacy Policy

**Last Updated: 2025-01-03**

## Our Commitment to Privacy

At Claret.Tech, we believe in complete transparency.

> **We DO NOT track you.**

## What We Don't Collect

- No personal identification information
- No IP address logging
- No behavioral tracking

For questions, contact [privacy@claret.tech](mailto:privacy@claret.tech).`;

      const result = renderMarkdownToHtml(markdown);

      expect(result).toContain("<h1>Privacy Policy</h1>");
      expect(result).toContain(
        "<p><strong>Last Updated: 2025-01-03</strong></p>",
      );
      expect(result).toContain("<h2>Our Commitment to Privacy</h2>");
      expect(result).toContain(
        "<blockquote><p><strong>We DO NOT track you.</strong></p></blockquote>",
      );
      expect(result).toContain("<ul>");
      expect(result).toContain(
        "<li>No personal identification information</li>",
      );
      expect(result).toContain('<a href="mailto:privacy@claret.tech"');
    });

    it("handles terms of service structure", () => {
      const markdown = `# Terms of Service

**Effective Date: 2025-01-03**

## 1. Acceptance of Terms

By accessing this website, you accept these terms.

## 2. Use of Website

- You may view all publicly available content
- Commercial use requires permission

Contact: [legal@claret.tech](mailto:legal@claret.tech)`;

      const result = renderMarkdownToHtml(markdown);

      expect(result).toContain("<h1>Terms of Service</h1>");
      expect(result).toContain("<h2>1. Acceptance of Terms</h2>");
      expect(result).toContain("<h2>2. Use of Website</h2>");
      expect(result).toContain("<ul>");
      expect(result).toContain('<a href="mailto:legal@claret.tech"');
    });
  });

  describe("Edge Cases", () => {
    it("handles empty lines between elements", () => {
      const markdown = "# Header\n\nParagraph\n\n- List item";
      const result = renderMarkdownToHtml(markdown);

      expect(result).toContain("<h1>Header</h1>");
      expect(result).toContain("<p>Paragraph</p>");
      expect(result).toContain("<ul><li>List item</li></ul>");
    });

    it("handles consecutive newlines", () => {
      const markdown = "Line 1\n\n\n\nLine 2";
      const result = renderMarkdownToHtml(markdown);

      expect(result).toBe("<p>Line 1</p>\n<p>Line 2</p>");
      expect(result).not.toContain("\n\n\n");
    });

    it("removes empty paragraphs", () => {
      const markdown = "Text\n\n\n\nMore text";
      const result = renderMarkdownToHtml(markdown);

      expect(result).not.toContain("<p></p>");
      expect(result).not.toContain("<p>\\s*</p>");
    });

    it("handles mixed content types", () => {
      const markdown = `# Header
      
Some **bold** text with a [link](https://example.com).

> A blockquote with \`code\`

- List item 1
- List item 2

Final paragraph.`;

      const result = renderMarkdownToHtml(markdown);

      expect(result).toContain("<h1>Header</h1>");
      expect(result).toContain("<strong>bold</strong>");
      expect(result).toContain('<a href="https://example.com"');
      expect(result).toContain("<blockquote>");
      expect(result).toContain("<code>code</code>");
      expect(result).toContain("<ul>");
      expect(result).toContain("<p>Final paragraph.</p>");
    });

    it("preserves whitespace in code blocks", () => {
      const markdown =
        "```\n  function indented() {\n    return true;\n  }\n```";
      const result = renderMarkdownToHtml(markdown);

      expect(result).toContain("  function indented()");
      expect(result).toContain("    return true;");
    });
  });

  describe("Performance", () => {
    it("processes large documents efficiently", () => {
      const largeMarkdown = Array(1000)
        .fill(
          "## Header\n\nParagraph with **bold** text and [link](https://example.com).\n\n- List item\n",
        )
        .join("");

      const start = performance.now();
      const result = renderMarkdownToHtml(largeMarkdown);
      const duration = performance.now() - start;

      expect(result).toContain("<h2>Header</h2>");
      expect(result.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // Should process in under 100ms
    });
  });
});
