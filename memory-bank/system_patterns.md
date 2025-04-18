# System Patterns

## Architecture
- **VS Code Extension:** Standard structure (`extension.ts`, `package.json`).
- **Webview UI:** A separate web application (HTML/CSS/JS) running inside a VS Code webview panel for the chat interface. Communication between the extension host and the webview via message passing.
- **Core Services (Extension Host):**
    - `AiService` (`src/ai/aiService.ts`): Acts as the central coordinator, orchestrating interactions between various managers. It initializes managers, handles `postMessage` setup, and exposes a unified API to the rest of the extension, delegating tasks to specialized managers.
    - `ProviderManager` (`src/ai/providerManager.ts`): Manages AI provider instances (initialization, `providerMap`), configuration (API keys via `setApiKey`/`deleteApiKey`, enablement via `setProviderEnabled`), and status reporting (`getProviderStatus`, potentially using `ProviderStatusManager`). Notifies `SubscriptionManager` of status changes.
    - `ToolManager` (`src/ai/toolManager.ts`): Manages tool definitions (standard and MCP), determines tool enablement based on configuration (`zencoder.toolAuthorization`), prepares the final `ToolSet` for the AI (`prepareToolSet`), and provides resolved tool status for the UI (`getResolvedToolStatusInfo`).
    - `SubscriptionManager` (`src/ai/subscriptionManager.ts`): Manages webview subscriptions (`addSubscription`, `removeSubscription`, `hasSubscription`) and pushes updates to the frontend (`notifyProviderStatusChange`, `notifyToolStatusChange`, etc.) using the `postMessageCallback`. Receives notifications from other managers or `AiService`.
    - `AiStreamer` (`src/ai/aiStreamer.ts`): Handles the core AI interaction logic, preparing messages (`_loadCustomInstructions`, uses `historyUtils.translateUiHistoryToCoreMessages`), getting provider instances (`_getProviderInstance`), resolving config (`configResolver.getChatEffectiveConfig`), calling the AI SDK (`streamText`), managing stream lifecycle (`abortCurrentStream`), and handling tool repair logic.
    - `ConfigResolver` (`src/ai/configResolver.ts`): Reads default chat configuration (`zencoder.defaults.defaultAssistantId`), merges it with session-specific configuration (`ChatSession.config.assistantId`), resolves the target Assistant (using `AssistantManager`), and provides the effective configuration (including resolved provider/model/instructions) for a given chat (`getChatEffectiveConfig`).
    - `ProviderStatusManager` (`src/ai/providerStatusManager.ts`): (Used by `ProviderManager`) Determines provider enablement and API key status based on configuration and secrets.
    - `ModelResolver` (`src/ai/modelResolver.ts`): Fetches and lists available models from enabled providers (used for Assistant configuration).
    - `AssistantManager` (`src/ai/assistantManager.ts` - **TODO**): Manages Assistant definitions (CRUD operations, persistence).
    - `HistoryManager` (`src/historyManager.ts`): Manages chat history messages (CRUD operations: `addMessage`, `deleteMessage`, `clearHistory`, `getHistory`, etc.). It utilizes `ChatSessionManager` to get session details (like `nextSeqId`) and `WorkspaceStateManager` for persistence. It also handles message modification logic via `MessageModifier`.
    - `ChatSessionManager` (`src/session/chatSessionManager.ts`): Manages the lifecycle and metadata (name, config (`assistantId`, `useDefaults`), `nextSeqId`, location) of chat sessions. Uses `WorkspaceStateManager` for persistence.
    - `WorkspaceStateManager` (`src/state/workspaceStateManager.ts`): Handles the low-level saving and loading of state (sessions, history, assistants) to `context.workspaceState`.
    - `StreamProcessor` (`src/streamProcessor.ts`): Handles parsing the AI response stream (`fullStream` via `text-delta`), and performs post-stream parsing of appended JSON blocks (e.g., for `suggested_actions`) before updating history/UI via `HistoryManager`.
    - `McpManager` (`src/ai/mcpManager.ts`): Manages lifecycle, configuration, and tool fetching for MCP servers.
- **Standard Data Communication Pattern (FE <-> BE):**
    - **Core Principle:** Explicit separation of state fetching (ReqRes) and update subscription (PubSub). PubSub **does not** send initial state upon subscription.
    - **Initial State Fetching (ReqRes):** Frontend uses `requestData(requestType, payload)` to request the initial state of data from the corresponding backend Handler (e.g., `getChatSessions`, `getChatHistory`).
    - **Real-time Updates (PubSub with JSON Patch):**
        - Frontend uses `listen(topic, handleUpdate)` to subscribe to a specific topic via the backend `SubscribeHandler`.
        - Backend uses `pushUpdate(topic, patch)` to push **incremental updates** as a standard **JSON Patch (RFC 6902)** array (`Operation[]`) to subscribed clients.
        - Backend utilizes a utility (e.g., `src/utils/patchUtils.ts` with `fast-json-patch`) to generate these patches by comparing the state before and after a change. Simple patches (like adding an item) can also be constructed manually.
        - Frontend's `createStore` utility internally uses a library (e.g., `fast-json-patch`) to apply the received patch array to its internal `actualState`.
    - **Mutation:** User actions that modify state are sent via `requestData(mutationRequestType, payload)`. Backend handlers process the mutation, generate the corresponding JSON Patch, and trigger a PubSub `pushUpdate` with the patch.
- **Standardized Frontend Store Creation (`createStore` Utility with Optimistic UI Support):**
    - Location: `webview-ui/src/stores/utils/createStore.ts`
    - Purpose: Provides a consistent way to create Nanostores (`StandardStore`) that handle initial data fetching (ReqRes), real-time patch updates (PubSub), and optimistic UI updates.
    - **Internal State:**
        - `_actualState`: Holds the state confirmed by the backend (updated via fetch or applying backend patches).
        - `_optimisticState`: Holds a temporary, predicted state after a user action but before backend confirmation. Initially `null`.
    - **Exported Value:** The store exposes a computed value: `_optimisticState ?? _actualState`. UI components subscribe to this combined value.
    - **API:** `createStore({ key, fetch, subscribe?, initialData?, dependsOn? })`
        - `key`, `fetch`, `initialData`, `dependsOn`: Same as before.
        - `subscribe`: Configures the `listen` subscription. The `handleUpdate` function provided here is **no longer used** for applying updates; `createStore` handles patch application internally using `fast-json-patch`. The `updateData` type for the subscription is expected to be `Operation[]`.
    - **Methods:**
        - `.refetch()`: Fetches initial state, clears optimistic state.
        - `.applyOptimisticPatch(patch: Operation[])`: Applies a given JSON Patch to the current `_actualState` and stores the result in `_optimisticState`. Updates the store's exported value to reflect the optimistic state.
        - `.clearOptimisticState()`: Resets `_optimisticState` to `null`. Updates the store's exported value to reflect the `_actualState`.
        - `.getActualState()`: Returns the current `_actualState`.
    - **Update Flow (Backend Patch):**
        1. `listen` callback receives a patch (`Operation[]`).
        2. Internal logic applies the patch to `_actualState` using `fast-json-patch`.
        3. Sets `_optimisticState` to `null`.
        4. Updates the store's exported value with the new `_actualState`.
    - **Optimistic Update Flow (User Action):**
        1. UI component calculates the optimistic patch (`Operation[]`) representing the user's action.
        2. UI component calls `store.applyOptimisticPatch(optimisticPatch)`.
        3. `createStore` applies the patch to `_actualState`, stores result in `_optimisticState`, updates exported value.
        4. UI component triggers the backend mutation request.
        5. **On mutation success:** Backend sends a patch. `createStore` applies it to `_actualState`, clears `_optimisticState`, store value updates to actual.
        6. **On mutation failure:** UI component calls `store.clearOptimisticState()`. Store value reverts to `_actualState`.
- **State Management (Persistence):**
    - Session metadata (`ChatSession` including `config.assistantId`) and chat history (`UiMessage[]`) persisted in `context.workspaceState` via `WorkspaceStateManager`, coordinated by `ChatSessionManager` and `HistoryManager`.
    - Assistant definitions (`Assistant[]`) persisted likely via `WorkspaceStateManager` (or dedicated file), coordinated by `AssistantManager` (**TODO**).
    - API keys stored securely in `context.secrets`.
    - Provider enablement stored in VS Code settings (`zencoder.provider.<id>.enabled`).
    - Global custom instructions stored in VS Code settings (`zencoder.customInstructions.global`).
    - Default Assistant ID stored in VS Code settings (`zencoder.defaults.defaultAssistantId`).
- **Tool Authorization:** Managed via VS Code setting `zencoder.toolAuthorization`. (Details remain the same).
- **Configuration Files:** (Details remain the same).
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
- **Service Layer:** Core functionalities encapsulated in services/managers.
- **Message Passing:** Unified Request/Response pattern (`requestData`/`responseData` with `requestId`) and Pub/Sub (`subscribe`/`unsubscribe`/`pushUpdate` with `topic`).
- **Handler/Registry Pattern:** Unified backend handlers (`RequestHandler` interface, registered in `extension.ts`).
- **Dependency Injection (Manual):** Core services passed via constructors.
