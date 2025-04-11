# Active Context

## Current Focus
Renaming project to "Zen Coder" and enhancing tool functionality based on Vercel AI SDK documentation (tool activation, multi-step, error handling, repair).

## Recent Changes
- **Project Renamed to Zen Coder:** Updated `package.json`, `src/extension.ts`, `README.md`, and Memory Bank files (`projectbrief.md`, `productContext.md`, `.clinerules`). Updated `webview-ui/index.html` title and root element ID. Updated secret keys prefix in `aiService.ts`.
- **Tool Enhancement (Vercel AI SDK):**
    - Added configuration options in `package.json` for enabling/disabling individual tools (`zencoder.tools.*.enabled`).
    - Modified `AiService` (`_getActiveToolNames`, `getAiResponseStream`) to read configuration and pass active tools via `experimental_activeTools` to `streamText`.
    - Added `maxSteps: 5` to `streamText` call in `AiService` to enable multi-step tool execution.
    - Added experimental tool error handling (`NoSuchToolError`, `InvalidToolArgumentsError`, `ToolExecutionError`) in `getAiResponseStream`.
    - Added experimental tool repair (`experimental_repairToolCall` with re-ask strategy) to `streamText` call in `AiService`.
    - Removed placeholder MCP executor logic from `src/extension.ts` and `AiService`. Updated `executeSearch` in `AiService` to reflect dependency on future MCP integration.

## Next Steps
- Update `memory-bank/progress.md` to reflect project renaming and tool enhancements.
- Commit changes.
- Attempt completion.
- Attempt completion.

## Active Decisions
- Project successfully renamed across relevant files.
- Tool functionality enhanced with activation controls, multi-step capability, and basic error/repair handling based on Vercel AI SDK features.
- Code prepared for potential future MCP integration.