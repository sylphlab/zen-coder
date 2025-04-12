# Active Context

## Current Focus
Implementing routing with `wouter` for Chat and Settings pages in the webview UI.

## Recent Changes
- **Implemented Routing:**
    - Installed `wouter`.
    - Created `SettingPage.tsx` and `ChatPage.tsx` components in `webview-ui/src/pages/`.
    - Updated `webview-ui/src/app.tsx` to use `wouter`'s `Router`, `Route`, and `Link` components to handle navigation between the Chat (`/`) and Settings (`/settings`) views.
    - Replaced the settings modal with the `/settings` route.
    - Updated `showSettings` message handler to navigate to `/settings`.
- **Relaxed Development CSP:** (Previous change)
    - Added `'unsafe-eval'` to the `script-src` directive in the development mode Content Security Policy within `src/extension.ts` (`getWebviewContent`). This was to test if Vite's HMR script execution was being blocked.
- **Fixed Vite Port File Path:**
    - Corrected the path used in `src/extension.ts` (`getWebviewContent`) to read the `.vite.port` file from the project root directory.
- **Fixed `package.json` Inconsistency:**
    - Updated `activationEvents`, `contributes.views`, and removed obsolete `menus`, `commands` to align with `WebviewViewProvider`. Resolved "No data provider registered" error.
- **Vite Port Discovery (Initial Implementation):**
    - Modified `webview-ui/vite.config.ts` to write the running dev server port to `.vite.port`.
    - Modified `src/extension.ts` to read the port during development.
- **Tool Refactoring & Expansion:** (Completed previously)
- **Fixed Stream Parsing (Comprehensive):** (Completed previously)
- **Removed Deprecated `StreamData`:** (Completed previously)
- **Standardized `streamText` Usage:** (Completed previously)
- **Corrected Stream Handling:** (Completed previously)
- **Corrected Stream Return Value:** (Completed previously)
- **UI Update (Tool Status):** (Completed previously, but status updates are now disabled).
- **AiService Refactoring:** (Completed previously)
- **Configuration Update:** (Completed previously)
- **Previous:** Project renamed to Zen Coder; Vercel AI SDK enhancements applied.
- **UI Tool Display Refinement:** (Completed previously)
- **`uuidGenerateTool` Enhancement & Progress:** (Completed previously)
- **Tool Result Handling Clarification:** (Completed previously)
- **Merged Settings UI into Chat Webview (Complete):** (Completed previously)

## Next Steps
- **Current Task:** Verify routing implementation and ensure both Chat and Settings pages render correctly.
- **Previous:** Implement routing with `wouter`.
- **Future:** Implement API/Web scraping for `resolveAvailableModels`.
- **Future:** Implement model selection persistence in Chat UI.
- **Future:** Implement chat history persistence.
- **Future:** Consider applying progress update pattern to other tools.
- **Future:** Consider refining UI display for complex tool results.
## Debugging Notes
- **Routing Implemented:** Added `wouter` and page components.
- **Relaxed Dev CSP:** Added `'unsafe-eval'` to `script-src` for testing HMR compatibility (Previous).
- **Fixed Vite Port File Path:** Corrected path in `src/extension.ts`.
- **Fixed "No data provider registered" Error:** Resolved by correcting `package.json`.
- **Fixed Vite 504 Error (Chat UI):** (Resolved previously)
- **Fixed Chat UI Hang:** (Resolved previously)
- **Fixed `getCurrentModelId` Return Type:** (Resolved previously)
- **Added Debug Logs (API Keys):** (Kept)
- **Verified Model Resolver Logic:** (Kept)
- **Corrected `_getProviderInstance` Logic:** (Kept)
- **Activity Bar Entry:** Changed to direct Webview View.
- **Verified Chat UI Code:** (Kept)

## Active Decisions
- Prioritized fixing core stream parsing and removing deprecated API usage.
- Standardized on documented Vercel AI SDK APIs.
- **New Principle:** Tools should support batch operations.
- Prioritized human-readable, inline tool status summaries.
- Confirmed tool results are passed back to the AI.
- Replaced Settings modal with a dedicated `/settings` route using `wouter`.
- Refactored activation to use `WebviewViewProvider`. (Previous)
- Implemented Vite port discovery. (Previous)
- Corrected `package.json` contributions. (Previous)
- Corrected Vite port file path. (Previous)
- Relaxed development CSP for testing. (Previous)