/**
 * Server-side markdown renderer
 * Used by API routes to pre-render markdown to HTML
 */

export function renderMarkdownToHtml(markdown: string): string {
  if (!markdown) return "";

  let html = markdown;

  // Step 1: Handle code blocks first (to protect them from other processing)
  const codeBlocks: string[] = [];
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const index = codeBlocks.length;
    const content = match.slice(3, -3);
    // Remove language specification if present (first line)
    const lines = content.split("\n");
    let codeContent;
    if (lines[0].match(/^[a-zA-Z]+$/) && lines.length > 1) {
      // Remove first line (language) and preserve whitespace in remaining lines
      codeContent = lines.slice(1).join("\n");
      // Only trim leading/trailing newlines, preserve internal whitespace
      codeContent = codeContent.replace(/^\n+/, "").replace(/\n+$/, "");
    } else {
      // No language specification, preserve whitespace
      codeContent = content.replace(/^\n+/, "").replace(/\n+$/, "");
    }
    codeBlocks.push(codeContent);
    return `__CODE_BLOCK_${index}__`;
  });

  // Step 2: Handle inline code
  const inlineCodes: string[] = [];
  html = html.replace(/`([^`]+)`/g, (match, code) => {
    const index = inlineCodes.length;
    inlineCodes.push(code);
    return `__INLINE_CODE_${index}__`;
  });

  // Step 3: Process block elements
  html = processBlockElements(html);

  // Step 4: Restore code blocks and inline code
  codeBlocks.forEach((code, index) => {
    html = html.replace(
      `__CODE_BLOCK_${index}__`,
      `<pre><code>${escapeHtml(code)}</code></pre>`,
    );
  });

  inlineCodes.forEach((code, index) => {
    html = html.replace(
      `__INLINE_CODE_${index}__`,
      `<code>${escapeHtml(code)}</code>`,
    );
  });

  // Step 5: Clean up extra whitespace and empty elements
  html = html
    .replace(/\n{3,}/g, "\n\n") // Limit consecutive newlines
    .replace(/<p>\s*<\/p>/g, "") // Remove empty paragraphs
    .trim();

  return html;
}

function processBlockElements(content: string): string {
  const lines = content.split("\n");
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headers
    if (line.match(/^#{1,3}\s+/)) {
      const level = line.match(/^#+/)?.[0].length || 1;
      const text = line.replace(/^#+\s*/, "").trim();
      result.push(`<h${level}>${text}</h${level}>`);
      i++;
    }
    // Blockquotes
    else if (line.match(/^>\s+/)) {
      const blockquoteLines = [];
      while (i < lines.length && lines[i].match(/^>\s+/)) {
        blockquoteLines.push(lines[i].replace(/^>\s*/, ""));
        i++;
      }
      const blockquoteContent = blockquoteLines.join(" ");
      result.push(
        `<blockquote><p>${processInlineElements(blockquoteContent)}</p></blockquote>`,
      );
    }
    // Unordered lists
    else if (line.match(/^-\s+/)) {
      const listItems = [];
      while (i < lines.length && lines[i].match(/^-\s+/)) {
        const itemText = lines[i].replace(/^-\s*/, "");
        listItems.push(`<li>${processInlineElements(itemText)}</li>`);
        i++;
      }
      result.push(`<ul>${listItems.join("")}</ul>`);
    }
    // Numbered lists
    else if (line.match(/^\d+\.\s+/)) {
      const listItems = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        const itemText = lines[i].replace(/^\d+\.\s*/, "");
        listItems.push(`<li>${processInlineElements(itemText)}</li>`);
        i++;
      }
      result.push(`<ol>${listItems.join("")}</ol>`);
    }
    // Empty lines
    else if (line.trim() === "") {
      // Skip empty lines but don't add them to result
      i++;
    }
    // Code block placeholders (should not be wrapped in paragraphs)
    else if (line.includes("__CODE_BLOCK_")) {
      result.push(line);
      i++;
    }
    // Regular paragraphs
    else {
      const paragraphLines = [];
      while (
        i < lines.length &&
        !lines[i].match(/^#{1,3}\s+/) &&
        !lines[i].match(/^>\s+/) &&
        !lines[i].match(/^-\s+/) &&
        !lines[i].match(/^\d+\.\s+/) &&
        !lines[i].includes("__CODE_BLOCK_") &&
        lines[i].trim() !== ""
      ) {
        paragraphLines.push(lines[i]);
        i++;
      }

      if (paragraphLines.length > 0) {
        const paragraphContent = paragraphLines.join(" ").trim();
        result.push(`<p>${processInlineElements(paragraphContent)}</p>`);
      }
    }
  }

  return result.join("\n");
}

function processInlineElements(content: string): string {
  let result = content;

  // First, escape any existing HTML to prevent XSS
  result = escapeHtml(result);

  // Then process markdown formatting on the escaped content
  // IMPORTANT: Process bold before italic to handle nested formatting correctly
  result = result
    // Bold text first (process escaped asterisks) - this handles nested cases like **bold *italic* text**
    .replace(/\*\*([^*]*(?:\*(?!\*)[^*]*)*)\*\*/g, "<strong>$1</strong>")
    // Italic text after bold (single asterisks)
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    // Links (process escaped markdown syntax)
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    );

  return result.trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
