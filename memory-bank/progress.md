# Project Progress

## What Works
- **Fixed Settings Page Input:** Corrected custom instruction input interference.
- **Restored Tool Settings Section:** Uncommented the component in the settings page.
- **Frontend State Refactoring (Nanostores Complete):**
    - Migrated core state management from Jotai/custom hooks to Nanostores.
    - Implemented `createFetcherStore` and `createMutationStore` utilities.
    - Created Nanostores for `$chatSessions`, `$defaultConfig`, `$providerStatus`, `$availableProviders`, `$allToolsStatus`, `$mcpStatus`, `$customInstructions`. Stores handle initial data fetching and backend push updates (`listen`).
    - Replaced `wouter` with `@nanostores/router`, integrated location persistence.
    - **Removed obsolete Jotai atoms:** Deleted `webview-ui/src/store/atoms.ts`. Refactored `ChatView`, `InputArea`, `MessagesArea` to remove Jotai dependencies for UI state (`isStreamingAtom`, `inputValueAtom`, `selectedImagesAtom`, `suggestedActionsMapAtom`, `activeChatIdAtom`). UI state now uses local component state (`useState` in `ChatView`) or derived Nanostore state (`$sendMessage.loading`), passed down via props. Active chat ID relies solely on route parameter.
- **Routing (`@nanostores/router`):** Implemented and integrated.
- **Pub/Sub:** Explicit subscribe/unsubscribe mechanisms implemented for Provider Status, Tool Status, Default Config, Custom Instructions, MCP Status. Backend pushes updates only when subscribed.
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

## What's Left
- **Testing (Manual - Post-Refactor):** Crucial next step.
    - Verify all UI interactions, state updates, data loading, navigation after major Jotai removal and Nanostores integration.
    - Test `isStreaming` state derivation from `$sendMessage.loading`.
    - Test `inputValue` local state management.
    - Test `selectedImages` state from `useImageUpload` hook.
    - Test prop passing (`inputValue`, `isStreaming`, `selectedImages`, `suggestedActionsMap`) from `ChatView` down.
- **Implement Pub/Sub for Suggested Actions:** Replace temporary local state for `suggestedActionsMap` in `ChatView.tsx` with a proper Nanostore atom listening to backend pushes.
- **Image Upload (Backend & Full Test):** Review/update backend handling (`HistoryManager`, `AiService`) and test the full flow.
- **VS Code Tool Enhancements:** Implement remaining VS Code debugging tools (stop, step, breakpoints); enhance `runCommandTool`.
- **UI Refinements & Error Handling:** Continue improving UI styling and error reporting/handling.
- **Test Structured Output:** Thoroughly test suggested actions parsing and display.

## Current Status (Post-Jotai Removal)
- Frontend state management is now fully based on Nanostores and local component state (`useState`).
- Obsolete Jotai atoms and related logic have been removed.
- Components (`ChatView`, `InputArea`, `MessagesArea`) receive necessary state via props.
- Active chat ID is determined solely by the route parameter.

## Known Issues / TODOs
- **Suggested Actions:** Currently use temporary local state in `ChatView`; needs proper Nanostore/PubSub implementation.
- **Testing:** Major refactoring requires thorough manual testing.
- **Image Upload:** Backend processing needs verification/completion.
- **(Previous Known Issues Still Apply where relevant, e.g., filesystem test linter issue)**
