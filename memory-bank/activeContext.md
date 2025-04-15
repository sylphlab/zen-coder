# Active Context

## Current Focus
**Communication Mechanism Refactoring:** Implementing and standardizing the ReqRes (fetch initial state) + PubSub (subscribe updates, no initial state) pattern across the application using the new `createStore` utility.

## Next Steps
1.  **Implement Incremental PubSub Updates (Backend + Frontend):**
    *   **Backend:** Modify `pushUpdate` logic to calculate and send JSON Patches (RFC 6902) instead of full state for relevant topics (especially `chatHistoryUpdate`). This requires adding sequence IDs (`seqId`) to messages and potentially versioning to states.
    *   **Frontend:** Update the `handleUpdate` function within `createStore` (or specific store definitions) to correctly apply received JSON Patches to the current state.
3.  **Enhance `createMutationStore` for Multi-Store Updates:**
    *   Modify `createMutationStore` to optionally accept an array of `targetAtom` configurations.
    *   Update `getOptimisticUpdate` and `applyMutationResult` to return/accept updates for multiple stores.
    *   Update relevant mutation stores (e.g., `$createChat` might affect `$chatSessions` and potentially navigate the router) to utilize this.
4.  **Implement Features Based on New Communication Model:**
    *   Chat History Pagination (Scroll-to-load-more).
    *   Manual Refresh button.
    *   Connection Status Indicator & Disconnect/Reconnect Handling (including fetching delta updates).
5.  **Testing (Manual):** Thoroughly test all refactored stores and communication flows.
    *   Verify initial data loading via ReqRes.
    *   Verify real-time updates via PubSub (full state push for now).
    *   Verify mutation logic, including optimistic updates and error handling.
    *   Verify dynamic stores (`$activeChatHistory`, `$activeChatSession`) correctly react to route changes.
6.  **Implement Pub/Sub for Suggested Actions:** Replace temporary state in `ChatView.tsx`.
7.  **Resume Image Upload:** Continue implementation.
8.  **Compliance Review & VS Code Tool Enhancements:** As before.

## Recent Changes (Communication Refactor, `createStore` Utility)
+ **Defined Standard Communication Pattern:** Established **ReqRes (fetch initial) + PubSub (subscribe updates, no initial state)** as the standard. Documented in `systemPatterns.md`.
+ **Created `createStore` Utility (`stores/utils/createStore.ts`):** Implemented a standardized utility for creating Nanostores that follow the new pattern, handling fetch, subscription, loading/error states, and dynamic parameters.
+ **Created Backend Handlers:** Added `GetChatSessionHandler`, `GetChatHistoryHandler`. Fixed `GetChatSessionsHandler`, `GetDefaultConfigHandler` response types.
+ **Refactored Core Stores:**
+   - `$chatSessions` (`chatStores.ts`): Refactored using `createStore`.
+   - `$defaultConfig` (`chatStores.ts`): Refactored using `createStore`, removed dependency on old `createFetcherStore`.
+   - `$activeChatSession` (`activeChatHistoryStore.ts`): Refactored to use ReqRes pattern (onMount + requestData).
+   - `$activeChatHistory` (`activeChatHistoryStore.ts`): Refactored using `createStore` with `dependsOn: [router]` for reactivity.
+ **Enhanced `createStore` Utility:** Added `dependsOn` option to handle reactivity for stores whose fetch/subscribe logic depends on other stores (like the router).
+ **Completed Store Refactoring:**
+   - `$providerStatus` (`providerStores.ts`): Refactored using `createStore`. Removed deprecated `$availableProvidersStore`.
+   - `$allToolsStatus` (`toolStores.ts`): Refactored using `createStore`.
+   - `$mcpStatus` (`mcpStores.ts`): Refactored using `createStore`.
+   - `$customInstructions` (`settingsStores.ts`): Refactored using `createStore`.
+ **Updated `createMutationStore`:** Modified to accept `StandardStore` (with 'loading'/'error' states) as `targetAtom` and handle these states in callbacks (including type fixes).
+ **Updated Mutation Store Callbacks (`chatStores.ts`, `providerStores.ts`, `toolStores.ts`, `mcpStores.ts`):** Adjusted `getOptimisticUpdate` and `applyMutationResult` to correctly handle the `loading`/'error' states of `StandardStore`.
+ **Updated `ChatView.tsx`:** Removed dependency on `$chatSessions`, uses `$activeChatSession` and `$activeChatHistory`, removed call to `setActiveChatIdAndSubscribe`, updated loading state checks.
+ **(Previous Refactoring - Communication Pattern, Initial `createStore`, Core Stores):** Remains relevant.

## Active Decisions
+ **Communication Pattern:** **ReqRes (Fetch Initial) + PubSub (Subscribe Updates, No Initial State)** is the standard. PubSub currently pushes full state, aiming for incremental patches later.
+ **Store Creation Utility:** Use the enhanced **`createStore`** utility (`stores/utils/createStore.ts`) with `dependsOn` option for creating data stores following the standard pattern.
+ **State Management:** **Nanostores** is primary. `createStore` and `createMutationStore` are the standard utilities.
+ **Routing:** Using **`@nanostores/router`**.
+ **Dependencies for Stores:** Stores needing dynamic parameters handle this via dynamic `payload`/`topic` functions and the `dependsOn` option in `createStore`. Stores like `$activeChatSession` still use `onMount` for specific router change logic.
+ **(Previous decisions remain largely valid unless superseded above)**
# Active Context

## Current Focus
**Nanostores Refactoring:** Completing the switch from Jotai/Custom Hooks to Nanostores for frontend state management. Removing obsolete Jotai atoms and ensuring UI components rely on local state or Nanostore derived state passed via props.

## Next Steps
1.  **Testing (Manual):** Thoroughly test the recent fixes:
    *   **Verify Chat Creation & Navigation:** Confirm that creating new chats works and automatically navigates to the new chat page.
    *   **Verify Provider Dropdown:** Confirm that the AI provider dropdown is now populated correctly.
    *   Verify UI interactions (input, streaming indicator, image selection, suggested actions) work correctly.
    *   Confirm chat switching and data loading remain functional.
          *   Check for any regressions introduced by the recent fixes.
2.  **Implement Pub/Sub for Suggested Actions:** Replace the temporary local state for `suggestedActionsMap` in `ChatView.tsx` with a proper Nanostore atom that listens to backend pushes for suggested actions updates.
3.  **Resume Image Upload:** Continue implementation and testing of image upload functionality.
4.  **Compliance Review:** Review `docs/general_guidelines.md` (SHA: `7eff9c8fe6876e567f2270c09c60d35f7beb47f1`) and apply relevant standards to the project codebase and structure.
5.  **VS Code Tool Enhancements:** Implement remaining VS Code debugging tools and enhance `runCommandTool`.
6.  **UI Refinements & Error Handling:** Continue improving UI and error handling.

## Recent Changes (Settings UI Refactoring, Jotai Removal, Bug Fixes)
+ - **Refactored Tool/MCP Settings UI:**
+     - Added retry button for MCP server connections (`RetryMcpConnectionHandler`, `$retryMcpConnection` store, UI button in `ToolSettings.tsx`).
+     - Merged MCP server status display into `ToolSettings.tsx`.
+     - Separated Standard Tools and MCP Servers/Tools into distinct sections in `ToolSettings.tsx`.
+     - Implemented collapsible sections for each tool category/server in `ToolSettings.tsx`, defaulting to collapsed.
+     - Fixed layout issues in `ToolSettings.tsx` (description wrapping, flex constraints).
+     - Removed the redundant `McpServerSettings.tsx` component and its usage in `SettingPage.tsx`.
+     - Made `RequestHandler.ts` interface generic.
+     - Fixed related TS errors in `extension.ts` and other files.
 - **Removed Obsolete Jotai Atoms & Refactored UI State:**
      - Deleted `webview-ui/src/store/atoms.ts`.
      - Removed dependencies on `isStreamingAtom`, `inputValueAtom`, `selectedImagesAtom`, `suggestedActionsMapAtom`, and `activeChatIdAtom` from `ChatView.tsx`, `InputArea.tsx`, `MessagesArea.tsx`, and `chatStores.ts`.
      # Removed duplicated block below
- **Attempted Blank Page/Timeout Fix:** Various adjustments (superseded).
- **Fixed TypeScript Errors:** General fixes post-refactoring.
- **Added VS Code Tools:** `goToDefinitionTool`, `findReferencesTool`, etc.
- **Verified Tool:** `replaceInActiveEditorTool`.
- **UI Improvements:** Loading feedback in `ChatListPage.tsx`.
- **Implemented Request/Response:** Initial async data loading pattern (superseded by Nanostore `onMount`).
- **Corrected Model ID Handling:** Separate `providerId` and `modelId`.
- **Refactored Extension Host:** Unified request handlers.
- **Cleaned Imports:** General cleanup.
- **UI Refactoring (Navigation & Layout):** Removed top nav, added buttons, fixed flexbox/routing conflicts (using `wouter` - now replaced).
- **Implemented Stream Cancellation:** Added stop button and logic.
- **Updated `aiService.ts` for Image History:** Accepted `CoreMessage[]`.
- **Refactored MCP Management:** Created `McpManager`.
- **File-Based MCP Server Configuration:** Implemented JSON config files.
- **Updated `common/types.ts` for Images:** Added `UiImagePart`.
- **Updated `app.tsx` for Images:** UI, handlers, rendering.
- **Installed Dependencies:** Markdown/Syntax highlighting.
- **Updated Handlers/History for Images:** `SendMessageHandler`, `HistoryManager`.
- **Refactored Model Selector:** Created reusable component.
- **Updated Message Bubble Actions:** Copy/Delete buttons.
- **Unified Tool ID & Enablement:** Standardized format and storage.
- **(Many previous fixes related to streaming, state, UI, architecture - see older context)**

## Active Decisions
- **State Management:** **Nanostores** is the primary state management library. Fetching, subscriptions, and core logic reside *within* Nanostore atoms (using `onMount`). Components use `useStore` from `@nanostores/preact`. **Jotai completely removed.**
- **UI State:** UI-specific state (like `inputValue`, `suggestedActionsMap`) managed via local component state (`useState`) primarily in container components (`ChatView`) and passed down as props. Backend-driven state (like `isStreaming`) derived from Nanostore mutation/fetcher stores.
- **Routing:** Using **`@nanostores/router`**.
- **Communication Module Style (FP):** `webview-ui/src/utils/communication.ts` remains FP style.
- **Model ID Handling:** Use separate `providerId` and `modelId`.
- **Communication Model (Unified Request/Response & Pub/Sub):** All FE->BE communication uses the unified `requestData` function, sending `{ type: 'requestData', requestType: '...', ... }`. Backend handlers (`SubscribeHandler`, `UnsubscribeHandler` included) are registered in `_requestHandlers` map and MUST return a value or throw an error to resolve/reject the frontend promise. Backend uses `pushUpdate` for BE->FE updates. (Reverted away from `postActionMessage`).
- **Handler Architecture:** Unified backend handlers using `RequestHandler` interface and `_requestHandlers` map in `extension.ts`.
- **Stream Processing:** `StreamProcessor` uses `pushUpdate`.
- **MCP Architecture:** File-based config, `McpManager`.
- **Image Upload:** UI implemented, backend needs update/testing.
- **Markdown & Syntax Highlighting:** Implemented.
- **Suggested Actions Implementation:** Via JSON block append + parsing. Need to implement frontend listener.
- **VS Code Tool Enhancements:** Some added, debugging/runCommand remain.
- **(Previous decisions remain largely valid unless superseded above)**
