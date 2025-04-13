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
- **Webview Message Handling:** Uses a registration pattern (`src/webview/handlers/`). `ZenCoderChatViewProvider` delegates incoming messages to specific `MessageHandler` implementations.
- **State Management:** Chat history (`UiMessage[]`) persisted in `context.workspaceState` (per workspace). API keys stored securely in `context.secrets`. **Tool enablement (standard & MCP)** stored uniformly in `context.globalState` (`toolEnabledStatus`). Provider enablement stored in VS Code settings (`zencoder.provider.<id>.enabled`). Global custom instructions stored in VS Code settings (`zencoder.customInstructions.global`).
- **Configuration Files:**
    - Global MCP Servers: `[VS Code User Data]/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json`
    - Project MCP Servers: `[Workspace]/.zen/mcp_servers.json`
    - Project Custom Instructions: `[Workspace]/.zen/custom_instructions.md`

## Key Technical Decisions
- **Vercel AI SDK:** Central library for AI model interaction, streaming, and tool definition/execution.
- **Tool Implementation:** Tools are defined using the `ai` package's `tool` function with `zod` schemas. They are organized modularly under `src/tools/` (filesystem, utils, system, vscode). Execution logic uses `vscode` API or Node.js modules as appropriate. MCP tools are identified using the `mcp_serverName_toolName` format.
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
- **Message Passing:** Standard mechanism for extension host <-> webview communication.
- **Handler/Registry Pattern:** Used within the extension host (`ZenCoderChatViewProvider`) to route incoming webview messages to dedicated handler classes.
- **Dependency Injection (Manual):** Dependencies like `AiService`, `HistoryManager`, etc., are passed down through constructors or context objects.