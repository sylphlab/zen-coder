import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
// Import necessary types from 'ai' SDK
import { CoreMessage, ToolCallPart as CoreToolCallPart, ToolResultPart as CoreToolResultPart, TextPart as CoreTextPart, AssistantContent } from 'ai';
import { AiService, ApiProviderKey } from './ai/aiService';
import { providerMap } from './ai/providers';

// --- Define UI Message Structure (Mirroring Frontend) ---
// Ideally, share this definition via a common types file
interface UiTextMessagePart { type: 'text'; text: string; }
interface UiToolCallPart { type: 'tool-call'; toolCallId: string; toolName: string; args: any; status?: 'pending' | 'running' | 'complete' | 'error'; result?: any; progress?: string; }
type UiMessageContentPart = UiTextMessagePart | UiToolCallPart;
interface UiMessage {
    id: string;
    sender: 'user' | 'assistant';
    content: UiMessageContentPart[];
    timestamp: number;
}
// --- End UI Message Structure Definition ---

let aiServiceInstance: AiService | undefined = undefined;

export async function activate(context: vscode.ExtensionContext) {
    console.log('--- Zen Coder Extension Activating ---');

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

    // Set callback for AiService to post messages back to webview
    aiServiceInstance.setPostMessageCallback((message: any) => {
        provider.postMessageToWebview(message);
    });
}

class ZenCoderChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'zencoder.views.chat';

    private _view?: vscode.WebviewView;
    private _aiService: AiService;
    private _context: vscode.ExtensionContext;
    private _extensionUri: vscode.Uri;
    private _extensionMode: vscode.ExtensionMode;
    // --- Use UI History as the single source of truth for persistence ---
    private _history: UiMessage[] = [];
    private readonly UI_HISTORY_KEY = 'zenCoderUiHistory'; // Define key for storage

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

        // --- Load UI History ---
        try {
            this._history = this._context.globalState.get<UiMessage[]>(this.UI_HISTORY_KEY, []);
            console.log(`Loaded ${this._history.length} messages from UI history (${this.UI_HISTORY_KEY}).`);
            // Basic validation for the loaded UI history structure
            if (!Array.isArray(this._history) || !this._history.every(msg => msg && msg.id && msg.sender && Array.isArray(msg.content))) {
                 console.warn("Loaded UI history is invalid or has unexpected structure. Clearing history.");
                 this._history = [];
                 this._context.globalState.update(this.UI_HISTORY_KEY, []);
            }
        } catch (e: any) {
            console.error("Error loading or parsing UI history, starting fresh:", e);
            this._history = [];
            try {
                this._context.globalState.update(this.UI_HISTORY_KEY, []);
            } catch (updateError) {
                console.error("Failed to clear corrupted UI history from global state:", updateError);
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
                        // --- Add user message to UI history ONLY ---
                        const userUiMessage: UiMessage = {
                            id: `user-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                            sender: 'user',
                            content: [{ type: 'text', text: message.text }],
                            timestamp: Date.now()
                        };
                        if (!Array.isArray(this._history)) { this._history = []; } // Ensure history is array
                        this._history.push(userUiMessage);
                        await this._context.globalState.update(this.UI_HISTORY_KEY, this._history);
                        console.log(`Saved user message to UI history. Count: ${this._history.length}`);

                        // --- Get modelId from message ---
                        const modelId = message.modelId;
                        if (!modelId) {
                             console.error("sendMessage handler did not receive a modelId.");
                             this.postMessageToWebview({ type: 'addMessage', sender: 'assistant', text: 'Error: No model ID specified in the request.' });
                             this._history.pop(); // Remove user message
                             await this._context.globalState.update(this.UI_HISTORY_KEY, this._history);
                             return; // Stop processing
                        }

                        // --- Translate UI History to CoreMessages for AI ---
                        const coreMessagesForAi = translateUiHistoryToCoreMessages(this._history);
                        console.log(`Translated ${this._history.length} UI messages to ${coreMessagesForAi.length} CoreMessages for AI.`);

                        // --- Get AI Response Stream using translated history AND the modelId ---
                        const streamResult = await this._aiService.getAiResponseStream(message.text, coreMessagesForAi, modelId); // Pass modelId
                        if (!streamResult) {
                            console.log("getAiResponseStream returned null, likely handled error.");
                            this._history.pop(); // Remove user message if stream failed immediately
                            await this._context.globalState.update(this.UI_HISTORY_KEY, this._history);
                            return;
                        }

                        // --- Add initial assistant message frame to UI history ---
                        const assistantUiMsgId = `asst-${Date.now()}-${Math.random().toString(16).slice(2)}`;
                        const initialAssistantUiMessage: UiMessage = {
                            id: assistantUiMsgId,
                            sender: 'assistant',
                            content: [], // Start empty
                            timestamp: Date.now()
                        };
                        if (!Array.isArray(this._history)) { this._history = []; }
                        this._history.push(initialAssistantUiMessage);
                        await this._context.globalState.update(this.UI_HISTORY_KEY, this._history); // Save initial frame
                        console.log(`Saved initial assistant message frame to UI history. Count: ${this._history.length}`);

                        // --- Send start signal *with* the ID of the UI message frame ---
                        this.postMessageToWebview({ type: 'startAssistantMessage', sender: 'assistant', messageId: assistantUiMsgId });

                        // --- Stream Processing ---
                        const reader = streamResult.stream.getReader();
                        const decoder = new TextDecoder();
                        let buffer = '';
                        let isDone = false;
                        let lastSavedUiHistoryJson = JSON.stringify(this._history); // Track last saved state to avoid redundant saves

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
                                             let historyChanged = false; // Flag to check if save is needed
                                             if (prefix >= '0' && prefix <= '7') { // Text/Error Chunks
                                                 const part = JSON.parse(contentData);
                                                 let textDelta = '';
                                                 if (typeof part === 'string') {
                                                     textDelta = part;
                                                     this.postMessageToWebview({ type: 'appendMessageChunk', sender: 'assistant', textDelta: part });
                                                 } else if (typeof part === 'object' && part?.type === 'text-delta') {
                                                     textDelta = part.textDelta;
                                                     this.postMessageToWebview({ type: 'appendMessageChunk', sender: 'assistant', textDelta: part.textDelta });
                                                 } else if (typeof part === 'object' && part?.type === 'error') {
                                                      vscode.window.showErrorMessage(`Stream Error: ${part.error}`); this.postMessageToWebview({ type: 'addMessage', sender: 'assistant', text: `Sorry, a stream error occurred: ${part.error}` });
                                                 }
                                                 // --- Append text chunk to UI history ---
                                                 if (textDelta && this._history.length > 0) {
                                                     const lastUiMessage = this._history.find(msg => msg.id === assistantUiMsgId); // Find by ID
                                                     if (lastUiMessage?.sender === 'assistant') {
                                                         if (!Array.isArray(lastUiMessage.content)) { lastUiMessage.content = []; }
                                                         const lastContentPart = lastUiMessage.content[lastUiMessage.content.length - 1];
                                                         if (lastContentPart?.type === 'text') {
                                                             lastContentPart.text += textDelta;
                                                         } else {
                                                             lastUiMessage.content.push({ type: 'text', text: textDelta });
                                                         }
                                                         historyChanged = true;
                                                     }
                                                 }
                                             } else if (prefix === '9') { // Tool Call
                                                 const part = JSON.parse(contentData);
                                                 if (part.toolCallId && part.toolName && part.args !== undefined) {
                                                     this.postMessageToWebview({ type: 'addToolCall', payload: { toolCallId: part.toolCallId, toolName: part.toolName, args: part.args } });
                                                     // --- Add tool call part to UI history ---
                                                     if (this._history.length > 0) {
                                                         const lastUiMessage = this._history.find(msg => msg.id === assistantUiMsgId); // Find by ID
                                                         if (lastUiMessage?.sender === 'assistant') {
                                                             if (!Array.isArray(lastUiMessage.content)) { lastUiMessage.content = []; }
                                                             const toolCallPart: UiToolCallPart = { type: 'tool-call', toolCallId: part.toolCallId, toolName: part.toolName, args: part.args, status: 'pending' };
                                                             lastUiMessage.content.push(toolCallPart);
                                                             historyChanged = true;
                                                         }
                                                     }
                                                 }
                                             } else if (prefix === 'a') { // Tool Result (from SDK internal processing)
                                                 const part = JSON.parse(contentData);
                                                 if (part.toolCallId && part.result !== undefined && part.toolName) {
                                                     // Send UI update
                                                     this.postMessageToWebview({ type: 'toolStatusUpdate', toolCallId: part.toolCallId, status: 'complete', message: part.result, toolName: part.toolName });
                                                     // --- Update tool status in UI history ---
                                                     if (this._history.length > 0) {
                                                         for (let i = this._history.length - 1; i >= 0; i--) { // Find relevant message
                                                             const msg = this._history[i];
                                                             if (msg.sender === 'assistant' && Array.isArray(msg.content)) {
                                                                 const toolCallIndex = msg.content.findIndex((p: any) => p.type === 'tool-call' && p.toolCallId === part.toolCallId);
                                                                 if (toolCallIndex !== -1) {
                                                                     const uiToolCallPart = msg.content[toolCallIndex] as UiToolCallPart;
                                                                     uiToolCallPart.status = 'complete';
                                                                     uiToolCallPart.result = part.result;
                                                                     historyChanged = true;
                                                                     break;
                                                                 }
                                                             }
                                                         }
                                                     }
                                                     // --- Tool result is NOT added to AI history here ---
                                                 } else { console.warn("Received tool result ('a') without complete data:", part); }
                                             } else if (prefix === 'd') { // Data/Annotations (e.g., custom tool progress/completion)
                                                   const part = JSON.parse(contentData);
                                                   if (part.type === 'message-annotation' && part.toolCallId && part.toolName) {
                                                       const statusMessage = (typeof part.message === 'string') ? part.message : undefined;
                                                       const finalStatus = part.status as 'complete' | 'error' | 'running';
                                                       // Send UI update
                                                       this.postMessageToWebview({ type: 'toolStatusUpdate', toolCallId: part.toolCallId, toolName: part.toolName, status: finalStatus, message: statusMessage });
                                                       // --- Update tool status/progress/result in UI history ---
                                                       if (this._history.length > 0) {
                                                            for (let i = this._history.length - 1; i >= 0; i--) { // Find relevant message
                                                                const msg = this._history[i];
                                                                if (msg.sender === 'assistant' && Array.isArray(msg.content)) {
                                                                    const toolCallIndex = msg.content.findIndex((p: any) => p.type === 'tool-call' && p.toolCallId === part.toolCallId);
                                                                    if (toolCallIndex !== -1) {
                                                                        const toolCallPart = msg.content[toolCallIndex] as UiToolCallPart;
                                                                        toolCallPart.status = finalStatus;
                                                                        if (finalStatus === 'complete' || finalStatus === 'error') {
                                                                            toolCallPart.result = statusMessage ?? (finalStatus === 'complete' ? 'Completed' : 'Error');
                                                                            toolCallPart.progress = undefined;
                                                                        } else if (finalStatus === 'running') {
                                                                            toolCallPart.progress = statusMessage;
                                                                        }
                                                                        historyChanged = true;
                                                                        break;
                                                                    }
                                                                }
                                                            }
                                                       }
                                                       // --- Tool result is NOT added to AI history here ---
                                                   } else if (part.type === 'error') {
                                                       vscode.window.showErrorMessage(`Stream Error: ${part.error}`);
                                                       this.postMessageToWebview({ type: 'addMessage', sender: 'assistant', text: `Sorry, a stream error occurred: ${part.error}` });
                                                       // Also update the last UI message to reflect the error
                                                       if (this._history.length > 0) {
                                                            const lastMsg = this._history.find(msg => msg.id === assistantUiMsgId); // Find by ID
                                                            if (lastMsg?.sender === 'assistant') {
                                                                if (!Array.isArray(lastMsg.content)) { lastMsg.content = []; }
                                                                lastMsg.content.push({ type: 'text', text: `\n[STREAM ERROR: ${part.error}]` });
                                                                historyChanged = true;
                                                            }
                                                       }
                                                   }
                                             } else if (prefix === 'e') { // Events/Errors
                                                  const part = JSON.parse(contentData);
                                                  if (part.error) { vscode.window.showErrorMessage(`Stream Event Error: ${part.error}`); this.postMessageToWebview({ type: 'addMessage', sender: 'assistant', text: `Sorry, an error occurred: ${part.error}` }); }
                                             }

                                             // --- Save UI history if changed ---
                                             if (historyChanged) {
                                                 const currentUiHistoryJson = JSON.stringify(this._history);
                                                 if (currentUiHistoryJson !== lastSavedUiHistoryJson) {
                                                     await this._context.globalState.update(this.UI_HISTORY_KEY, this._history);
                                                     lastSavedUiHistoryJson = currentUiHistoryJson;
                                                     // console.log(`Saved UI history after update.`); // Optional
                                                 }
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

                        // --- Stream finished ---
                        console.log("[Extension] Stream processing loop finished.");
                        this.postMessageToWebview({ type: 'streamFinished' });

                        // --- Final AI History Update (Only add final CoreMessage to AI context) ---
                        try {
                             const finalAssistantCoreMessage = await streamResult.finalMessagePromise;
                             if (finalAssistantCoreMessage) {
                                 console.log("[Extension] Final assistant CoreMessage received.");
                                 // --- Reconcile final UI state based on CoreMessage ---
                                 const uiMessageIndex = this._history.findIndex(msg => msg.id === assistantUiMsgId);
                                 if (uiMessageIndex !== -1) {
                                     const finalUiMessage = this._history[uiMessageIndex];
                                     let finalCoreText = "";
                                     let finalCoreToolCalls: CoreToolCallPart[] = [];

                                     if (typeof finalAssistantCoreMessage.content === 'string') {
                                         finalCoreText = finalAssistantCoreMessage.content;
                                     } else if (Array.isArray(finalAssistantCoreMessage.content)) {
                                         finalAssistantCoreMessage.content.forEach(part => {
                                             if (part.type === 'text') { finalCoreText += part.text; }
                                             else if (part.type === 'tool-call') { finalCoreToolCalls.push(part); }
                                         });
                                     }

                                     const reconstructedUiContent: UiMessageContentPart[] = [];
                                     finalCoreToolCalls.forEach(coreToolCall => {
                                         const existingUiToolCall = finalUiMessage.content.find(p => p.type === 'tool-call' && p.toolCallId === coreToolCall.toolCallId) as UiToolCallPart | undefined;
                                         reconstructedUiContent.push({
                                             type: 'tool-call',
                                             toolCallId: coreToolCall.toolCallId,
                                             toolName: coreToolCall.toolName,
                                             args: coreToolCall.args,
                                             status: existingUiToolCall?.status ?? 'complete', // Assume complete if final message exists
                                             result: existingUiToolCall?.result,
                                             progress: undefined // Clear progress
                                         });
                                     });
                                     if (finalCoreText) {
                                         reconstructedUiContent.push({ type: 'text', text: finalCoreText });
                                     }
                                     finalUiMessage.content = reconstructedUiContent;

                                     // Save the final reconciled UI message state
                                     const finalUiHistoryJson = JSON.stringify(this._history);
                                     if (finalUiHistoryJson !== lastSavedUiHistoryJson) {
                                         await this._context.globalState.update(this.UI_HISTORY_KEY, this._history);
                                         lastSavedUiHistoryJson = finalUiHistoryJson;
                                         console.log(`Saved final reconciled UI history state. Count: ${this._history.length}`);
                                     }
                                 } else {
                                      console.warn("[Extension] Could not find UI message frame to reconcile final state.");
                                 }
                             } else {
                                 console.warn("[Extension] No final assistant message object received from AiService promise. UI history might represent an incomplete final state if interrupted.");
                             }
                        } catch (finalMsgError) {
                             console.error("[Extension] Error retrieving final message from promise:", finalMsgError);
                        }

                    } catch (error: any) {
                        console.error("Error processing AI stream:", error);
                        vscode.window.showErrorMessage(`Failed to get AI response: ${error.message}`);
                        this.postMessageToWebview({ type: 'addMessage', sender: 'assistant', text: `Sorry, an error occurred: ${error.message}` });
                        // Attempt to remove the failed user message from UI history
                        if (this._history.length > 0 && this._history[this._history.length - 1]?.sender === 'user') {
                            this._history.pop();
                            await this._context.globalState.update(this.UI_HISTORY_KEY, this._history);
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
                        // Send loaded UI history
                        this.postMessageToWebview({ type: 'loadUiHistory', payload: this._history }); // Send UI history
                        console.log("[Extension] Sent loaded UI history to webview.");
                        const statusList = await this._aiService.getProviderStatus();
                        this.postMessageToWebview({ type: 'providerStatus', payload: statusList });
                        console.log("[Extension] Sent provider status list to webview.");
                    } catch (error: any) {
                         console.error("[Extension] Error fetching initial state for webview:", error);
                         vscode.window.showErrorMessage(`Error fetching initial state: ${error.message}`);
                         this.postMessageToWebview({ type: 'availableModels', payload: [] });
                         this.postMessageToWebview({ type: 'providerStatus', payload: [] });
                         this.postMessageToWebview({ type: 'loadUiHistory', payload: [] }); // Send empty UI history on error
                    }
                    break;
                // ... other cases remain the same ...
                 case 'setModel':
                    if (typeof message.modelId === 'string') {
                        this._aiService.setModel(message.modelId); // No cast needed
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

// --- History Translation Helper ---
function translateUiHistoryToCoreMessages(uiHistory: UiMessage[]): CoreMessage[] {
    const coreMessages: CoreMessage[] = [];
    for (const uiMsg of uiHistory) {
        if (uiMsg.sender === 'user') {
            // User message: Extract text content
            const userText = uiMsg.content.find(part => part.type === 'text')?.text || '';
            coreMessages.push({ role: 'user', content: userText });
        } else if (uiMsg.sender === 'assistant') {
            // Assistant message: Translate content parts and generate tool results
            const assistantContent: AssistantContent = []; // Use SDK's AssistantContent type
            const toolResultsForThisMsg: CoreToolResultPart[] = [];
            let hasContentForAi = false; // Track if this message should be sent to AI

            for (const part of uiMsg.content) {
                if (part.type === 'text') {
                    assistantContent.push({ type: 'text', text: part.text });
                    hasContentForAi = true;
                } else if (part.type === 'tool-call') {
                    // Add the tool call part (without UI status/result)
                    assistantContent.push({
                        type: 'tool-call',
                        toolCallId: part.toolCallId,
                        toolName: part.toolName,
                        args: part.args
                    });
                    hasContentForAi = true; // Tool call itself is content for AI
                    // If the tool call is marked complete/error in UI state, generate a tool result message
                    if (part.status === 'complete' || part.status === 'error') {
                        toolResultsForThisMsg.push({
                            type: 'tool-result',
                            toolCallId: part.toolCallId,
                            toolName: part.toolName,
                            result: part.result ?? (part.status === 'complete' ? 'Completed' : 'Error') // Use stored result or default
                        });
                    }
                    // Ignore pending/running tool calls for AI history translation
                }
            }

            // Only add assistant message if it has relevant content for the AI
            if (hasContentForAi && assistantContent.length > 0) {
                 coreMessages.push({ role: 'assistant', content: assistantContent });
                 // Add any corresponding tool results immediately after
                 if (toolResultsForThisMsg.length > 0) {
                     coreMessages.push({ role: 'tool', content: toolResultsForThisMsg });
                 }
            } else if (!hasContentForAi) {
                 console.log(`Skipping assistant message (ID: ${uiMsg.id}) with no AI-relevant content during translation.`);
            }
        }
    }
    return coreMessages;
}

// --- Other Helper Functions ---
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
                `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'self'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource};">
                 </head>`
            );

            return htmlContent;
        } catch (e: any) {
            console.error(`Error reading or processing production webview HTML from ${htmlPath.fsPath}: ${e}`);
            return `<html><body>Error loading webview content. Failed to read or process build output. Check console and ensure 'pnpm run build:webview' has run successfully. Path: ${htmlPath.fsPath} Error: ${e.message}</body></html>`;
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

export function deactivate() {}
