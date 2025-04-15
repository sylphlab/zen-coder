# Project Progress

## What Works
- **Fixed Chat Loading/Redirect Issue:** Refactored `ChatPage.tsx` and `ChatView.tsx` to consolidate redirect logic in `ChatPage`. Ensures `ChatPage` waits for both `$chatSessions` and `$activeChatHistory` to load before checking if the target chat session exists and rendering `ChatView` or redirecting. `ChatView` now assumes it's rendered only with valid `chatId` and focuses solely on history loading.
- **Fixed Reactivity Issue (Chat History):** Modified `HistoryManager.getHistory` to return a copy (`[...history]`) instead of a direct reference, ensuring Nanostore/Preact detect changes and trigger UI updates for incoming messages.
- **Fixed Settings Page Input:** Corrected custom instruction input interference.
- **Restored Tool Settings Section:** Uncommented the component in the settings page.
- **Frontend State Refactoring (Nanostores using `createStore`):**
    - Migrated core state management from Jotai/custom hooks to Nanostores.
    - Implemented `createMutationStore` utility.
    - **Refactored all data stores using the new `createStore` utility:** `$chatSessions`, `$defaultConfig` (in `chatStores.ts`), `$activeChatSession` (still uses `onMount`), `$activeChatHistory` (in `activeChatHistoryStore.ts`), `$providerStatus` (in `providerStores.ts`), `$allToolsStatus` (in `toolStores.ts`), `$mcpStatus` (in `mcpStores.ts`), `$customInstructions` (in `settingsStores.ts`).
    - **Enhanced `createStore` utility:** Added `dependsOn` option to handle reactivity for dynamic stores (like `$activeChatHistory` depending on `router`).
    - **Removed `createFetcherStore` utility:** Replaced by `createStore`.
    - Removed deprecated `$availableProvidersStore`.
    - Updated `createMutationStore` and mutation store definitions (`getOptimisticUpdate`, `applyMutationResult`) to handle `StandardStore` ('loading'/'error') states correctly.
    - **Removed obsolete Jotai atoms:** Deleted `webview-ui/src/store/atoms.ts`. Refactored `ChatView`, `InputArea`, `MessagesArea` to remove Jotai dependencies. UI state now uses local component state (`useState`) or derived Nanostore state (`$sendMessage.loading`), passed down via props.
- **Routing (`@nanostores/router`):** Implemented and integrated.
- **Pub/Sub:** Handled within `createStore` utility. Backend pushes updates only when subscribed.
- **Request/Response:** Strict FE->BE communication via `requestData`. Unified backend `RequestHandler`.
- **Stream Processing:** Handles mixed stream parts, pushes updates via `pushUpdate`.
- **Multi-Chat Backend Structure:** `HistoryManager` handles multiple sessions. Handlers operate on `chatId`.
- **Multi-Chat Frontend Basics:** `ChatListPage` exists, basic navigation works. `ChatView` displays content based on route param.
- **Model ID Handling:** Separate `providerId` and `modelId` used correctly.
- **VS Code Tools (Partial):** `goToDefinition`, `findReferences`, `renameSymbol`, `getConfiguration`, `startDebugging`, `replaceInActiveEditor`. Filesystem tools refactored.
- **MCP Management:** `McpManager`, file-based config, status UI in settings.
- **Stream Cancellation:** Implemented.
- **Image Upload (Partial):** Basic UI, data sending logic exists. Backend needs review/update. Display works.
- **Message Actions:** Copy/Delete per message implemented.
- **UI Basics:** Markdown/Syntax Highlighting, basic UnoCSS styling.
- **Fixed MCP Server Settings UI:**
    - Implemented optimistic updates for the "Retry Connection" button in `webview-ui/src/stores/mcpStores.ts`.
    - Corrected UI logic in `webview-ui/src/components/settings/McpServerSettings.tsx` to show "Retrying..." status per-server using local state and disable buttons correctly during a retry.
    - Added and registered backend handlers (`OpenGlobalMcpConfigHandler`, `OpenProjectMcpConfigHandler`) for the "Configure Global/Project Servers" buttons in `src/extension.ts`.
    - Modified backend logic in `src/ai/mcpManager.ts` to force reconnection attempt on retry and emit `mcpStatusChanged` events.
    - Corrected `McpManager` to push status updates via the correct `pushUpdate` mechanism (`mcpStatus` topic).
    - Updated `AiService` to listen for `mcpStatusChanged` from `McpManager` and trigger `_notifyToolStatusChange`, ensuring MCP tools appear in the main toggle list.
- **Refactored Tool/MCP Settings UI:**
    - Merged MCP server status and retry button into `ToolSettings.tsx`.
    - Implemented collapsible sections (default collapsed) for Standard Tools and MCP Servers.
    - Fixed layout issues (description wrapping, flex constraints).
    - Removed `McpServerSettings.tsx`.

## What's Left
- **Testing (Manual - Post `createStore` Refactor):** Crucial next step.
    - Verify all refactored stores (`$chatSessions`, `$defaultConfig`, `$activeChatSession`, `$activeChatHistory`, `$providerStatus`, `$allToolsStatus`, `$mcpStatus`, `$customInstructions`) load initial data correctly.
    - Verify real-time updates via PubSub for all subscribed stores.
    - Verify mutation logic and optimistic updates for settings (`provider`, `tool auth`, `mcp retry`), chat creation/deletion, message sending/deletion.
    - **Verify reactivity:** Confirm that `$activeChatHistory` updates correctly when the route (`chatId`) changes.
    - Test UI interactions, loading/error states, navigation after major refactoring.
    - Test state derivation (`isStreaming`) and local state management (`inputValue`, `selectedImages`).
- **Implement Incremental PubSub Updates (Backend + Frontend):** Next major task after testing.
- **Enhance `createMutationStore` for Multi-Store Updates:** Future task.
- **Implement Features Based on New Communication Model:** Pagination, Refresh, Connection Status. Future task.
- **Implement Pub/Sub for Suggested Actions:** Replace temporary state in `ChatView.tsx`.
- **Image Upload (Backend & Full Test):** Review/update backend handling (`HistoryManager`, `AiService`) and test the full flow.
- **VS Code Tool Enhancements:** Implement remaining VS Code debugging tools (stop, step, breakpoints); enhance `runCommandTool`.
- **UI Refinements & Error Handling:** Continue improving UI styling and error reporting/handling.
- **Test Structured Output:** Thoroughly test suggested actions parsing and display.

## Current Status (Post `createStore` Refactor)
- Frontend state management uses Nanostores via the enhanced `createStore` utility (handling ReqRes+PubSub and dependencies) and `createMutationStore`.
- Obsolete Jotai atoms and `createFetcherStore` utility removed.
- Dynamic stores like `$activeChatHistory` are reactive to router changes.
- Components use local state (`useState`) or receive Nanostore state via props/`useStore`.

## Known Issues / TODOs
- **Testing:** Thorough manual testing of the `createStore` refactoring, reactivity, and mutations is required.
- **Suggested Actions:** Needs proper Nanostore/PubSub implementation.
- **Image Upload:** Backend processing needs verification/completion.
- **(Previous Known Issues Still Apply where relevant)**
