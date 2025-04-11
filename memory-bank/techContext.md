# Tech Context

## Core Technologies
- **VS Code API:** For extension development, webviews, file system access, terminal interaction, settings, secret storage.
- **TypeScript:** Primary language for extension development.
- **Node.js:** Runtime environment for VS Code extensions.
- **Vercel AI SDK (`ai` package):** Core library for interacting with AI models.
    - `@ai-sdk/anthropic`: For Claude models.
    - `@ai-sdk/google`: For Gemini models.
    - `@openrouter/ai-sdk-provider`: For OpenRouter models.
    - `@ai-sdk/deepseek`: For DeepSeek models.
- **Zod:** For defining tool parameter schemas.
- **HTML/CSS/JavaScript:** For the webview UI.
- **VS Code Webview UI Toolkit:** Preferred initial choice for building the webview UI components. **(Note: Deprecated as of v1.4.0, may need replacement later)**.
- **pnpm:** Package management (v10.8.0 used for initial install).
- **esbuild:** Bundler (as indicated by `esbuild.js` in the project root).
- **eslint:** Linter (as indicated by `eslint.config.mjs`).

## Development Setup
- Standard VS Code extension development environment.
- Requires Node.js and pnpm installed.
- Debugging via VS Code launch configurations (`.vscode/launch.json`).
- Packaging via `vsce`.

## Constraints
- Must operate within the VS Code extension sandbox.
- Network requests for AI APIs and potentially `fetch`/`search` tools.
- File system access limited to the workspace (with safety checks).
- User confirmation required for sensitive operations (`runCommand`, file overwrites).

## Dependencies (Installed)
- `ai`: 4.3.5
- `@ai-sdk/anthropic`: 1.2.9
- `@ai-sdk/google`: 1.2.10
- `@openrouter/ai-sdk-provider`: 0.4.5
- `@ai-sdk/deepseek`: 0.2.9
- `zod`: 3.24.2
- `@vscode/webview-ui-toolkit`: 1.4.0 (Deprecated)
- *(Plus transitive dependencies)*

## Guideline Checksums
<!-- This section will be populated automatically by the SHA verification process -->