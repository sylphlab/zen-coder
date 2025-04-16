# Project Progress

## What Works
*   **Vertex AI Provider (Enhanced):** Updated support for Google Vertex AI to handle JSON service account credentials, optional Project ID, and optional Location via dedicated inputs in settings.
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
*   **Unified State Updates (JSON Patch):** Refactored backend managers and frontend stores (`createStore`, `createMutationStore`) to primarily use JSON Patch for state synchronization (except for simple boolean/full payload updates like streaming status/suggested actions).
*   **Fixed `ConfigResolver` Logic:** Corrected provider/model validation and fallback logic.
*   **Fixed Async Chain:** Ensured `async/await` is used correctly from `SendMessageHandler` down to `ConfigResolver`.
*   **Fixed `$activeChatHistory` Store:** Removed conflicting `handleUpdate`.
*   **Fixed `$defaultConfig` Store:** Corrected `SubscriptionManager` push logic (hopefully).
*   **Refactored Credential Handling:** Updated provider interface, backend logic, and UI to support complex credentials (JSON + optional fields) alongside simple API keys.

## What's Left / Known Issues
*   **Vertex AI Testing:** Need to test Vertex AI functionality thoroughly with valid credentials, Project ID, and Location.
*   **Vertex AI Dynamic Models:** Implement dynamic model fetching for Vertex AI (currently uses static list).
*   **Vertex AI Settings UI Enhancement:** Consider adding dropdowns for Project ID and Location (requires Google Cloud auth or hardcoded lists - complex). (Low Priority)
*   **BUGFIX: Tool Call UI:** Spinner doesn't stop, default state isn't collapsed. (Lower Priority - Addressing collapsed state now)
*   **BUGFIX: Error Message UI:** API errors (like function calling not supported) are logged but not shown in the UI. Need to update `Message` component to handle `status: 'error'`. (Medium Priority)
*   **BUGFIX: `deepseek-reasoner` Function Calling Error:** While the error is correct (model doesn't support it), the UI should display the error gracefully instead of just stopping. (Related to Error Message UI bug).
*   **BUGFIX: Settings Default Model Loading (Possible):** The "狂 load" issue might be fixed by the `SubscriptionManager` correction and Extension Host restart, but needs confirmation.
*   **Testing (Manual):** Thorough testing needed once critical bugs are fixed.
*   **Resume Image Upload (Backend & Full Test):** Review/update backend and test.
*   **Compliance Review:** Apply `docs/general_guidelines.md`.
*   **VS Code Tool Enhancements:** Implement remaining debug tools, enhance `runCommandTool`.
*   **UI Refinements:** Ongoing task.
*   **Address Timeout (If Needed):** Monitor if timeouts occur.

## Current Status
*   **Major Refactoring Complete:** Unified state updates using JSON Patch, simplified optimistic UI handling.
*   **Critical Bugs Persist:** The chat history clearing on send is the most critical issue blocking further testing. The missing model name on pending messages and lack of error display are also important UI bugs.
*   Settings page stability needs re-verification after Extension Host restart.
