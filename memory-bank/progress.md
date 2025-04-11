# Project Progress

## What Works
- Initial project structure exists.
- Memory Bank files created and updated.
- Core dependencies installed.
- **Webview UI refactored to use Vite + Preact.**
- **Basic Preact chat UI structure implemented (`app.tsx`, `app.css`).**
- **Model selection dropdown implemented in Preact UI and functional.**
- Communication between Preact UI and extension host updated.
- `minicoder.startChat` command registered and activated.
- Basic Webview panel creation logic implemented, loading the Vite build output.
- CSP nonce handling adapted for Vite build.
- `AiService` class created (`src/ai/aiService.ts`) with:
    - API Key Management methods using `vscode.SecretStorage`.
    - Correct model provider instantiation logic using factory functions.
    - `getAiResponseStream` method.
    - Tool definitions for all required tools.
    - Basic tool execution logic implemented for most tools.
    - `executeSearch` updated to use an MCP tool executor bridge.
    - Conversation history update methods.
- `AiService` integrated into `src/extension.ts` (including async initialization).
- Placeholder MCP tool executor (`executeMcpToolPlaceholder`) defined in `src/extension.ts` and passed to `AiService`.
- Streaming logic adapted for Preact UI.
- API Key Setting Commands and handlers implemented.
- Vite build configuration updated for webview integration.
- `package.json` scripts updated for webview build/watch.

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
- **MVP + Model Selection Complete:** Core functionality, API key management, and model selection UI are implemented using Vite + Preact.
- Project is in a functional state meeting the extended requirements.

## Known Issues
- `@vscode/webview-ui-toolkit` dependency is unused after refactor but still listed in `package.json`.
- Search tool currently uses a placeholder MCP executor.
- Other tool implementations might need more robust error handling.
- Conversation history is not persisted.