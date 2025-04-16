# Active Context

## Current Focus
**Investigating Persistent Errors:** Despite refactoring, the "Model: undefined" error persists when using DeepSeek, and the optimistic display of model/provider names is still delayed (names appear only after the stream finishes). The core issue seems to be how model configuration and metadata are resolved or passed during the `sendMessage` flow.

## Next Steps
1.  **Diagnose `Model: undefined`:** Re-examine `ConfigResolver`, `AiStreamer`, and `SendMessageHandler` focusing on how `modelId` is determined and passed specifically for DeepSeek. Add more targeted logging if necessary.
2.  **Diagnose Delayed Name Display:** Trace how `providerName` and `modelName` are passed from `SendMessageHandler` to `HistoryManager.addAssistantMessageFrame` and included in the initial `HistoryAddMessageDelta`. Verify the frontend store (`activeChatHistoryStore`) correctly applies this initial data.
3.  **Test Vertex AI:** Thoroughly test Vertex AI integration with JSON credentials, dynamic project ID fetching/selection, pre-filled location/project ID text inputs, and static model list fallback.
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
*   **Vertex Dynamic Fetching (Reverted):** Fully reverted dynamic fetching for projects and locations due to complexities and decision to use static data. Removed related handlers and dependencies. Implemented pre-filling of Project ID and Location text inputs based on parsed JSON credentials in the UI.
*   **Fixed Vertex Settings Reload Loop:** Identified root cause as missing backend handlers (`getVertexProjects`, `getVertexLocations`). Replaced dynamic fetching with a static data handler (`GetVertexStaticDataHandler`) providing locations and an empty project list, and updated frontend (`ProviderSettings.tsx`) to use it.
*   **Improved Vertex Location UI (Custom Select):** Created and enhanced a custom dropdown component (`CustomSelect.tsx`) for Vertex Location in `ProviderSettings.tsx`. This component uses static data (updated with regions), groups options by region, displays them with ID primary and Name secondary, supports filtering, and allows custom value input.
*   **Improved Model Selection UI (Custom Select):** Replaced the model selection input/datalist in `ModelSelector.tsx` with the enhanced `CustomSelect` component (moved to `components/ui/`), allowing custom model ID input and consistent UI. Adjusted display order to Name primary, ID secondary. Updated import paths.
*   **Unified Provider Selection UI (Custom Select):** Replaced the provider selection `<select>` in `ModelSelector.tsx` with the `CustomSelect` component for UI consistency. Always shows input for searching with live filtering, but configured to disallow custom values (`allowCustomValue={false}`) and hide IDs (`showId={false}`). Autocompletes on exact name match or single filter result on blur/enter, otherwise reverts input display to selected option's name (or clears if none selected).
*   **Enhanced `CustomSelect.tsx`:** Implemented robust blur/enter logic for `allowCustomValue=false` (autocomplete/revert) and added keyboard navigation (Up/Down/Enter/Escape) with highlighting and scrolling.

## Active Decisions
*   **Vertex Credentials Storage:** Store Vertex credentials (JSON content, optional project ID, optional location) as a single JSON stringified object in `SecretStorage`.
*   **Custom Select Configuration:** Added `showId` prop to `CustomSelect.tsx` to optionally hide the secondary ID display. Set `showId={false}` for Provider selection in `ModelSelector.tsx`.
*   **Component Structure:** Moved reusable `CustomSelect` component to `webview-ui/src/components/ui/`.
*   **Custom Select Display:** Component (`CustomSelect.tsx`) configured to display Name primarily and ID secondarily (right, lighter color). Input field correctly displays selected option's Name while using ID as the underlying value.
*   **Vertex Project/Location Data:** Use static data for locations (provided by user) and an empty list for projects. Dynamic fetching via Google Cloud libraries is disabled.
*   **Vertex Dynamic Fetching (Partial Revert):** Reverted dynamic fetching for locations and models due to SDK complexities. Kept dynamic project fetching/dropdown. Implemented pre-filling of Project ID and Location text inputs based on parsed JSON credentials in the UI. Removed location handler and related dependencies.
*   **Static Model Data:** Created static data files and integrated them as fallbacks in `getAvailableModels` for relevant providers.
*   **Incremental Saves:** Text chunks are saved as they arrive via `appendTextChunk`.
*   **Simplified Finalization:** Post-stream logic in `SendMessageHandler` handles parsing actions, updating final content via `MessageModifier.updateMessageContent`, and pushing relevant updates (status, suggested actions).
*   **Optimistic Name Display:** Model/Provider names are fetched early in `SendMessageHandler` and passed to `HistoryManager.addAssistantMessageFrame` to be included in the initial message delta. (Still needs verification/debugging).
*   **Separate Provider/Model IDs:** Codebase consistently uses distinct `providerId` and `modelId`.
*   **(Previous decisions remain largely valid unless superseded above)**
