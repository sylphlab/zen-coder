# Active Context

## Current Focus
Refactoring complete. Ready for next task (e.g., UnoCSS styling or feature work).

## Recent Changes
+- **Comprehensive Refactoring (Extension Host):**
+    - Implemented handler registration pattern in `extension.ts` (`ZenCoderChatViewProvider`). Message logic moved to dedicated handlers in `src/webview/handlers/`.
+    - Refactored `AiService` (`src/ai/aiService.ts`): Extracted provider status logic to `ProviderStatusManager` (`src/ai/providerStatusManager.ts`) and model resolution logic to `ModelResolver` (`src/ai/modelResolver.ts`). `AiService` now focuses on core AI interaction and API key storage.
+    - Created shared types file `src/common/types.ts`.
+    - Extracted webview HTML generation to `src/webview/webviewContent.ts`.
+    - History management remains in `src/historyManager.ts`.
+    - Stream processing remains in `src/streamProcessor.ts`.
+ - **Implemented Provider Selection Persistence:** Modified `app.tsx` to save/restore both selected provider and model ID using `vscode.getState`/`setState`.
- **Added Clear Chat Button:** Implemented button and handler in `app.tsx` and backend message handling in `extension.ts` to clear chat history.
- **Fixed UI Update on Stream (Attempt 3):** Implemented stricter immutability in `appendMessageChunk` handler (`app.tsx`) by creating new objects/arrays for all modified levels of the state.
- **Fixed UI Update on Stream (Attempt 2):** Further refined frontend logic (`app.tsx`) for `appendMessageChunk` using deep cloning to ensure state updates trigger immediate UI re-renders.
- **Fixed UI Update on Stream:** Modified frontend logic (`app.tsx`) for `appendMessageChunk` to ensure state updates trigger immediate UI re-renders by creating new array references, resolving the issue where messages only appeared after reload.
- **Fixed AI Response Handling:** Corrected frontend logic (`app.tsx`) in the `startAssistantMessage` handler to properly use the `messageId` sent from the backend, resolving issues where AI responses weren't displayed after the previous fix.
- **Fixed Immediate User Message Display:** Updated `handleSend` in `app.tsx` to add the user message to the UI state *before* sending it to the backend, ensuring immediate visibility.
- **Implemented UI State Persistence:** Refactored history management to use a single persistent store (`UiMessage[]` format mirroring frontend state) saved in `globalState` (`zenCoderUiHistory`).
    - Backend (`extension.ts`) now incrementally updates this UI history during streaming (text chunks, tool calls, tool status updates) and saves frequently.
    - Backend translates `UiMessage[]` to `CoreMessage[]` on demand before calling the AI SDK.
    - Frontend (`app.tsx`) now receives and directly uses the persisted `UiMessage[]` history via `loadUiHistory` message, ensuring partial messages and tool statuses are restored correctly on reload.
- **Removed Deprecated Dependency:** Removed `@vscode/webview-ui-toolkit` from root `package.json`.
- **Applied UnoCSS Styling:** Added utility classes to `App.tsx` (layout, chat elements) and `SettingPage.tsx` for basic styling and dark mode support. Fixed related JSX errors.
- **Fixed UI Rendering Error:** Corrected message rendering logic in `App.tsx` to handle both string and array types for `msg.content`, resolving `msg.content.map is not a function` error.
- **Added Tool Result History Saving:** Modified `extension.ts` stream processing to create and save `role: 'tool'` messages to history when tool results are received.
- **Fixed History Format Error:** Corrected `_chatHistory` type in `extension.ts` to `CoreMessage[]` and ensured user messages are converted to the correct format before being added, resolving `AI_InvalidPromptError`.
- **Fixed UI Infinite Loop:** Adjusted `useEffect` dependencies and removed automatic model re-fetch on status update in `App.tsx` to prevent loop.
- **Implemented Chat History Persistence:**
    - Extension (`extension.ts`) now loads/saves history using `context.globalState`.
    - History is passed to `AiService` and sent to webview (`App.tsx`) on load.
    - `AiService` refactored to return final assistant message via promise for saving.
- **Implemented Model Selection Persistence:** Used `vscode.getState()`/`setState()` in `App.tsx` to save and restore the last selected model ID across webview reloads.
- **Fixed Stream End Handling:** Added explicit `streamFinished` message from backend (`extension.ts`) to frontend (`App.tsx`) to reliably stop the UI streaming indicator.
- **Fixed State Synchronization:** Ensured Chat UI model list updates correctly after API key changes in Settings UI. (Triggered model re-fetch on provider status change in `App.tsx`).
- **Fixed Model List Refresh (`App.tsx`):**
    - Modified `useEffect` hook in `App.tsx` to re-trigger `getAvailableModels` message when `providerStatus` is updated (e.g., after setting/deleting an API key), ensuring the chat UI's model list reflects newly available providers.
- **Corrected Settings UI (`SettingPage.tsx`):** (Previous change)
    - Removed local `providerDetails`.
    - Updated component to render from `providerStatus` prop.
    - Updated filtering logic.
    - Fixed JSX comment issue.
- **Updated Backend Data Structure (`AiService.ts`, `extension.ts`):** (Previous change)
    - `AiService.getProviderStatus` returns richer `ProviderInfoAndStatus[]`.
    - `extension.ts` handlers updated for new structure.
- **Updated App State (`App.tsx`):** (Previous change)
    - `providerStatus` state holds `ProviderInfoAndStatus[]`.
    - Message handling updated.
- **Updated Settings UI (Initial Features):** (Previous change)
    - Added "Delete Key" button.
    - Added `handleDeleteApiKey` handler.
    - Added `apiKeyUrl` display.
    - Defined `providerDetails` locally (incorrectly).
- **Updated Extension (`extension.ts`):** (Previous change)
    - Added `deleteApiKey` handler.
    - Updated other handlers.
    - Imported `providerMap`.
- **Updated App (`App.tsx`):** (Previous change)
    - Updated message calls and props.
- **Updated Extension (`extension.ts`):**
    - Added message handler for `deleteApiKey`.
    - Updated handlers for `webviewReady`, `getProviderStatus`, `setApiKey` to use refactored `AiService` methods and `providerMap`.
    - Imported `providerMap`.
- **Updated App (`App.tsx`):**
    - Ensured `getProviderStatus` and `getAvailableModels` are called on `webviewReady`.
    - Passed necessary props to `SettingPage`.
- **Further Refactored AI Provider Logic:** (Previous change)
    - Modified `AiProvider` interface for key/status management.
    - Updated provider modules to implement the interface.
    - Refactored `AiService` to delegate key/status management.
    - Removed redundant properties/methods from `AiService`.
    - Updated methods in `AiService` to use provider methods.
    - Fixed `dynamicImport` path.
- **Refactored AI Provider Logic (Initial):** (Previous change)
    - Created `src/ai/providers` directory.
    - Defined initial `AiProvider` interface.
    - Created individual provider modules implementing the initial interface.
    - Implemented dynamic model fetching for OpenRouter.
    - Created `src/ai/providers/index.ts`.
    - Initial refactor of `AiService` (`_getProviderInstance`, `resolveAvailableModels`).
    - Removed old SDK imports and helpers.
    - Created `src/utils/dynamicImport.ts`.
- **Added Settings Provider Search:** (Previous change)
    - Added a search input field to `SettingPage.tsx`.
    - Implemented state (`searchQuery`) and filtering logic (`filteredProviders`, `useMemo`) to dynamically filter the displayed provider list based on the search query (matching name or key).
- **Implemented OpenRouter Model Fetching:** (Previous change)
    - Added `fetchOpenRouterModels` method to `AiService`.
    - Updated `resolveAvailableModels` to use the fetched models.
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
- **Current Task:** Refactoring complete.
- **Next:** Apply UnoCSS styling to UI components (as previously planned).
- **Previous:** Implement Provider/Model persistence and Clear Chat button.
- **Future:** Consider applying progress update pattern to other tools.
- **Future:** Consider refining UI display for complex tool results.
## Debugging Notes
- **Provider/Model Persistence Implemented:** UI now saves and restores both selections.
- **Clear Chat Implemented:** Button added to UI, backend handler added.
- **UI Stream Update Fixed (Attempt 3):** Applied stricter immutability pattern for state updates in `appendMessageChunk`.
- **UI Stream Update Fixed (Attempt 2):** Implemented deep cloning for state updates in `appendMessageChunk` handler.
- **UI Stream Update Fixed:** Frontend now correctly updates the UI immediately as message chunks arrive by ensuring new state array references are created.
- **AI Response Display Fixed:** Frontend now correctly handles the `startAssistantMessage` signal using the provided `messageId` and appends response chunks.
- **Immediate Message Display Fixed:** User messages now appear instantly in the chat UI.
- **UI State Persistence Implemented:** Backend now persists history in UI format (`UiMessage[]`), including partial messages and tool statuses. Frontend loads this state directly.
- **Model Selection Fixed:** Frontend now sends the selected `modelId` with the `sendMessage` request. Backend (`extension.ts` and `aiService.ts`) now correctly uses the provided `modelId` to instantiate the AI model, resolving the issue where the wrong provider/key was being used.
- **UI Rendering Fixed:** Correctly handles different `CoreMessage` content types (string/array). Navigation should work again.
- **UI Styled:** Applied basic UnoCSS styling to Chat and Settings pages. Fixed JSX errors caused by diff application.
- **Tool Results Saved to History:** Added logic in `extension.ts` to persist `role: 'tool'` messages.
- **History Format Corrected:** Ensured `_chatHistory` in `extension.ts` uses `CoreMessage` format, fixing SDK errors.
- **UI Loop Fixed:** Changed `useEffect` dependencies in `App.tsx` to prevent infinite state requests.
- **Chat History Persists:** History is loaded from and saved to global state by the extension host.
- **Model Selection Persists:** Last selected model is now saved and restored using webview state API.
- **Streaming Indicator Fixed:** Added explicit `streamFinished` message handling to ensure UI stops indicating streaming reliably.
- **Model List Refresh Fixed:** Chat UI model list now updates automatically after API keys are set/deleted in Settings.
- **Settings UI Corrected:** Uses backend data for provider details (Previous).
- **Backend Communication Updated:** Sends richer provider info list (Previous). Handles delete key message (Previous).
- **AI Provider Logic Further Refactored:** `AiService` delegates key/status management (Previous).
- **OpenRouter Models Fetched Dynamically:** Logic in `openRouterProvider.ts` (Previous).
- **Settings Provider Search Added:** Users can now filter the provider list in the settings page (Previous).
- **API Key Input Added:** Settings page allows setting API keys (Previous).
- **Settings Page Restored:** Moved rendering logic and passed necessary props (Previous).
- **Nanostores Added:** Installed the library and Preact integration (Previous).
- **GSAP Added:** Installed the library (Previous).
- **Integrated UnoCSS:** Added dependencies, Vite plugin, config, and imports (Previous).
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
+- **Architecture:** Adopted handler registration pattern for webview messages and further modularized backend services (`AiService`, `ProviderStatusManager`, `ModelResolver`, `HistoryManager`, `StreamProcessor`).
+ - Changed storage strategy: Persist UI state (`UiMessage[]`) directly and translate to `CoreMessage[]` on demand for AI interaction. Removed separate `CoreMessage` history persistence.
+ - Ensured `modelId` is passed from frontend through backend to `AiService` for correct model instantiation.
+ - Prioritized fixing core stream parsing and removing deprecated API usage.
+ - Standardized on documented Vercel AI SDK APIs.
- **New Principle:** Tools should support batch operations.
- Prioritized human-readable, inline tool status summaries.
- Confirmed tool results are passed back to the AI.
- Standardized internal history representation in `extension.ts` to `CoreMessage[]`.
- Changed `App.tsx` `useEffect` dependencies to `[]` to fix initialization loop.
- Implemented history persistence using `context.globalState` managed by the extension host.
- Refactored `AiService` to return final assistant message via promise to enable history saving.
- Used `vscode.getState/setState` for simple webview state persistence (model selection).
- Added explicit `streamFinished` message from backend to UI to fix streaming indicator persistence.
- Added logic to `App.tsx` to re-fetch models when provider status changes.
- Corrected `SettingPage.tsx` to use backend data structure (Previous).
- Updated `AiService` and `extension.ts` for combined provider info (Previous).
- Updated `App.tsx` state management (Previous).
- Updated Settings UI (`SettingPage.tsx`) to add delete/URL features (Previous).
- Updated backend message handling (`extension.ts`) for UI changes (Previous).
- Delegated API key and status management to provider modules (Previous).
- Refactored AI provider handling into modular components (Initial refactor).
- Added search functionality to the Settings page Provider list (Previous).
- Implemented dynamic fetching of OpenRouter models (Moved to provider module).
- Implemented API Key input and setting mechanism in the Settings page (Previous).
- Restored Settings page functionality after routing refactor (Previous).
- Added Nanostores for state management (Previous).
- Added GSAP for animations (Previous).
- Integrated UnoCSS for utility-first styling (Previous).
- Replaced Settings modal with a dedicated `/settings` route using `wouter` (Previous).
- Refactored activation to use `WebviewViewProvider` (Previous).
- Implemented Vite port discovery (Previous).
- Corrected `package.json` contributions (Previous).
- Corrected Vite port file path (Previous).
- Relaxed development CSP for testing (Previous).