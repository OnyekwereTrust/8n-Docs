const headingPattern = /^(#{1,3})\s+(.*)$/gm;
const boldPattern = /\*\*(.+?)\*\*/g;
const italicPattern = /_(.+?)_/g;
const bulletPattern = /^(\s*)[-*]\s+(.*)$/gm;
const numberedPattern = /^(\s*)\d+\.\s+(.*)$/gm;
const blockquotePattern = /^>\s?(.*)$/gm;
const inlineCodePattern = /`([^`]+)`/g;
const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;

export function renderMarkdown(markdown) {
  if (!markdown) {
    return "<pre>(empty)</pre>";
  }

  const trimmed = typeof markdown === "string" ? markdown.trim() : "";
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") {
        const segments = [];
        if (parsed.workflow_description) {
          segments.push(
            `<section class="doc-block doc-block--description">${compileMarkdown(
              parsed.workflow_description
            )}</section>`
          );
        }
        if (parsed.workflow_diagram) {
          segments.push(
            `<section class="doc-block doc-block--diagram">${compileMarkdown(
              parsed.workflow_diagram
            )}</section>`
          );
        }
        if (parsed.nodes_settings) {
          segments.push(
            `<section class="doc-block doc-block--nodes">${compileMarkdown(
              parsed.nodes_settings
            )}</section>`
          );
        }
        if (segments.length) {
          return `<div class="markdown">${segments.join("")}</div>`;
        }
      }
    } catch (error) {
      // fall through to plain markdown rendering
    }
  }

  return `<div class="markdown">${compileMarkdown(markdown)}</div>`;
}

function compileMarkdown(markdown) {
  const codeBlocks = [];
  let workingText = String(markdown).replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, content) => {
    const token = `@@CODE_BLOCK_${codeBlocks.length}@@`;
    codeBlocks.push({
      lang: lang || "",
      content,
    });
    return token;
  });

  const escaped = escapeHtml(workingText);

  const withHeadings = escaped.replace(headingPattern, (_, hashes, text) => {
    const level = Math.min(hashes.length, 3);
    const tag = level === 1 ? "h2" : level === 2 ? "h3" : "h4";
    const cleanText = text.trim();
    return `\n\n<${tag}>${cleanText}</${tag}>\n\n`;
  });

  const withBold = withHeadings.replace(boldPattern, "<strong>$1</strong>");
  const withItalics = withBold.replace(italicPattern, "<em>$1</em>");

  const withInlineCode = withItalics.replace(inlineCodePattern, "<code>$1</code>");
  const withImages = withInlineCode.replace(imagePattern, (_, alt, src) => {
    return `<img src="${src}" alt="${escapeHtml(alt)}" />`;
  });

  const withBlockquotes = withImages.replace(blockquotePattern, (_, text) => {
    return `<blockquote>${text}</blockquote>`;
  });

  const withLists = withBlockquotes
    .replace(bulletPattern, (_, spaces, text) => `${spaces}<li data-type="ul">${text}</li>`)
    .replace(numberedPattern, (_, spaces, text) => `${spaces}<li data-type="ol">${text}</li>`);

  let paragraphs = withLists
    .split(/\n{2,}/)
    .map((chunk) => {
      const trimmedChunk = chunk.trim();
      if (!trimmedChunk) {
        return "";
      }
      if (trimmedChunk.match(/^<h[2-4]>.*<\/h[2-4]>$/)) {
        return trimmedChunk;
      }
      if (trimmedChunk.startsWith("<h")) {
        return trimmedChunk;
      }
      if (trimmedChunk.startsWith("<blockquote")) {
        return trimmedChunk;
      }
      if (trimmedChunk.includes("@@CODE_BLOCK_")) {
        return trimmedChunk;
      }
      if (trimmedChunk.includes("<li")) {
        const listType = trimmedChunk.includes('data-type="ol"') ? "ol" : "ul";
        const normalized = trimmedChunk.replace(/\s?data-type="(?:ul|ol)"/g, "");
        return `<${listType}>${normalized}</${listType}>`;
      }
      return `<p>${trimmedChunk.replace(/\n/g, "<br />")}</p>`;
    })
    .filter(Boolean)
    .join("");

  codeBlocks.forEach((block, index) => {
    const token = `@@CODE_BLOCK_${index}@@`;
    let replacement;
    if ((block.lang || "").toLowerCase() === "mermaid") {
      replacement = `<div class="mermaid">${escapeHtml(block.content)}</div>`;
    } else {
      const langClass = block.lang ? ` class="language-${escapeLang(block.lang)}"` : "";
      replacement = `<pre><code${langClass}>${escapeHtml(block.content)}</code></pre>`;
    }
    paragraphs = paragraphs.replace(new RegExp(token, "g"), replacement);
  });

  return paragraphs;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeLang(lang) {
  return String(lang).replace(/[^a-z0-9-]/gi, "").toLowerCase();
}
