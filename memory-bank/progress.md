# Project Progress

## What Works
- Initial project structure exists.
- Memory Bank files created and updated.
- Core dependencies installed.
- Webview UI refactored to use Vite + Preact.
- Basic Preact chat UI structure implemented.
- Model selection dropdown implemented and functional.
- Communication between Preact UI and extension host updated.
- `zencoder.startChat` command registered and activated (project renamed).
- **Webview panel creation logic loads correctly in both Development (Vite Dev Server for HMR) and Production (Vite build output) modes.** (Fixed Preact mount point to `#root` in `webview-ui/src/main.tsx` for dev mode).
- CSP nonce handling adapted for both modes.
- `AiService` class created (`src/ai/aiService.ts`) with:
    - API Key Management methods using `vscode.SecretStorage`.
    - Correct model provider instantiation logic using factory functions.
    - `getAiResponseStream` method using standard `streamText`.
    - Tool definitions for all required tools.
    - Basic tool execution logic implemented for most tools.
    - `executeSearch` updated to indicate requirement for MCP integration (placeholder removed).
    - Conversation history update methods.
- `AiService` integrated into `src/extension.ts`.
- Placeholder MCP tool executor removed from `src/extension.ts` and `AiService` constructor.
- Streaming logic adapted for Preact UI.
- API Key Setting Commands and handlers implemented.
- Vite build configuration updated.
- `package.json` scripts updated.
- **VS Code Launch Configuration (`.vscode/launch.json`) updated to use `npm: watch` for `preLaunchTask`, enabling development mode HMR.**
- **TypeScript RootDir Issue (TS6059) Fixed:** Main `tsconfig.json` updated with `include: ["src/**/*"]` to prevent conflicts with the separate `webview-ui` project.
- **TypeScript DOM Type Errors (TS2304) Fixed:** Added `"DOM"` to `compilerOptions.lib` in main `tsconfig.json` to resolve type issues from `@ai-sdk/ui-utils`.
- **Vite Dev Server CORS Issue Fixed:** Updated `webview-ui/vite.config.ts` with `server: { cors: true }` to allow webview access.
- **Project Renamed to "Zen Coder":** All relevant files (`package.json`, `src/extension.ts`, `README.md`, Memory Bank files, `webview-ui/index.html`, `aiService.ts` secret keys) updated.
- **Tool Refactoring & Expansion Completed:**
    - All tool logic moved from `AiService` to modular files under `src/tools/`.
    - Tools standardized using Vercel AI SDK `tool` helper and `zod`.
    - **New/Enhanced Tools:**
        - Filesystem: `readFileTool` (multi-file, encoding), `writeFileTool` (encoding, append), `listFilesTool` (recursive, depth, stats), `createFolderTool`, `getStatTool`, `deleteFileTool` (useTrash), `deleteFolderTool` (useTrash), `moveRenameTool` (overwrite), `copyFileTool`, `copyFolderTool`. (Internal `searchFiles` removed).
        - Utils: `fetchUrlTool`, `base64EncodeTool`, `base64DecodeTool`, `md5HashTool`.
        - System: `getOsInfoTool`, `getCurrentTimeTool`, `getTimezoneTool`, `getPublicIpTool`.
        - VSCode: `getOpenTabsTool`, `getActiveTerminalsTool`, `runCommandTool` (cwd, env).
    - `AiService` refactored to use the new tool structure.
    - `package.json` configuration updated for new/enhanced tool names.
    - Dependencies (`node-fetch`, types) added and import issues resolved.
    - Previous enhancements (multi-step, error handling, repair, activation) remain integrated.
- **Fixed Stream Parsing (Comprehensive):** Corrected stream parsing in `extension.ts` to handle Vercel AI SDK format, including various prefixes (`0:`-`7:`, `8:`, `9:`, `a:`, `d:`, `e:`, `f:`) and correctly parsing JSON-encoded strings and handling tool call/result messages.
- **Removed Deprecated `StreamData`:** Refactored `aiService.ts` to remove `StreamData` usage and associated custom tool status updates.
- **Corrected `streamText` Usage:** Fixed types and return value handling for `streamText` in `aiService.ts` and `extension.ts`.
- **UI Update (Tool Status):** (Completed previously, but custom status updates are currently disabled).
- **`uuidGenerateTool` updated:** Now accepts `count` parameter and sends progress updates via callback.
- **UI Tool Display:** Implemented inline, human-readable tool call display with progress updates for `uuidGenerateTool` and specific summaries for file tools. Technical details hidden by default.
- **Tool Result Handling:** Confirmed tool results are correctly passed back to the AI model via the SDK.
- **Merged Settings UI into Chat Webview:**
    - Settings UI (provider enablement, API key status) is now accessible via a modal within the main chat webview (`webview-ui/src/app.tsx`).
    - Removed separate `settings-ui` project and associated build scripts/dependencies.
    - Updated `extension.ts` to manage only the single chat webview and handle settings messages.
    - Updated `zencoder.openSettings` command to trigger the modal in the chat view.
## What's Left (Potential Future Enhancements)
- Implement conversation history persistence.
- Thorough testing and debugging of core chat and tool execution.
- Remove unused `@vscode/webview-ui-toolkit` dependency.
- Implement actual MCP client integration for tools like `search` (currently placeholder/disabled).
- Refine Preact component structure.
- Improve Markdown rendering in Preact UI.
- Improve error handling in Preact UI.
- Re-implement tool status updates using recommended Vercel AI SDK APIs (if desired).

## Current Status
- **UI Streaming & Tool Display:** Core chat streaming works. Tool calls are displayed inline with human-readable summaries and progress updates (for `uuidGenerateTool`).
- **Tool Execution:** Tools (including multi-UUID generation) execute and return results to the AI.
- **Settings Integration:** Settings UI (provider status/enablement) is integrated into the main chat webview via a modal.

## Known Issues
- `@vscode/webview-ui-toolkit` dependency is unused but still listed.
- Search tool functionality relies on the external `search_files` tool (requires environment support).
- Conversation history is not persisted.
- **AI Response Behavior:** AI models might not always explicitly list tool results (e.g., all generated UUIDs) in their text response, even though they receive the results. This depends on the model and prompt.
- Custom tool execution status updates (beyond the inline display) are currently disabled.
- Model resolver logic (fetching available models dynamically) is not yet implemented.
- Chat UI model selection persistence is not yet implemented.
- Conversation history is not persisted.