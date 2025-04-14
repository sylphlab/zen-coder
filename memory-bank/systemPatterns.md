# System Patterns

## Architecture
- **VS Code Extension:** Standard structure (`extension.ts`, `package.json`).
- **Webview UI:** A separate web application (HTML/CSS/JS) running inside a VS Code webview panel for the chat interface. Communication between the extension host and the webview via message passing.
- **Core Services (Extension Host):**
    - `AiService (`src/ai/aiService.ts`): Focused on core AI interaction (calling `streamText` using explicit `providerId` and `modelId`), API key storage delegation (`setApiKey`, `deleteApiKey`), and tool execution wrapping.
    - `ProviderStatusManager` (`src/ai/providerStatusManager.ts`): Determines provider enablement and API key status.
    - `ModelResolver` (`src/ai/modelResolver.ts`): Fetches and lists available models from enabled providers (including `providerId`).
    - `HistoryManager` (`src/historyManager.ts`): Manages chat history persistence (`globalState`) and translation between UI/Core formats.
    - `StreamProcessor` (`src/streamProcessor.ts`): Handles parsing the AI response stream (`fullStream` via `text-delta`), and performs post-stream parsing of appended JSON blocks (e.g., for `suggested_actions`) before updating history/UI.
    - `McpManager` (`src/ai/mcpManager.ts`): Manages lifecycle, configuration, and tool fetching for MCP servers.
- **Webview Message Handling:** Uses a unified Request Handler pattern (`src/webview/handlers/RequestHandler.ts`). All FE -> BE messages are treated as requests (must include `requestId`). `ZenCoderChatViewProvider` uses a single `_handlers` map to route requests based on `message.requestType` (for `type: 'requestData'`) or `message.type` (for other actions like `subscribe`, `unsubscribe`, `sendMessage`). Backend ALWAYS sends a `responseData` message back.
- **State Management:** Chat history (`UiMessage[]`) persisted in `context.workspaceState` (per workspace). API keys stored securely in `context.secrets`. Provider enablement stored in VS Code settings (`zencoder.provider.<id>.enabled`). Global custom instructions stored in VS Code settings (`zencoder.customInstructions.global`).
- **Tool Authorization:** Managed via VS Code setting `zencoder.toolAuthorization`. This object defines status (`disabled`, `requiresAuthorization`, `alwaysAllow`) for standard tool categories (e.g., `filesystem`, `vscode`) and MCP servers. It also allows specific overrides (`disabled`, `requiresAuthorization`, `alwaysAllow`, `inherit`) for individual tools (standard or MCP). `AiService` reads this config to determine the final availability of each tool based on inheritance rules. (Replaces previous `zencoder.tools.*.enabled` settings and `globalState` `toolEnabledStatus` key).
- **Configuration Files:**
    - Global MCP Servers: `[VS Code User Data]/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json`
    - Project MCP Servers: `[Workspace]/.zen/mcp_servers.json`
    - Project Custom Instructions: `[Workspace]/.zen/custom_instructions.md`

## Key Technical Decisions
- **Vercel AI SDK:** Central library for AI model interaction, streaming, and tool definition/execution.
- **Tool Implementation:** Tools are defined using the `ai` package's `tool` function with `zod` schemas. They are organized modularly under `src/tools/` (filesystem, utils, system, vscode). Standard tools are categorized logically (see `STANDARD_TOOL_CATEGORIES` in `AiService`). Execution logic uses `vscode` API or Node.js modules. MCP tools are identified using the `mcp_serverName_toolName` format and categorized by server name. Authorization is checked via the `zencoder.toolAuthorization` setting before a tool is made available to the AI.
   - **Filesystem Tool Design Philosophy:**
       - **Consistency:** Strive for consistent parameter names and return structures across tools.
       - **Batch Operations:** Tools generally accept arrays of paths/items to minimize AI roundtrips.
       - **Glob Support:** Tools operating on potentially multiple unspecified paths (`listFiles`, `statItems`, `deleteItems`, `searchContent`, `replaceContent`) accept glob patterns in their `paths` array for flexibility.
       - **Explicit Paths:** Tools performing precise modifications or requiring unambiguous targets (`writeFiles`, `editFile`) require explicit relative paths, not globs.
       - **Line Range Control:** Tools processing file content (`readFiles`, `searchContent`, `replaceContent`) use a standardized, optional `lineRange` parameter (`{ start_line?: number, end_line?: number }`) supporting negative indexing from the end, allowing operations on specific file segments. This requires reading the full file first to determine the range, which might impact performance on very large files.
       - **Clear Separation:** `replaceContent` handles bulk, pattern-based replacements across files, while `editFile` focuses on precise, line-number/pattern-based edits within specific files (akin to applying a patch).
       - **Safety:** Workspace boundaries are enforced, and potentially dangerous operations (like deleting `.git`) are prevented.
- **Security:** Prioritize security by using `SecretStorage` and requiring explicit user confirmation for potentially harmful actions like `runCommand`. File operations confined to the workspace.
- **UI Choice:** Start with the VS Code Webview UI Toolkit for simplicity and native feel, unless specific needs dictate a minimal framework like Preact later.
- **AI Response Format (Suggested Actions):** To handle suggested actions from the AI without conflicting with user content or complex streaming parsing:
    - AI streams text content normally using `streamText`.
    - For suggested actions, AI appends a specific JSON block (```json { "suggested_actions": [...] } ```) at the *very end* of its response.
    - The backend (`HistoryManager`) parses this trailing block *after* the stream completes.
    - A strict Zod schema (`structuredAiResponseSchema`) validates the parsed JSON.
    - If valid, the actions are sent to the UI (likely displayed near the input box), and the JSON block is *removed* from the text saved to history.
    - If invalid (parsing error or schema mismatch), the block is treated as regular text and remains in the history.
    - This approach balances streaming simplicity, robustness against conflicts (via validation), and avoids requiring AI to generate complex XML/CDATA or frontend Markdown parsing for actions.

## Design Patterns
- **Service Layer:** Core functionalities (AI interaction, status, models, history) are encapsulated in dedicated services/managers.
- **Message Passing:** Strict Request/Response pattern for FE -> BE communication (all messages require `requestId` and receive `responseData`). Pub/Sub pattern for BE -> FE state updates (using `pushUpdate` messages with `topic` and `data`).
- **Handler/Registry Pattern:** Unified pattern using `RequestHandler` interface and a single handler map in `ZenCoderChatViewProvider` for all incoming requests.
- **Dependency Injection (Manual):** Dependencies like `AiService`, `HistoryManager`, etc., are passed down through constructors or context objects.