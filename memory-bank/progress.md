# Project Progress

## What Works
*   **Static Model Data:** Created static data files (`src/ai/staticModelData/`) for Anthropic, Google, Vertex, OpenAI, DeepSeek, and Mistral based on provided info, including capabilities from Vercel AI SDK table.
*   **Provider Model Fallback:** Updated `getAvailableModels` in provider implementations to use static data as a fallback if dynamic fetching fails or is not implemented.
*   **Vertex AI Provider (Enhanced):** Updated support for Google Vertex AI to handle JSON service account credentials, optional Project ID, and optional Location via dedicated inputs in settings. UI pre-fills Project ID/Location from JSON if available. Project ID fetching/dropdown implemented.
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
*   **Image Upload (Partial):** UI implemented, data sending logic exists. Backend needs review. Image preview bug fixed.
*   **Message Actions:** Copy/Delete implemented.
*   **UI Basics:** Markdown/Syntax Highlighting, basic styling.
*   **Fixed MCP Server Settings UI:** Optimistic updates, status display.
*   **Refactored Core Services:** `AiService`, `HistoryManager`, `ChatSessionManager`, `ConfigResolver`, `WorkspaceStateManager`, `MessageModifier`.
*   **Fixed `$isStreamingResponse` Store:** Corrected definition.
*   **Suggested Actions Pub/Sub:** Implemented backend push via `SubscriptionManager`, created frontend `$suggestedActions` store, integrated with UI.
*   **Removed `reconcileFinalAssistantMessage`:** Eliminated redundant finalization logic.
*   **Unified State Updates (JSON Patch):** Refactored backend managers and frontend stores (`createStore`, `createMutationStore`) to primarily use JSON Patch for state synchronization (except for simple boolean/full payload updates like streaming status/suggested actions).
*   **Fixed `ConfigResolver` Logic:** Corrected provider/model validation and fallback logic (partially refactored for Assistants, needs AssistantManager integration).
*   **Fixed Async Chain:** Ensured `async/await` is used correctly from `SendMessageHandler` down to `ConfigResolver`.
*   **Fixed `$activeChatHistory` Store:** Removed conflicting `handleUpdate`.
*   **Fixed `$defaultConfig` Store:** Corrected `SubscriptionManager` push logic (partially refactored for Assistants).
*   **Refactored Credential Handling:** Updated provider interface, backend logic, and UI to support complex credentials (JSON + optional fields) alongside simple API keys.
*   **[Resolved] UI Refactoring (Styling):** Systematically reviewed and updated core UI components (`ChatPage`, `MessagesArea`, `InputArea`, `SettingPage`, `ChatListPage`, `ConfirmationDialog`, `CustomSelect`, settings sub-components) for minimalism, theme adherence, borderless design, UnoCSS usage. Removed shadows, borders, unnecessary opacities. Confirmed scrollbar styling.
*   **[Resolved] Dependency Cleanup:** Removed unused `@heroicons/react`.
*   **[Resolved] Tool Call UI:** Implemented collapse/expand for tool call section in `MessagesArea`. (Spinner bug remains - upstream issue).
*   **[Resolved] Error Display UI:** Updated `MessagesArea` to show specific error details from `UiMessage.errorDetails` (requires backend to populate).
*   **[Resolved] Session List Enhancements:** Improved visibility of individual delete button, added bulk delete UI/logic, added resource usage placeholder.
*   **[Resolved] Model Selector UI Bugs:** Fixed invisible text in dropdown, added filtering capability.
*   **[Resolved] Image Preview Bug:** Fixed data URL handling in `useImageUpload` hook.
*   **Assistant Architecture (Phase 1 Frontend):** Updated types (`Assistant`, `ChatConfig`, `DefaultChatConfig`, `SendMessagePayload`), refactored `InputArea`/`ChatPage`/`SettingPage`/`DefaultAssistantSettings` (pending rename), created placeholder `AssistantSettings` UI. Fixed resulting type errors in frontend and backend files (`configResolver`, `SetDefaultConfigHandler`).
*   **[Resolved] Assistant Settings UI Bugs:** Fixed dropdown cutoff issue in modal, resolved mouse click selection issue in `CustomSelect`.
*   **[Resolved] Assistant CRUD Backend:** Implemented and registered backend handlers (`Get`, `Create`, `Update`, `Delete`) for Assistant management. Debugged "No handler found" error (related to build/cache).
*   **[Resolved] Assistant List Timeout:** Removed debounce timer from `AssistantManager.saveAssistants` to fix timeout during initial load.

## What's Left / Known Issues
*   **Assistant Architecture (Phase 2+):**
    *   Implement backend `AssistantManager` (CRUD operations, persistence) - **Handlers implemented, core logic exists.**
    *   Implement frontend stores (`assistantStores.ts`) for fetching/managing Assistants - **Implemented, minor debugging done.**
    *   Replace placeholder Assistant data/logic in `InputArea`, `DefaultAssistantSettings`, `AssistantSettings` with store integration.
    *   Implement full UI functionality in `AssistantSettings.tsx` (create/edit forms, validation, saving, deleting).
    *   Update backend `AiService`, `AiStreamer`, `ConfigResolver` to fully utilize selected Assistant configuration (fetching details, applying instructions, using correct model).
    *   Update `ChatSessionManager` to handle `assistantId` in `ChatConfig`.
    *   Rename `DefaultModelSettings.tsx` file to `DefaultAssistantSettings.tsx`.
*   **Complete Static Data:** Add static data for remaining providers (OpenRouter, Ollama, etc.).
*   **Verify Static Data:** Double-check accuracy of static model info (capabilities, pricing, limits) against latest documentation.
*   **Vertex AI Testing:** Need to test Vertex AI functionality thoroughly after Assistant refactor.
*   **Vertex AI Dynamic Locations/Models (Deferred):** Dynamic fetching was reverted.
*   **Vertex AI Error Handling:** Improve error handling.
*   **BUG: Tool Call Spinner:** Spinner doesn't stop (likely upstream data issue).
*   **Resume Image Upload (Backend & Full Test):** Review/update backend and test.
*   **Compliance Review:** Apply `docs/general_guidelines.md`.
*   **VS Code Tool Enhancements:** Implement remaining debug tools, enhance `runCommandTool`.
*   **UI Refinements:** Ongoing task (e.g., welcome screen simplification, syntax highlighting theme matching).
*   **Address Timeout (If Needed):** Monitor if timeouts occur.
*   **Error Handling/Display:** Improve user feedback for backend errors (e.g., saving Assistant, sending message).

## Current Status
*   Major UI refactoring pass complete.
*   Pivoted to Assistant-based architecture; Phase 1 (frontend types, component refactoring, placeholder UI) complete.
*   Core chat functionality works with placeholder Assistant logic.
*   Assistant CRUD backend handlers implemented and initial timeout issue resolved. Frontend store interaction needs testing/verification.
