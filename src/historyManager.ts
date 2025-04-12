import * as vscode from 'vscode';
import { CoreMessage, ToolCallPart as CoreToolCallPart, ToolResultPart as CoreToolResultPart, AssistantContent } from 'ai';
import { UiMessage, UiMessageContentPart, UiToolCallPart, UiTextMessagePart } from './common/types'; // Import UI types

/**
 * Manages the chat history, including persistence and translation
 * between UI format (UiMessage) and AI SDK format (CoreMessage).
 */
export class HistoryManager {
    private _history: UiMessage[] = [];
    private readonly UI_HISTORY_KEY = 'zenCoderUiHistory'; // Key for VS Code global state
    private _context: vscode.ExtensionContext;
    private _lastSavedHistoryJson: string = '[]'; // Track last saved state to avoid redundant saves

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
        this.loadHistory();
    }

    /**
     * Loads history from VS Code global state.
     */
    public loadHistory(): void {
        try {
            this._history = this._context.globalState.get<UiMessage[]>(this.UI_HISTORY_KEY, []);
            console.log(`Loaded ${this._history.length} messages from UI history (${this.UI_HISTORY_KEY}).`);
            // Basic validation
            if (!Array.isArray(this._history) || !this._history.every(msg => msg && msg.id && msg.sender && Array.isArray(msg.content))) {
                 console.warn("Loaded UI history is invalid or has unexpected structure. Clearing history.");
                 this._history = [];
                 this._context.globalState.update(this.UI_HISTORY_KEY, []);
            }
            this._lastSavedHistoryJson = JSON.stringify(this._history); // Update tracker
        } catch (e: any) {
            console.error("Error loading or parsing UI history, starting fresh:", e);
            this._history = [];
            try {
                this._context.globalState.update(this.UI_HISTORY_KEY, []);
            } catch (updateError) {
                console.error("Failed to clear corrupted UI history from global state:", updateError);
            }
            this._lastSavedHistoryJson = '[]'; // Reset tracker
        }
    }

    /**
     * Saves the current history to VS Code global state if it has changed.
     */
    private async saveHistoryIfNeeded(): Promise<void> {
        try {
            const currentHistoryJson = JSON.stringify(this._history);
            if (currentHistoryJson !== this._lastSavedHistoryJson) {
                await this._context.globalState.update(this.UI_HISTORY_KEY, this._history);
                this._lastSavedHistoryJson = currentHistoryJson;
                // console.log(`Saved UI history. Count: ${this._history.length}`); // Optional: Verbose logging
            }
        } catch (error) {
            console.error("Failed to save UI history:", error);
            // Consider notifying the user or implementing retry logic if critical
        }
    }

    /**
     * Gets the current history in UI format.
     */
    public getHistory(): UiMessage[] {
        return this._history;
    }

    /**
     * Adds a user message to the history and saves.
     */
    public async addUserMessage(text: string): Promise<string> {
        const userUiMessage: UiMessage = {
            id: `user-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            sender: 'user',
            content: [{ type: 'text', text: text }],
            timestamp: Date.now()
        };
        if (!Array.isArray(this._history)) { this._history = []; } // Ensure history is array
        this._history.push(userUiMessage);
        await this.saveHistoryIfNeeded();
        console.log(`Added user message to UI history. Count: ${this._history.length}`);
        return userUiMessage.id;
    }

    /**
     * Adds an initial, empty assistant message frame to the history and saves.
     * Returns the ID of the created message frame.
     */
    public async addAssistantMessageFrame(): Promise<string> {
        const assistantUiMsgId = `asst-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const initialAssistantUiMessage: UiMessage = {
            id: assistantUiMsgId,
            sender: 'assistant',
            content: [], // Start empty
            timestamp: Date.now()
        };
        if (!Array.isArray(this._history)) { this._history = []; }
        this._history.push(initialAssistantUiMessage);
        await this.saveHistoryIfNeeded();
        console.log(`Added initial assistant message frame to UI history. Count: ${this._history.length}`);
        return assistantUiMsgId;
    }

    /**
     * Appends a text chunk to the assistant message specified by ID.
     */
    public async appendTextChunk(assistantMessageId: string, textDelta: string): Promise<void> {
        const message = this._history.find(msg => msg.id === assistantMessageId);
        if (message?.sender === 'assistant') {
            if (!Array.isArray(message.content)) { message.content = []; }
            const lastContentPart = message.content[message.content.length - 1];
            if (lastContentPart?.type === 'text') {
                lastContentPart.text += textDelta;
            } else {
                message.content.push({ type: 'text', text: textDelta });
            }
            await this.saveHistoryIfNeeded();
        } else {
            console.warn(`HistoryManager: Could not find assistant message with ID ${assistantMessageId} to append text chunk.`);
        }
    }

    /**
     * Adds a tool call part to the assistant message specified by ID.
     */
    public async addToolCall(assistantMessageId: string, toolCallId: string, toolName: string, args: any): Promise<void> {
        const message = this._history.find(msg => msg.id === assistantMessageId);
        if (message?.sender === 'assistant') {
            if (!Array.isArray(message.content)) { message.content = []; }
            const toolCallPart: UiToolCallPart = { type: 'tool-call', toolCallId, toolName, args, status: 'pending' };
            message.content.push(toolCallPart);
            await this.saveHistoryIfNeeded();
        } else {
            console.warn(`HistoryManager: Could not find assistant message with ID ${assistantMessageId} to add tool call.`);
        }
    }

    /**
     * Updates the status, result, or progress of a specific tool call within the history.
     */
    public async updateToolStatus(toolCallId: string, status: 'running' | 'complete' | 'error', resultOrProgress?: any): Promise<void> {
        let historyChanged = false;
        for (let i = this._history.length - 1; i >= 0; i--) {
            const msg = this._history[i];
            if (msg.sender === 'assistant' && Array.isArray(msg.content)) {
                const toolCallIndex = msg.content.findIndex((p: any) => p.type === 'tool-call' && p.toolCallId === toolCallId);
                if (toolCallIndex !== -1) {
                    const toolCallPart = msg.content[toolCallIndex] as UiToolCallPart;
                    toolCallPart.status = status;
                    if (status === 'complete' || status === 'error') {
                        toolCallPart.result = resultOrProgress ?? (status === 'complete' ? 'Completed' : 'Error');
                        toolCallPart.progress = undefined; // Clear progress on completion/error
                    } else if (status === 'running') {
                        toolCallPart.progress = typeof resultOrProgress === 'string' ? resultOrProgress : toolCallPart.progress; // Update progress if string
                    }
                    historyChanged = true;
                    break; // Found and updated
                }
            }
        }
        if (historyChanged) {
            await this.saveHistoryIfNeeded();
        } else {
             console.warn(`HistoryManager: Could not find tool call with ID ${toolCallId} to update status.`);
        }
    }

     /**
     * Reconciles the final state of an assistant message. It uses the text accumulated
     * via `appendTextChunk` as the primary source for the final text content, ensuring
     * that even interrupted streams are recorded correctly. It uses the optional
     * `finalCoreMessage` (if provided by the SDK upon successful completion) primarily
     * to get the definitive list of tool calls intended by the AI.
     * @param assistantMessageId The ID of the assistant message to reconcile.
     * @param finalCoreMessage The final CoreMessage from the SDK (can be null if stream failed or didn't produce one).
     */
    public async reconcileFinalAssistantMessage(assistantMessageId: string, finalCoreMessage: CoreMessage | null): Promise<void> {
        // Find the UI message frame
        const uiMessageIndex = this._history.findIndex(msg => msg.id === assistantMessageId);
        if (uiMessageIndex === -1) {
            console.warn(`[HistoryManager] Could not find UI message frame (ID: ${assistantMessageId}) to reconcile final state.`);
            return;
        }

        const finalUiMessage = this._history[uiMessageIndex];
        let finalCoreToolCalls: CoreToolCallPart[] = []; // Get tool calls from finalCoreMessage if available

        // 1. Extract accumulated text from the existing UI message content parts
        // This is the most reliable source, especially for interrupted streams.
        const finalAccumulatedText = finalUiMessage.content.filter(part => part.type === 'text').map(part => part.text).join('');

        // 2. Extract tool calls ONLY from the finalCoreMessage (if provided and valid)
        //    We trust the finalCoreMessage for the definitive list of tool calls the AI intended.
        if (finalCoreMessage && finalCoreMessage.role === 'assistant' && Array.isArray(finalCoreMessage.content)) {
            finalCoreMessage.content.forEach(part => {
                if (part.type === 'tool-call') {
                    finalCoreToolCalls.push(part);
                }
                // We IGNORE text parts from finalCoreMessage now
            });
        } else if (finalCoreMessage) {
             console.warn(`[HistoryManager] Received finalCoreMessage for reconcile, but it's not a valid assistant message with array content. ID: ${assistantMessageId}. Tool calls might be missing.`);
        }

        // 3. Reconstruct the UI content
        const reconstructedUiContent: UiMessageContentPart[] = [];

        // Add tool calls first, preserving their last known status/result from the UI history
        finalCoreToolCalls.forEach(coreToolCall => {
            const existingUiToolCall = finalUiMessage.content.find(p => p.type === 'tool-call' && p.toolCallId === coreToolCall.toolCallId) as UiToolCallPart | undefined;
            reconstructedUiContent.push({
                type: 'tool-call',
                toolCallId: coreToolCall.toolCallId,
                toolName: coreToolCall.toolName,
                args: coreToolCall.args,
                status: existingUiToolCall?.status ?? 'complete', // Preserve status/result if available
                result: existingUiToolCall?.result,
                progress: undefined // Clear progress
            });
        });

        // Add the final accumulated text content (from appendTextChunk)
        if (finalAccumulatedText) {
            reconstructedUiContent.push({ type: 'text', text: finalAccumulatedText });
        } else {
            // If somehow no text was accumulated, log a warning.
            // We won't use finalText from streamResult.text as it might be unreliable on interruption.
            console.warn(`[HistoryManager] No accumulated text found for message ID: ${assistantMessageId} during reconcile.`);
        }

        // Replace the old content with the reconciled content
        finalUiMessage.content = reconstructedUiContent;

        // Save the final reconciled UI message state
        await this.saveHistoryIfNeeded();
        console.log(`[HistoryManager] Reconciled final UI state for message ID: ${assistantMessageId} using accumulated text.`);
    }


    /**
     * Clears the chat history both in memory and in persistent storage.
     */
    public async clearHistory(): Promise<void> {
        this._history = [];
        this._lastSavedHistoryJson = '[]'; // Reset tracker
        try {
            await this._context.globalState.update(this.UI_HISTORY_KEY, []);
            console.log("[HistoryManager] Cleared UI history in global state.");
        } catch (error: any) {
            console.error("[HistoryManager] Failed to clear UI history from global state:", error);
            vscode.window.showErrorMessage(`Failed to clear chat history: ${error.message}`);
        }
    }

    /**
     * Translates the current UI history (UiMessage[]) into the format
     * required by the Vercel AI SDK (CoreMessage[]).
     * Includes user messages, assistant messages (text/tool calls),
     * and corresponding tool results derived from the UI state.
     */
    public translateUiHistoryToCoreMessages(): CoreMessage[] {
        const coreMessages: CoreMessage[] = [];
        for (const uiMsg of this._history) {
            if (uiMsg.sender === 'user') {
                // User message: Extract text content
                const userText = uiMsg.content.find((part): part is UiTextMessagePart => part.type === 'text')?.text || '';
                if (userText) { // Only add if there's text
                     coreMessages.push({ role: 'user', content: userText });
                }
            } else if (uiMsg.sender === 'assistant') {
                // Assistant message: Translate content parts and generate tool results
                const assistantContent: AssistantContent = []; // Use SDK's AssistantContent type
                const toolResultsForThisMsg: CoreToolResultPart[] = [];
                let hasContentForAi = false; // Track if this message should be sent to AI

                for (const part of uiMsg.content) {
                    if (part.type === 'text') {
                        if (part.text) { // Only add non-empty text parts
                            assistantContent.push({ type: 'text', text: part.text });
                            hasContentForAi = true;
                        }
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
                     console.log(`[HistoryManager] Skipping assistant message (ID: ${uiMsg.id}) with no AI-relevant content during translation.`);
                }
            }
        }
        return coreMessages;
    }
}