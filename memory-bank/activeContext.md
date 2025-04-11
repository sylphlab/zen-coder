# Active Context

## Current Focus
Finalizing documentation and preparing for task completion after successfully refactoring the UI and implementing model selection.

## Recent Changes
- Completed core MVP functionality (chat loop, streaming, tools, API key storage/setting, provider instantiation).
- Refined `search` tool to use an MCP executor bridge (placeholder).
- **Refactored Webview UI:** Migrated from plain JS/HTML/CSS to a Vite + Preact setup within the `webview-ui` directory.
- **Implemented Model Selection:** Added UI elements (likely a dropdown) in the Preact application to allow users to select from available AI models. This selection is communicated back to the extension host to update the `AiService`.
- Updated relevant files (`package.json`, `src/extension.ts`, `webview-ui/*`) to support the new UI structure and build process.

## Next Steps
- Update `memory-bank/progress.md` to reflect the final state.
- Commit the latest changes.
- Attempt completion.

## Active Decisions
- Webview UI successfully refactored to Vite + Preact.
- Model selection functionality implemented as requested.
- Core logic remains stable.