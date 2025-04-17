# Project Brief: Zen Coder VS Code Extension

## Objective
Build a lightweight VS Code extension that provides a simple chat interface to interact with selected AI models for coding assistance. Focus on core functionality, ease of use for a single developer, and direct integration with essential VS Code actions via AI tools.

## Core Technology
- **Platform:** Visual Studio Code Extension
- **AI SDK:** Vercel AI SDK (`ai` package)
- **Supported AI Providers & Models:**
    - Anthropic (Claude) via `@ai-sdk/anthropic` (e.g., `claude-3-5-sonnet-latest`)
    - Google (Gemini) via `@ai-sdk/google` (e.g., `models/gemini-1.5-pro-latest`)
    - OpenRouter via `@openrouter/ai-sdk-provider` (e.g., `anthropic/claude-3.5-sonnet`)
    - DeepSeek via `@ai-sdk/deepseek` (e.g., `deepseek-coder`)
- **State Management:** Standard VS Code mechanisms (`context.globalState`, `context.workspaceState`, `vscode.SecretStorage` for API keys).
- **UI Framework:** Standard VS Code Webview UI Toolkit or simple web framework (plain JS/HTML/CSS, Preact).

## Core User Interface
- **Chat View:**
    - Dedicated panel/view.
    - Multiple independent chat sessions.
    - Simple input area.
    - Message display (user prompts, streaming AI responses with Markdown rendering).
    - Provider/Model selection.
- **Settings View:**
    - Minimalist VS Code settings UI.
    - API Key Management using `vscode.SecretStorage`.

## Core Functionality
- **Basic Chat:**
    - Send user message + history to selected AI model via Vercel AI SDK (`streamText` / `generateText`).
    - Stream response back to UI.
    - Simple conversation history persistence (workspace/global state).
- **Tool Calling (Essential):**
    - Implement using Vercel AI SDK `tools` parameter.
    - AI requests tool execution; extension executes and returns result.
    - **Required Tools (MVP):**
        - `readFile(path: string)`: Read workspace file.
        - `writeFile(path: string, content: string)`: Write workspace file (with safety/confirmation).
        - `listFiles(path: string)`: List workspace files/dirs.
        - `runCommand(command: string, terminalId?: string, workingDirectory?: string)`: Execute shell command (REQUIRES USER CONFIRMATION).
        - `search(query: string)`: Web search.
        - `fetch(url: string)`: Fetch URL content.
        - `getOpenTabs()`: List open editor file paths.
        - `getActiveTerminals()`: List active VS Code terminals.
        - `getCurrentTime()`: Get current date/time.

## Security Considerations
- API Keys: MUST use `vscode.SecretStorage`.
- `runCommand`: MUST require explicit user confirmation.
- File System Access: Confine to workspace, confirm destructive actions.

## Development Considerations
- Use `npm create vite@latest` (vanilla-ts) or VS Code Webview UI Toolkit for webview.
- Use `vsce` for packaging.
- Clear code structure (extension logic, webview UI, AI service).

## Initial Exclusions (May be revisited)
- No RAG.
- No complex multi-assistant features.
- No advanced state management/checkpointing.
- No Git integration tools.
- No fancy onboarding.
- No automatic context fetching from editor selection (unless simple).
- No complex performance optimizations.
- No scheduling tool.

## Goal
A functional, reliable, single-user AI assistant within VS Code using the specified tools and AI providers via the Vercel AI SDK.