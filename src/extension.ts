import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AiService, ApiProviderKey } from './ai/aiService';

let aiServiceInstance: AiService | undefined = undefined; // Hold AiService instance

// Make activate async to await AiService initialization
export async function activate(context: vscode.ExtensionContext) {
    console.log('--- Zen Coder Extension Activating ---');

    console.log('Congratulations, your extension "zencoder" is now active!');

    // Instantiate and initialize AiService.
    aiServiceInstance = new AiService(context);
    await aiServiceInstance.initialize(); // Wait for keys to be loaded

    // --- Register Webview View Provider ---
    // Ensure aiServiceInstance is initialized before creating the provider
    if (!aiServiceInstance) {
        console.error("AiService failed to initialize before registering view provider.");
        vscode.window.showErrorMessage("Zen Coder failed to initialize. Please check logs or restart VS Code.");
        return; // Stop activation if service failed
    }
    const provider = new ZenCoderChatViewProvider(context.extensionUri, context.extensionMode, aiServiceInstance);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ZenCoderChatViewProvider.viewType, provider)
    );
    console.log('Zen Coder Chat View Provider registered.');

    // Set the postMessage callback in AiService AFTER provider is created
    // Ensure aiServiceInstance is definitely defined here (checked above)
    aiServiceInstance.setPostMessageCallback((message: any) => {
        provider.postMessageToWebview(message);
    });

    // --- Removed Command Registrations ---
    console.log('Removed all command registrations.');

} // End of activate function

// --- Webview View Provider Class ---
class ZenCoderChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'zencoder.views.chat'; // Matches package.json view ID

    private _view?: vscode.WebviewView;
    private _aiService: AiService;
    private _extensionUri: vscode.Uri;
    private _extensionMode: vscode.ExtensionMode;

    constructor(
        extensionUri: vscode.Uri,
        extensionMode: vscode.ExtensionMode,
        aiService: AiService // Pass initialized AiService
    ) {
        this._extensionUri = extensionUri;
        this._extensionMode = extensionMode;
        this._aiService = aiService; // Store the instance
        console.log("ZenCoderChatViewProvider constructed.");
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;
        console.log("Resolving webview view...");

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview')]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        console.log("Webview HTML set.");

        webviewView.webview.onDidReceiveMessage(async (message: any) => {
            console.log("Received message from webview:", message.type);
            // Ensure AiService is available (should be guaranteed by constructor injection)
            if (!this._aiService) {
                console.error("AiService is unexpectedly undefined in message handler.");
                vscode.window.showErrorMessage("Internal Error: AI Service not available.");
                return;
            }

            switch (message.type) {
                case 'sendMessage':
                    try {
                        // Ensure model is set before sending
                        if (!this._aiService.getCurrentModelId()) {
                            this.postMessageToWebview({ type: 'addMessage', sender: 'assistant', text: 'Please select a model first in the settings.' });
                            return;
                        }
                        const streamResult = await this._aiService.getAiResponseStream(message.text);
                        if (!streamResult) {
                            console.log("getAiResponseStream returned null, likely handled error.");
                            return; // Error likely handled and message sent by AiService
                        }

                        this.postMessageToWebview({ type: 'startAssistantMessage', sender: 'assistant' });

                        const reader = streamResult.getReader();
                        const decoder = new TextDecoder();
                        let buffer = '';
                        let isDone = false;

                        while (!isDone) {
                            const { done, value } = await reader.read();
                            isDone = done;
                            buffer += decoder.decode(value, { stream: !isDone });

                            const lines = buffer.split('\n');
                            buffer = lines.pop() ?? '';

                            for (const line of lines) {
                                if (line.trim() === '') continue;
                                const match = line.match(/^([0-9a-zA-Z]):(.*)$/);
                                if (match && match[1] && match[2]) {
                                    const prefix = match[1];
                                    const contentData = match[2];
                                    try {
                                        // Simplified stream handling for brevity - assumes similar logic as before
                                        if (prefix >= '0' && prefix <= '7') {
                                            const part = JSON.parse(contentData);
                                            if (typeof part === 'string') {
                                                this.postMessageToWebview({ type: 'appendMessageChunk', sender: 'assistant', textDelta: part });
                                            } else if (typeof part === 'object' && part?.type === 'text-delta') {
                                                this.postMessageToWebview({ type: 'appendMessageChunk', sender: 'assistant', textDelta: part.textDelta });
                                            } else if (typeof part === 'object' && part?.type === 'error') {
                                                 vscode.window.showErrorMessage(`Stream Error: ${part.error}`); this.postMessageToWebview({ type: 'addMessage', sender: 'assistant', text: `Sorry, a stream error occurred: ${part.error}` });
                                            }
                                        } else if (prefix === '9') { // Tool Call
                                            const part = JSON.parse(contentData);
                                            if (part.toolCallId && part.toolName && part.args !== undefined) {
                                                this.postMessageToWebview({ type: 'addToolCall', payload: { toolCallId: part.toolCallId, toolName: part.toolName, args: part.args } });
                                            }
                                        } else if (prefix === 'a') { // Tool Result
                                            const part = JSON.parse(contentData);
                                            if (part.toolCallId && part.result !== undefined) {
                                                this.postMessageToWebview({ type: 'toolStatusUpdate', toolCallId: part.toolCallId, status: 'complete', message: part.result });
                                            }
                                        } else if (prefix === 'd') { // Data/Annotations
                                             const part = JSON.parse(contentData);
                                             if (part.type === 'message-annotation') {
                                                 const statusMessage = (typeof part.message === 'string') ? part.message : undefined;
                                                 this.postMessageToWebview({ type: 'toolStatusUpdate', toolCallId: part.toolCallId, toolName: part.toolName, status: part.status, message: statusMessage });
                                             } else if (part.type === 'error') { vscode.window.showErrorMessage(`Stream Error: ${part.error}`); this.postMessageToWebview({ type: 'addMessage', sender: 'assistant', text: `Sorry, a stream error occurred: ${part.error}` }); }
                                        } else if (prefix === 'e') { // Events/Errors
                                             const part = JSON.parse(contentData);
                                             if (part.error) { vscode.window.showErrorMessage(`Stream Event Error: ${part.error}`); this.postMessageToWebview({ type: 'addMessage', sender: 'assistant', text: `Sorry, an error occurred: ${part.error}` }); }
                                        }
                                        // Ignore 8, f silently
                                    } catch (e) { console.error(`Failed to parse JSON for prefix '${prefix}':`, contentData, e); }
                                } else { if (line.trim() !== '') { console.warn('Received stream line without expected prefix format:', line); } }
                            }
                        }
                        // Final buffer processing (simplified)
                        if (buffer.trim().startsWith('{') && buffer.trim().endsWith('}')) {
                             try {
                                 const part = JSON.parse(buffer);
                                 if (part.type === 'text-delta') { this.postMessageToWebview({ type: 'appendMessageChunk', sender: 'assistant', textDelta: part.textDelta }); }
                                 // Add other final part handling if needed
                             } catch (e) { /* ignore */ }
                        }

                    } catch (error: any) {
                        console.error("Error processing AI stream:", error);
                        vscode.window.showErrorMessage(`Failed to get AI response: ${error.message}`);
                        this.postMessageToWebview({ type: 'addMessage', sender: 'assistant', text: `Sorry, an error occurred: ${error.message}` });
                    }
                    break; // End of 'sendMessage' case

                case 'webviewReady':
                    console.log('Webview view is ready');
                    // Send initial state (models, provider status)
                    const models = await this._aiService.resolveAvailableModels();
                    this.postMessageToWebview({ type: 'availableModels', payload: models });
                    const status = await this._aiService.getProviderStatus();
                    this.postMessageToWebview({ type: 'providerStatus', payload: status });
                    break;
                case 'setModel':
                    if (typeof message.modelId === 'string') {
                        this._aiService.setModel(message.modelId as any); // Cast might be needed
                        console.log(`Model changed to: ${message.modelId}`);
                    } else { console.error('Invalid modelId received', message); }
                    break;
                case 'getAvailableModels': // Still needed if webview re-requests
                    const currentModels = await this._aiService.resolveAvailableModels();
                    this.postMessageToWebview({ type: 'availableModels', payload: currentModels });
                    break;
                case 'getProviderStatus': // Handle settings request
                    const currentStatus = await this._aiService.getProviderStatus();
                    this.postMessageToWebview({ type: 'providerStatus', payload: currentStatus });
                    break;
                case 'setProviderEnabled': // Handle settings update
                    if (message.payload && typeof message.payload.provider === 'string' && typeof message.payload.enabled === 'boolean') {
                        const providerKeyInput = message.payload.provider;
                        const enabled = message.payload.enabled;
                        const validKeys: ApiProviderKey[] = ['ANTHROPIC', 'GOOGLE', 'OPENROUTER', 'DEEPSEEK'];
                        if (validKeys.includes(providerKeyInput as ApiProviderKey)) {
                            const providerKey = providerKeyInput as ApiProviderKey;
                            try {
                                const config = vscode.workspace.getConfiguration('zencoder.provider');
                                const keyMap: Record<ApiProviderKey, string> = { ANTHROPIC: 'anthropic.enabled', GOOGLE: 'google.enabled', OPENROUTER: 'openrouter.enabled', DEEPSEEK: 'deepseek.enabled' };
                                await config.update(keyMap[providerKey], enabled, vscode.ConfigurationTarget.Global);
                                console.log(`Provider ${String(providerKey)} enabled status updated to: ${enabled}`);
                                // Send updated status back
                                const updatedStatus = await this._aiService.getProviderStatus();
                                this.postMessageToWebview({ type: 'providerStatus', payload: updatedStatus });
                            } catch (error: any) {
                                console.error(`Failed to update provider setting for ${String(providerKey)}:`, error);
                                vscode.window.showErrorMessage(`Failed to update setting for ${String(providerKey)}: ${error.message}`);
                            }
                        } else { console.error(`Invalid provider key received in setProviderEnabled: ${providerKeyInput}`); }
                    } else { console.error("Invalid payload for setProviderEnabled:", message.payload); }
                    break;
                default:
                    console.warn("Received unknown message type from webview:", message.type);
            }
        });

        console.log("Webview view resolved and message listener attached.");
    }

    // Public method to allow AiService to post messages back
    public postMessageToWebview(message: any) {
        if (this._view) {
            this._view.webview.postMessage(message);
        } else {
            // Queue message or log warning if view not ready?
            console.warn("Attempted to post message to unresolved webview view:", message.type);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Reuse the existing getWebviewContent function
        return getWebviewContent(webview, this._extensionUri, this._extensionMode);
    }
}

// --- Helper Functions ---

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, extensionMode: vscode.ExtensionMode): string {
    const nonce = getNonce();
    const isDevelopment = extensionMode === vscode.ExtensionMode.Development;
    let viteDevServerPort = 5173; // Default port
    const portFilePath = path.join(extensionUri.fsPath, '.vite.port'); // Path relative to extension root
    try {
        if (fs.existsSync(portFilePath)) {
            const portFileContent = fs.readFileSync(portFilePath, 'utf8');
            const parsedPort = parseInt(portFileContent.trim(), 10);
            if (!isNaN(parsedPort) && parsedPort > 0) {
                viteDevServerPort = parsedPort;
                console.log(`Read Vite dev server port ${viteDevServerPort} from ${portFilePath}`);
            } else {
                console.warn(`Invalid port number found in ${portFilePath}: ${portFileContent}. Using default ${viteDevServerPort}.`);
            }
        } else {
            console.log(`.vite.port file not found at ${portFilePath}. Using default port ${viteDevServerPort}.`);
        }
    } catch (error: any) {
        console.error(`Error reading port file ${portFilePath}: ${error.message}. Using default port ${viteDevServerPort}.`);
    }
    const viteDevServerUrl = `http://localhost:${viteDevServerPort}`;
    const buildDir = 'webview'; // Build output directory for webview UI
    const title = 'Zen Coder'; // Simple title
    const mainTsxPath = '/src/main.tsx'; // Entry point for webview UI

    console.log(`Getting webview content. Development mode: ${isDevelopment}`);

    if (isDevelopment) {
        // Development mode: Load from the Vite dev server for HMR
        console.log(`Loading webview from Vite dev server: ${viteDevServerUrl}`);
        // CSP needs to allow connection to the dev server and inline styles (Vite might inject some)
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta http-equiv="Content-Security-Policy" content="
        default-src 'none';
        style-src 'unsafe-inline' ${webview.cspSource} ${viteDevServerUrl};
        script-src 'unsafe-eval' 'nonce-${nonce}' ${viteDevServerUrl};
        connect-src ${viteDevServerUrl} ws://${viteDevServerUrl.split('//')[1]};
        img-src ${webview.cspSource} data: ${viteDevServerUrl};
        font-src ${webview.cspSource} ${viteDevServerUrl};
    ">
    <script type="module" nonce="${nonce}" src="${viteDevServerUrl}/@vite/client"></script>
    <script type="module" nonce="${nonce}" src="${viteDevServerUrl}${mainTsxPath}"></script>
</head>
<body>
    <div id="root"></div>
</body>
</html>`;

    } else {
        // Production mode: Load from the build output directory
        console.log(`Loading webview from dist/${buildDir}`);
        const buildPath = vscode.Uri.joinPath(extensionUri, 'dist', buildDir);
        const htmlPath = vscode.Uri.joinPath(buildPath, 'index.html');

        try {
            let htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');

            // Replace asset paths with webview URIs
            htmlContent = htmlContent.replace(/(href|src)="(\/[^"]+)"/g, (match, attr, path) => {
                const assetUriOnDisk = vscode.Uri.joinPath(buildPath, path);
                const assetWebviewUri = webview.asWebviewUri(assetUriOnDisk);
                return `${attr}="${assetWebviewUri}"`;
            });

            // Inject nonce into the main script tag
            htmlContent = htmlContent.replace(
                /(<script type="module" crossorigin src="[^"]+")>/,
                `$1 nonce="${nonce}">`
            );

            // Inject CSP meta tag
            htmlContent = htmlContent.replace(
                '</head>',
                // CSP for production: allow styles/images/fonts from webview source, scripts with nonce, self connections
                `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'self'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource};">
                 </head>`
            );

            return htmlContent;
        } catch (e: any) { // Add type annotation for error
            console.error(`Error reading or processing production webview HTML from ${htmlPath.fsPath}: ${e}`);
            return `<html><body>Error loading webview content. Failed to read or process build output. Check console and ensure 'pnpm run build:webview' has run successfully. Path: ${htmlPath.fsPath} Error: ${e.message}</body></html>`;
        }

// Class definition moved above registration
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export function deactivate() {} // No resources to dispose explicitly in deactivate
