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
- **Tool Functionality Enhanced:**
    - Added VS Code settings (`zencoder.tools.*.enabled`) to enable/disable tools.
    - `AiService` now reads settings and uses `experimental_activeTools` in `streamText`.
    - `streamText` call updated with `maxSteps: 5` for multi-step tool use.
    - Added experimental tool error handling and repair (`experimental_repairToolCall`) in `AiService`.

## What's Left (Potential Future Enhancements)
- Refine Preact component structure.
- Refine tool execution logic (error handling, robustness, e.g., `fetch`).
- Implement conversation history persistence.
- Thorough testing and debugging.
- Remove unused `@vscode/webview-ui-toolkit` dependency.
- Implement actual MCP client integration for tools like `search`.
- Improve Markdown rendering in Preact UI.
- Improve error handling in Preact UI.

## Current Status
- **Core Functionality Enhanced:** Project renamed to Zen Coder. Tool functionality improved with activation controls, multi-step capability, and experimental error handling/repair. Core chat, API key management, model selection, and dev/prod webview loading remain functional.
- Project is stable with enhanced tool features based on Vercel AI SDK.

## Known Issues
- `@vscode/webview-ui-toolkit` dependency is unused after refactor but still listed in `package.json`.
- Search tool requires MCP integration to function.
- Other tool implementations might need more robust error handling.
- Conversation history is not persisted.