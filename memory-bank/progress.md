# Project Progress

## What Works
- Initial project structure exists.
- Memory Bank files created and updated.
- Core dependencies installed.
- Webview UI refactored to use Vite + Preact.
- Basic Preact chat UI structure implemented.
- Model selection dropdown implemented and functional.
- Communication between Preact UI and extension host updated.
- `minicoder.startChat` command registered and activated.
- **Webview panel creation logic loads correctly in both Development (Vite Dev Server for HMR) and Production (Vite build output) modes.** (Fixed Preact mount point to `#root` in `webview-ui/src/main.tsx` for dev mode).
- CSP nonce handling adapted for both modes.
- `AiService` class created (`src/ai/aiService.ts`) with:
    - API Key Management methods using `vscode.SecretStorage`.
    - Correct model provider instantiation logic using factory functions.
    - `getAiResponseStream` method.
    - Tool definitions for all required tools.
    - Basic tool execution logic implemented for most tools.
    - `executeSearch` updated to use an MCP tool executor bridge.
    - Conversation history update methods.
- `AiService` integrated into `src/extension.ts`.
- Placeholder MCP tool executor defined and passed to `AiService`.
- Streaming logic adapted for Preact UI.
- API Key Setting Commands and handlers implemented.
- Vite build configuration updated.
- `package.json` scripts updated.
- **VS Code Launch Configuration (`.vscode/launch.json`) updated to use `npm: watch` for `preLaunchTask`, enabling development mode HMR.**

## What's Left (Potential Future Enhancements)
- Refine Preact component structure.
- Refine tool execution logic (error handling, robustness, e.g., `fetch`).
- Implement conversation history persistence.
- Thorough testing and debugging.
- Remove unused `@vscode/webview-ui-toolkit` dependency.
- Replace placeholder MCP tool executor with actual implementation if available/needed.
- Improve Markdown rendering in Preact UI.
- Improve error handling in Preact UI.

## Current Status
- **MVP + Model Selection + Dev Mode Complete & Functional:** Core functionality, API key management, model selection UI (Vite + Preact), and webview loading (supporting dev HMR) are implemented and working.
- Project is in a stable, functional state meeting the extended requirements.

## Known Issues
- `@vscode/webview-ui-toolkit` dependency is unused after refactor but still listed in `package.json`.
- Search tool currently uses a placeholder MCP executor.
- Other tool implementations might need more robust error handling.
- Conversation history is not persisted.