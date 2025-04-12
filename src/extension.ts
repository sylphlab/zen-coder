import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AiService, ApiProviderKey } from './ai/aiService';
import { providerMap } from './ai/providers'; // Import providerMap

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
    const provider = new ZenCoderChatViewProvider(context, aiServiceInstance); // Pass full context
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
    private _context: vscode.ExtensionContext; // Store context
    private _extensionUri: vscode.Uri;
    private _extensionMode: vscode.ExtensionMode;
    private _chatHistory: any[] = []; // Store chat history (use a proper type later)

    constructor(
        context: vscode.ExtensionContext, // Accept context
        aiService: AiService // Pass initialized AiService
    ) {
        this._context = context; // Store context
        this._extensionUri = context.extensionUri;
        this._extensionMode = context.extensionMode;
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
        // Load history when view is resolved
        this._chatHistory = this._context.globalState.get<any[]>('zenCoderChatHistory', []);
        console.log(`Loaded ${this._chatHistory.length} messages from history.`);

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
                        // Add user message to history (basic structure for now)
                        const userMessage = { sender: 'user', content: [{ type: 'text', text: message.text }], timestamp: Date.now() }; // Add ID later if needed by history structure
                        this._chatHistory.push(userMessage);
                        // Save history immediately after adding user message
                        await this._context.globalState.update('zenCoderChatHistory', this._chatHistory);
                        console.log(`Saved history after user message. Count: ${this._chatHistory.length}`);

                        // Ensure model is set before sending
                        if (!this._aiService.getCurrentModelId()) {
                            this.postMessageToWebview({ type: 'addMessage', sender: 'assistant', text: 'Please select a model first in the settings.' });
                            return;
                        }
                        // Pass current history to AI service
                        const streamResult = await this._aiService.getAiResponseStream(message.text, this._chatHistory);
                        if (!streamResult) {
                            console.log("getAiResponseStream returned null, likely handled error.");
                            return; // Error likely handled and message sent by AiService
                        }

                        this.postMessageToWebview({ type: 'startAssistantMessage', sender: 'assistant' });

                        // --- Stream Processing ---
                        const reader = streamResult.stream.getReader(); // Access the stream property
                        const decoder = new TextDecoder();
                        let buffer = '';
                        let isDone = false;

                        while (!isDone) {
                            try {
                                const { done, value } = await reader.read();
                                isDone = done;
                                if (done) break; // Exit loop if stream is done

                                buffer += decoder.decode(value, { stream: true }); // Use stream: true

                                const lines = buffer.split('\n');
                                buffer = lines.pop() ?? ''; // Keep the potentially incomplete last line

                                for (const line of lines) {
                                    if (line.trim() === '') continue;
                                    const match = line.match(/^([0-9a-zA-Z]):(.*)$/);
                                    // ... (rest of the line processing logic remains the same) ...
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
                                    // ... (rest of the line processing logic) ...
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
                            } catch (readError) {
                                console.error("Error reading from stream:", readError);
                                this.postMessageToWebview({ type: 'addMessage', sender: 'assistant', text: `Error reading AI response stream.` });
                                isDone = true; // Stop the loop on read error
                            }
                        } // End while loop

                        // --- Finalize History ---
                        console.log("[Extension] Stream processing loop finished.");
                        this.postMessageToWebview({ type: 'streamFinished' }); // Signal UI

                        // Await the final message from AiService
                        const finalAssistantMessage = await streamResult.finalMessagePromise;
                        if (finalAssistantMessage) {
                            this._chatHistory.push(finalAssistantMessage);
                            // TODO: Add logic to push tool results to history if needed,
                            // potentially by modifying AiService to include them in the final message promise resolution?
                            // For now, only assistant message content is added.
                            await this._context.globalState.update('zenCoderChatHistory', this._chatHistory);
                            console.log(`Saved history after assistant message. Count: ${this._chatHistory.length}`);
                        } else {
                            console.warn("[Extension] No final assistant message object received from AiService promise.");
                            // History only contains user message in this case.
                        }

                        // TODO: After stream finishes, get the complete assistant message object
                        // from AiService (requires AiService modification) and add it to _chatHistory, then save again.
                        // For now, history only saves user messages reliably.

                    } catch (error: any) {
                        console.error("Error processing AI stream:", error);
                        vscode.window.showErrorMessage(`Failed to get AI response: ${error.message}`);
                        this.postMessageToWebview({ type: 'addMessage', sender: 'assistant', text: `Sorry, an error occurred: ${error.message}` });
                        // Remove the user message we optimistically added if the stream fails immediately? Or handle downstream?
                        // For now, leave it.
                    }
                    break; // End of 'sendMessage' case

                case 'webviewReady':
                    console.log('Webview view is ready');
                    // Send initial state (models, provider status) - Use new methods
                    console.log("[Extension] Webview ready, fetching initial state...");
                    try {
                        const models = await this._aiService.resolveAvailableModels();
                        this.postMessageToWebview({ type: 'availableModels', payload: models });
                        console.log("[Extension] Sent available models to webview.");
                        // Send loaded history along with other initial state
                        this.postMessageToWebview({ type: 'loadHistory', payload: this._chatHistory });
                        console.log("[Extension] Sent loaded history to webview.");
                        // Fetch the new combined status list
                        const statusList = await this._aiService.getProviderStatus();
                        this.postMessageToWebview({ type: 'providerStatus', payload: statusList }); // Send the list
                        console.log("[Extension] Sent provider status list to webview.");
                    } catch (error: any) {
                         console.error("[Extension] Error fetching initial state for webview:", error);
                         vscode.window.showErrorMessage(`Error fetching initial state: ${error.message}`);
                         // Send empty state or error message?
                         this.postMessageToWebview({ type: 'availableModels', payload: [] });
                         this.postMessageToWebview({ type: 'providerStatus', payload: {} });
                    }
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
                case 'getProviderStatus': // Handle settings request (e.g., refresh)
                    try {
                        console.log("[Extension] Received getProviderStatus request from webview.");
                        // Fetch the new combined status list
                        const currentStatusList = await this._aiService.getProviderStatus();
                        this.postMessageToWebview({ type: 'providerStatus', payload: currentStatusList }); // Send the list
                        console.log("[Extension] Sent updated provider status list to webview.");
                    } catch (error: any) {
                         console.error("[Extension] Error handling getProviderStatus request:", error);
                         vscode.window.showErrorMessage(`Error getting provider status: ${error.message}`);
                         this.postMessageToWebview({ type: 'providerStatus', payload: {} }); // Send empty status on error
                    }
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
                                // Send updated status list back
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
                        // Validate providerKey against known provider IDs from the map
                        if (providerMap.has(providerKey)) {
                            try {
                                // Delegate directly to AiService, which now handles provider lookup
                                await this._aiService.setApiKey(providerKey, apiKey); // AiService handles confirmation now
                                console.log(`[Extension] API Key set request processed for ${providerKey}`);
                                // Send updated status back to reflect the change
                                const updatedStatusList = await this._aiService.getProviderStatus();
                                this.postMessageToWebview({ type: 'providerStatus', payload: updatedStatusList });
                                // Confirmation message handled by AiService now
                            } catch (error: any) {
                                // Error message handled by AiService now
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
                                await this._aiService.deleteApiKey(providerId); // AiService handles confirmation now
                                console.log(`[Extension] API Key delete request processed for ${providerId}`);
                                // Send updated status back
                                const updatedStatusList = await this._aiService.getProviderStatus();
                                this.postMessageToWebview({ type: 'providerStatus', payload: updatedStatusList });
                                // Confirmation message handled by AiService
                            } catch (error: any) {
                                // Error message handled by AiService
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
        // Pass context to getWebviewContent if needed, but it's not currently used there
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
