# Project Progress

## What Works
- Initial project structure exists.
- Memory Bank files created and updated.
- Core dependencies installed.
- Basic Webview UI files created (using plain JS/HTML/CSS).
- `minicoder.startChat` command registered and activated.
- Basic Webview panel creation logic implemented.
- CSP nonce handling added.
- `AiService` class created (`src/ai/aiService.ts`) with:
    - API Key Management methods using `vscode.SecretStorage`.
    - Correct model provider instantiation logic using factory functions.
    - `getAiResponseStream` method.
    - Tool definitions for all required tools.
    - Basic tool execution logic implemented for most tools.
    - `executeSearch` updated to use an MCP tool executor bridge.
    - Conversation history update methods.
- `AiService` integrated into `src/extension.ts` (including async initialization).
- Placeholder MCP tool executor (`executeMcpToolPlaceholder`) defined in `src/extension.ts` and passed to `AiService`.
- Basic streaming implemented (extension processing parts, sending chunks to webview).
- Webview (`main.js`) updated to handle streaming display.
- API Key Setting Commands and handlers implemented.

## What's Left (Based on Feedback & Plan)
- **Implement Model Selection UI/Logic:** Add UI elements (e.g., dropdown) to the webview and connect it to `AiService.setModel`. (High Priority)
- Refine other tool execution logic (error handling, robustness, e.g., `fetch`).
- Implement conversation history persistence (optional MVP+).
- Thorough testing and debugging.
- Address the deprecated `@vscode/webview-ui-toolkit` (if components are needed later).
- Replace placeholder MCP tool executor with actual implementation if available/needed.

## Current Status
- MVP core functionality complete.
- Received feedback acknowledging current UI approach and prioritizing model selection.
- Preparing to commit current state before starting next task (likely model selection UI).

## Known Issues
- `@vscode/webview-ui-toolkit` (v1.4.0) is deprecated (currently only used for CSS vars).
- Search tool currently uses a placeholder MCP executor.
- Other tool implementations might need more robust error handling.
- Conversation history is not persisted.
- No UI for selecting models yet.