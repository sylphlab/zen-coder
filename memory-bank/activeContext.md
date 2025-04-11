# Active Context

## Current Focus
Finalizing documentation and preparing for task completion after implementing development mode support for webview loading.

## Recent Changes
- Completed core MVP functionality.
- Refactored Webview UI to Vite + Preact.
- Implemented Model Selection UI and logic.
- Updated relevant files (`package.json`, `src/extension.ts`, `webview-ui/*`) for Vite + Preact.
- Fixed Webview Loading Issue for production builds.
- **Implemented Development Mode Support:**
    - Updated `.vscode/launch.json` to use `npm: watch` as `preLaunchTask`.
    - Modified `getWebviewContent` in `src/extension.ts` to detect `extensionMode` and load from Vite dev server (`http://localhost:5173`) in development or from `dist/webview` in production.
    - Adjusted CSP policies for both modes.
- **Fixed Preact Mount Point:** Corrected the target element ID in `webview-ui/src/main.tsx` from `#app` to `#root` to match the development HTML structure in `src/extension.ts`, resolving the "無野睇" issue in dev mode.

## Next Steps
- Update `memory-bank/progress.md` to reflect the development mode support and the Preact mount point fix.
- Commit the latest changes.
- Attempt completion.

## Active Decisions
- Webview UI successfully refactored and loading correctly in both development (with HMR via Vite dev server) and production modes.
- Model selection functionality implemented.
- Core logic remains stable.