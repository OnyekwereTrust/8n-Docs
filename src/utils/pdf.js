export function buildPrintHtml(data, options = {}) {
  const { readme, title } = data;
  const { autoPrint = true } = options;
  const safeTitle = sanitize(title || "Auto-Docs for n8n");

  const readmeBlocks = buildDocumentationSections(readme);
  const script = autoPrint
    ? `<script>window.addEventListener("load",()=>{setTimeout(()=>{window.print();},150);});</script>`
    : "";

  return [
    "<!DOCTYPE html>",
    "<html lang=\"en\">",
    "<head>",
    "<meta charset=\"UTF-8\" />",
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\" />",
    `<title>${safeTitle}</title>`,
    "<style>",
    baseStyles(),
    "</style>",
    "</head>",
    "<body>",
    `<header><h1>${safeTitle}</h1><p>AI-generated documentation by Auto-Docs for n8n.</p></header>`,
    "<main>",
    readmeBlocks,
    "</main>",
    "<footer style=\"margin-top: 3rem; padding-top: 2rem; border-top: 1px solid #d7dcf7; text-align: center; color: #54576f; font-size: 0.875rem;\"><p style=\"margin: 0;\">Made by Trust Onyekwere</p></footer>",
    script,
    "</body>",
    "</html>",
  ].join("");
}

function baseStyles() {
  return `
    :root {
      color-scheme: light;
      font-family: "Segoe UI", Helvetica, Arial, sans-serif;
      background: #f5f7fb;
      color: #1d1d1f;
    }
    body {
      margin: 0;
      padding: 2rem;
    }
    header {
      text-align: left;
      margin-bottom: 2rem;
    }
    header h1 {
      margin: 0 0 0.5rem;
      font-size: 1.75rem;
    }
    main {
      display: grid;
      gap: 1.5rem;
    }
    section {
      background: #ffffff;
      border: 1px solid #d7dcf7;
      border-radius: 12px;
      padding: 1.25rem;
      box-shadow: 0 1px 2px rgba(18, 25, 45, 0.08);
      page-break-inside: avoid;
    }
    section h2 {
      margin-top: 0;
      margin-bottom: 1rem;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: "SFMono-Regular", Menlo, Consolas, monospace;
      font-size: 0.9rem;
      line-height: 1.45;
    }
    code {
      font-family: inherit;
    }
    @media print {
      body {
        padding: 1rem;
      }
      section {
        box-shadow: none;
        border-color: #c3c8ef;
      }
    }
  `;
}

function wrapSection(title, content) {
  return `<section><h2>${sanitize(title)}</h2>${content}</section>`;
}

function renderCodeFence(text, lang) {
  if ((lang || "").toLowerCase() === "mermaid") {
    return `<div class="mermaid">${sanitize(text || "")}</div>`;
  }
  const safeLang = lang ? ` class="language-${sanitize(lang || "")}"` : "";
  return `<pre${safeLang}>${sanitize(text || "")}</pre>`;
}

function sanitize(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMarkdown(markdown) {
  if (!markdown) {
    return "<p>(empty)</p>";
  }

  const codeBlocks = [];
  let text = markdown.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, content) => {
    const token = `@@CODE_BLOCK_${codeBlocks.length}@@`;
    codeBlocks.push({ lang, content });
    return token;
  });

  text = sanitize(text);

  text = text.replace(/^#{3}\s+(.+)$/gm, "<h3>$1</h3>");
  text = text.replace(/^#{2}\s+(.+)$/gm, "<h2>$1</h2>");
  text = text.replace(/^#{1}\s+(.+)$/gm, "<h1>$1</h1>");

  text = text.replace(/^\s*[-*]\s+(.+)$/gm, "<li>$1</li>");
  text = text.replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>");

  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");

  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
    return `<img src="${src}" alt="${sanitize(alt)}" style="max-width:100%;"/>`;
  });

  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/_(.+?)_/g, "<em>$1</em>");

  const blocks = text
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (/^<h[1-3]>/.test(trimmed) || /^<ul>/.test(trimmed)) return trimmed;
      if (trimmed.includes("@@CODE_BLOCK_")) return trimmed;
      return `<p>${trimmed.replace(/\n/g, "<br />")}</p>`;
    })
    .filter(Boolean)
    .join("");

  let html = blocks;
  codeBlocks.forEach((block, index) => {
    const token = `@@CODE_BLOCK_${index}@@`;
    html = html.replace(
      new RegExp(token, "g"),
      renderCodeFence(block.content, block.lang)
    );
  });

  return html;
}

function buildDocumentationSections(readme) {
  if (!readme || typeof readme !== "string") {
    return wrapSection("Documentation", "<p>(empty)</p>");
  }

  const trimmed = readme.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") {
        const parts = [];
        if (parsed.workflow_description) {
          parts.push(
            wrapSection("Workflow Description", renderMarkdown(parsed.workflow_description))
          );
        }
        if (parsed.workflow_diagram) {
          parts.push(
            wrapSection("Workflow Diagram", renderMarkdown(parsed.workflow_diagram))
          );
        }
        if (parsed.nodes_settings) {
          parts.push(
            wrapSection("Node Configuration Details", renderMarkdown(parsed.nodes_settings))
          );
        }
        if (parts.length) {
          return parts.join("");
        }
      }
    } catch (error) {
      // fall through to default handling
    }
  }

  return wrapSection("Documentation", renderMarkdown(readme));
}
