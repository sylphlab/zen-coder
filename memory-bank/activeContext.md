# Active Context

## Current Focus
Refactoring initial data loading mechanism to use Request/Response instead of `WebviewReady` push.

## Next Steps
1.  **Testing (Manual):** Thoroughly test the new Request/Response data loading mechanism. Verify that all initial states (chats, providers, statuses) load correctly and UI updates accordingly.
2.  **Implement True Pub/Sub:** Identify data that *needs* real-time updates (e.g., MCP connection status, maybe tool status changes) and implement a dedicated push mechanism (Pub/Sub) for those specific updates, keeping the initial load as Request/Response.
3.  **Resume Image Upload:** Continue implementation and testing of image upload functionality.
4.  **VS Code Tool Enhancements:** Implement remaining VS Code debugging tools and enhance `runCommandTool`.
5.  **UI Refinements & Error Handling:** Continue improving UI and error handling.

## Next Steps
1.  **Resume Image Upload:** Continue implementation and testing of image upload functionality (Backend logic seems ready, needs frontend testing/integration).
2.  **VS Code Tool Enhancements:** Implement remaining VS Code debugging tools (stop, step, breakpoints) and enhance `runCommandTool` (exit code).
3.  **Testing (Manual):**
    *   Thoroughly test all UI interactions (model selection, settings, async states).
    *   Test structured output and suggested actions.
    *   Test image upload functionality across providers.
4.  **UI Refinements:** Further improve UI styling and potentially add animations.
5.  **Error Handling:** Review and improve error handling across the application.

## Recent Changes (Unified Request/Response, Pub/Sub, Handler Architecture, Bug Fixes)
+ - **Refactored Settings Page & Subscription Logic:** Broke down `webview-ui/src/pages/SettingPage.tsx` into smaller components (`DefaultModelSettings`, `CustomInstructionsSettings`, `ProviderSettings`, `McpServerSettings`, `ToolSettings`). Moved subscription logic (subscribe/unsubscribe messages) from component `useEffect` hooks to the `onMount`/`onUnmount` lifecycle methods of the corresponding Jotai atoms (`providerStatusAtom`, `defaultConfigAtom`, `allToolsStatusAtom`, `mcpServerStatusAtom`, `customInstructionsAtom`) in `webview-ui/src/store/atoms.ts`. This aligns with Jotai best practices and aims to definitively fix the infinite loop. Corrected `atomWithDefault` usage and added null checks in components.
+ - **Refactored Initial Data Loading:**
+     - Removed `WebviewReadyHandler` and its push-based logic.
+     - Created new request handlers (`GetChatStateHandler`, `GetAvailableProvidersHandler`, `GetProviderStatusHandler`, `GetAllToolsStatusHandler`, `GetMcpStatusHandler`) in `src/webview/handlers/`.
+     - Updated `extension.ts` to register new request handlers in `_initializeRequestHandlers` and remove `WebviewReadyHandler`.
+     - Updated `src/common/types.ts` to include `getChatState` in `WebviewRequestType`.
+     - Updated `webview-ui/src/components/MessageHandlerComponent.tsx` to send initial data requests on mount using `requestData`.
+     - Updated `webview-ui/src/utils/requestManager.ts` to store `requestType` and update relevant Jotai atoms (`chatSessionsAtom`, `activeChatIdAtom`) upon receiving responses for specific request types (`getChatState`). Removed incorrect attempts to set async/read-only atoms.
+     - Verified async atoms in `webview-ui/src/store/atoms.ts` use `requestData` for fetching.
+     - Deleted `src/webview/handlers/WebviewReadyHandler.ts` file.
+ - **Implemented MCP Status Pub/Sub:**
+     - Created `SubscribeToMcpStatusHandler` and `UnsubscribeFromMcpStatusHandler`.
+     - Updated `McpManager` to track webview subscription status (`_isWebviewSubscribed`, `setWebviewSubscription`) and only push status updates (`_notifyWebviewOfStatusUpdate`) when subscribed.
+     - Updated `extension.ts` to register the new Pub/Sub handlers.
+     - Updated `SettingPage.tsx` to send subscribe/unsubscribe messages in `useEffect`.
+     - Updated `common/types.ts` to include `subscribeToMcpStatus` and `unsubscribeFromMcpStatus` message types.
+ - **Fixed App Load Failure (Request/Response Timing):**
+     - Diagnosed `unknown or timed out request ID` error in `requestManager.ts` as likely timing issue.
+     - Centralized ALL message handling (requests and pushes) into a single global listener in `main.tsx`.
+     - Removed `MessageHandlerComponent.tsx`.
+     - Updated `main.tsx` listener to directly update Jotai atoms using `store.set`.
+     - Simplified `requestManager.ts`'s `handleResponse` to only resolve/reject promises.
+ - **Implemented Tool Status Pub/Sub:**
+     - Added `_isToolStatusSubscribed` and `setToolStatusSubscription` to `AiService`.
+     - Added `_notifyToolStatusChange` to `AiService` and called it from `SetToolEnabledHandler`.
+     - Created `SubscribeToToolStatusHandler` and `UnsubscribeFromToolStatusHandler`.
+     - Updated `extension.ts` to register new handlers.
+     - Updated `SettingPage.tsx` to send subscribe/unsubscribe messages.
+     - Updated `common/types.ts` with new message types.
+     - Removed direct handling of `updateAllToolsStatus` from `main.tsx` (already done).
+ - **Implemented Custom Instructions Pub/Sub:**
+     - Added `_isCustomInstructionsSubscribed` and `setCustomInstructionsSubscription` to `AiService`.
+     - Added `_notifyCustomInstructionsChange` to `AiService` and called it from `SetGlobalCustomInstructionsHandler` and `SetProjectCustomInstructionsHandler`.
+     - Created `SubscribeToCustomInstructionsHandler` and `UnsubscribeFromCustomInstructionsHandler`.
+     - Updated `extension.ts` to register new handlers.
+     - Updated `SettingPage.tsx` to send subscribe/unsubscribe messages and removed initial `getCustomInstructions` request.
+     - Updated `common/types.ts` with new message types.
- **Fixed Model Input Field:** Modified `useEffect` hook in `ModelSelector.tsx` to only update `inputValue` when external `selectedProviderId` or `selectedModelId` props change, preventing interference with user typing.
- **Fixed Gray Screen:** Resolved `Uncaught SyntaxError` in `InputArea.tsx` by correcting the import from `activeChatModelNameAtom` to `activeChatModelIdAtom`.
- **Attempted Blank Page/Timeout Fix:** Moved response listener to `main.tsx`, added `<Suspense>`, fixed syntax errors in `app.tsx`, added `className` prop to `MessagesAreaProps` and `InputAreaProps`. Corrected atom usage (`modelId` vs `modelName`) in `atoms.ts`, `HeaderControls.tsx`, and `app.tsx`. Added debug logging. (Issue persists, but initial timeout seems resolved).
- **Fixed TypeScript Errors:** Resolved multiple TS errors across handlers and services related to recent refactoring (e.g., `modelName` vs `modelId`, incorrect method calls, missing types).
- **Added VS Code Tools:** Implemented `goToDefinitionTool`, `findReferencesTool`, `renameSymbolTool`, `getConfigurationTool`, `startDebuggingTool`.
- **Verified Tool:** Confirmed `replaceInActiveEditorTool` correctly handles text insertion when no text is selected.
- **UI Improvements:** Added loading feedback to chat list actions (`ChatListPage.tsx`) and applied minor styling adjustments to `ChatListPage.tsx` and `app.tsx`.
- **(Previous: Jotai Async Refactor & Model ID Correction)**
- **Implemented Request/Response:** Added `requestManager.ts` in webview and request handling logic in `extension.ts` to replace push-based data fetching for providers, models, and default config.
- **Implemented Async Atoms:** Refactored `providerStatusAtom`, `availableProvidersAtom`, `defaultConfigAtom`, and created `modelsForProviderAtomFamily` in `webview-ui/src/store/atoms.ts` to use the new async request mechanism.
- **Updated UI for Async:** Modified `SettingPage.tsx` and `ModelSelector.tsx` to use `jotai/utils/loadable` to handle loading/error states for async atoms.
- **Corrected Model ID Handling:**
    - Removed logic parsing/combining IDs with ':' in `ModelSelector.tsx`, `SettingPage.tsx`, `HeaderControls.tsx`, `app.tsx`.
    - Updated `ModelSelectorProps` and its `onModelChange` callback to handle separate `providerId` and `modelId`.
    - Updated `DefaultChatConfig` and `ChatConfig` types in `common/types.ts` to use separate `providerId` and `modelId` fields (removed `modelName`, `defaultChatModelId`).
    - Updated relevant handlers (`handleDefaultChatModelChange` in `SettingPage.tsx`, `handleModelSelectorChange` in `app.tsx`) to work with separate IDs.
- **Refactored Extension Host:**
    - Added `_requestHandlers` map in `ZenCoderChatViewProvider` (`extension.ts`) to handle data requests from the webview.
    - Removed corresponding `MessageHandler` classes (`GetProviderStatusHandler`, `GetAvailableModelsHandler`, `GetCustomInstructionsHandler`) and their registrations.
    - Verified implementation of `getMcpStatuses`, `getAllToolsWithStatus`, `getCombinedCustomInstructions` in `AiService.ts`.
- **Cleaned Imports:** Removed unused imports and fixed type errors resulting from the refactoring across multiple files.
- **(Previous Jotai Refactor):** Initial move from `useState`/message-passing to basic Jotai atoms.
- **(Previous changes before Jotai refactor)**
- **UI Refactoring (Navigation &amp; Layout):**
    - Removed top navigation bar (`<nav>`) from `app.tsx`.
    - Added settings icon button to `HeaderControls.tsx` for navigation to `/settings`.
    - Added back button to `SettingPage.tsx` for navigation back to chat (`/index.html`).
    - Resolved complex rendering issues caused by conflicts between `wouter` routing (`<Router>`, `<Route>`) and Flexbox layout (`flex-1`, `h-full`). Final solution involved using `<Switch>`, correcting the chat route path to `/index.html`, and ensuring Flexbox properties were correctly applied within route components.
- **Implemented Stream Cancellation:**
    - Added `AbortController` management to `src/ai/aiService.ts` (`getAiResponseStream`).
    - Added `abortCurrentStream` method to `src/ai/aiService.ts`.
    - Created `src/webview/handlers/StopGenerationHandler.ts` to call `abortCurrentStream`.
    - Registered `StopGenerationHandler` in `src/extension.ts`.
    - Added "Stop Generating" button to `webview-ui/src/components/InputArea.tsx` (visible during streaming).
    - Updated `webview-ui/src/app.tsx` to pass the `handleStopGeneration` callback to `InputArea`.
- **Implemented Stream Cancellation:**
    - Added `AbortController` management to `src/ai/aiService.ts` (`getAiResponseStream`).
    - Added `abortCurrentStream` method to `src/ai/aiService.ts`.
    - Created `src/webview/handlers/StopGenerationHandler.ts` to call `abortCurrentStream`.
    - Registered `StopGenerationHandler` in `src/extension.ts`.
    - Added "Stop Generating" button to `webview-ui/src/components/InputArea.tsx` (visible during streaming).
    - Updated `webview-ui/src/app.tsx` to pass the `handleStopGeneration` callback to `InputArea`.
- **Updated `src/ai/aiService.ts`:** Modified `getAiResponseStream` to accept `history: CoreMessage[]` (which includes the latest user message with potential image parts) instead of a separate `prompt: string`, aligning with `HistoryManager` updates for image upload support.
- **Refactored MCP Management:**
    - Created `src/ai/mcpManager.ts` to encapsulate all MCP-related logic (config loading/watching, client initialization/management, tool fetching/caching, error tracking, retry logic).
    - Refactored `src/ai/aiService.ts` to remove MCP logic and delegate calls (getting status, getting tools, retrying connections) to the new `McpManager` instance.
    - Added `RetryMcpConnectionHandler` and registered it in `extension.ts`.
    - Updated `SettingPage.tsx` UI to display connection status, errors, fetched tools, and provide a "Retry" button for failed connections, removing the old test logic.
- **File-Based MCP Server Configuration:**
    - **Refactored MCP configuration:** Removed UI form and VS Code settings (`zencoder.mcp.servers`). Configuration is now managed via JSON files:
        - **Global:** `[VS Code User Data]/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json`
        - **Project:** `[Workspace]/.vscode/mcp_servers.json`
    - **Updated JSON Structure:** Config files now use an object map (`mcpServers: { [serverName]: config }`) instead of an array. Server config includes `disabled`, `env`, `alwaysAllow` properties. Project settings override global settings by server name.
    - **Updated Settings UI (`SettingPage.tsx`):** Replaced MCP form/list with two buttons: "Configure Global Servers" and "Configure Project Servers". These buttons trigger commands to open the respective JSON files.
    - **Updated Backend (`extension.ts`, `aiService.ts`):**
        - Added commands (`zen-coder.openGlobalMcpConfig`, `zen-coder.openProjectMcpConfig`) to find/create/open config files.
        - Modified `AiService` to read/merge/watch these JSON files, using the new structure and `disabled` flag.
        - Fixed various `apply_diff` errors during implementation using `write_to_file` for `aiService.ts`.
- **Updated `src/common/types.ts`:** Added `UiImagePart` interface and included it in the `UiMessageContentPart` union type.
- **Updated `webview-ui/src/app.tsx`:**
    - Added state (`selectedImage`, `fileInputRef`) to handle image selection.
    - Added UI elements (button, preview, remove button) for image upload in the input area.
    - Implemented `handleImageFileChange`, `triggerImageUpload`, `removeSelectedImage` functions for image handling.
    - Modified `handleSend` to include selected image data (base64) in the message content sent to the backend.
    - Updated `renderContentPart` to display `image` type content parts.
    - Updated `UiMessageContentPart` import to include `UiImagePart`.
    - Integrated `react-markdown` for proper Markdown rendering in text parts.
    - **Integrated `react-syntax-highlighter`:** Modified `ReactMarkdown` component to use `SyntaxHighlighter` for fenced code blocks, applying the `vscDarkPlus` theme.
- **Installed Dependencies:** Added `react-markdown`, `remark-gfm`, `react-syntax-highlighter`, `@types/react-syntax-highlighter` to `webview-ui`.
- **Updated `src/webview/handlers/SendMessageHandler.ts`:**
    - Changed message handling to expect a `content: UiMessageContentPart[]` array instead of `text: string`.
    - Updated import for `UiMessageContentPart` to use `../../common/types`.
    - Passed the `userMessageContent` array to `historyManager.addUserMessage` and `aiService.getAiResponseStream`.
- **Updated `src/historyManager.ts`:**
    - Modified `addUserMessage` to accept `content: UiMessageContentPart[]` instead of `text: string`.
    - Updated `translateUiHistoryToCoreMessages` to handle user messages with `image` parts, converting base64 data to Buffer for the AI SDK.
- **Refactored Model Selector:** Created reusable `ModelSelector.tsx` component and updated `SettingPage.tsx`, `HeaderControls.tsx`, and `app.tsx` accordingly. Improved model selection logic within the component.
- **Updated Message Bubble Actions:** Added Copy and Delete buttons to individual messages in `MessagesArea.tsx`. Implemented corresponding handlers (`handleCopyMessage`, `handleDeleteMessage`) in `app.tsx`. Added backend support (`DeleteMessageHandler.ts`, `HistoryManager.deleteMessageFromHistory`, registered handler in `extension.ts`).
- **Removed Clear Chat Button:** Removed the clear chat history button (trash icon) from `HeaderControls.tsx` and updated `app.tsx` props.
- **Unified Tool ID & Enablement:**
   - Standardized MCP tool identifier to `mcp_serverName_toolName` format in `aiService.ts` for AI interaction.
   - Unified tool enablement logic: All tool statuses (standard and MCP) are now read from and written to a single `globalState` key (`toolEnabledStatus`) in `aiService.ts`, `SetToolEnabledHandler.ts`, and `WebviewReadyHandler.ts`. Removed separate handling logic and ID conversions.
- **(Previous changes before interruption - see below)**
- **Refactored `AiService._getProviderInstance`:** Removed unreliable logic that inferred `providerId` from `modelId`. The method now requires both `providerId` and `modelId` as arguments, ensuring the correct provider is used directly. Updated UI and handlers to pass `providerId`.
- **Refactored Stream Processing (`src/streamProcessor.ts`):** Modified `process` method to iterate over `streamResult.fullStream` instead of sequential processing of individual streams (`textStream`, `toolCalls`, etc.). This ensures correct handling of mixed stream part types (text, tool calls, reasoning, etc.) and maintains proper order.
- **Fixed UI Streaming (Attempt 4 - `write_to_file`):** After `apply_diff` failed repeatedly, used `write_to_file` to apply a simplified state update logic in `webview-ui/src/app.tsx`'s `appendMessageChunk` handler. This version uses `.map()` to create a new messages array and new message/content objects, aiming for more reliable change detection by Preact.
- **Reverted Structured Output Strategy:** Removed `experimental_output` from `AiService` call and removed `main_content` from `structuredAiResponseSchema` again. Adopted new strategy: AI will append JSON block with `suggested_actions` at the end of its text response. `StreamProcessor` updated to parse this JSON block post-stream and remove it from the final history text.
- **Corrected Final Text Handling (User Guided):** Implemented the robust approach based on user feedback, prioritizing accumulated text for history.
    - `src/webview/handlers/SendMessageHandler.ts` no longer awaits `streamResult.text`. It passes `null` for the text argument to `reconcileFinalAssistantMessage`.
    - `src/historyManager.ts` (`reconcileFinalAssistantMessage`) now correctly uses the text accumulated via `appendTextChunk` (from the `textStream`) as the definitive final text content for the assistant message history. This ensures accurate recording even if the stream is interrupted. `streamResult.text` is not used for history updates. It only uses `finalCoreMessage` (if provided by the SDK) to get the final list of tool calls.
- **Code Simplification & TypeScript Reliance (User Guided):**
    - Removed unnecessary runtime checks (e.g., `streamResult` null check, `isPromise` checks) in `src/streamProcessor.ts` and `src/webview/handlers/SendMessageHandler.ts`, trusting the TypeScript type definitions provided by the Vercel AI SDK.
    - Improved error handling in `src/ai/aiService.ts`: Methods like `getAiResponseStream` now throw errors on failure (e.g., failed to get model instance) instead of returning null, allowing centralized error handling in the caller (`SendMessageHandler`).
- **Improved Type Safety (User Guided):** Addressed previous use of `any` type based on user feedback:
    - **`src/streamProcessor.ts`:**
        - Replaced `any` type for `streamResult` parameter in `process` method with generics (`StreamTextResult<TOOLS, PARTIAL_OUTPUT>`).
        - Used `util/types.isPromise` for checking `toolCalls` and `toolResults` instead of `typeof ... .then === 'function'`.
    - **`src/ai/aiService.ts`:**
        - Corrected return type annotation for `getAiResponseStream` (implicitly `Promise<StreamTextResult<...> | null>`).
        - Refactored `activeTools` construction using `reduce` for better readability.
- **Fixed Streaming TypeError & Final Message Handling (Attempt 6 - User Guided):** Corrected previous incorrect fixes based on user feedback.
- **Cleaned Up Redundant Tools:** Deleted unused interaction tool files (`showInformationMessage.ts`, `showWarningMessage.ts`, `showErrorMessage.ts`, `showInputBox.ts`, `showQuickPick.ts`) from `src/tools/vscode/` and updated `src/tools/vscode/index.ts` accordingly. Confirmed `src/tools/index.ts` requires no changes.
- **Finalized Suggested Actions Design:** Agreed to abandon tool-based approach (`presentOptionsTool`, `show...Tool`) for AI-suggested actions. New strategy: AI appends a ```json { "suggested_actions": [...] } ``` block at the end of its text response. `StreamProcessor` parses this block post-stream, sends actions to UI, and removes the block from the final history text. Schema (`structuredAiResponseSchema`) now only defines `suggested_actions`.
- **Corrected Toolset Understanding:** Focused analysis on core VS Code interaction tools, excluding filesystem tools from this specific discussion and clarifying the role of existing interaction tools before deciding on the structured output approach.
+- **Filesystem Tool Refactoring (Complete):**
+    - Finalized design based on feedback: Prioritized consistency, Glob support (except for write/edit), and clear separation of concerns (`replaceContent` vs `editFile`).
+    - Implemented unified `lineRange` schema (using `start_line`/`end_line` with negative indexing) for `readFiles`, `searchContent`, `replaceContent`.
+    - Created `searchContent`, `replaceContent`, `deleteItems` tools.
+    - Implemented core logic for `editFile` (including indentation).
+    - Updated tool indices and fixed related test errors.
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
- **Custom Instructions & Config Consolidation:**
    - Implemented global custom instructions via VS Code setting (`zencoder.customInstructions.global`).
    - Implemented project-specific custom instructions via `.zen/custom_instructions.md`.
    - Moved project-specific MCP server configuration from `.vscode/mcp_servers.json` to `.zen/mcp_servers.json`.
    - Updated `AiService` to load and merge both global and project instructions before sending requests to the AI.
    - Updated Settings UI (`SettingPage.tsx`) to allow editing/saving of both global and project instructions.
    - Added backend handlers (`Get/Set...InstructionsHandler`, `OpenOrCreate...FileHandler`) and registered them in `extension.ts`.
    - Updated config utility functions (`configUtils.ts`, `mcpConfigUtils.ts`) to use the new `.zen` directory for project files.
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
- **Current Task:** Implementing multi-chat functionality (see Next Steps above).
- **Paused:** Image upload task (will resume after multi-chat).
- **Future:** Implement remaining VS Code tool enhancements (`goToDefinition`, `findReferences`, `renameSymbol`, `getConfiguration`, debugging tools, `runCommandTool` exit code).
- **Future:** Confirm `replaceInActiveEditorTool` insertion capability.
- **Future:** Test structured output and suggested actions thoroughly.
- **Future:** Test image upload functionality thoroughly across different providers.

## Debugging Notes
+ - **Settings Page Infinite Loop (Refactored - Atom Lifecycle):** The loop persisted. Refactored `SettingPage.tsx` into smaller components. Moved subscription logic (subscribe/unsubscribe messages) from component `useEffect` hooks to the `onMount`/`onUnmount` lifecycle methods of the corresponding Jotai atoms in `atoms.ts`. Corrected `atomWithDefault` usage and added null checks in components. This is the recommended Jotai pattern for managing side effects tied to atom state.
+ - **Model Input Field (Fixed):** The `useEffect` hook in `ModelSelector.tsx` was incorrectly overwriting `inputValue`. Fixed by adjusting the dependency array to only react to external prop changes (`selectedProviderId`, `selectedModelId`).
- **TypeScript Errors in `SendMessageHandler.ts`:** Resolved import path issue. Remaining errors related to `HistoryManager` and `AiService` expecting `string` instead of `UiMessageContentPart[]` will be addressed by updating those files.
- **Filesystem Test (`filesystem.test.ts`):** Added tests for `readFileTool`. Fixed TS errors related to `StreamData` mock and missing `encoding` parameter in tool calls.
    - **Persistent Linter Issue:** TypeScript continues to report an overload error for `Buffer.from(content, 'utf8')` in the `createFile` helper function, even though the logic correctly handles `string | Buffer` input. Ignoring for now as the code functions correctly.
- **Fixed Provider List Display:** Corrected data structure mismatch (`providerId` vs `provider`) in `app.tsx` when handling `availableModels` message. Fixed JSX syntax error in `<datalist>`.
- **Fixed Clear Chat Button:** Reverted incorrect CSP change (`sandbox allow-modals`) in `webviewContent.ts`. Implemented custom confirmation dialog in `app.tsx` to replace native `confirm()`.
- **Fixed AI Response Rendering:** Modified `app.tsx` to immediately add an empty assistant message frame to state upon receiving `startAssistantMessage`, ensuring `appendMessageChunk` can find the target message.
- **Previous Fixes:** (Includes all items from the original list below this point)
- Provider/Model Persistence Implemented.
- UI Stream Update Fixed (Attempt 4 - `write_to_file` with `.map()`).
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
- **Model ID Handling:** Confirmed decision to use separate `providerId` and `modelId` for now, abandoning the problematic combined ID format. Planned future refactor to a more robust data structure (`{ internal_id, provider_id, display_name, reference_id }`).
- **Communication Model:** Refactored to a strict Request/Response model. All FE -> BE messages MUST be sent via `requestData` (in `communication.ts`) which always generates a `requestId` and sends a `type: 'requestData'` message with the actual operation in `requestType`. The backend (`extension.ts`) MUST always reply with a `responseData` message containing the same `requestId`. Fire-and-forget is no longer used from FE to BE.
- **Pub/Sub Model:** Backend pushes state updates (e.g., provider status, tool status) via a `type: 'pushUpdate'` message containing `topic` and `data`. Frontend (`main.tsx`) listens for these and updates Jotai atoms directly. The `listen` function in `communication.ts` handles sending `subscribe`/`unsubscribe` requests (via `requestData`) and managing the underlying `pushUpdate` listener for specific topics.
- **Handler Architecture:** Unified all backend handlers (`src/webview/handlers/`) to implement the `RequestHandler` interface. Removed `MessageHandler` interface and map. `extension.ts` uses a single `_handlers` map and unified logic in `_handleWebviewMessage` to process all incoming requests.
- **Stream Processing:** Refactored `StreamProcessor` to push chat history updates and streaming status via `pushUpdate` (`topic: 'chatUpdate'` and `topic: 'streamingStatusUpdate'`) instead of specific message types like `appendMessageChunk`. Frontend (`main.tsx`) updated to handle these new topics. (Note: `loadChatState` handling in `main.tsx` remains temporary).
- **MCP Architecture:** Shifted from UI/VSCode settings to dedicated JSON files (Global: `.../settings/mcp_settings.json`, Project: `.zen/mcp_servers.json`). All MCP client lifecycle management (init, retry, close), config handling, and tool fetching/caching is now handled by `McpManager`. `AiService` delegates MCP tasks. Settings UI displays status from `McpManager` and allows triggering retries.
- **Image Upload:** Implemented UI and basic frontend logic. Backend needs updating (`SendMessageHandler`, `HistoryManager`, `AiService`).
- **Markdown & Syntax Highlighting:** Implemented using `react-markdown` and `react-syntax-highlighter` (`vscDarkPlus` theme) in the frontend. Fixed initial webview loading issues by correcting root `tsconfig.json` references.
- **Suggested Actions Implementation:** New strategy: AI appends JSON block with `suggested_actions` to the end of its text response. `StreamProcessor` parses this post-stream, sends actions to UI, and removes the block from history. Schema (`structuredAiResponseSchema`) only defines `suggested_actions`. `experimental_output` is not used. Text streaming relies on standard `text-delta` parts.
- **VS Code Tool Enhancements:** Added `goToDefinitionTool`, `findReferencesTool`, `renameSymbolTool`, `getConfigurationTool`, `startDebuggingTool`. Verified `replaceInActiveEditorTool` insertion. Remaining: Debugging tools (stop, step, breakpoints), enhance `runCommandTool` (exit code).
- **UI Fixes:** (Previous fixes remain relevant)
    - Corrected `app.tsx` to use `providerId` from `AvailableModel` type.
    - Reverted invalid `sandbox allow-modals` CSP directive in `webviewContent.ts`.
    - Implemented custom confirmation dialog in `app.tsx` for Clear Chat.
    - Ensured `app.tsx` adds assistant message frame on `startAssistantMessage`.
    - Refactored `appendMessageChunk` handler in `app.tsx` using `.map()` for potentially more robust state updates.
    - **Resolved UI Rendering/Layout Issues:** Fixed conflicts between `wouter` routing and Flexbox by using `<Switch>`, correcting route paths (`/index.html`), and ensuring proper flex properties (`flex-1`, `h-full`) on routed components.
- **Architecture:** Unified handler registration pattern, modularized backend services. Strict Request/Response for FE->BE, Pub/Sub (`pushUpdate`) for BE->FE state updates.
- **State/History:** Persist UI state (`UiMessage[]`), translate to `CoreMessage[]` on demand. Streaming updates now pushed via `chatUpdate` topic.
- **Model Handling:** Pass `modelId` correctly; delegate provider logic.
- **Tooling (Filesystem - Background):**
   - Filesystem tools refactored for consistency (Glob paths, unified `lineRange`, clear separation of `replaceContent`/`editFile`).
   - Prioritize inline status; confirm results passed to AI.
- **Persistence:** Use `globalState` for history, `vscode.getState/setState` for webview state. Existing history logic should handle saving partial messages on stream abort.
- **Dependencies/Setup:** Integrated Vite, Preact, UnoCSS, wouter, etc.
- **UI Navigation:** Finalized navigation using settings icon in `HeaderControls` and back button in `SettingPage`, removing top nav bar. Routing handled by `wouter` with `<Switch>`.
- **Multi-Chat Architecture:** Storing chat sessions (`ChatSession[]`) including history and config per chat in `workspaceState`. Backend services and handlers updated to operate based on `chatId`. Frontend manages `chatSessions` state and `activeChatId`.
- **Model ID Handling:** Corrected system to use separate `providerId` and `modelId` fields, removing the previous combined `providerId:modelName` format. Fixed callback signature mismatch in `app.tsx` that was causing selection resets.
- **Tool Enablement Storage:** All tool enablement statuses (standard and MCP) are stored uniformly in `globalState` under the `toolEnabledStatus` key. `SetToolEnabledHandler` writes to this key, and `aiService` reads from it.
- **MCP Tool Identifier:** Standardized on `mcp_serverName_toolName` format for identifying MCP tools when interacting with the AI and storing/retrieving enablement status from `globalState`.
- **Message Actions:** Added copy/delete functionality per message bubble in `MessagesArea.tsx`, implemented handlers in `app.tsx`, and added backend support via `DeleteMessageHandler` and `HistoryManager`. Removed the global clear chat button from `HeaderControls.tsx`.
- **Model Selector:** Refactored into a reusable component (`ModelSelector.tsx`) used in both `SettingPage.tsx` and `HeaderControls.tsx`.
- **Previous Decisions:** (Includes items like routing, dynamic OpenRouter fetch, API key handling, etc.)