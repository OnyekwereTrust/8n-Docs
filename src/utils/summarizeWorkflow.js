const DEFAULT_MODEL = "gpt-3.5-turbo";
const DEFAULT_PROVIDER = "openai";

const SYSTEM_PROMPT = `You are an expert technical writer who produces precise, implementation-focused documentation for n8n workflows.
- You always follow instructions exactly.
- Your tone is concise, direct, and free of filler or marketing language.
- When asked for JSON output, you return strictly valid JSON with the required keys and plain markdown string values.
- Never include commentary outside the requested JSON payload.`;

const USER_PROMPT_TEMPLATE = `You will be given an n8n workflow export (JSON). Using it, produce documentation for Docsify.js that includes a Mermaid diagram. Follow these rules exactly:

OUTPUT FORMAT REQUIREMENTS
- Each key's value must be a single markdown string. Do not wrap the JSON in code fences.
- Escape any internal double quotes with a backslash. Preserve \\n for newlines.
- Do not add comments or explanations outside of the JSON object.

FORMATTING GUIDELINES
- Keep a blank line before and after every heading.
- Use numbered lists and bullet lists exactly as shown.
- Do not use horizontal rules (---).
- Keep paragraphs to 2-3 sentences.

SECTION REQUIREMENTS

1) workflow_description (markdown):
\`\`\`
## Overview

[Write 2-3 concise paragraphs. Start with "This workflow..." or "The workflow...". Describe purpose, beneficiaries, and the problem solved.]

## Process

1. **Trigger:** [Explain how the workflow starts]
2. **[...]** [Continue each node in execution order]

## Business Value

[Single paragraph describing measurable impact: time saved, errors prevented, automation benefits.]
\`\`\`

2) workflow_diagram (markdown):
\`\`\`
## Workflow Diagram

![Workflow Diagram](data:image/svg+xml;base64,[diagramBytes])
\`\`\`
- Embed the rendered SVG as a base64 data URI that visualizes every node and connection.

3) nodes_settings (markdown):
\`\`\`
## Node Configuration Details

### 1. [Node Name]
**Type:** \`[Node Type]\` | **Position:** Step X of N

[One sentence describing the node's role.]

**Connections:**
- ⬅️ **Input from:** [...]
- ➡️ **Output to:** [...]

[If expressions or code exist:]
**Logic/Expression:**
\`\`\`javascript
[expression]
\`\`\`

\`\`\`
- Repeat for every node in execution order.
- Include method, URL, credentials (as [Configured]/[Required]), filters, headers, important parameters.
- Omit ids/typeVersion/position unless relevant.
- Sanitize sensitive values; never output secrets.

ADDITIONAL CONTEXT
- Workflow name: {WORKFLOW_NAME}
- Node count: {NODE_COUNT}
- Provide accurate details using the JSON.

Workflow JSON:
{workflowJson}`;

export async function summarizeWorkflow(workflow, options = {}) {
  const { apiKey, provider = DEFAULT_PROVIDER } = options;

  if (!apiKey) {
    throw new Error(`${provider === "openai" ? "OpenAI" : "Anthropic"} API key is required for AI documentation.`);
  }
  
  // Use the best model for each provider
  const model = provider === "openai" ? "gpt-3.5-turbo" : "claude-3-opus-20240229";

  const workflowJson = JSON.stringify(workflow, null, 2);
  const userContent = USER_PROMPT_TEMPLATE.replace("{WORKFLOW_NAME}", workflow.name || "Untitled Workflow")
    .replace("{WORKFLOW_ACTIVE}", String(Boolean(workflow.active)))
    .replace("{NODE_COUNT}", String(Array.isArray(workflow.nodes) ? workflow.nodes.length : 0))
    .replace("{workflowJson}", workflowJson);

  let response;
  
  if (provider === "openai") {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: userContent,
          },
        ],
      }),
    });
  } else if (provider === "anthropic") {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2024-01-01"
      },
      body: JSON.stringify({
        model: "claude-3-opus-20240229",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: `${SYSTEM_PROMPT}\n\n${userContent}`
          }
        ],
        system: SYSTEM_PROMPT
      }),
    });
  }

  if (!response.ok) {
    const errorText = await safeReadText(response);
    throw new Error(`AI request failed (${response.status}): ${errorText || response.statusText}`);
  }

  const data = await response.json();
  let content;
  
  if (provider === "openai") {
    content = data?.choices?.[0]?.message?.content;
  } else if (provider === "anthropic") {
    content = data?.content?.[0]?.text;
  }

  if (!content || !content.trim()) {
    throw new Error("AI response missing documentation content.");
  }

  // Post-process to remove AI tells and improve quality
  const cleanedContent = postProcessContent(content.trim(), workflow);

  return {
    documentation: cleanedContent,
  };
}

/**
 * Post-process documentation to remove AI tells and improve quality
 */
function postProcessContent(content, workflow) {
  let cleaned = stripJsonCodeFence(content);

  // Clean up line endings
  cleaned = cleaned.replace(/\r\n?/g, '\n');

  // Remove version information
  cleaned = cleaned.replace(
    /^.*[Tt]emplate\s+(was\s+)?created\s+in\s+n8n\s+v?[\d.]+.*$/gm,
    ""
  );
  cleaned = cleaned.replace(
    /^.*[Tt]his\s+template\s+was\s+created\s+in\s+n8n\s+v?[\d.]+.*$/gm,
    ""
  );

  // Remove generic AI phrases
  const aiPhrases = [
    /In conclusion[,\s]/gi,
    /Ultimately[,\s]/g,
    /Furthermore[,\s]/g,
    /Moreover[,\s]/g,
    /It is important to note that/gi,
    /It should be noted that/gi,
    /It is worth mentioning that/gi,
    /As previously mentioned/gi,
    /As mentioned above/gi,
    /As stated earlier/gi,
  ];

  aiPhrases.forEach((phrase) => {
    cleaned = cleaned.replace(phrase, "");
  });

  // Replace generic words with simpler alternatives
  const wordReplacements = [
    [/utilize/gi, "use"],
    [/utilization/gi, "use"],
    [/facilitate/gi, "help"],
    [/facilitates/gi, "helps"],
    [/leverage/gi, "use"],
    [/leverages/gi, "uses"],
    [/implement/gi, "set up"],
    [/implementation/gi, "setup"],
    [/optimize/gi, "improve"],
    [/optimization/gi, "improvement"],
    [/enhance/gi, "improve"],
    [/enhancement/gi, "improvement"],
  ];

  wordReplacements.forEach(([pattern, replacement]) => {
    cleaned = cleaned.replace(pattern, replacement);
  });

  // Fix repetitive sentence starters (simple heuristic: check for 3+ sentences starting the same way)
  // This is a basic check - more sophisticated NLP would be better but keeping it simple
  cleaned = varySentenceStarters(cleaned);

  // Remove excessive adjectives (basic heuristic: remove "very", "extremely", "highly" when redundant)
  cleaned = cleaned.replace(/\b(very|extremely|highly|significantly)\s+/gi, "");

  // Clean up extra whitespace
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  cleaned = cleaned.replace(/[^\S\r\n]+/g, " ");
  cleaned = cleaned.trim();

  const jsonWithDiagram = attachGeneratedDiagram(cleaned, workflow);
  if (jsonWithDiagram) {
    return jsonWithDiagram;
  }

  return cleaned;
}

/**
 * Basic heuristic to vary sentence starters by detecting and fixing repetition
 */
function varySentenceStarters(text) {
  // Split into sentences
  const sentences = text.split(/([.!?]\s+)/);
  const result = [];
  const recentStarters = [];
  const maxRecent = 3;

  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = sentences[i]?.trim();
    if (!sentence) {
      result.push(sentences[i] || "");
      continue;
    }

    // Extract first 3-4 words as "starter"
    const words = sentence.split(/\s+/);
    if (words.length < 3) {
      result.push(sentence + (sentences[i + 1] || ""));
      continue;
    }

    const starter = words.slice(0, 2).join(" ").toLowerCase();
    const punctuation = sentences[i + 1] || "";

    // Check if this starter was used recently
    const recentCount = recentStarters.filter((s) => s === starter).length;

    if (recentCount >= 2 && words.length > 4) {
      // Try to rephrase by moving a word or using a different structure
      // Simple approach: if it starts with "The workflow", sometimes use "This workflow" or restructure
      if (starter === "the workflow" || starter === "this workflow") {
        if (recentCount % 2 === 0) {
          words[0] = words[0] === "The" ? "This" : "The";
        } else {
          // Try to restructure: "The workflow processes..." -> "Processing happens when..."
          if (words[2] && words[2].endsWith("s")) {
            const verb = words[2].slice(0, -1); // Remove 's'
            words.splice(0, 3, verb.charAt(0).toUpperCase() + verb.slice(1), "happens", "when");
          }
        }
      }
    }

    result.push(words.join(" ") + punctuation);
    recentStarters.push(starter);
    if (recentStarters.length > maxRecent) {
      recentStarters.shift();
    }
  }

  return result.join("");
}

async function safeReadText(response) {
  try {
    return await response.text();
  } catch (error) {
    return "";
  }
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

function attachGeneratedDiagram(documentText, workflow) {
  if (!workflow || typeof workflow !== "object") {
    return null;
  }
  const trimmed = typeof documentText === "string" ? documentText.trim() : "";
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const diagramMarkdown = buildWorkflowDiagramMarkdown(workflow);
    if (!diagramMarkdown) {
      return null;
    }
    const updated = { ...parsed, workflow_diagram: diagramMarkdown };
    if (typeof updated.workflow_description !== "string") {
      updated.workflow_description = "";
    }
    if (typeof updated.nodes_settings !== "string") {
      updated.nodes_settings = "";
    }
    return JSON.stringify(updated, null, 2);
  } catch (error) {
    return null;
  }
}

function buildWorkflowDiagramMarkdown(workflow) {
  const svg = renderWorkflowDiagramSvg(workflow);
  if (!svg) {
    return "## Workflow Diagram\n\n_No diagram available._";
  }
  const encoded = base64Encode(svg);
  if (!encoded) {
    return "## Workflow Diagram\n\n_No diagram available._";
  }
  return `## Workflow Diagram

![Workflow Diagram](data:image/svg+xml;base64,${encoded})`;
}

function renderWorkflowDiagramSvg(workflow) {
  if (!workflow || typeof workflow !== "object" || !Array.isArray(workflow.nodes) || !workflow.nodes.length) {
    return null;
  }

  const nodes = workflow.nodes;
  const nodeInfos = [];
  const nodeMap = new Map();

  nodes.forEach((node, index) => {
    if (!node || typeof node !== "object") {
      return;
    }
    const key = node.name || node.id || `Node_${index + 1}`;
    if (nodeMap.has(key)) {
      return;
    }
    const info = {
      key,
      node,
      label: deriveNodeLabel(node, index),
      index,
      type: node.type || "",
    };
    nodeInfos.push(info);
    nodeMap.set(key, info);
  });

  if (!nodeInfos.length) {
    return null;
  }

  const edges = [];
  const connections = workflow.connections || {};
  Object.entries(connections).forEach(([sourceKey, types]) => {
    if (!nodeMap.has(sourceKey)) {
      return;
    }
    Object.values(types || {}).forEach((sets) => {
      if (!Array.isArray(sets)) {
        return;
      }
      sets.forEach((targets) => {
        if (!Array.isArray(targets)) {
          return;
        }
        targets.forEach((target) => {
          if (!target || typeof target !== "object") {
            return;
          }
          const destKey = target.node;
          if (!nodeMap.has(destKey)) {
            return;
          }
          let label = "";
          if (typeof target.index === "number" && target.type && target.type !== "main") {
            label = `${target.type} ${target.index + 1}`;
          }
          edges.push({ from: sourceKey, to: destKey, label });
        });
      });
    });
  });

  const NODE_WIDTH = 240;
  const NODE_HEIGHT = 90;
  const V_SPACING = 50;
  const MARGIN = 80;
  const width = NODE_WIDTH + MARGIN * 2;
  const height = MARGIN * 2 + nodeInfos.length * (NODE_HEIGHT + V_SPACING);

  const positions = new Map();
  nodeInfos.forEach((info, idx) => {
    const x = width / 2;
    const y = MARGIN + idx * (NODE_HEIGHT + V_SPACING) + NODE_HEIGHT / 2;
    positions.set(info.key, { x, y });
  });

  const nodesSvg = [];
  const edgesSvg = [];

  edges.forEach((edge) => {
    const fromPos = positions.get(edge.from);
    const toPos = positions.get(edge.to);
    if (!fromPos || !toPos) {
      return;
    }
    const startX = fromPos.x;
    const startY = fromPos.y + NODE_HEIGHT / 2;
    const endX = toPos.x;
    const endY = toPos.y - NODE_HEIGHT / 2;
    const midY = (startY + endY) / 2;
    edgesSvg.push(`<path class="edge" d="M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}" marker-end="url(#arrow)" />`);
    if (edge.label) {
      edgesSvg.push(`<text class="edge-label" x="${(startX + endX) / 2}" y="${midY - 6}">${escapeSvgText(edge.label)}</text>`);
    }
  });

  nodeInfos.forEach((info) => {
    const pos = positions.get(info.key);
    if (!pos) {
      return;
    }
    const category = categorizeNode(info);
    const x = pos.x - NODE_WIDTH / 2;
    const y = pos.y - NODE_HEIGHT / 2;
    const rx = 18;
    const baseRect = `<rect class="node ${category.className}" x="${x}" y="${y}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="${rx}" ry="${rx}" />`;
    let shape = baseRect;
    if (category.shape === "ellipse") {
      shape = `<ellipse class="node ${category.className}" cx="${pos.x}" cy="${pos.y}" rx="${NODE_WIDTH / 2}" ry="${NODE_HEIGHT / 2}" />`;
    } else if (category.shape === "diamond") {
      shape = `<polygon class="node ${category.className}" points="${pos.x},${y} ${x + NODE_WIDTH},${pos.y} ${pos.x},${y + NODE_HEIGHT} ${x},${pos.y}" />`;
    }
    nodesSvg.push(shape);

    const lines = splitLabelIntoLines(info.label, 22);
    lines.forEach((line, idx) => {
      const offset = (idx - (lines.length - 1) / 2) * 18;
      nodesSvg.push(`<text class="node-label" x="${pos.x}" y="${pos.y + offset}">${escapeSvgText(line)}</text>`);
    });
  });

  const svgParts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${Math.max(height, 240)}" viewBox="0 0 ${width} ${Math.max(height, 240)}">`,
    "<defs>",
    '<marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth">',
    '<path d="M0,0 L10,5 L0,10 z" fill="#607D8B" />',
    "</marker>",
    "</defs>",
    `<style>
      .node { stroke-width: 2; }
      .node-trigger { fill:#4CAF50; stroke:#2E7D32; }
      .node-action { fill:#2196F3; stroke:#1565C0; }
      .node-logic { fill:#FF9800; stroke:#E65100; }
      .node-function { fill:#7E57C2; stroke:#5E35B1; }
      .node-end { fill:#F44336; stroke:#C62828; }
      .node-error { fill:#9C27B0; stroke:#6A1B9A; }
      .node-label { fill:#FFFFFF; font-family:'Segoe UI', Helvetica, Arial, sans-serif; font-size:14px; text-anchor:middle; dominant-baseline:middle; }
      .edge { stroke:#90A4AE; stroke-width:2; fill:none; }
      .edge-label { fill:#607D8B; font-size:12px; font-family:'Segoe UI', Helvetica, Arial, sans-serif; text-anchor:middle; }
      text { user-select:none; }
    </style>`,
    edgesSvg.join(""),
    nodesSvg.join(""),
    "</svg>",
  ];

  return svgParts.join("");
}


function deriveNodeLabel(node, index) {
  if (node && typeof node.name === "string" && node.name.trim().length) {
    return node.name.trim();
  }
  if (node && typeof node.displayName === "string" && node.displayName.trim().length) {
    return node.displayName.trim();
  }
  if (node && typeof node.type === "string" && node.type.trim().length) {
    const parts = node.type.split(".");
    return parts[parts.length - 1] || `Node ${index + 1}`;
  }
  return `Node ${index + 1}`;
}

function categorizeNode(info) {
  const type = String(info.type || "").toLowerCase();
  if (type.includes("error")) {
    return { className: "node-error", shape: "ellipse" };
  }
  if (type.includes("trigger") || type.includes("webhook") || type.includes("start")) {
    return { className: "node-trigger", shape: "ellipse" };
  }
  if (type.includes("if") || type.includes("switch") || type.includes("router")) {
    return { className: "node-logic", shape: "diamond" };
  }
  if (type.includes("code") || type.includes("function")) {
    return { className: "node-function", shape: "rect" };
  }
  if (type.includes("end") || type.includes("respond")) {
    return { className: "node-end", shape: "ellipse" };
  }
  return { className: "node-action", shape: "rect" };
}

function splitLabelIntoLines(label, maxLength = 22) {
  const words = String(label || "").split(/\s+/).filter(Boolean);
  if (!words.length) {
    return ["(unnamed node)"];
  }
  const lines = [];
  let current = "";
  words.forEach((word) => {
    if ((current + " " + word).trim().length > maxLength && current) {
      lines.push(current.trim());
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  });
  if (current) {
    lines.push(current.trim());
  }
  if (lines.length > 3) {
    const truncated = lines.slice(0, 3);
    const last = truncated[2];
    truncated[2] = last.length > maxLength - 1 ? `${last.slice(0, maxLength - 1)}…` : `${last}…`;
    return truncated;
  }
  return lines;
}

function escapeSvgText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function base64Encode(svg) {
  try {
    if (typeof window !== "undefined" && window.btoa) {
      return window.btoa(unescape(encodeURIComponent(svg)));
    }
  } catch (error) {
    // fall back to Buffer
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(svg, "utf8").toString("base64");
  }
  return null;
}
