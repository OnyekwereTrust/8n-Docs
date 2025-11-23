const SECTION_HEADINGS = [
  "High-Level Summary",
  "Key Features",
  "Process Flow",
  "Business Value",
  "Setup Instructions",
  "Configuration Details",
  "Overview",
  "Process",
  "Use Cases",
  "Integrations",
  "Recommendations",
];

const BULLET_CHARS = /^(?:\s*[•‣▪●■*]+\s*)/gm;

export function sanitizeAiDoc(input) {
  if (!input) {
    return "";
  }

  let text = stripJsonCodeFence(String(input));

  // Fix common AI formatting issues in JSON
  text = text.replace(/\*\*"([^"]+)"\*\*\s*:/g, '"$1":'); // Remove bold keys
  text = text.replace(/'([^']+)'\s*:/g, '"$1":'); // Replace single quotes on keys

  const compact = text.trim();
  if (compact.startsWith("{") && compact.endsWith("}")) {
    return compact;
  }

  text = text.replace(/\r\n?/g, "\n");
  text = text.replace(/[\u2028\u2029\u200B]/g, "");
  text = text.replace(/([A-Za-z])\n(?=[A-Za-z])/g, "$1 ");
  text = text.replace(BULLET_CHARS, "- ");
  text = text.replace(new RegExp(`^#\s+(${SECTION_HEADINGS.join("|")})\\b`, "gim"), "## $1");
  text = text.replace(/^#\s+/gm, "## ");

  SECTION_HEADINGS.forEach((heading) => {
    const plainHeadingRegex = new RegExp(`^\\s*${heading}\\b\\s*(.+)?`, "im");
    text = text.replace(plainHeadingRegex, (_, rest = "") => {
      const body = rest.trim();
      return body ? `## ${heading}\n\n${body}` : `## ${heading}`;
    });

    const inlineHeadingRegex = new RegExp(`^##\\s*${heading}\\b\\s+(.+)`, "im");
    text = text.replace(inlineHeadingRegex, (_, rest) => `## ${heading}\n\n${rest.trim()}`);

    const tightHeadingRegex = new RegExp(`^##\\s*${heading}\\b`, "gim");
    text = text.replace(tightHeadingRegex, `## ${heading}`);
  });

  text = text.replace(
    /^(#{1,6}\s+[^\n]+)([^\n]*?)$/gm,
    (_, headingLine, trailing) => {
      const trimmedTrailing = trailing.trim();
      if (!trimmedTrailing) {
        return headingLine;
      }
      return `${headingLine}\n\n${trimmedTrailing}`;
    }
  );

  text = text.replace(/([^\n])\n(#{1,6}\s)/g, "$1\n\n$2");
  text = text.replace(/(#{1,6}\s+[^\n]+)(?!\n\n)/g, "$1\n\n");

  const lines = text.split("\n");
  for (let i = 0; i < lines.length - 1; i += 1) {
    const line = lines[i];
    const nextLine = lines[i + 1];
    if (!/^#{1,6}\s/.test(line)) {
      continue;
    }
    const trimmedNext = nextLine?.trim();
    if (
      trimmedNext &&
      trimmedNext.length > 0 &&
      trimmedNext.length <= 8 &&
      /^[A-Za-z]+$/.test(trimmedNext) &&
      /[A-Za-z]$/.test(line.trim())
    ) {
      lines[i] = `${line}${trimmedNext}`;
      lines.splice(i + 1, 1);
      i -= 1;
    }
  }
  text = lines.join("\n");

  text = text.replace(/([^\n])\n(-\s)/g, "$1\n\n$2");
  text = text.replace(/^\s*-\s+/gm, "- ");

  text = text.replace(/\n{3,}/g, "\n\n");

  text = text.replace(/\s+$/g, "");

  return `${text}\n`;
}


function stripJsonCodeFence(value) {
  if (value == null) {
    return "";
  }
  let trimmed = String(value).trim();
  if (/^```json/i.test(trimmed) && trimmed.endsWith("```")) {
    trimmed = trimmed.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  } else if (/^```/.test(trimmed) && trimmed.endsWith("```")) {
    trimmed = trimmed.replace(/^```\s*/, "").replace(/```$/, "").trim();
  } else if (/^`json\b/i.test(trimmed) && trimmed.endsWith("`")) {
    trimmed = trimmed.replace(/^`json\s*/i, "").replace(/`$/, "").trim();
  } else if (/^json\s*{\s*/i.test(trimmed) && trimmed.endsWith("}")) {
    trimmed = trimmed.replace(/^json\s*/i, "").trim();
  }
  return trimmed;
}
