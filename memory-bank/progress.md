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
    - `getAiResponseStream` method.
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
    - Basic streaming status updates implemented via `StreamData` (demonstrated in `listFilesTool`, `readFileTool`, etc.).
    - **Fixed Stream Parsing (Refined):** Corrected stream parsing in `extension.ts` to handle Vercel AI SDK format, including various prefixes (`0:`, `d:`, `e:`, `f:`) and differentiating between raw text and JSON content based on prefix and content structure.
    - **UI Update (Tool Status):** Webview UI (`app.tsx`, `app.css`) updated to display tool execution status updates received via `message-annotation`.
## What's Left (Potential Future Enhancements)
- Implement conversation history persistence.
- Thorough testing and debugging of new tools and stream parsing across different models.
- Remove unused `@vscode/webview-ui-toolkit` dependency.
- Implement actual MCP client integration for tools like `search` (currently placeholder/disabled).
- Refine Preact component structure.
- Improve Markdown rendering in Preact UI.
- Improve error handling in Preact UI.

## Current Status
- **Toolset Refactored & Expanded:** All requested tools implemented in a modular structure under `src/tools/`. `AiService` and configuration updated accordingly. Project remains functional with the enhanced toolset.
- **Stream Parsing Refined:** Logic updated to handle more Vercel AI SDK stream variations, including raw text chunks.
- Project is stable, pending further testing of stream parsing.

## Known Issues
- `@vscode/webview-ui-toolkit` dependency is unused but still listed.
- Search tool functionality relies on the external `search_files` tool (requires environment support).
- Conversation history is not persisted.
- Webview UI now displays basic tool status updates. (Further refinement might be needed).