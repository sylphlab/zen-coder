# Active Context

## Current Focus
Implementing dynamic model resolution for OpenRouter.

## Recent Changes
- **Implemented OpenRouter Model Fetching:**
    - Added `fetchOpenRouterModels` private async method to `AiService` using Node.js `https` module to call the OpenRouter API (`/api/v1/models`).
    - Updated `resolveAvailableModels` in `AiService` to call `fetchOpenRouterModels` if OpenRouter is enabled and has an API key set.
    - Fetched models are added to the `resolvedModels` list with `source: 'api'`.
    - Hardcoded OpenRouter models are now only added as fallbacks if the API call fails.
- **Implemented Settings API Key Input:** (Previous change)
    - Added UI elements and message handling for setting API keys in `SettingPage.tsx` and `src/extension.ts`.
- **Restored Settings Page:** (Previous change)
    - Updated `SettingPage.tsx` props and rendering logic.
    - Exported types from `App.tsx`.
    - Passed props in `App.tsx` route.
- **Added Nanostores:** (Previous change)
    - Installed `nanostores` and `@nanostores/preact` dependencies.
- **Added GSAP:** (Previous change)
    - Installed `gsap` dependency.
- **Integrated UnoCSS:** (Previous change)
    - Installed `unocss`, `@unocss/vite`, `@unocss/reset`.
    - Configured Vite (`webview-ui/vite.config.ts`).
    - Created UnoCSS config file (`webview-ui/uno.config.ts`).
    - Imported UnoCSS styles in `webview-ui/src/main.tsx`.
- **Implemented Routing:** (Previous change)
    - Installed `wouter`.
    - Created `SettingPage.tsx` and `ChatPage.tsx` components.
    - Updated `webview-ui/src/app.tsx` for routing.
    - Replaced settings modal with `/settings` route.
    - Updated `showSettings` message handler.
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
- **Current Task:** Update Memory Bank and commit OpenRouter model fetching implementation.
- **Previous:** Implement OpenRouter model fetching in `AiService`.
- **Future:** Implement API/Web scraping for `resolveAvailableModels`.
- **Future:** Implement model selection persistence in Chat UI.
- **Future:** Implement chat history persistence.
- **Future:** Consider applying progress update pattern to other tools.
- **Future:** Consider refining UI display for complex tool results.
## Debugging Notes
- **OpenRouter Models Fetched:** `AiService` now attempts to fetch models dynamically from the OpenRouter API.
- **API Key Input Added:** Settings page allows setting API keys (Previous).
- **Settings Page Restored:** Moved rendering logic and passed necessary props (Previous).
- **Nanostores Added:** Installed the library and Preact integration (Previous).
- **GSAP Added:** Installed the library (Previous).
- **UnoCSS Integrated:** Added dependencies, Vite plugin, config, and imports (Previous).
- **Routing Implemented:** Added `wouter` and page components (Previous).
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
- Implemented dynamic fetching of OpenRouter models in `AiService`.
- Implemented API Key input and setting mechanism in the Settings page. (Previous)
- Restored Settings page functionality after routing refactor. (Previous)
- Added Nanostores for state management. (Previous)
- Added GSAP for animations. (Previous)
- Integrated UnoCSS for utility-first styling. (Previous)
- Replaced Settings modal with a dedicated `/settings` route using `wouter`. (Previous)
- Refactored activation to use `WebviewViewProvider`. (Previous)
- Implemented Vite port discovery. (Previous)
- Corrected `package.json` contributions. (Previous)
- Corrected Vite port file path. (Previous)
- Relaxed development CSP for testing. (Previous)