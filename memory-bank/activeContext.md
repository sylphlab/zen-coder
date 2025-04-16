# Active Context

## Current Focus
**Investigating Persistent Errors:** Despite refactoring, the "Model: undefined" error persists when using DeepSeek, and the optimistic display of model/provider names is still delayed (names appear only after the stream finishes). The core issue seems to be how model configuration and metadata are resolved or passed during the `sendMessage` flow.

## Next Steps
1.  **Diagnose `Model: undefined`:** Re-examine `ConfigResolver`, `AiStreamer`, and `SendMessageHandler` focusing on how `modelId` is determined and passed specifically for DeepSeek. Add more targeted logging if necessary.
2.  **Diagnose Delayed Name Display:** Trace how `providerName` and `modelName` are passed from `SendMessageHandler` to `HistoryManager.addAssistantMessageFrame` and included in the initial `HistoryAddMessageDelta`. Verify the frontend store (`activeChatHistoryStore`) correctly applies this initial data.
3.  **Test Vertex AI:** Thoroughly test Vertex AI integration with JSON credentials and optional project/location text inputs (pre-filled from JSON).
4.  **Test Core Functionality:** Once the above are resolved, re-test basic chat, streaming, persistence, and suggested actions.
5.  **Resume Image Upload:** Continue implementation.
6.  **Compliance Review & VS Code Tool Enhancements:** As before.
7.  **Implement Vertex Dynamic Models:** Fetch models dynamically for Vertex AI.

## Recent Changes (Refactoring Message Finalization & Optimistic Display Attempt)
*   **Removed `reconcileFinalAssistantMessage`:** Eliminated this redundant function from `MessageModifier.ts`.
*   **Removed `_finalizeHistory`:** Removed this private method from `SendMessageHandler.ts`.
*   **Integrated Finalization Logic:** Moved the responsibilities of `_finalizeHistory` (parsing suggested actions, updating final message content, saving state, pushing updates) directly into the `try/catch` block of `SendMessageHandler.handle` after stream processing.
*   **Added `MessageModifier.updateMessageContent`:** Created this method to handle updating the final text content (without the suggested actions block) and model info in the history state.
*   **Modified `MessageModifier.appendTextChunk`:** Added a call to `_sessionManager.touchChatSession` to ensure incremental saving of text deltas.
*   **Modified `HistoryManager.addAssistantMessageFrame`:** Updated signature to accept provider/model names and include them in the initial `UiMessage` object and the `HistoryAddMessageDelta` for optimistic UI updates.
*   **Removed `reconcile` call from `StreamProcessor`:** Removed the call to the now-deleted `reconcileFinalAssistantMessage`.
*   **Removed Combined ID Logic:** Refactored `ConfigResolver` and `AiStreamer` to use separate `providerId` and `modelId` fields, removing the combined `chatModelId`.
*   **Corrected DeepSeek Provider Mapping:** Fixed `deepseekProvider.ts` to correctly map `model.id` to both `id` and `name` in `ModelDefinition`.
*   **Replaced Chinese Errors:** Updated user-facing error messages in `aiStreamer.ts` to English.
*   **Added Vertex AI Provider:** Integrated `@ai-sdk/google-vertex`.
*   **Refactored Credential Handling:** Modified `AiProvider` interface, `ProviderStatusManager`, `common/types.ts`, and `ProviderSettings.tsx` to support complex credentials (JSON string + optional project/location fields) stored as a single stringified object in `SecretStorage`. Renamed `apiKeySet` to `credentialsSet` in `ProviderInfoAndStatus`.

## Active Decisions
*   **Vertex Credentials Storage:** Store Vertex credentials (JSON content, optional project ID, optional location) as a single JSON stringified object in `SecretStorage`.
*   **Vertex Dynamic Fetching (Reverted):** Removed dynamic fetching for projects, locations, and models due to SDK complexities. Implemented simpler pre-filling of Project ID and Location text inputs based on parsed JSON credentials in the UI. Removed associated handlers and dependencies.
*   **Incremental Saves:** Text chunks are saved as they arrive via `appendTextChunk`.
*   **Simplified Finalization:** Post-stream logic in `SendMessageHandler` handles parsing actions, updating final content via `MessageModifier.updateMessageContent`, and pushing relevant updates (status, suggested actions).
*   **Optimistic Name Display:** Model/Provider names are fetched early in `SendMessageHandler` and passed to `HistoryManager.addAssistantMessageFrame` to be included in the initial message delta. (Still needs verification/debugging).
*   **Separate Provider/Model IDs:** Codebase consistently uses distinct `providerId` and `modelId`.
*   **(Previous decisions remain largely valid unless superseded above)**
