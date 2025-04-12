# Active Context

## Current Focus
Finalizing Vercel AI SDK integration after addressing stream parsing and deprecated API issues.

## Recent Changes
- **Tool Refactoring & Expansion:** (Completed previously)
- **Fixed Stream Parsing (Comprehensive):** Iteratively refined stream parsing logic in `src/extension.ts` to handle various Vercel AI SDK prefixes (`0:`-`7:`, `8:`, `9:`, `a:`, `d:`, `e:`, `f:`) and correctly parse JSON-encoded strings and tool call/result messages.
- **Removed Deprecated `StreamData`:** Refactored `src/ai/aiService.ts` to remove usage of the deprecated `StreamData` API for sending custom tool status updates. Temporarily removed the feature of sending 'in-progress', 'complete', 'error' statuses during tool execution to simplify and stabilize the core functionality.
- **Standardized `streamText` Usage:** Ensured `src/ai/aiService.ts` uses the standard `streamText` function, corrected type definitions for `StreamTextResult`, `onFinish` callback, and `experimental_repairToolCall` parameters.
- **Corrected Stream Handling:** Fixed `src/extension.ts` to correctly handle the `ReadableStream` returned by the updated `getAiResponseStream` method in `aiService.ts` (using `streamResult.getReader()` instead of `streamResult.body.getReader()`).
- **Corrected Stream Return Value:** Fixed `src/ai/aiService.ts` to return `result.toDataStream()` instead of the non-existent `result.stream` or `result.toAIStream()`.
- **UI Update (Tool Status):** (Completed previously, but status updates are now disabled pending reimplementation with new APIs if needed).
- **AiService Refactoring:** (Completed previously)
- **Configuration Update:** (Completed previously)
- **Previous:** Project renamed to Zen Coder; Vercel AI SDK enhancements (multi-step, error handling, repair) applied.
- **UI Tool Display Refinement:** Updated UI (`app.tsx`) to display tool calls inline with assistant messages, using a content array structure. Implemented human-readable status summaries for tools, hiding technical details by default (e.g., "[正在讀取 file.txt...]", "[uuidGenerateTool 已完成]").
- **`uuidGenerateTool` Enhancement & Progress:** Updated tool to accept `count` parameter and implemented progress updates via callback. Modified `AiService` wrapper and UI (`app.tsx`) to handle and display progress (e.g., "[正在生成 UUID x/y...]").
- **Tool Result Handling Clarification:** Confirmed that the tool (`uuidGenerateTool`) correctly returns the final result array to the SDK, which then passes it to the AI model. The AI's choice not to explicitly list the results in its initial response is a model behavior, not a code issue.

## Next Steps
- **Current Task:** Implement Settings Page & Model Resolver.
    - **Phase 1 (Complete):**
        - Created `settings-ui` directory and initialized Vite + Preact project.
        - Registered `zencoder.openSettings` command in `package.json`.
        - Added command handler and `settingsPanel` creation logic in `src/extension.ts`.
        - Added `getApiKeyStatus` method to `src/ai/aiService.ts`.
        - Configured `settings-ui/vite.config.ts` (port 5174, output dir `dist/settings`).
        - Updated build/watch scripts in main `package.json`.
    - **Phase 2 (Complete):**
        - Implemented basic Preact UI (`settings-ui/src/app.tsx`) to display provider API key status.
        - Implemented communication (`webviewReady`, `getApiKeyStatus` request, `apiKeyStatus` response) between `settingsPanel` and extension host.
        - Added basic CSS (`settings-ui/src/app.css`).
    - **Phase 3 (Complete):**
        - Added VS Code configuration for provider enablement.
        - Updated `AiService` to check provider enablement (`_isProviderEnabled`, `getProviderStatus`).
        - Updated Settings UI to display and control provider enablement via checkboxes and communication (`getProviderStatus`, `setProviderEnabled`).
        - Updated `extension.ts` message handler for provider status/enablement.
        - Implemented basic Model Resolver framework (`resolveAvailableModels`) in `AiService` with hardcoded fallback list, respecting provider status.
        - **Refactored Chat UI (`webview-ui/src/app.tsx`)**:
            - Added Provider dropdown selector.
            - Model input (`<input>`+`<datalist>`) is now filtered based on selected Provider.
            - Allows custom model ID input.
            - Corrected TypeScript errors related to message type definitions.
        - Updated `extension.ts` message handler for `getAvailableModels`.
- **Previous:** Test core chat functionality, focusing on the new inline, human-readable tool call display and the updated `uuidGenerateTool`.
- **Future:** Implement API/Web scraping for `resolveAvailableModels` (e.g., OpenRouter).
- **Future:** Implement model selection persistence in Chat UI.
- **Future:** Implement chat history persistence.
- **Future:** Consider applying the progress update pattern (callback + wrapper) to other potentially long-running tools (e.g., `runCommand`, multi-file operations) if needed.
- **Future:** Consider refining the UI display for tool results when they are complex objects.
## Debugging Notes
- **Fixed Vite 504 Error (Chat UI):** Resolved "Outdated Optimize Dep" error for `@vscode/webview-ui-toolkit/react` by removing the unused import from `webview-ui/src/app.tsx`, deleting `webview-ui/node_modules/.vite`, and force-reinstalling dependencies.
- **Fixed Chat UI Hang:** Modified `AiService.getAiResponseStream` to send an error message back to the Chat UI when a model instance cannot be created (due to disabled provider or missing API key), allowing the UI to reset its streaming state. (Resolved)
- **Fixed `getCurrentModelId` Return Type:** Corrected the return type in `AiService` to `string`. (Resolved)
- **Added Debug Logs (Settings Page):** Added console logs to `extension.ts` for the `zencoder.openSettings` command handler and the `ZenCoderCommandsProvider` to trace execution and view rendering. (Helped diagnose)
- **Added Debug Logs (API Keys):** Added detailed console logs to `AiService` `initialize`, `setApiKey`, and `_getProviderInstance` methods to trace SecretStorage operations and internal key checking logic. (Helped diagnose)
- **Verified Model Resolver Logic:** Confirmed the logic in `AiService.resolveAvailableModels` correctly filters hardcoded models based on provider status (enabled and API key set).
- **Corrected `_getProviderInstance` Logic:** Refactored the method to determine provider based on model ID patterns first, then check enablement and API key status, resolving the issue where valid keys might be incorrectly reported as missing for certain model IDs (like `deepseek-chat`). (Resolved API Key issue)
- **Added Activity Bar Entry:** Added a "Zen Coder" view to the Activity Bar with an "Open Settings" command as an alternative way to access settings, bypassing Command Palette issues. (Resolved Settings Page access issue)
- **Verified Chat UI Code:** Confirmed `webview-ui/src/app.tsx` contains the code for the "Provider -> Model" selection flow. (Confirmed)
- **Fixed Vite 504 Error (Chat UI):** Resolved "Outdated Optimize Dep" error for `@vscode/webview-ui-toolkit/react` by removing the unused import from `webview-ui/src/app.tsx`, deleting `webview-ui/node_modules/.vite`, and force-reinstalling dependencies.

## Active Decisions
- Prioritized fixing core stream parsing and removing deprecated API usage over maintaining custom tool status updates for now.
- Standardized on documented Vercel AI SDK APIs (`streamText`, `toDataStream`).
- **New Principle:** Tools should support batch operations where applicable (added to `.clinerules`).
- Prioritized human-readable, inline tool status summaries (including progress for `uuidGenerateTool`) over showing raw technical details by default in the UI.
- Confirmed tool results are passed back to the AI; AI response generation determines if/how results are presented in text.
- **New:** Established foundation for a separate Settings Webview UI using Vite + Preact.