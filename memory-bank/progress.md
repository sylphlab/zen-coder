# Project Progress

## What Works
- **Multi-Chat Backend Structure:**
    - `HistoryManager` refactored to manage multiple `ChatSession` objects (including history and config) stored in `workspaceState`.
    - `HistoryManager` includes methods for creating, deleting, updating, and retrieving chat sessions and the last active chat ID.
    - `HistoryManager` includes basic logic for determining effective chat configuration (merging defaults and chat-specific settings) and deriving `providerId` from a standardized `chatModelId` (`providerId:modelName`).
    - Core backend services (`AiService`, `StreamProcessor`) and handlers (`SendMessageHandler`, `ClearChatHistoryHandler`, `WebviewReadyHandler`) updated to accept and use `chatId`.
    - New backend handlers (`SetActiveChatHandler`, `CreateChatHandler`, `DeleteChatHandler`) created and registered in `extension.ts` to manage chat sessions.
- **Multi-Chat Frontend Structure:**
    - `app.tsx` state updated to manage `chatSessions` array and `activeChatId`.
    - `app.tsx` includes handlers (`handleSelectChat`, `handleCreateChat`, `handleDeleteChat`) to post messages to the new backend handlers.
    - `ChatListPage.tsx` component created to display the list of chats.
    - Basic routing added in `app.tsx` to navigate between the chat view (`/index.html`) and the chat list view (`/chats`).
    - `HeaderControls.tsx` updated with a button to navigate to the chat list view.
    - `MessagesArea.tsx` updated to display messages from the currently active chat session.
- **Jotai Async Refactor & Model ID Correction (Complete):**
    - Implemented request/response mechanism between webview and extension host.
    - Refactored data fetching atoms (`providerStatus`, `availableProviders`, `defaultConfig`, `modelsForProvider`) to use async logic and the request mechanism.
    - Updated UI components (`ModelSelector`, `HeaderControls`, `SettingPage`, `App`) to use async atoms with `loadable` for loading/error states.
    - Corrected model ID handling to use separate `providerId` and `modelId` fields across types, components, and handlers.
    - Removed redundant message handlers (`GetProviderStatusHandler`, etc.) in `extension.ts`.
    - Added placeholder methods to `AiService` for required request handlers (`getMcpStatuses`, `getAllToolsWithStatus`, `getCombinedCustomInstructions`).
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
- **Unified Tool ID & Enablement:** Standardized MCP tool ID format (`mcp_serverName_toolName`) and unified enablement logic using `globalState` (`toolEnabledStatus`) across `aiService.ts`, `SetToolEnabledHandler.ts`, and `WebviewReadyHandler.ts`.
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
    - **TODO:** Improve UI feedback during chat creation/deletion.
    - **TODO:** Style `ChatListPage.tsx`.
- **Refine Backend (Complete):**
    - Default config loading from VS Code settings verified in `HistoryManager`.
    - VS Code settings definitions exist in `package.json`.
    - `AiService` usage of effective config verified.
- **Testing:** Next major step.

## What's Left (Other Features/Enhancements)
- Resume and complete image upload functionality.
- Implement remaining VS Code tool enhancements (`goToDefinition`, etc.).
- Confirm `replaceInActiveEditorTool` insertion capability.
- Test structured output and suggested actions thoroughly.
- Improve error handling throughout.
- Refine UI styling and potentially add animations.
- Implement placeholder methods in `AiService` (`getMcpStatuses`, `getAllToolsWithStatus`, `getCombinedCustomInstructions`).
- Verify/update backend handlers (`SetDefaultConfigHandler`, `UpdateChatConfigHandler`) and VS Code settings to use separate `providerId`/`modelId`.
- Thoroughly test UI interactions, especially model selection and async data loading/error states.

## Current Status (Multi-Chat Implementation)
- Backend services (`HistoryManager`, `AiService`, `StreamProcessor`) and core handlers updated for `chatId`.
- New backend handlers created and registered (`SetActiveChatHandler`, `CreateChatHandler`, `DeleteChatHandler`).
- Frontend state (`app.tsx`) updated to manage `chatSessions` and `activeChatId`.
- `ChatListPage.tsx` component created and integrated into routing.
- Basic navigation between chat view and chat list implemented.
- Model ID format standardized and integrated.
- Frontend model selection UI updated to reflect active chat config.
- Backend config loading and usage verified.

## Known Issues / TODOs (Multi-Chat)
- **Model ID Handling:** Corrected to use separate `providerId` and `modelId`.
- **Frontend State Hook (`useMessageHandler`):** Verified.
- **Chat Deletion:** Confirmation dialog verified.
- **Chat Configuration UI:** Implemented via `HeaderControls`.
- **Default Config Loading:** Implemented in `HistoryManager`.
- **`AiService._getProviderInstance`:** Verified.
- **Testing:** Multi-chat functionality is largely untested.
- **TODO:** Improve UI feedback during chat creation/deletion (e.g., loading indicators).
- **TODO:** Style `ChatListPage.tsx`.
- **(Previous Known Issues Still Apply where relevant)**
- **MCP Tool Schema Error:** Believed to be resolved by unifying tool ID format to `mcp_serverName_toolName`. Requires testing.