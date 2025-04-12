import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CoreMessage } from 'ai'; // Single import
import { AiService, ApiProviderKey } from './ai/aiService';
import { providerMap } from './ai/providers';

let aiServiceInstance: AiService | undefined = undefined;

export async function activate(context: vscode.ExtensionContext) {
    console.log('--- Zen Coder Extension Activating ---');
    console.log('Congratulations, your extension "zencoder" is now active!');

    aiServiceInstance = new AiService(context);
    await aiServiceInstance.initialize();

    if (!aiServiceInstance) {
        console.error("AiService failed to initialize before registering view provider.");
        vscode.window.showErrorMessage("Zen Coder failed to initialize. Please check logs or restart VS Code.");
        return;
    }
    const provider = new ZenCoderChatViewProvider(context, aiServiceInstance);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ZenCoderChatViewProvider.viewType, provider)
    );
    console.log('Zen Coder Chat View Provider registered.');

    aiServiceInstance.setPostMessageCallback((message: any) => {
        provider.postMessageToWebview(message);
    });
    console.log('Removed all command registrations.');
}

class ZenCoderChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'zencoder.views.chat';

    private _view?: vscode.WebviewView;
    private _aiService: AiService;
    private _context: vscode.ExtensionContext;
    private _extensionUri: vscode.Uri;
    private _extensionMode: vscode.ExtensionMode;
    private _chatHistory: CoreMessage[] = []; // Correct type

    constructor(
        context: vscode.ExtensionContext,
        aiService: AiService
    ) {
        this._context = context;
        this._extensionUri = context.extensionUri;
        this._extensionMode = context.extensionMode;
        this._aiService = aiService;
        console.log("ZenCoderChatViewProvider constructed.");
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;
        console.log("Resolving webview view...");
        // Load history with validation
        try {
            const loadedHistory = this._context.globalState.get<any[]>('zenCoderChatHistory', []);
            if (loadedHistory.every(msg => msg && typeof msg.role === 'string' && msg.content !== undefined)) {
                 this._chatHistory = loadedHistory as CoreMessage[];
                 console.log(`Loaded ${this._chatHistory.length} messages from history.`);
            } else if (loadedHistory.length > 0) {
                 console.warn("Existing chat history format is incompatible or invalid. Clearing history.");
                 this._chatHistory = [];
                 this._context.globalState.update('zenCoderChatHistory', []);
            } else {
                 this._chatHistory = [];
                 console.log("Initialized empty chat history.");
            }
        } catch (e: any) {
             console.error("Error loading or parsing chat history, starting fresh:", e);
             this._chatHistory = [];
             try {
                this._context.globalState.update('zenCoderChatHistory', []);
             } catch (updateError) {
                 console.error("Failed to clear corrupted history from global state:", updateError);
             }
        }

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview')]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        console.log("Webview HTML set.");

        webviewView.webview.onDidReceiveMessage(async (message: any) => {
            console.log("Received message from webview:", message.type);
            if (!this._aiService) {
                console.error("AiService is unexpectedly undefined in message handler.");
                vscode.window.showErrorMessage("Internal Error: AI Service not available.");
                return;
            }

            switch (message.type) {
                case 'sendMessage':
                    try {
                        const userCoreMessage: CoreMessage = { role: 'user', content: message.text };
                        if (!Array.isArray(this._chatHistory)) { this._chatHistory = []; }
                        this._chatHistory.push(userCoreMessage);
                        await this._context.globalState.update('zenCoderChatHistory', this._chatHistory);
                        console.log(`Saved history after user message. Count: ${this._chatHistory.length}`);

                        if (!this._aiService.getCurrentModelId()) {
                            this.postMessageToWebview({ type: 'addMessage', sender: 'assistant', text: 'Please select a model first in the settings.' });
                            this._chatHistory.pop(); // Remove invalid user message
                            await this._context.globalState.update('zenCoderChatHistory', this._chatHistory);
                            return;
                        }

                        const streamResult = await this._aiService.getAiResponseStream(message.text, this._chatHistory);
                        if (!streamResult) {
                            console.log("getAiResponseStream returned null, likely handled error.");
                            this._chatHistory.pop(); // Remove user message if stream failed immediately
                            await this._context.globalState.update('zenCoderChatHistory', this._chatHistory);
                            return;
                        }

                        this.postMessageToWebview({ type: 'startAssistantMessage', sender: 'assistant' });

                        // --- Stream Processing ---
                        const reader = streamResult.stream.getReader();
                        const decoder = new TextDecoder();
                        let buffer = '';
                        let isDone = false;

                        while (!isDone) {
                            try {
                                const { done, value } = await reader.read();
                                isDone = done;
                                if (done) break;

                                buffer += decoder.decode(value, { stream: true });
                                const lines = buffer.split('\n');
                                buffer = lines.pop() ?? '';

                                for (const line of lines) {
                                     if (line.trim() === '') continue;
                                     const match = line.match(/^([0-9a-zA-Z]):(.*)$/);
                                     if (match && match[1] && match[2]) {
                                         const prefix = match[1];
                                         const contentData = match[2];
                                         try {
                                             if (prefix >= '0' && prefix <= '7') { // Text/Error Chunks
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
                                             } else if (prefix === 'a') { // Tool Result (from SDK internal processing)
                                                 const part = JSON.parse(contentData);
                                                 if (part.toolCallId && part.result !== undefined && part.toolName) { // Ensure toolName is present
                                                     // Send UI update
                                                     this.postMessageToWebview({ type: 'toolStatusUpdate', toolCallId: part.toolCallId, status: 'complete', message: part.result, toolName: part.toolName });
                                                     // Add tool result to history
                                                     const toolResultMessage: CoreMessage = {
                                                         role: 'tool',
                                                         content: [{ type: 'tool-result', toolCallId: part.toolCallId, toolName: part.toolName, result: part.result }]
                                                     };
                                                     if (!Array.isArray(this._chatHistory)) { this._chatHistory = []; }
                                                     this._chatHistory.push(toolResultMessage);
                                                     await this._context.globalState.update('zenCoderChatHistory', this._chatHistory);
                                                     console.log(`Saved history after tool result for ${part.toolName}. Count: ${this._chatHistory.length}`);
                                                 } else { console.warn("Received tool result ('a') without complete data:", part); }
                                             } else if (prefix === 'd') { // Data/Annotations (e.g., custom tool progress/completion)
                                                  const part = JSON.parse(contentData);
                                                  if (part.type === 'message-annotation') {
                                                      const statusMessage = (typeof part.message === 'string') ? part.message : undefined;
                                                      // Send UI update
                                                      this.postMessageToWebview({ type: 'toolStatusUpdate', toolCallId: part.toolCallId, toolName: part.toolName, status: part.status, message: statusMessage });
                                                      // Also save tool result history when receiving annotation completion
                                                      if (part.status === 'complete' && part.toolCallId && part.toolName) {
                                                           const toolResultMessage: CoreMessage = {
                                                               role: 'tool',
                                                               content: [{ type: 'tool-result', toolCallId: part.toolCallId, toolName: part.toolName, result: statusMessage ?? 'Completed' }] // Use statusMessage or default
                                                           };
                                                           if (!Array.isArray(this._chatHistory)) { this._chatHistory = []; }
                                                           this._chatHistory.push(toolResultMessage);
                                                           await this._context.globalState.update('zenCoderChatHistory', this._chatHistory);
                                                           console.log(`Saved history after tool annotation result for ${part.toolName}. Count: ${this._chatHistory.length}`);
                                                      }
                                                  } else if (part.type === 'error') { vscode.window.showErrorMessage(`Stream Error: ${part.error}`); this.postMessageToWebview({ type: 'addMessage', sender: 'assistant', text: `Sorry, a stream error occurred: ${part.error}` }); }
                                             } else if (prefix === 'e') { // Events/Errors
                                                  const part = JSON.parse(contentData);
                                                  if (part.error) { vscode.window.showErrorMessage(`Stream Event Error: ${part.error}`); this.postMessageToWebview({ type: 'addMessage', sender: 'assistant', text: `Sorry, an error occurred: ${part.error}` }); }
                                             }
                                         } catch (e) { console.error(`Failed to parse JSON for prefix '${prefix}':`, contentData, e); }
                                     } else { if (line.trim() !== '') { console.warn('Received stream line without expected prefix format:', line); } }
                                }
                            } catch (readError) {
                                console.error("Error reading from stream:", readError);
                                this.postMessageToWebview({ type: 'addMessage', sender: 'assistant', text: `Error reading AI response stream.` });
                                isDone = true;
                            }
                        } // End while loop

                        // --- Finalize History ---
                        console.log("[Extension] Stream processing loop finished.");
                        this.postMessageToWebview({ type: 'streamFinished' });

                        const finalAssistantMessage = await streamResult.finalMessagePromise;
                        if (finalAssistantMessage) {
                             if (!Array.isArray(this._chatHistory)) { this._chatHistory = []; }
                            this._chatHistory.push(finalAssistantMessage);
                            // Save history *after* assistant message is finalized
                            await this._context.globalState.update('zenCoderChatHistory', this._chatHistory);
                            console.log(`Saved history after assistant message. Count: ${this._chatHistory.length}`);
                        } else {
                            console.warn("[Extension] No final assistant message object received from AiService promise.");
                            // Save history even if assistant didn't respond (e.g., only tool calls happened)
                            await this._context.globalState.update('zenCoderChatHistory', this._chatHistory);
                        }

                    } catch (error: any) {
                        console.error("Error processing AI stream:", error);
                        vscode.window.showErrorMessage(`Failed to get AI response: ${error.message}`);
                        this.postMessageToWebview({ type: 'addMessage', sender: 'assistant', text: `Sorry, an error occurred: ${error.message}` });
                        // Attempt to remove the failed user message from history
                        if (this._chatHistory[this._chatHistory.length - 1]?.role === 'user') {
                            this._chatHistory.pop();
                            await this._context.globalState.update('zenCoderChatHistory', this._chatHistory);
                        }
                    }
                    break; // End of 'sendMessage' case

                case 'webviewReady':
                    console.log('Webview view is ready');
                    console.log("[Extension] Webview ready, fetching initial state...");
                    try {
                        const models = await this._aiService.resolveAvailableModels();
                        this.postMessageToWebview({ type: 'availableModels', payload: models });
                        console.log("[Extension] Sent available models to webview.");
                        // Send loaded history
                        this.postMessageToWebview({ type: 'loadHistory', payload: Array.isArray(this._chatHistory) ? this._chatHistory : [] });
                        console.log("[Extension] Sent loaded history to webview.");
                        const statusList = await this._aiService.getProviderStatus();
                        this.postMessageToWebview({ type: 'providerStatus', payload: statusList });
                        console.log("[Extension] Sent provider status list to webview.");
                    } catch (error: any) {
                         console.error("[Extension] Error fetching initial state for webview:", error);
                         vscode.window.showErrorMessage(`Error fetching initial state: ${error.message}`);
                         this.postMessageToWebview({ type: 'availableModels', payload: [] });
                         this.postMessageToWebview({ type: 'providerStatus', payload: [] });
                         this.postMessageToWebview({ type: 'loadHistory', payload: [] });
                    }
                    break;
                // ... (other cases remain the same) ...
                 case 'setModel':
                    if (typeof message.modelId === 'string') {
                        this._aiService.setModel(message.modelId as any); // Cast might be needed
                        console.log(`Model changed to: ${message.modelId}`);
                    } else { console.error('Invalid modelId received', message); }
                    break;
                case 'getAvailableModels':
                    const currentModels = await this._aiService.resolveAvailableModels();
                    this.postMessageToWebview({ type: 'availableModels', payload: currentModels });
                    break;
                case 'getProviderStatus':
                    try {
                        console.log("[Extension] Received getProviderStatus request from webview.");
                        const currentStatusList = await this._aiService.getProviderStatus();
                        this.postMessageToWebview({ type: 'providerStatus', payload: currentStatusList });
                        console.log("[Extension] Sent updated provider status list to webview.");
                    } catch (error: any) {
                         console.error("[Extension] Error handling getProviderStatus request:", error);
                         vscode.window.showErrorMessage(`Error getting provider status: ${error.message}`);
                         this.postMessageToWebview({ type: 'providerStatus', payload: [] }); // Send empty array on error
                    }
                    break;
                case 'setProviderEnabled':
                    if (message.payload && typeof message.payload.provider === 'string' && typeof message.payload.enabled === 'boolean') {
                        const providerKeyInput = message.payload.provider;
                        const enabled = message.payload.enabled;
                        if (providerMap.has(providerKeyInput)) {
                             const providerKey = providerKeyInput as ApiProviderKey;
                            try {
                                const config = vscode.workspace.getConfiguration('zencoder.provider');
                                // Assuming config keys match provider IDs (e.g., 'anthropic.enabled')
                                await config.update(`${providerKey}.enabled`, enabled, vscode.ConfigurationTarget.Global);
                                console.log(`Provider ${String(providerKey)} enabled status updated to: ${enabled}`);
                                const updatedStatusList = await this._aiService.getProviderStatus();
                                this.postMessageToWebview({ type: 'providerStatus', payload: updatedStatusList });
                            } catch (error: any) {
                                console.error(`Failed to update provider setting for ${String(providerKey)}:`, error);
                                vscode.window.showErrorMessage(`Failed to update setting for ${String(providerKey)}: ${error.message}`);
                            }
                        } else { console.error(`Invalid provider key received in setProviderEnabled: ${providerKeyInput}`); }
                    } else { console.error("Invalid payload for setProviderEnabled:", message.payload); }
                    break;
                case 'setApiKey':
                    if (message.payload && typeof message.payload.provider === 'string' && typeof message.payload.apiKey === 'string') {
                        const providerKey = message.payload.provider as ApiProviderKey;
                        const apiKey = message.payload.apiKey;
                        if (providerMap.has(providerKey)) {
                            try {
                                await this._aiService.setApiKey(providerKey, apiKey);
                                console.log(`[Extension] API Key set request processed for ${providerKey}`);
                                const updatedStatusList = await this._aiService.getProviderStatus();
                                this.postMessageToWebview({ type: 'providerStatus', payload: updatedStatusList });
                            } catch (error: any) {
                                console.error(`[Extension] Error setting API Key for ${providerKey} (forwarded from AiService):`, error);
                            }
                        } else {
                            console.error(`[Extension] Invalid provider ID received in setApiKey: ${providerKey}`);
                            vscode.window.showErrorMessage(`Invalid provider ID: ${providerKey}`);
                        }
                    } else {
                        console.error("Invalid payload for setApiKey:", message.payload);
                    }
                    break;
                case 'deleteApiKey':
                    if (message.payload && typeof message.payload.provider === 'string') {
                        const providerId = message.payload.provider;
                        if (providerMap.has(providerId)) {
                            try {
                                await this._aiService.deleteApiKey(providerId);
                                console.log(`[Extension] API Key delete request processed for ${providerId}`);
                                const updatedStatusList = await this._aiService.getProviderStatus();
                                this.postMessageToWebview({ type: 'providerStatus', payload: updatedStatusList });
                            } catch (error: any) {
                                console.error(`[Extension] Error deleting API Key for ${providerId} (forwarded from AiService):`, error);
                            }
                        } else {
                            console.error(`[Extension] Invalid provider ID received in deleteApiKey: ${providerId}`);
                            vscode.window.showErrorMessage(`Invalid provider ID: ${providerId}`);
                        }
                    } else {
                        console.error("[Extension] Invalid payload for deleteApiKey:", message.payload);
                    }
                    break;
                default:
                    console.warn("[Extension] Received unknown message type from webview:", message.type);
            }
        });

        console.log("Webview view resolved and message listener attached.");
    }

    public postMessageToWebview(message: any) {
        if (this._view) {
            this._view.webview.postMessage(message);
        } else {
            console.warn("Attempted to post message to unresolved webview view:", message.type);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        return getWebviewContent(webview, this._extensionUri, this._extensionMode);
    }
}

// --- Helper Functions --- (getWebviewContent and getNonce remain unchanged)
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
