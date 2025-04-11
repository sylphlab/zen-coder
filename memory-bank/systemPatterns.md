# System Patterns

## Architecture
- **VS Code Extension:** Standard structure (`extension.ts`, `package.json`).
- **Webview UI:** A separate web application (HTML/CSS/JS) running inside a VS Code webview panel for the chat interface. Communication between the extension host and the webview via message passing.
- **AI Interaction Service:** A dedicated module/class within the extension host responsible for:
    - Managing API keys (via `vscode.SecretStorage`).
    - Handling model selection.
    - Interacting with the Vercel AI SDK (`ai` package).
    - Defining and executing tools requested by the AI.
- **State Management:** Use `context.globalState` and `context.workspaceState` for non-sensitive data like chat history per session. Use `vscode.SecretStorage` exclusively for API keys.

## Key Technical Decisions
- **Vercel AI SDK:** Central library for AI model interaction, streaming, and tool definition/execution.
- **Tool Implementation:** Tools defined using the `ai` package's `tool` function, leveraging `zod` for parameter validation. Tool execution logic will use the `vscode` API for workspace interactions (file system, terminals, etc.).
- **Security:** Prioritize security by using `SecretStorage` and requiring explicit user confirmation for potentially harmful actions like `runCommand`. File operations confined to the workspace.
- **UI Choice:** Start with the VS Code Webview UI Toolkit for simplicity and native feel, unless specific needs dictate a minimal framework like Preact later.

## Design Patterns
- **Service Layer:** Encapsulate AI interaction logic.
- **Message Passing:** For communication between extension host and webview UI.
- **Command Pattern:** Potentially for triggering extension actions from the UI or AI tools.