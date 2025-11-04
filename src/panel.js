import { parseWorkflow } from "./utils/parseWorkflow.js";
import { renderMarkdown } from "./utils/markdown.js";
import { buildZip } from "./utils/zip.js";
import { buildPrintHtml } from "./utils/pdf.js";
import { summarizeWorkflow } from "./utils/summarizeWorkflow.js";
import { sanitizeAiDoc } from "./utils/sanitizeAiDoc.js";
import { 
  saveApiKey, 
  getStoredApiKey, 
  saveProvider, 
  getStoredProvider, 
  saveModel, 
  getStoredModel 
} from "./utils/storage.js";

const elements = {
  uploadView: null,
  uploadArea: null,
  dropzone: null,
  fileInput: null,
  error: null,
  fileName: null,
  docsView: null,
  readmePanel: null,
  readme: null,
  downloadZip: null,
  downloadPdf: null,
  downloadJson: null,
  shareLink: null,
  shareContainer: null,
  shareUrl: null,
  copyShareLink: null,
  restart: null,
  stepUpload: null,
  stepReview: null,
  aiSettingsButton: null,
  aiSettingsPanel: null,
  aiSettingsClose: null,
  aiProvider: null,
  aiModel: null,
  aiKey: null,
  aiStatus: null,
  apiKeyLabel: null,
  aiModelField: null,
  providerDocs: null,
  globalLoader: null,
};

function cacheElements() {
  elements.uploadView = document.getElementById("upload-view");
  elements.uploadArea = document.getElementById("upload-area");
  elements.dropzone = document.getElementById("dropzone");
  elements.fileInput = document.getElementById("file-input");
  elements.error = document.getElementById("upload-error");
  elements.fileName = document.getElementById("file-name");
  elements.docsView = document.getElementById("docs-view");
  elements.readmePanel = document.getElementById("panel-readme");
  elements.readme = document.getElementById("readme-content");
  elements.downloadZip = document.getElementById("download-zip");
  elements.downloadPdf = document.getElementById("download-pdf");
  elements.downloadJson = document.getElementById("download-json");
  elements.shareLink = document.getElementById("share-link");
  elements.shareContainer = document.getElementById("share-link-container");
  elements.shareUrl = document.getElementById("share-link-url");
  elements.copyShareLink = document.getElementById("copy-share-link");
  elements.restart = document.getElementById("restart");
  elements.stepUpload = document.getElementById("step-upload");
  elements.stepReview = document.getElementById("step-review");
  elements.aiSettingsButton = document.getElementById("ai-settings-button");
  elements.aiSettingsPanel = document.getElementById("ai-settings-panel");
  elements.aiSettingsClose = document.getElementById("ai-settings-close");
  elements.aiProvider = document.getElementById("ai-provider");
  elements.aiModel = document.getElementById("ai-model");
  elements.aiKey = document.getElementById("ai-api-key");
  elements.aiStatus = document.getElementById("ai-status");
  elements.apiKeyLabel = document.getElementById("api-key-label");
  elements.aiModelField = document.getElementById("ai-model-field");
  elements.providerDocs = document.getElementById("provider-docs");
  elements.globalLoader = document.getElementById("global-loader");
}

const state = {
  originalFile: null,
  originalText: "",
  meta: null,
  apiKey: getStoredApiKey(),
  selectedProvider: getStoredProvider(),

  zipUrl: null,
  shareUrl: null,
  aiLoading: false,
  generationLoading: false,
  baseActionsEnabled: false,
  aiValidationTimer: null,
  aiValidationAbort: null,
  apiKeyValid: null,
  documentation: "",
  isAiPanelOpen: false,
  aiStatusMessage: "",
};

function isValidationActive() {
  return Boolean(state.aiValidationTimer || state.aiValidationAbort);
}

function updateAiButtonState(overrideState) {
  if (!elements.aiSettingsButton) {
    return;
  }

  const validStates = new Set(["pending", "error", "ready"]);
  let indicator = overrideState || null;

  if (!indicator) {
    if (!state.apiKey) {
      indicator = "error";
    } else if (state.aiLoading || state.generationLoading || isValidationActive()) {
      indicator = "pending";
    } else if (state.apiKeyValid === true) {
      indicator = "ready";
    } else if (state.apiKeyValid === false) {
      indicator = "error";
    } else {
      indicator = "pending";
    }
  }

  if (indicator && validStates.has(indicator)) {
    elements.aiSettingsButton.dataset.state = indicator;
  } else {
    delete elements.aiSettingsButton.dataset.state;
  }

  if (state.aiStatusMessage) {
    elements.aiSettingsButton.title = state.aiStatusMessage;
    elements.aiSettingsButton.setAttribute("aria-describedby", "ai-status");
  } else {
    elements.aiSettingsButton.removeAttribute("title");
    elements.aiSettingsButton.removeAttribute("aria-describedby");
  }
}

function initializePanel() {
  cacheElements();
  setupUpload();
  setupActions();
  setupAiControls();
  setActionsEnabled(false);
  goToStep(1);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializePanel, { once: true });
} else {
  initializePanel();
}

function setupUpload() {
  if (!elements.uploadArea) {
    return;
  }

  ["dragenter", "dragover"].forEach((eventName) => {
    elements.uploadArea.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
      elements.uploadArea.classList.add("dragover");
    });
  });

  ["dragleave", "dragend", "drop"].forEach((eventName) => {
    elements.uploadArea.addEventListener(eventName, () => {
      elements.uploadArea.classList.remove("dragover");
    });
  });

  elements.uploadArea.addEventListener("drop", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      await handleFile(files[0]);
    }
  });

  elements.uploadArea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      elements.fileInput?.click();
    }
  });

  elements.fileInput?.addEventListener("change", async (event) => {
    const target = event.target;
    const file = target?.files?.[0];
    if (file) {
      await handleFile(file);
    }
    if (target) {
      target.value = "";
    }
  });
}

function setupActions() {
  elements.downloadZip?.addEventListener("click", () => {
    if (!state.documentation) return;
    revokeUrl(state.zipUrl);
    const { url } = buildZip({ readme: state.documentation });
    state.zipUrl = url;
    triggerDownload("docs.zip", url);
  });

  elements.downloadPdf?.addEventListener("click", () => {
    if (!state.documentation) return;
    const html = buildPrintHtml(
      {
        readme: state.documentation,
        title: state.meta?.title || "Auto-Docs for n8n",
      },
      { autoPrint: true }
    );
    openPrintPreview(html);
  });

  elements.downloadJson?.addEventListener("click", () => {
    if (!state.originalText) return;
    const blob = new Blob([state.originalText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    triggerDownload(state.originalFile?.name || "workflow.json", url);
    setTimeout(() => revokeUrl(url), 4000);
  });

  elements.shareLink?.addEventListener("click", () => {
    if (!state.documentation) return;
    if (state.shareUrl) {
      revokeUrl(state.shareUrl);
    }
    const html = buildPrintHtml(
      {
        readme: state.documentation,
        title: state.meta?.title || "Auto-Docs for n8n",
      },
      { autoPrint: false }
    );
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    state.shareUrl = url;
    if (elements.shareContainer) {
      elements.shareContainer.hidden = false;
    }
    if (elements.shareUrl) {
      elements.shareUrl.textContent = url;
      elements.shareUrl.href = url;
      elements.shareUrl.focus();
    }
  });

  elements.copyShareLink?.addEventListener("click", async () => {
    if (!state.shareUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(state.shareUrl);
      elements.copyShareLink.textContent = "Copied!";
      setTimeout(() => {
        elements.copyShareLink.textContent = "Copy link";
      }, 2000);
    } catch (error) {
      console.error(error);
      elements.copyShareLink.textContent = "Press Cmd+C";
      setTimeout(() => {
        elements.copyShareLink.textContent = "Copy link";
      }, 2000);
    }
  });

  elements.restart?.addEventListener("click", () => {
    resetToUpload();
  });
}

function setupAiControls() {
  if (!elements.aiKey || !elements.aiProvider) {
    return;
  }

  const openAiPanel = () => {
    if (state.isAiPanelOpen || !elements.aiSettingsPanel) return;
    state.isAiPanelOpen = true;
    elements.aiSettingsPanel.classList.remove("hidden");
    requestAnimationFrame(() => {
      elements.aiSettingsPanel.classList.add("open");
    });
    elements.aiSettingsPanel.setAttribute("aria-hidden", "false");
    elements.aiSettingsButton?.setAttribute("aria-expanded", "true");
    setTimeout(() => {
      elements.aiKey?.focus();
    }, 120);
  };

  const closeAiPanel = (focusToggle = false) => {
    if (!state.isAiPanelOpen || !elements.aiSettingsPanel) return;
    state.isAiPanelOpen = false;
    elements.aiSettingsPanel.classList.remove("open");
    elements.aiSettingsPanel.setAttribute("aria-hidden", "true");
    elements.aiSettingsButton?.setAttribute("aria-expanded", "false");
    setTimeout(() => {
      if (!state.isAiPanelOpen) {
        elements.aiSettingsPanel?.classList.add("hidden");
      }
    }, 200);
    if (focusToggle && elements.aiSettingsButton) {
      elements.aiSettingsButton.focus();
    }
  };

  const toggleAiPanel = () => {
    if (state.isAiPanelOpen) {
      closeAiPanel(true);
    } else {
      openAiPanel();
    }
  };

  const handleOutsideClick = (event) => {
    if (!state.isAiPanelOpen) return;
    if (
      elements.aiSettingsPanel?.contains(event.target) ||
      elements.aiSettingsButton?.contains(event.target)
    ) {
      return;
    }
    closeAiPanel();
  };

  const handleEscape = (event) => {
    if (event.key === "Escape" && state.isAiPanelOpen) {
      event.preventDefault();
      closeAiPanel(true);
    }
  };

  elements.aiSettingsButton?.addEventListener("click", (event) => {
    event.preventDefault();
    toggleAiPanel();
  });

  elements.aiSettingsClose?.addEventListener("click", () => closeAiPanel(true));
  document.addEventListener("mousedown", handleOutsideClick);
  document.addEventListener("keydown", handleEscape);

  const handleProviderChange = (event) => {
    state.selectedProvider = event.target.value;
    state.apiKeyValid = null;
    saveProvider(state.selectedProvider);

    if (state.selectedProvider === "openai") {
      elements.apiKeyLabel.textContent = "OpenAI API Key";
      elements.aiKey.placeholder = "sk-...";
      if (elements.providerDocs) {
        elements.providerDocs.href = "https://platform.openai.com/api-keys";
      }
    } else {
      elements.apiKeyLabel.textContent = "Anthropic API Key";
      elements.aiKey.placeholder = "sk-ant-...";
      if (elements.providerDocs) {
        elements.providerDocs.href = "https://console.anthropic.com/account/keys";
      }
    }

    updateAiButtonState();

    if (state.apiKey) {
      queueApiKeyValidation(state.apiKey);
    }
  };

  const handleInput = (event) => {
    state.apiKey = event.target?.value?.trim() || "";
    state.apiKeyValid = null;

    if (state.apiKey) {
      saveApiKey(state.apiKey);
    } else {
      saveApiKey("");
    }

    if (state.aiValidationTimer) {
      clearTimeout(state.aiValidationTimer);
      state.aiValidationTimer = null;
    }
    if (state.aiValidationAbort) {
      state.aiValidationAbort.abort();
      state.aiValidationAbort = null;
    }

    if (!state.apiKey) {
      setAiStatus(
        `${state.selectedProvider === "openai" ? "OpenAI" : "Anthropic"} API key is required to generate documentation.`,
        "error"
      );
      updateAiButtonState("error");
      return;
    }

    queueApiKeyValidation(state.apiKey);
  };

  elements.aiProvider.addEventListener("change", handleProviderChange);
  elements.aiKey.addEventListener("input", handleInput);
  elements.aiKey.addEventListener("blur", handleInput);

  state.selectedProvider = getStoredProvider();
  elements.aiProvider.value = state.selectedProvider;

  handleProviderChange({ target: { value: state.selectedProvider } });

  const storedKey = getStoredApiKey();
  if (storedKey) {
    state.apiKey = storedKey;
    elements.aiKey.value = storedKey;
    queueApiKeyValidation(storedKey);
  } else {
    setAiStatus(
      `Enter your ${state.selectedProvider === "openai" ? "OpenAI" : "Anthropic"} API key to generate documentation.`
    );
    openAiPanel();
  }

  updateAiButtonState();
}

function queueApiKeyValidation(key) {
  if (!key) {
    return;
  }

  state.apiKeyValid = null;

  if (state.aiValidationTimer) {
    clearTimeout(state.aiValidationTimer);
  }

  setAiStatus("🔄 Validating API key...", "loading", { loading: true });

  state.aiValidationTimer = setTimeout(() => {
    state.aiValidationTimer = null;
    runApiKeyValidation(key);
  }, 600);
}

async function runApiKeyValidation(key) {
  if (state.aiValidationAbort) {
    state.aiValidationAbort.abort();
  }

  const controller = new AbortController();
  state.aiValidationAbort = controller;

  try {
    let response;
    
    if (state.selectedProvider === "openai") {
      response = await fetch("https://api.openai.com/v1/models?limit=1", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${key}`,
        },
        signal: controller.signal,
      });
    } else if (state.selectedProvider === "anthropic") {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-3-opus-20240229",
          max_tokens: 1,
          messages: [{ role: "user", content: "Hi" }]
        }),
        signal: controller.signal,
      });
    }

    if (!response.ok) {
      state.apiKeyValid = false;
      if (response.status === 401 || response.status === 403) {
        setAiStatus(`⚠️ Invalid ${state.selectedProvider === "openai" ? "OpenAI" : "Anthropic"} API key`, "error", { loading: false });
      } else {
        setAiStatus(`⚠️ API key validation failed (${response.status})`, "error", { loading: false });
      }
      return false;
    }

    state.apiKeyValid = true;
    setAiStatus(`✓ ${state.selectedProvider === "openai" ? "OpenAI" : "Anthropic"} API key verified`, "success", { loading: false });
    return true;
  } catch (error) {
    if (error.name === "AbortError") {
      return null;
    }
    state.apiKeyValid = false;
    setAiStatus("Unable to validate API key. Check your connection and try again.", "error");
    return false;
  } finally {
    if (state.aiValidationAbort === controller) {
      state.aiValidationAbort = null;
    }
    updateAiButtonState();
  }
}

async function ensureApiKeyValid() {
  if (!state.apiKey) {
    setAiStatus("OpenAI API key is required to generate documentation.", "error");
    return false;
  }

  if (state.aiValidationTimer) {
    clearTimeout(state.aiValidationTimer);
    state.aiValidationTimer = null;
  }

  if (state.aiValidationAbort) {
    state.aiValidationAbort.abort();
    state.aiValidationAbort = null;
  }

  if (state.apiKeyValid === true) {
    return true;
  }

  const result = await runApiKeyValidation(state.apiKey);
  return result === true;
}

function goToStep(step) {
  const isReview = step === 2;
  elements.uploadView?.classList.toggle("hidden", isReview);
  elements.docsView?.classList.toggle("hidden", !isReview);

  elements.stepUpload?.classList.toggle("active", step === 1);
  elements.stepReview?.classList.toggle("active", isReview);

  if (elements.stepUpload) {
    elements.stepUpload.setAttribute("aria-current", step === 1 ? "step" : "false");
  }
  if (elements.stepReview) {
    elements.stepReview.setAttribute("aria-current", isReview ? "step" : "false");
  }

  if (elements.restart) {
    elements.restart.hidden = !isReview;
  }

  if (!isReview) {
    if (elements.shareContainer) {
      elements.shareContainer.hidden = true;
    }
    setActionsEnabled(false);
  }
}

function setActionsEnabled(enabled) {
  state.baseActionsEnabled = enabled;
  applyActionDisabledState();
}

function applyActionDisabledState() {
  const shouldEnable = state.baseActionsEnabled && !state.generationLoading && !state.aiLoading;
  if (elements.downloadPdf) {
    elements.downloadPdf.disabled = !shouldEnable;
  }
}

function setAiStatus(message, stateValue, options = {}) {
  if (!elements.aiStatus) {
    return;
  }
  const hasMessage = Boolean(message);
  elements.aiStatus.textContent = hasMessage ? message : "";
  state.aiStatusMessage = hasMessage ? message : "";

  if (hasMessage && stateValue) {
    elements.aiStatus.dataset.state = stateValue;
  } else {
    delete elements.aiStatus.dataset.state;
  }

  if (hasMessage && options.loading) {
    elements.aiStatus.dataset.loading = "true";
  } else {
    delete elements.aiStatus.dataset.loading;
  }

  if (!hasMessage) {
    delete elements.aiStatus.dataset.loading;
  }

  updateAiButtonState();
}

function setAiLoading(isLoading) {
  state.aiLoading = isLoading;
  applyActionDisabledState();
  updateAiButtonState();
}

function setGlobalLoading(isLoading, message = "Generating documentation…") {
  state.generationLoading = isLoading;
  if (elements.globalLoader) {
    if (!isLoading) {
      elements.globalLoader.classList.add("hidden");
    } else {
      const textEl = elements.globalLoader.querySelector(".global-loader__message");
      if (textEl) {
        textEl.textContent = message;
      }
      elements.globalLoader.classList.remove("hidden");
    }
  }
  applyActionDisabledState();
  updateAiButtonState();
}

function resetToUpload() {
  revokeUrl(state.zipUrl);
  revokeUrl(state.shareUrl);

  state.zipUrl = null;
  state.shareUrl = null;
  state.documentation = "";
  state.meta = null;
  state.originalFile = null;
  state.originalText = "";

  setGlobalLoading(false);

  elements.fileName.textContent = "";
  if (elements.shareUrl) {
    elements.shareUrl.textContent = "";
    elements.shareUrl.removeAttribute("href");
  }
  if (elements.shareContainer) {
    elements.shareContainer.hidden = true;
  }
  if (elements.copyShareLink) {
    elements.copyShareLink.textContent = "Copy link";
  }
  if (elements.fileInput) {
    elements.fileInput.value = "";
  }
  elements.readme.innerHTML = "";
  resetError();
  setActionsEnabled(false);
  goToStep(1);
}

async function handleFile(file) {
  resetError();
  
  // Validate file type
  if (!isJsonFile(file)) {
    setError("Please provide a .json file exported from n8n.");
    return;
  }

  // Validate file size (limit to 5MB to prevent memory issues)
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  if (file.size > MAX_FILE_SIZE) {
    setError(`File is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 5MB.`);
    return;
  }

  if (file.size === 0) {
    setError("File is empty. Please provide a valid n8n workflow JSON file.");
    return;
  }

  setActionsEnabled(false);

  // Require API key before any processing
  if (!state.apiKey || !state.apiKey.trim()) {
    setError("OpenAI API key is required to proceed. Please enter your API key first.");
    setAiStatus("OpenAI API key is required to generate documentation.", "error");
    return;
  }

  try {
    const text = await file.text();
    
    // Validate JSON content before parsing
    if (!text || text.trim().length === 0) {
      throw new Error("File appears to be empty or invalid.");
    }
    
    const { workflow, meta } = parseWorkflow(text);
    
    setAiStatus("Validating API key...", "loading", { loading: true });
    const keyValid = await ensureApiKeyValid();
    if (!keyValid) {
      setError(`Invalid ${state.selectedProvider === "openai" ? "OpenAI" : "Anthropic"} API key. Please provide a valid key.`);
      setAiStatus(`${state.selectedProvider === "openai" ? "OpenAI" : "Anthropic"} API key appears invalid. Please update the key.`, "error");
      return;
    }

    setGlobalLoading(true, "Generating documentation...");
    setAiStatus("Generating documentation with AI...", "loading", { loading: true });
    setAiLoading(true);

    const { documentation } = await summarizeWorkflow(workflow, {
      apiKey: state.apiKey,
      provider: state.selectedProvider,
      model: state.selectedModel
    });

    if (!documentation || !documentation.trim()) {
      throw new Error("AI returned empty documentation.");
    }

    const cleanDoc = sanitizeAiDoc(documentation.trim());

    setAiStatus("Documentation generated via AI.", "success");
    state.apiKeyValid = true;

    updatePreview({
      documentation: cleanDoc,
      meta,
      file,
      originalText: text,
    });
  } catch (error) {
    console.error(error);
    setError(error.message || "Unable to process workflow.");
    setAiLoading(false);
    setAiStatus(error.message || "AI enrichment failed.", "error");
  } finally {
    setAiLoading(false);
    setGlobalLoading(false);
    if (!state.documentation) {
      setActionsEnabled(false);
    }
  }
}

function updatePreview({ documentation, meta, file, originalText }) {
  revokeUrl(state.shareUrl);
  state.shareUrl = null;
  revokeUrl(state.zipUrl);
  state.zipUrl = null;

  state.documentation = documentation;
  state.meta = meta;
  state.originalFile = file;
  state.originalText = originalText;

  elements.fileName.textContent = file.name ? `• ${file.name}` : "";
  elements.readme.innerHTML = renderMarkdown(documentation);

  resetError();
  if (elements.shareContainer) {
    elements.shareContainer.hidden = true;
  }
  if (elements.shareUrl) {
    elements.shareUrl.textContent = "";
    elements.shareUrl.removeAttribute("href");
  }
  if (elements.copyShareLink) {
    elements.copyShareLink.textContent = "Copy link";
  }
  setGlobalLoading(false);
  goToStep(2);
  setActionsEnabled(true);
}

function isJsonFile(file) {
  if (!file) return false;
  if (file.type === "application/json") return true;
  return file.name?.toLowerCase().endsWith(".json");
}

function triggerDownload(filename, url) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function openPrintPreview(html) {
  const printWindow = window.open("", "_blank", "noopener");
  if (!printWindow) {
    setError("Pop-up blocked. Allow pop-ups for this extension to print.");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

function setError(message) {
  elements.error.textContent = message;
}

function resetError() {
  elements.error.textContent = "";
}

function revokeUrl(url) {
  if (url) {
    URL.revokeObjectURL(url);
  }
}


window.addEventListener("beforeunload", () => {
  revokeUrl(state.zipUrl);
  revokeUrl(state.shareUrl);
});
