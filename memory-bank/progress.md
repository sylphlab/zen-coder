# Project Progress

## What Works
- **Nanostores Added:** Installed `nanostores` and `@nanostores/preact`. Ready for state management.
- **GSAP Added:** Installed `gsap` dependency. Ready for use in animations. (Previous)
- **UnoCSS Integrated:** Added dependencies, Vite plugin, config (`uno.config.ts`), and imported into `main.tsx`. Ready for use. (Previous)
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
- `AiService` class created (`src/ai/aiService.ts`) and further refactored. API key management and status checks are now fully delegated to the modular provider implementations under `src/ai/providers/`.
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
- **Routing Implemented:** Added `wouter` for navigation between Chat (`/`) and Settings (`/settings`) pages. Created basic `SettingPage.tsx` and `ChatPage.tsx`. Replaced settings modal with the `/settings` route. (Previous)
- **Settings Provider Search:** Added a search input to `SettingPage.tsx` to filter the list of providers.
- **AI Provider Refactoring (Complete):** Implemented modular provider structure under `src/ai/providers`. `AiService` now fully delegates model creation, listing, API key management, and status checks to these modules.
- **Settings Page API Key Input:** Added input fields and buttons to `SettingPage.tsx` to allow users to set API keys for each provider. Implemented message passing (`setApiKey`) to the extension host, which handles storing the key in `SecretStorage` via `AiService`. (Previous)
- **Settings Page Restored:** Moved provider settings logic from `App.tsx` to `SettingPage.tsx` and passed necessary props (`providerStatus`, `handleProviderToggle`) to restore functionality after routing refactor. Exported required types from `App.tsx`. (Previous)
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
- Apply UnoCSS classes for styling.
- Implement animations using GSAP where appropriate.
- Define and use Nanostores stores for managing shared state (e.g., settings, chat history).

## Current Status
- **Settings Integration & State Sync:** Settings UI (`/settings`) correctly uses backend data. Setting/deleting keys now triggers a refresh of the available models list in the Chat UI (`App.tsx`), ensuring newly enabled providers are immediately selectable.
- **UI Streaming & Tool Display:** Core chat streaming works. Tool calls are displayed inline with human-readable summaries and progress updates.
- **Tool Execution:** Tools execute and return results to the AI.
- **Settings Integration & State Sync:** Settings UI (`/settings`) correctly uses backend data. Setting/deleting keys now triggers a refresh of the available models list in the Chat UI (`App.tsx`), ensuring newly enabled providers are immediately selectable.
- **Activation:** Extension now activates and displays the webview directly in the activity bar using `WebviewViewProvider`.
- **Development Mode Reliability:** Extension reliably connects to the Vite dev server for HMR by reading the port from the correct file path.
- **View Provider Registration:** Corrected `package.json` ensures the `WebviewViewProvider` is properly registered.
- **Webview Loading (Troubleshooting):** Relaxed development CSP to potentially resolve blank webview issue. (Previous)
- **Styling:** UnoCSS is set up but not yet applied to components. Existing CSS (`app.css`, `index.css`) might conflict or be redundant.

## Known Issues
- `@vscode/webview-ui-toolkit` dependency is unused but still listed.
- Search tool functionality relies on the external `search_files` tool (requires environment support).
- Conversation history is not persisted.
- **AI Response Behavior:** AI models might not always explicitly list tool results (e.g., all generated UUIDs) in their text response, even though they receive the results. This depends on the model and prompt.
- Custom tool execution status updates (beyond the inline display) are currently disabled.
- Model resolver logic now iterates through all enabled providers using their `getAvailableModels` method. Dynamic fetching is implemented only for OpenRouter currently; others use hardcoded lists within their modules.
- Chat UI model selection persistence is not yet implemented.
- API Key management is now handled by individual provider modules, interacting with `vscode.SecretStorage`. `AiService` delegates these operations. Input fields remain in the Settings page webview.
- **Blank Webview (Development):** Still investigating the cause of the blank webview in development mode, currently testing relaxed CSP. (Previous issue)
- **Routing CSS:** Basic navigation links added, but styling (`.app-layout`, `.navigation`, `.content-area`) needs to be implemented in `app.css`.