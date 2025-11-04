# Auto-Docs for n8n (Upload)

Chrome extension (Manifest v3) that turns any exported n8n `workflow.json` into polished documentation using OpenAI. Drop a workflow, supply your API key, and receive a concise README ready to share or download.

## Features

- Guided two-step flow: upload the workflow, then review AI-generated documentation
- OpenAI API key validation with inline status updates before you can proceed
- Full-screen loader and status cues while documentation is being generated
- Immediate preview rendered in Markdown
- Quick actions for downloading a ZIP (`README.md`), creating a print-ready PDF, exporting the original JSON, or sharing a temporary preview link
- All processing stays in the browser—the OpenAI request uses your local key and is never stored

## Development

No build tooling is required. Load the extension directly in Chrome:

1. Open `chrome://extensions/` and enable **Developer mode**.
2. Click **Load unpacked**.
3. Select the `autodocs-upload-extension` directory.
4. Use the toolbar action → **Open Auto-Docs** to launch the panel.

### Generating Documentation

1. Paste a valid OpenAI API key in Step 1 (the key is held only in-memory for the active tab).
2. Drop or choose an n8n `workflow.json` export.
3. The extension validates your key, calls OpenAI with a structured prompt, and displays the documentation once ready.
4. Use the action buttons to download or share the AI-generated README.

## Packaging

To produce a ZIP bundle for submission, compress the `autodocs-upload-extension` directory contents (not the parent folder).
