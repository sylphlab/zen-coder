# Project Progress

## What Works
- Initial project structure exists.
- Memory Bank files created and updated.
- Core dependencies installed.
- Webview UI refactored to use Vite + Preact.
- Basic Preact chat UI structure implemented.
- Model selection dropdown implemented and functional.
- Communication between Preact UI and extension host updated.
- Extension activates on view (`onView:zencoder.views.chat`).
- Webview panel creation logic loads correctly in both Development (Vite Dev Server for HMR) and Production (Vite build output) modes.
- CSP nonce handling adapted for both modes.
- `AiService` class created (`src/ai/aiService.ts`) with core functionality (API keys, model instantiation, streaming, tool definitions/execution).
- `AiService` integrated into `src/extension.ts`.
- Streaming logic adapted for Preact UI.
- Vite build configuration updated.
- `package.json` scripts updated.
- VS Code Launch Configuration (`.vscode/launch.json`) updated for HMR.
- TypeScript RootDir and DOM Type Errors fixed.
- Vite Dev Server CORS Issue Fixed.
- Project Renamed to \"Zen Coder\".
- Tool Refactoring & Expansion Completed.
- Fixed Stream Parsing (Comprehensive).
- Removed Deprecated `StreamData`.
- Corrected `streamText` Usage.
- `uuidGenerateTool` updated with progress callback.
- UI Tool Display refined (inline, human-readable summaries, progress).
- Merged Settings UI into Chat Webview.
- **Vite Port Discovery Implemented & Fixed:** Extension now reads the actual Vite dev server port from the correct file path (`.vite.port` in the project root) during development, ensuring reliable HMR connection even if the default port changes.
- **`package.json` Corrected:** Contributions (`activationEvents`, `views`) updated and obsolete sections (`menus`, `commands`) removed to align with `WebviewViewProvider` implementation, resolving the "No data provider registered" error.
- **Development CSP Relaxed (Testing):** Added `'unsafe-eval'` to `script-src` in development mode CSP to test HMR compatibility.

## What's Left (Potential Future Enhancements)
- Implement conversation history persistence.
- Thorough testing and debugging of core chat and tool execution.
- Remove unused `@vscode/webview-ui-toolkit` dependency.
- Implement actual MCP client integration for tools like `search` (currently placeholder/disabled).
- Refine Preact component structure.
- Improve Markdown rendering in Preact UI.
- Improve error handling in Preact UI.
- Re-implement tool status updates using recommended Vercel AI SDK APIs (if desired).
- If relaxing CSP works, investigate if a more specific CSP rule can be used instead of `'unsafe-eval'`.

## Current Status
- **UI Streaming & Tool Display:** Core chat streaming works. Tool calls are displayed inline with human-readable summaries and progress updates.
- **Tool Execution:** Tools execute and return results to the AI.
- **Settings Integration:** Settings UI integrated into the main chat webview via a modal.
- **Activation:** Extension now activates and displays the webview directly in the activity bar using `WebviewViewProvider`.
- **Development Mode Reliability:** Extension reliably connects to the Vite dev server for HMR by reading the port from the correct file path.
- **View Provider Registration:** Corrected `package.json` ensures the `WebviewViewProvider` is properly registered.
- **Webview Loading (Troubleshooting):** Relaxed development CSP to potentially resolve blank webview issue.

## Known Issues
- `@vscode/webview-ui-toolkit` dependency is unused but still listed.
- Search tool functionality relies on the external `search_files` tool (requires environment support).
- Conversation history is not persisted.
- **AI Response Behavior:** AI models might not always explicitly list tool results (e.g., all generated UUIDs) in their text response, even though they receive the results. This depends on the model and prompt.
- Custom tool execution status updates (beyond the inline display) are currently disabled.
- Model resolver logic (fetching available models dynamically) is not yet implemented.
- Chat UI model selection persistence is not yet implemented.
- API Key management needs reimplementation (e.g., via VS Code settings or webview input).
- **Blank Webview (Development):** Still investigating the cause of the blank webview in development mode, currently testing relaxed CSP.