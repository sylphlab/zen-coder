# Active Context

## Current Focus
**Fixed Model ID/Name Display & Input:** Addressed issues where the message bubble showed the model ID instead of the name, and the model selector input prevented custom IDs. Modified `ModelSelector.tsx`, `MessagesArea.tsx`, `ProviderStatusManager.ts`, `SendMessageHandler.ts`, `MessageModifier.ts`, `activeChatHistoryStore.ts`, and `types.ts`. Added logging to `SendMessageHandler` and `MessagesArea` for diagnosis.

## Next Steps
1.  **Test Model Display & Selection:** Verify model name/ID display, tooltip, and custom ID input work as expected. Check console logs. **(Next Task)**
2.  **Test User Message Display (Optimistic Update):** Verify that user messages now appear instantly in the UI after sending.
3.  **Test Streaming Display Fix:** Verify that AI responses stream correctly (related to previous buffering/store fixes).
4.  **Test Suggested Actions:** Verify that suggested actions appear correctly after an AI response and function as expected (sending messages, running tools, filling input).
3.  **Test History Persistence & Review Logs:** Confirm completed/stopped messages persist and review logs added to `WorkspaceStateManager` if needed.
4.  **Test Delta Updates:** Manual testing still pending.
5.  **Resume Image Upload:** Continue implementation.
6.  **Compliance Review & VS Code Tool Enhancements:** As before.
7.  **Address Timeout (If Needed):** Monitor if timeouts occur.

## Recent Changes (Model ID/Name Fixes)
+ **Fixed `ProviderStatusManager`:** Modified `getProviderStatus` to fetch and include the `models` array (with names) in the status object.
+ **Updated `SendMessageHandler`:** Adjusted logic to retrieve `modelName` from the corrected provider status; added logging.
+ **Updated `MessageModifier`:** Ensured `modelName` is saved and included in the `HistoryUpdateMessageStatusDelta`.
+ **Updated `activeChatHistoryStore`:** Modified `handleUpdate` to process `modelName` from the delta.
+ **Updated `MessagesArea`:** Changed display to show `modelName` (with `modelId` fallback/tooltip) above the message content; added logging.
+ **Updated `ModelSelector`:** Modified `handleModelBlur` and removed `useEffect` to allow custom model IDs in the input field.
+ **Updated `types.ts`:** Added model info fields to `UiMessage` and `HistoryUpdateMessageStatusDelta`.
+ **(Previous changes: Optimistic Updates, Error Handling, Streaming Fixes, etc.)**

## Active Decisions
+ **Model Display:** Show `modelName` (fallback `modelId`) above message, `modelId` in tooltip.
+ **Model Input:** Allow custom `modelId` entry in selector.
+ **Model Info Source:** Fetch model names via `ProviderStatusManager` during status generation.
+ **Model Info Propagation:** Pass names through `SendMessageHandler` -> `MessageModifier` -> `HistoryUpdateMessageStatusDelta` -> `activeChatHistoryStore`.
+ **Optimistic Update Strategy:** Manually add user message to `$activeChatHistory` store in `handleSend` before calling backend.
+ **Fixed Store Type Mismatch:** Corrected `handleUpdate` signature in `activeChatHistoryStore.ts`.
+ **Fixed Streaming Race Condition:** (Previous attempt) Added chunk buffering logic to `webview-ui/src/stores/activeChatHistoryStore.ts`.
+ **(Previous changes: Suggested Actions Pub/Sub, Error Correction, Persistence Fixes, etc.)**

## Active Decisions
+ **Optimistic Update Strategy:** Manually add user message to `$activeChatHistory` store in `handleSend` before calling backend.
+ **Store Error Recovery:** Allow stores in 'error' state to potentially recover by processing new updates via `handleUpdate`.
+ **Streaming Fix:** (Retained from previous step) Use a buffer (`Map`) in the frontend history store (`activeChatHistoryStore.ts`) to temporarily hold chunks for messages whose frames haven't arrived yet. Apply buffered chunks when the message frame is added.
+ **Accept Persistence Limitation:** Acknowledge limitations regarding persistence during abrupt window reloads.
+ **Persistence Trigger:** Final save triggered correctly on normal finish and manual abort via forced `touchChatSession`.
+ **In-Memory Update During Stream:** Correctly implemented.
+ **Communication Pattern:** ReqRes + PubSub.
+ **State Management:** Nanostores primary.
+ **(Previous decisions remain largely valid unless superseded above)**
