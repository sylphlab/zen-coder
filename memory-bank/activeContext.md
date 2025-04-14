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

## Recent Changes (Jotai Removal, Bug Fixes)
+ - **Removed Obsolete Jotai Atoms & Refactored UI State:**
+     - Deleted `webview-ui/src/store/atoms.ts`.
+     - Removed dependencies on `isStreamingAtom`, `inputValueAtom`, `selectedImagesAtom`, `suggestedActionsMapAtom`, and `activeChatIdAtom` from `ChatView.tsx`, `InputArea.tsx`, `MessagesArea.tsx`, and `chatStores.ts`.
+     - Refactored `ChatView.tsx` to manage `inputValue` and `suggestedActionsMap` (temporarily) with local state (`useState`).
+     - Refactored `ChatView.tsx` to derive `isStreaming` state from `$sendMessage.loading`.
+     - Refactored `InputArea.tsx` and `MessagesArea.tsx` to receive UI state (`inputValue`, `isStreaming`, `selectedImages`, `suggestedActionsMap`) and setters (`setInputValue`) as props from `ChatView.tsx`.
+     - Updated relevant event handlers (`handleSend`, `handleSuggestedActionClick`, etc.) in `ChatView.tsx` to use local state setters or derived state.
+     - Ensured `activeChatId` logic relies solely on the `chatIdFromRoute` prop passed via the router.
+ - **Fixed Build Errors:** Resolved various import errors related to the refactoring and obsolete atoms file. Exported `generateUniqueId` from `communication.ts`. Fixed syntax error in `chatStores.ts`.
+ - **Fixed 404 Routing Error:** Modified `webview-ui/src/stores/router.ts` to map the initial `/index.html` path (from `getLastLocation`) to the `/` (home) route.
+ - **(Previous: Nanostores Integration & Routing)**
+ - **Refactored Settings Page & Subscription Logic:** (Obsolete due to Nanostores migration)
+ - **Refactored Initial Data Loading:** (Obsolete due to Nanostores migration)
+ - **Implemented Pub/Sub (Various):** MCP Status, Tool Status, Custom Instructions, Provider Status, Default Config.
+ - **Fixed App Load Failure (Request/Response Timing):** Centralized message handling.
+ - **Fixed Chat Creation Error (Data Transformation):** Modified `createFetcherStore.ts` (then refactored `providerStores.ts` to use basic atom/onMount) to correctly handle both initial fetch (raw array) and push updates (`{payload: array}`) for `$providerStatus`.
+ - **Fixed Chat Creation Navigation (Attempt 1):** Modified `CreateChatHandler.ts` to return the full `ChatSession` object.
+ - **Fixed Missing Providers Dropdown:** Added logs, identified data format mismatch between initial fetch and push update for `$providerStatus`, corrected store logic in `providerStores.ts`. Added checks in `ModelSelector.tsx`. Refactored `$providerStatus` to use basic atom/onMount. Corrected `processData` logic in `providerStores.ts`.
+ - **Fixed Provider Selection Reset:** Corrected return type and value in `UpdateChatConfigHandler.ts` to match frontend expectations (`{ config: ... }`).
+ - **Fixed Chat Creation Navigation (Attempt 2 - Timing):** Modified `ChatPage.tsx` `useEffect` to check for session existence only after `$chatSessions` is loaded (not null) and depend on `sessions`.
- **Fixed Model Input Field:** Modified `useEffect` hook in `ModelSelector.tsx`.
- **Fixed Gray Screen:** Resolved import error in `InputArea.tsx`.
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
