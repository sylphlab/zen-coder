import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AiService } from './ai/aiService'; // Import AiService
// Removed incorrect readDataStream import
// Type definition for the keys used in AiService SECRET_KEYS
type ApiProviderKey = 'ANTHROPIC' | 'GOOGLE' | 'OPENROUTER' | 'DEEPSEEK';


let chatPanel: vscode.WebviewPanel | undefined = undefined;
let aiServiceInstance: AiService | undefined = undefined; // Hold AiService instance

// Make activate async to await AiService initialization
export async function activate(context: vscode.ExtensionContext) {

    console.log('Congratulations, your extension "zencoder" is now active!');

    // Instantiate and initialize AiService.
    // MCP tool execution will be handled internally by AiService if an MCP client is configured.
    aiServiceInstance = new AiService(context);
    await aiServiceInstance.initialize(); // Wait for keys to be loaded

    // --- Register Chat Command ---
    const startChatCommand = vscode.commands.registerCommand('zencoder.startChat', () => {
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
                // IMPORTANT: Allow loading content ONLY from the Vite build output directory
                localResourceRoots: [ vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview') ]
            }
        );

        // Pass extensionMode to getWebviewContent
        chatPanel.webview.html = getWebviewContent(chatPanel.webview, context.extensionUri, context.extensionMode);

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

                            // Send a message to start the assistant message container in the webview
                            chatPanel?.webview.postMessage({ type: 'startAssistantMessage', sender: 'assistant' });

                            // Process the stream using Web Streams API
                            if (!streamResult.body) {
                                throw new Error("Response body is null");
                            }
                            const reader = streamResult.body.getReader();
                            const decoder = new TextDecoder();
                            let buffer = '';
                            let isDone = false;

                            while (!isDone) {
                                const { done, value } = await reader.read();
                                isDone = done;
                                buffer += decoder.decode(value, { stream: !isDone }); // Decode chunk

                                // Process complete lines (JSON objects separated by newline)
                                const lines = buffer.split('\n');
                                buffer = lines.pop() ?? ''; // Keep the last potentially incomplete line

                                for (const line of lines) {
                                    if (line.trim() === '') continue;
                                    // Match the prefix (e.g., '0:', '1:', '2:') and the JSON data
                                    const match = line.match(/^(\d+):(.*)$/);
                                    if (match && match[2]) {
                                        const jsonData = match[2];
                                        try {
                                            const part = JSON.parse(jsonData); // Parse the JSON part after the prefix

                                            // Process the parsed part based on its type
                                            switch (part.type) {
                                                case 'text-delta':
                                                    chatPanel?.webview.postMessage({ type: 'appendMessageChunk', sender: 'assistant', textDelta: part.textDelta });
                                                    break;
                                                case 'tool-call':
                                                    console.log('Tool call received in stream:', part);
                                                    break;
                                                case 'tool-result':
                                                    console.log('Tool result received in stream:', part);
                                                    break;
                                                case 'message-annotation':
                                                    console.log('Message annotation (tool status):', part);
                                                    // Ensure message exists and is a string before sending
                                                    const statusMessage = (typeof part.message === 'string') ? part.message : undefined;
                                                    chatPanel?.webview.postMessage({
                                                        type: 'toolStatusUpdate',
                                                        toolCallId: part.toolCallId,
                                                        toolName: part.toolName,
                                                        status: part.status,
                                                        message: statusMessage // Send validated message
                                                    });
                                                    break;
                                                case 'error':
                                                    console.error('Error received in stream:', part.error);
                                                    vscode.window.showErrorMessage(`Stream Error: ${part.error}`);
                                                    chatPanel?.webview.postMessage({ type: 'addMessage', sender: 'assistant', text: `Sorry, a stream error occurred: ${part.error}` });
                                                    break;
                                                // Other types like 'finish' are implicitly handled by the loop ending
                                            }
                                        } catch (e) {
                                            console.error('Failed to parse stream chunk JSON:', jsonData, e);
                                            // Handle parsing error
                                        }
                                    } else {
                                        // Handle lines that don't match the expected format (e.g., could be metadata lines)
                                        console.warn('Received stream line without expected prefix:', line);
                                    }
                                } // End for loop processing lines
                            } // End while loop reading stream

                            // Process any remaining buffer content
                            // Attempt to parse the remaining buffer only if it's not empty and seems like JSON
                            if (buffer.trim().startsWith('{') && buffer.trim().endsWith('}')) {
                                try {
                                    const part = JSON.parse(buffer);
                                    // Process the final part (repeat switch logic if necessary)
                                    switch (part.type) {
                                        case 'text-delta': chatPanel?.webview.postMessage({ type: 'appendMessageChunk', sender: 'assistant', textDelta: part.textDelta }); break;
                                        case 'message-annotation':
                                             const statusMessage = (typeof part.message === 'string') ? part.message : undefined;
                                             chatPanel?.webview.postMessage({ type: 'toolStatusUpdate', toolCallId: part.toolCallId, toolName: part.toolName, status: part.status, message: statusMessage });
                                             break;
                                        case 'error': vscode.window.showErrorMessage(`Stream Error: ${part.error}`); chatPanel?.webview.postMessage({ type: 'addMessage', sender: 'assistant', text: `Sorry, a stream error occurred: ${part.error}` }); break;
                                        default: console.log("Final buffer part:", part); // Log other types
                                    }
                                } catch (e) {
                                    console.error('Failed to parse final stream buffer:', buffer, e);
                                }
                            } else if (buffer.trim() !== '') {
                                console.warn('Non-JSON content in final stream buffer:', buffer);
                            }

                            // History updates are handled by the onFinish callback in AiService
                            // TODO: Persist history

                        } catch (error: any) { // Catch block for the main try block in 'sendMessage'
                            console.error("Error processing AI stream:", error);
                            vscode.window.showErrorMessage(`Failed to get AI response: ${error.message}`);
                            chatPanel?.webview.postMessage({ type: 'addMessage', sender: 'assistant', text: `Sorry, an error occurred: ${error.message}` });
                        }
                        return; // End of 'sendMessage' case

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
                } // End switch (message.type)
            }, // End onDidReceiveMessage handler
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

    registerApiKeyCommand('zencoder.setAnthropicKey', 'ANTHROPIC', 'Anthropic');
    registerApiKeyCommand('zencoder.setGoogleKey', 'GOOGLE', 'Google');
    registerApiKeyCommand('zencoder.setOpenRouterKey', 'OPENROUTER', 'OpenRouter');
    registerApiKeyCommand('zencoder.setDeepseekKey', 'DEEPSEEK', 'Deepseek');

} // End of activate function

// --- Helper Functions ---

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, extensionMode: vscode.ExtensionMode): string {
    const nonce = getNonce();
    const isDevelopment = extensionMode === vscode.ExtensionMode.Development;
    const viteDevServerUrl = 'http://localhost:5173'; // Default Vite port for webview-ui

    console.log(`Getting webview content. Development mode: ${isDevelopment}`);

    if (isDevelopment) {
        // Development mode: Load from Vite dev server for HMR
        console.log(`Loading webview from Vite dev server: ${viteDevServerUrl}`);
        // CSP needs to allow connection to the dev server and inline styles (Vite might inject some)
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Coder (Dev)</title>
    <meta http-equiv="Content-Security-Policy" content="
        default-src 'none';
        style-src 'unsafe-inline' ${webview.cspSource} ${viteDevServerUrl};
        script-src 'nonce-${nonce}' ${viteDevServerUrl};
        connect-src ${viteDevServerUrl} ws://${viteDevServerUrl.split('//')[1]};
        img-src ${webview.cspSource} data: ${viteDevServerUrl};
        font-src ${webview.cspSource} ${viteDevServerUrl};
    ">
    <script type="module" nonce="${nonce}" src="${viteDevServerUrl}/@vite/client"></script>
    <script type="module" nonce="${nonce}" src="${viteDevServerUrl}/src/main.tsx"></script>
</head>
<body>
    <div id="root">Loading UI from Dev Server...</div>
</body>
</html>`;

    } else {
        // Production mode: Load from build output
        console.log("Loading webview from dist/webview");
        const buildPath = vscode.Uri.joinPath(extensionUri, 'dist', 'webview');
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
        } catch (e) {
            console.error(`Error reading or processing production webview HTML from ${htmlPath.fsPath}: ${e}`);
            return `<html><body>Error loading webview content. Failed to read or process build output. Check console and ensure 'pnpm run build:webview' has run successfully. Path: ${htmlPath.fsPath} Error: ${e}</body></html>`;
        }
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
