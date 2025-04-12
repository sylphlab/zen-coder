# Active Context

## Current Focus
Fixed UI bugs: Provider list display, Clear Chat confirmation, and AI response rendering. Ready for next task.

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
- **Current Task:** Fixed UI bugs (Provider list, Clear Chat, AI response).
- **Next:** Write test cases for tools and refactor tools for multiple operations (as requested by user).
- **Previous:** Implement Provider/Model persistence and Clear Chat button.
- **Future:** Consider applying progress update pattern to other tools.
- **Future:** Consider refining UI display for complex tool results.
## Debugging Notes
- **Fixed Provider List Display:** Corrected data structure mismatch (`providerId` vs `provider`) in `app.tsx` when handling `availableModels` message. Fixed JSX syntax error in `<datalist>`.
- **Fixed Clear Chat Button:** Reverted incorrect CSP change (`sandbox allow-modals`) in `webviewContent.ts`. Implemented custom confirmation dialog in `app.tsx` to replace native `confirm()`.
- **Fixed AI Response Rendering:** Modified `app.tsx` to immediately add an empty assistant message frame to state upon receiving `startAssistantMessage`, ensuring `appendMessageChunk` can find the target message.
- **Previous Fixes:** (Includes all items from the original list below this point)
- Provider/Model Persistence Implemented.
- UI Stream Update Fixed (Multiple Attempts).
- Immediate Message Display Fixed.
- UI State Persistence Implemented.
- Model Selection Fixed.
- UI Rendering Fixed (CoreMessage types).
- UI Styled (UnoCSS).
- Tool Results Saved to History.
- History Format Corrected.
- UI Loop Fixed.
- Chat History Persists.
- Model Selection Persists.
- Streaming Indicator Fixed.
- Model List Refresh Fixed.
- Settings UI Corrected (Data Source).
- Backend Communication Updated (Provider Info).
- AI Provider Logic Refactored (Delegation).
- OpenRouter Models Fetched Dynamically.
- Settings Provider Search Added.
- API Key Input Added.
- Settings Page Restored.
- Nanostores Added.
- GSAP Added.
- Integrated UnoCSS.
- Routing Implemented.
- Fixed Vite Port File Path.
- Fixed "No data provider registered" Error.
- Activity Bar Entry Changed.

## Active Decisions
- **UI Fixes:**
    - Corrected `app.tsx` to use `providerId` from `AvailableModel` type.
    - Reverted invalid `sandbox allow-modals` CSP directive in `webviewContent.ts`.
    - Implemented custom confirmation dialog in `app.tsx` for Clear Chat.
    - Ensured `app.tsx` adds assistant message frame on `startAssistantMessage`.
- **Architecture:** Adopted handler registration pattern, modularized backend services.
- **State/History:** Persist UI state (`UiMessage[]`), translate to `CoreMessage[]` on demand.
- **Model Handling:** Pass `modelId` correctly; delegate provider logic.
- **Tooling:** Prioritize inline status; confirm results passed to AI.
- **Persistence:** Use `globalState` for history, `vscode.getState/setState` for webview state.
- **Dependencies/Setup:** Integrated Vite, Preact, UnoCSS, wouter, etc.
- **Previous Decisions:** (Includes items like routing, dynamic OpenRouter fetch, API key handling, etc.)