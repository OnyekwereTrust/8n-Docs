# 8n Docs (Auto-Docs for n8n)

Chrome extension that transforms exported n8n `workflow.json` files into Docsify-ready documentation with AI. Launch the panel, connect your preferred LLM provider, and review the polished README before printing to PDF.

## What it does

- Guided two-step panel: drop an n8n export, then review the generated documentation in the same view.
- AI settings drawer lets you switch between OpenAI and Anthropic, store your API key locally, and see inline validation against the provider.
- Workflow validation strips credentials, normalizes nodes, and rejects invalid or oversized files (limit 5 MB) before anything is sent to an LLM.
- Generates structured markdown with an overview, step-by-step process, business value summary, and an embedded Mermaid diagram for every node.
- Markdown rendering with accessible styling plus a `Download PDF` action that opens a print-ready view for saving or sharing.
- Everything runs inside the browser—the extension calls the LLM API you choose directly with your key.

## Requirements

- Chrome/Chromium with Manifest V3 support.
- An API key for either:
  - OpenAI (`gpt-3.5-turbo`)
  - Anthropic (`claude-3-opus-20240229`)

## Using the extension

1. Install via `chrome://extensions/` → enable **Developer mode** → **Load unpacked** → select this repository directory.
2. Click the toolbar icon and choose **Open 8n Docs** to launch the full panel in a new tab.
3. Open **AI Settings**, pick OpenAI or Anthropic, and paste your API key. The key is stored in local storage only and validated automatically.
4. Drop or browse for an exported n8n `workflow.json` (up to 5 MB). Invalid JSON or non-n8n files are rejected with clear errors.
5. The extension removes credential data, sends the normalized workflow to the selected LLM, and renders the Docsify-friendly markdown preview.
6. Use **Download PDF** to open the print dialog and save the documentation.

## Development

No build tooling is required.

1. Clone this repository locally.
2. Open `chrome://extensions/`, enable **Developer mode**, and select **Load unpacked**.
3. Choose the repository root (the directory containing `manifest.json`).
4. Use the toolbar action → **Open 8n Docs** to verify the panel and iterate on changes.

## Packaging

To bundle the extension, zip the repository contents (including `manifest.json`, `src`, and `assets`) and submit the archive to the Chrome Web Store.
