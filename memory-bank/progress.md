# Project Progress

## What Works
*   **Persistence (Completed/Stopped Messages):** AI responses that finish streaming or are manually stopped are saved and persist after reloading (subject to async save completion before termination).
*   **Incremental Text Saves:** Text deltas (`appendTextChunk`) now trigger saves, persisting streamed text incrementally.
*   **Fixed Chat Loading/Redirect Issue:** Consolidated logic in `ChatPage.tsx`.
*   **Fixed Reactivity Issue (Chat History):** Ensured immutable updates in `HistoryManager.getHistory`.
*   **Fixed Settings Page Input:** Resolved input interference.
*   **Restored Tool Settings Section:** Re-enabled in settings UI.
*   **Frontend State Refactoring (Nanostores using `createStore`):** Completed.
*   **Routing (`@nanostores/router`):** Implemented.
*   **Pub/Sub & Request/Response:** Unified communication pattern established. Backend pushes delta updates for history/sessions.
*   **Stream Processing:** Handles mixed stream parts, pushes UI updates via PubSub, updates in-memory state during stream. Fixed race condition where chunks could arrive before the message frame.
*   **Multi-Chat Backend Structure:** Implemented.
*   **Multi-Chat Frontend Basics:** Implemented.
*   **Model ID Handling:** Codebase refactored to use separate `providerId` and `modelId`, removing combined `chatModelId`.
*   **VS Code Tools (Partial):** Several tools implemented, filesystem tools refactored.
*   **MCP Management:** `McpManager`, file-based config, status UI.
*   **Stream Cancellation:** Implemented via `abortCurrentStream`, triggers save attempt.
*   **Image Upload (Partial):** UI implemented, data sending logic exists. Backend needs review.
*   **Message Actions:** Copy/Delete implemented.
*   **UI Basics:** Markdown/Syntax Highlighting, basic styling.
*   **Fixed MCP Server Settings UI:** Optimistic updates, status display.
*   **Refactored Core Services:** `AiService`, `HistoryManager`, `ChatSessionManager`, `ConfigResolver`, `WorkspaceStateManager`, `MessageModifier`.
*   **Fixed `$isStreamingResponse` Store:** Corrected definition.
*   **Suggested Actions Pub/Sub:** Implemented backend push via `SubscriptionManager`, created frontend `$suggestedActions` store, integrated with UI.
*   **Removed `reconcileFinalAssistantMessage`:** Eliminated redundant finalization logic.

## What's Left
*   **BUGFIX: DeepSeek Model Resolution:** Still getting "Model: undefined" error. Need to trace `modelId` flow from `ConfigResolver` through `AiStreamer`. **(Immediate Priority)**
*   **BUGFIX: Delayed Model Name Display:** Model/Provider names appear only after stream completion, not optimistically. Need to verify `addAssistantMessageFrame` and frontend store logic. **(Immediate Priority)**
*   **Testing (Manual):** Thorough testing needed for core functionality, streaming, persistence, suggested actions, model display/selection, and delta updates once bugs are fixed.
*   **Resume Image Upload (Backend & Full Test):** Review/update backend and test.
*   **Compliance Review:** Apply `docs/general_guidelines.md`.
*   **VS Code Tool Enhancements:** Implement remaining debug tools, enhance `runCommandTool`.
*   **UI Refinements & Error Handling:** Ongoing task.
*   **Address Timeout (If Needed):** Monitor if timeouts occur.

## Current Status
*   **Refactoring Complete:** Removed `reconcileFinalAssistantMessage` and implemented incremental saves for text deltas. Model/Provider names are intended to be included in the initial message frame.
*   **Critical Bugs Persist:** The "Model: undefined" error for DeepSeek and the delayed model name display indicate issues remain in the configuration resolution/passing or frontend state update logic.
*   Core chat functionality is partially working but hampered by the above bugs.

## Known Issues / TODOs
*   **DeepSeek Model Resolution Error:** `modelId` becomes `undefined` during `sendMessage`.
*   **Delayed Model Name Display:** Names not shown optimistically on pending messages.
*   **Persistence on Abrupt Reload:** Partial messages being streamed might be lost. (Accepted Limitation)
*   **Testing:** Blocked by critical bugs.
*   **Timeout:** Potential issue needs monitoring.
*   **Image Upload:** Backend needs verification/completion.
