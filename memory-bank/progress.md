# Project Progress

## What Works
- **Provider Status Pub/Sub:**
    - Implemented explicit subscribe/unsubscribe mechanism for real-time Provider status updates.
    - Frontend (`SettingPage`) now subscribes on mount and unsubscribes on unmount.
    - Backend (`AiService`) tracks subscription status and only pushes status updates when subscribed.
    - Created `SubscribeToProviderStatusHandler` and `UnsubscribeFromProviderStatusHandler`.
    - Removed direct handling of `pushUpdateProviderStatus` in `main.tsx`.
- **Tool Status Pub/Sub:**
    - Implemented explicit subscribe/unsubscribe mechanism for real-time Tool status updates.
    - Frontend (`SettingPage`) now subscribes on mount and unsubscribes on unmount.
    - Backend (`AiService`) tracks subscription status (`_isToolStatusSubscribed`) and only pushes status updates (`_notifyToolStatusChange`) when subscribed.
    - Created `SubscribeToToolStatusHandler` and `UnsubscribeFromToolStatusHandler`.
    - Updated `SetToolEnabledHandler` to call `_notifyToolStatusChange`.
    - Removed direct handling of `updateAllToolsStatus` in `main.tsx` (verified).
- **Default Config Pub/Sub:**
    - Implemented explicit subscribe/unsubscribe mechanism for real-time Default Config updates.
    - Frontend (`SettingPage`) now subscribes on mount and unsubscribes on unmount.
    - Backend (`AiService`) tracks subscription status (`_isDefaultConfigSubscribed`) and only pushes status updates (`_notifyDefaultConfigChange`) when subscribed.
    - Created `SubscribeToDefaultConfigHandler` and `UnsubscribeFromDefaultConfigHandler`.
    - Updated `SetDefaultConfigHandler` to call `_notifyDefaultConfigChange`.
- **Custom Instructions Pub/Sub:**
    - Implemented explicit subscribe/unsubscribe mechanism for real-time Custom Instructions updates.
    - Frontend (`SettingPage`) now subscribes on mount, unsubscribes on unmount, and removed initial request.
    - Backend (`AiService`) tracks subscription status (`_isCustomInstructionsSubscribed`) and only pushes status updates (`_notifyCustomInstructionsChange`) when subscribed.
    - Created `SubscribeToCustomInstructionsHandler` and `UnsubscribeFromCustomInstructionsHandler`.
    - Updated `SetGlobalCustomInstructionsHandler` and `SetProjectCustomInstructionsHandler` to call `_notifyCustomInstructionsChange`.
- **App Loading & Message Handling:**
    - Fixed `unknown or timed out request ID` error by centralizing all message handling (requests and pushes) into a single global listener in `main.tsx`.
    - Removed `MessageHandlerComponent`.
    - `main.tsx` listener now directly updates Jotai atoms using `store.set`.
    - `requestManager.ts` simplified to only handle Promise resolution/rejection.
- **MCP Status Pub/Sub:**
    - Implemented explicit subscribe/unsubscribe mechanism for real-time MCP server status updates.
    - Frontend (`SettingPage`) now subscribes on mount and unsubscribes on unmount.
    - Backend (`McpManager`) tracks subscription status and only pushes updates when subscribed.
    - Created `SubscribeToMcpStatusHandler` and `UnsubscribeFromMcpStatusHandler`.
- **Initial Data Loading (Request/Response):**
    - Removed `WebviewReadyHandler` push mechanism.
    - Implemented Request/Response pattern using `requestData` utility.
    - Created backend handlers (`GetChatStateHandler`, `GetAvailableProvidersHandler`, `GetProviderStatusHandler`, `GetAllToolsStatusHandler`, `GetMcpStatusHandler`) registered in `extension.ts`.
    - Frontend (`main.tsx` listener) now requests initial data (chats, providers, statuses) on mount.
    - `requestManager` resolves promises; Jotai async atoms handle their own state updates based on resolved data. `main.tsx` handles atom updates for push messages.
- **Multi-Chat Backend Structure:**
    - `HistoryManager` refactored to manage multiple `ChatSession` objects (including history and config) stored in `workspaceState`.
    - `HistoryManager` includes methods for creating, deleting, updating, and retrieving chat sessions and the last active chat ID.
    - `HistoryManager` includes basic logic for determining effective chat configuration (merging defaults and chat-specific settings) and deriving `providerId` from a standardized `chatModelId` (`providerId:modelName`).
    - Core backend services (`AiService`, `StreamProcessor`) and handlers (`SendMessageHandler`, `ClearChatHistoryHandler`) updated to accept and use `chatId`.
    - New backend handlers (`SetActiveChatHandler`, `CreateChatHandler`, `DeleteChatHandler`) created and registered in `extension.ts` to manage chat sessions.
- **Multi-Chat Frontend Structure:**
    - `app.tsx` state updated to manage `chatSessions` array and `activeChatId`.
    - `app.tsx` includes handlers (`handleSelectChat`, `handleCreateChat`, `handleDeleteChat`) to post messages to the new backend handlers.
    - `ChatListPage.tsx` component created to display the list of chats.
    - Basic routing added in `app.tsx` to navigate between the chat view (`/index.html`) and the chat list view (`/chats`).
    - `HeaderControls.tsx` updated with a button to navigate to the chat list view.
    - `MessagesArea.tsx` updated to display messages from the currently active chat session.
- **Jotai Async Refactor & Model ID Correction (Complete):** (Details omitted for brevity, see activeContext.md)
- **TypeScript Error Fixes:** Resolved various TS errors introduced during refactoring.
- **VS Code Tool Enhancements:**
    - Added `goToDefinitionTool`.
    - Added `findReferencesTool`.
    - Added `renameSymbolTool`.
    - Added `getConfigurationTool`.
    - Added `startDebuggingTool`.
    - Verified `replaceInActiveEditorTool` insertion capability.
- **UI Improvements:**
    - Added loading feedback to chat list actions.
    - **Fixed Model Input Field:** Resolved issue where users couldn't type into the model input field in `ModelSelector.tsx` by correcting the `useEffect` hook's dependencies.
    - Applied styling adjustments to chat list and main chat view.
+- **MCP Server Configuration:**
+    - Defined `zencoder.mcp.servers` setting in `package.json`.
+    - `AiService.ts` updated to dynamically load MCP servers based on settings.
+        - Corrected SSE transport configuration method (object literal).
+    - Settings UI (`SettingPage.tsx`) updated with a section to manage MCP server configurations (add/edit/delete/toggle).
+        - Fixed initialization error causing blank page.
+- **Stream Processing Refactoring:** Refactored `src/streamProcessor.ts` to correctly handle mixed stream parts by iterating over `fullStream`.
+- **Filesystem Tool Refactoring & Enhancement:**
+    - Tools (`listFiles`, `statItems`, `deleteItems`, `searchContent`, `replaceContent`) now support Glob patterns for path inputs where appropriate.
+    - Tools processing content (`readFiles`, `searchContent`, `replaceContent`) use a consistent `lineRange` parameter (with negative indexing) for range control.
+    - Added `searchContent` (with context), `replaceContent` (bulk replace), `deleteItems` (unified delete), and `editFile` (precise edits) tools.
+    - Core logic for all filesystem tools implemented.
+    - Tool indices updated and related test errors fixed.
- **Model Selector Refactoring:** Created reusable `ModelSelector.tsx` component, updated `SettingPage.tsx`, `HeaderControls.tsx`, and `app.tsx`. Improved model selection logic.
- **Message Bubble Actions:** Added Copy/Delete buttons to messages in `MessagesArea.tsx`, implemented handlers in `app.tsx`, and added backend support (`DeleteMessageHandler`, `HistoryManager.deleteMessageFromHistory`).
- **Unified Tool ID & Enablement:** Standardized MCP tool ID format (`mcp_serverName_toolName`) and unified enablement logic using `globalState` (`toolEnabledStatus`) across `aiService.ts` and `SetToolEnabledHandler.ts`.
- **Provider Selection Persistence:** Implemented saving/restoring of selected provider and model ID in `app.tsx`.
- **Clear Chat Button:** Removed from `HeaderControls.tsx`.
- **UI Stream Update (Attempt 3):** Applied stricter immutability pattern for state updates in `appendMessageChunk` handler (`app.tsx`).
- **UI Stream Update (Attempt 2):** Refined state update logic (`app.tsx`) using deep cloning to force UI re-renders for message chunks.
- **UI Stream Update:** Fixed frontend state update logic (`app.tsx`) for `appendMessageChunk` to ensure message chunks render immediately by creating new array references.
- **AI Response Display:** Fixed frontend logic (`app.tsx`) to correctly handle the `startAssistantMessage` signal using the provided `messageId`, ensuring streaming AI responses are displayed properly.
- **Immediate User Message Display:** User messages now appear instantly in the chat UI after sending.
- **UI Rendering Fixed:** Corrected message rendering logic in `App.tsx` to handle both string and array content types, resolving `msg.content.map is not a function` error.
- **UI Initialization Loop Fixed:** Corrected `useEffect` dependencies in `App.tsx` to prevent infinite requests on startup.
- **UI Styling (UnoCSS):** Basic styling applied to main layout, navigation, chat elements (header, messages, input), and settings page using UnoCSS utility classes. Dark mode support included.
- **Chat History Persistence:** History is loaded/saved using `CoreMessage` format in `context.globalState`. User/Assistant messages are saved; Tool results saving is incomplete.
- **Model Selection Persistence:** Last selected model ID is now saved/restored using webview state API (`vscode.getState`/`setState`).
- **Stream End Handling Fixed:** Backend now sends an explicit `streamFinished` message, and the UI handles it to reliably stop the streaming indicator.
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
- **Routing Implemented:** Added `wouter` for navigation between Chat (`/index.html`) and Settings (`/settings`) pages. Created basic `SettingPage.tsx` and `ChatPage.tsx`. Replaced settings modal with the `/settings` route. Routing issues resolved using `<Switch>` and correct path.
- **Settings Provider Search:** Added a search input to `SettingPage.tsx` to filter the list of providers.
- **AI Provider Refactoring (Complete):** Implemented modular provider structure under `src/ai/providers`. `AiService` now fully delegates model creation, listing, API key management, and status checks to these modules. Added OpenAI and Ollama providers.
- **Settings Page API Key Input:** Added input fields and buttons to `SettingPage.tsx` to allow users to set API keys for each provider. Implemented message passing (`setApiKey`) to the extension host, which handles storing the key in `SecretStorage` via `AiService`. (Previous)
- **Settings Page Restored:** Moved provider settings logic from `App.tsx` to `SettingPage.tsx` and passed necessary props (`providerStatus`, `handleProviderToggle`) to restore functionality after routing refactor. Exported required types from `App.tsx`. (Previous)
- **Vite Port Discovery Implemented & Fixed:** Extension now reads the actual Vite dev server port from the correct file path (`.vite.port` in the project root) during development, ensuring reliable HMR connection even if the default port changes.
- **`package.json` Corrected:** Contributions (`activationEvents`, `views`) updated and obsolete sections (`menus`, `commands`) removed to align with `WebviewViewProvider` implementation, resolving the "No data provider registered" error.
- **Development CSP Relaxed (Testing):** Added `'unsafe-eval'` to `script-src` in development mode CSP to test HMR compatibility.

## What's Left (Multi-Chat Implementation)
- **Standardize Model IDs (Complete):** All parts verified/completed.
- **Refine Frontend (Partially Complete):**
    - Chat deletion confirmation dialog verified.
    - `useMessageHandler` hook verified for `loadChatState`.
    - Chat-specific model selection UI verified in `HeaderControls`.
    - UI feedback during chat creation/deletion improved (loading state added).
    - `ChatListPage.tsx` styling improved.
- **Refine Backend (Complete):**
    - Default config loading from VS Code settings verified in `HistoryManager`.
    - VS Code settings definitions exist in `package.json`.
    - `AiService` usage of effective config verified.
- **Testing:** Next major step.

## What's Left (Other Features/Enhancements)
- **Testing:** Thoroughly test the new Request/Response data loading and Pub/Sub mechanisms.
- **Implement True Pub/Sub (Complete for Settings):** MCP status, Provider status, Tool status, Default Config, and Custom Instructions now use Pub/Sub. Review remaining push updates (e.g., `mcpConfigReloaded`) for potential conversion.
- Resume and complete image upload functionality.
- Implement remaining VS Code tool enhancements (debugging tools: stop, step, breakpoints; enhance `runCommandTool`).
- Test structured output and suggested actions thoroughly (Manual).
- Improve error handling throughout.
- Further refine UI styling and potentially add animations.
- Thoroughly test UI interactions (model selection, async states, etc.) (Manual).
- Resume and complete image upload functionality (Manual Testing/Debugging).

## Current Status (Multi-Chat Implementation)
- Backend services (`HistoryManager`, `AiService`, `StreamProcessor`) and core handlers updated for `chatId`.
- New backend handlers created and registered (`SetActiveChatHandler`, `CreateChatHandler`, `DeleteChatHandler`).
- Frontend state (`app.tsx`) updated to manage `chatSessions` and `activeChatId`.
- `ChatListPage.tsx` component created and integrated into routing.
- Basic navigation between chat view and chat list implemented.
- Model ID format standardized and integrated.
- Frontend model selection UI updated to reflect active chat config.
- Backend config loading and usage verified.

## Known Issues / TODOs
- **Model Input Field (Fixed):** Resolved issue where users couldn't type into the model input field in `ModelSelector.tsx` by correcting the `useEffect` hook's dependencies.
- **Model ID Strategy (Future):** Plan to refactor `AvailableModel` structure to `{ internal_id, provider_id, display_name, reference_id }` for clarity and robustness. (Recorded in activeContext)
- **Communication Model:** Initial data load uses Request/Response. MCP status, Provider status, Tool status, Default Config, and Custom Instructions use Pub/Sub. Chat streaming uses context-specific push. All message handling centralized in `main.tsx`. Remaining push updates (e.g., `mcpConfigReloaded`) need review.
- **Testing:** Multi-chat functionality is largely untested.
- **(Previous Known Issues Still Apply where relevant)**
- **MCP Tool Schema Error:** Believed to be resolved by unifying tool ID format to `mcp_serverName_toolName`. Requires testing.