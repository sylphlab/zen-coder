import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AiService } from './ai/aiService'; // Import AiService
// Type definition for the keys used in AiService SECRET_KEYS
type ApiProviderKey = 'ANTHROPIC' | 'GOOGLE' | 'OPENROUTER' | 'DEEPSEEK';


let chatPanel: vscode.WebviewPanel | undefined = undefined;
let aiServiceInstance: AiService | undefined = undefined; // Hold AiService instance

// Make activate async to await AiService initialization
export async function activate(context: vscode.ExtensionContext) {

    console.log('Congratulations, your extension "minicoder" is now active!');

    // Placeholder function for executing MCP tools - replace with actual implementation if available
    const executeMcpToolPlaceholder = async (serverName: string, toolName: string, args: any): Promise<any> => {
        console.warn(`MCP Tool Execution Placeholder: Server=${serverName}, Tool=${toolName}, Args=`, args);
        // In a real scenario, this would interact with the MCP client/system
        // For now, return a placeholder error or mock response for the search tool
        if (serverName === 'brave-search' && toolName === 'brave_web_search') {
            return Promise.resolve([
                { title: 'Placeholder Result 1', url: '#', description: 'This is a placeholder result from the executeMcpToolPlaceholder function.' },
                { title: 'Placeholder Result 2', url: '#', description: 'Actual search requires external MCP integration.' }
            ]);
            // Or return an error:
            // return Promise.reject(new Error('MCP tool execution not implemented in this context.'));
        }
        return Promise.reject(new Error(`MCP tool ${serverName}/${toolName} execution not implemented.`));
    };

    // Instantiate and initialize AiService, passing the executor
    aiServiceInstance = new AiService(context, executeMcpToolPlaceholder);
    await aiServiceInstance.initialize(); // Wait for keys to be loaded

    // --- Register Chat Command ---
    const startChatCommand = vscode.commands.registerCommand('minicoder.startChat', () => {
        // Ensure AiService is ready before opening chat
        if (!aiServiceInstance) {
             vscode.window.showErrorMessage("AI Service is not yet initialized. Please wait a moment and try again.");
             return;
        }

        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (chatPanel) {
            chatPanel.reveal(column);
            return;
        }

        chatPanel = vscode.window.createWebviewPanel(
            'aiCoderChat',
            'AI Coder Chat',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview'), // Allow access to build output
                    vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview', 'assets') // Allow access to assets
                ]
            }
        );

        chatPanel.webview.html = getWebviewContent(chatPanel.webview, context.extensionUri);

        // Handle messages from the webview
        chatPanel.webview.onDidReceiveMessage(
            async message => { // Make handler async
                if (!aiServiceInstance) { // Redundant check, but safe
                    vscode.window.showErrorMessage("AI Service not initialized.");
                    return;
                }

                switch (message.type) {
                    case 'sendMessage':
                        try {
                            const streamResult = await aiServiceInstance.getAiResponseStream(message.text);

                            if (!streamResult) {
                                return; // Error handled in AiService
                            }

                            let fullResponse = "";
                            let toolCalls: any[] = [];
                            let toolResults: any[] = [];

                            // Send a message to start the assistant message container in the webview
                            chatPanel?.webview.postMessage({ type: 'startAssistantMessage', sender: 'assistant' });

                            for await (const part of streamResult.fullStream) {
                                switch (part.type) {
                                    case 'text-delta':
                                        fullResponse += part.textDelta;
                                        chatPanel?.webview.postMessage({ type: 'appendMessageChunk', sender: 'assistant', textDelta: part.textDelta });
                                        break;
                                    case 'tool-call':
                                        console.log('Tool call:', part);
                                        toolCalls.push(part);
                                        chatPanel?.webview.postMessage({ type: 'appendMessageChunk', sender: 'assistant', textDelta: `\n*Calling tool: ${part.toolName}...*\n` });
                                        break;
                                    case 'tool-result':
                                        console.log('Tool result:', part);
                                        toolResults.push(part);
                                         chatPanel?.webview.postMessage({ type: 'appendMessageChunk', sender: 'assistant', textDelta: `\n*Tool ${part.toolName} result received.*\n` });
                                        break;
                                }
                            }

                            // After stream finishes
                            if (fullResponse) {
                                aiServiceInstance.addAssistantResponseToHistory(fullResponse);
                            }
                            toolCalls.forEach(tc => aiServiceInstance?.addToolCallToHistory(tc));
                            toolResults.forEach(tr => aiServiceInstance?.addToolResultToHistory(tr));
                            // TODO: Persist history

                        } catch (error: any) {
                            console.error("Error processing AI stream:", error);
                            vscode.window.showErrorMessage(`Failed to get AI response: ${error.message}`);
                            chatPanel?.webview.postMessage({ type: 'addMessage', sender: 'assistant', text: `Sorry, an error occurred: ${error.message}` });
                        }
                        return;

                    case 'webviewReady':
                        console.log('Webview is ready');
                        // TODO: Send initial state
                        return;
                    case 'setModel':
                        if (aiServiceInstance && typeof message.modelId === 'string') {
                            // Validate modelId before setting (using AiService's internal list or a shared constant)
                            // For now, assume AiService.setModel handles validation
                            aiServiceInstance.setModel(message.modelId as any); // Cast needed if types don't perfectly align
                            console.log(`Model changed to: ${message.modelId}`);
                        } else {
                            console.error('Failed to set model: AiService not ready or invalid modelId', message);
                        }
                        return;
                }
            },
            undefined,
            context.subscriptions
        );

        chatPanel.onDidDispose(() => { chatPanel = undefined; }, null, context.subscriptions);
        context.subscriptions.push(chatPanel);
    });

    context.subscriptions.push(startChatCommand);

    // --- Register API Key Setting Commands ---
    const registerApiKeyCommand = (commandId: string, providerKey: ApiProviderKey, providerName: string) => {
        const disposable = vscode.commands.registerCommand(commandId, async () => {
            if (!aiServiceInstance) {
                vscode.window.showErrorMessage("AI Service not initialized.");
                return;
            }

            const apiKey = await vscode.window.showInputBox({
                prompt: `Enter your ${providerName} API Key`,
                password: true, // Mask the input
                ignoreFocusOut: true, // Keep input box open even if focus moves
                placeHolder: `Paste your ${providerName} key here`,
            });

            if (apiKey) {
                try {
                    await aiServiceInstance.setApiKey(providerKey, apiKey);
                    // Confirmation message is shown by AiService
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Failed to set ${providerName} API Key: ${error.message}`);
                }
            } else {
                vscode.window.showInformationMessage(`Set ${providerName} API Key cancelled.`);
            }
        });
        context.subscriptions.push(disposable);
    };

    registerApiKeyCommand('minicoder.setAnthropicKey', 'ANTHROPIC', 'Anthropic');
    registerApiKeyCommand('minicoder.setGoogleKey', 'GOOGLE', 'Google');
    registerApiKeyCommand('minicoder.setOpenRouterKey', 'OPENROUTER', 'OpenRouter');
    registerApiKeyCommand('minicoder.setDeepseekKey', 'DEEPSEEK', 'Deepseek');

} // End of activate function

// --- Helper Functions (getWebviewContent, getNonce) remain the same ---

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    // Path to the Vite build output
    const buildPath = vscode.Uri.joinPath(extensionUri, 'dist', 'webview');
    const htmlPath = vscode.Uri.joinPath(buildPath, 'index.html');
    const nonce = getNonce();

    // Get URIs for assets from the manifest (more robust than guessing paths)
    const manifestPath = vscode.Uri.joinPath(buildPath, 'manifest.json');
    let scriptUri: vscode.Uri | undefined;
    let styleUri: vscode.Uri | undefined;

    try {
        const manifestContent = fs.readFileSync(manifestPath.fsPath, 'utf8');
        const manifest = JSON.parse(manifestContent);
        // Find the entry JS and CSS files in the manifest
        // This assumes a single entry point named 'index.html' or similar
        const entryKey = Object.keys(manifest).find(key => manifest[key].isEntry);
        if (entryKey && manifest[entryKey]) {
             if (manifest[entryKey].file) {
                 scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(buildPath, manifest[entryKey].file));
             }
             if (manifest[entryKey].css && manifest[entryKey].css.length > 0) {
                 styleUri = webview.asWebviewUri(vscode.Uri.joinPath(buildPath, manifest[entryKey].css[0]));
             }
        } else {
            console.error("Could not find entry point in manifest.json");
            // Fallback to guessing paths (less reliable)
            scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(buildPath, 'assets', 'index.js')); // Adjust filename if needed
            styleUri = webview.asWebviewUri(vscode.Uri.joinPath(buildPath, 'assets', 'index.css')); // Adjust filename if needed
        }

    } catch (e) {
        console.error(`Error reading manifest.json: ${e}`);
        // Fallback to guessing paths if manifest fails
        scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(buildPath, 'assets', 'index.js')); // Adjust filename if needed
        styleUri = webview.asWebviewUri(vscode.Uri.joinPath(buildPath, 'assets', 'index.css')); // Adjust filename if needed
    }

    if (!scriptUri || !styleUri) {
         console.error("Failed to determine script or style URI for webview.");
         return `<html><body>Error loading webview assets. Check console and build output.</body></html>`;
    }

    try {

        let htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');

        // Inject URIs and CSP nonce
        // IMPORTANT: Adjust placeholders if your index.html structure differs
        htmlContent = htmlContent
            .replace(
                '</head>',
                `<link rel="stylesheet" href="${styleUri}">
                 <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; connect-src 'self';">
                 </head>`
            )
            .replace(
                '</body>',
                `<script type="module" nonce="${nonce}" src="${scriptUri}"></script>
                 </body>`
            );

        return htmlContent;
    } catch (e) {
        console.error(`Error reading webview HTML: ${e}`);
        return `<html><body>Error loading webview content. Check console.</body></html>`;
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

export function deactivate() {
    if (chatPanel) {
        chatPanel.dispose();
    }
}
