export function parseWorkflow(text) {
  if (typeof text !== "string") {
    throw new Error("Expected file contents as text.");
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error("Invalid JSON: unable to parse workflow.");
  }

  // Handle missing or invalid workflow data
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid workflow: expected an object.");
  }

  const workflow = normalizeWorkflow(parsed);
  const {
    names: credentialNames,
    usageByCredential,
    usageByNode,
  } = collectCredentialNames(workflow);

  // Safely remove credentials from nodes
  if (Array.isArray(workflow.nodes)) {
    workflow.nodes.forEach((node) => {
      if (node && typeof node === "object") {
        delete node.credentials;
      }
    });
  }

  return {
    workflow,
    meta: {
      credentialNames: Array.from(credentialNames).sort(),
      credentialUsage: mapSetToObject(usageByCredential),
      nodeCredentials: mapSetToObject(usageByNode),
      title: workflow.name || "n8n Workflow",
    },
  };
}

function normalizeWorkflow(data) {
  const workflow = { ...data };

  workflow.name = typeof workflow.name === "string" ? workflow.name : "Untitled Workflow";
  workflow.nodes = Array.isArray(workflow.nodes) ? workflow.nodes.map(normalizeNode) : [];
  workflow.connections =
    workflow.connections && typeof workflow.connections === "object"
      ? workflow.connections
      : {};

  return workflow;
}

function normalizeNode(node) {
  const safeNode = { ...node };

  safeNode.id = safeNode.id ?? safeNode.name ?? cryptoRandomId();
  safeNode.name = typeof safeNode.name === "string" ? safeNode.name : String(safeNode.id);
  safeNode.type = typeof safeNode.type === "string" ? safeNode.type : "n8n-nodes-base.unknown";
  safeNode.parameters =
    safeNode.parameters && typeof safeNode.parameters === "object" ? safeNode.parameters : {};
  safeNode.position = Array.isArray(safeNode.position) ? safeNode.position : [0, 0];

  return safeNode;
}

function collectCredentialNames(workflow) {
  const names = new Set();
  const usageByCredential = new Map();
  const usageByNode = new Map();

  // Safely handle missing or invalid nodes array
  if (!Array.isArray(workflow.nodes)) {
    return {
      names,
      usageByCredential,
      usageByNode,
    };
  }

  workflow.nodes.forEach((node) => {
    // Skip invalid nodes
    if (!node || typeof node !== "object") {
      return;
    }

    const credentials = node.credentials;
    if (!credentials || typeof credentials !== "object") {
      return;
    }

    Object.entries(credentials).forEach(([key, value]) => {
      if (!key) {
        return;
      }

      const name = deriveCredentialName(value);
      const resolvedName = name || key;
      names.add(resolvedName);

      if (!usageByCredential.has(resolvedName)) {
        usageByCredential.set(resolvedName, new Set());
      }
      usageByCredential.get(resolvedName).add(node.name || node.id || key);

      const nodeKey = node.name || node.id || "node";
      if (!usageByNode.has(nodeKey)) {
        usageByNode.set(nodeKey, new Set());
      }
      usageByNode.get(nodeKey).add(resolvedName);
    });
  });

  return {
    names,
    usageByCredential,
    usageByNode,
  };
}

function deriveCredentialName(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (typeof value.id === "string") {
    return value.id;
  }

  if (typeof value.name === "string") {
    return value.name;
  }

  return null;
}

function cryptoRandomId() {
  // Use browser crypto when available; fallback to Math.random for compatibility.
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `node-${Math.random().toString(36).slice(2, 10)}`;
}

function mapSetToObject(map) {
  const entries = {};
  map.forEach((set, key) => {
    entries[key] = Array.from(set).sort();
  });
  return entries;
}
