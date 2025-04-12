import * as vscode from 'vscode';
import { AiServiceResponse } from './ai/aiService'; // Use the correct exported type
import { HistoryManager } from './historyManager';

/**
 * Processes the AI response stream, updates history, and posts messages to the webview.
 */
export class StreamProcessor {
    private _historyManager: HistoryManager;
    private _postMessageCallback: (message: any) => void;

    constructor(historyManager: HistoryManager, postMessageCallback: (message: any) => void) {
        this._historyManager = historyManager;
        this._postMessageCallback = postMessageCallback;
    }

    /**
     * Processes the stream from the AI service.
     * @param streamResult The result object from AiService.getAiResponseStream (must not be null).
     * @param assistantMessageId The ID of the UI message frame for this response.
     */
    public async process(streamResult: AiServiceResponse, assistantMessageId: string): Promise<void> {
        const reader = streamResult.stream.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let isDone = false;

        console.log(`[StreamProcessor] Starting processing for message ID: ${assistantMessageId}`);

        while (!isDone) {
            try {
                const { done, value } = await reader.read();
                isDone = done;
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? ''; // Keep the potentially incomplete last line

                for (const line of lines) {
                    if (line.trim() === '') continue;
                    const match = line.match(/^([0-9a-zA-Z]):(.*)$/); // Match prefix and content
                    if (match && match[1] && match[2]) {
                        const prefix = match[1];
                        const contentData = match[2];
                        try {
                            await this.handleStreamPart(prefix, contentData, assistantMessageId);
                        } catch (parseError) {
                            console.error(`[StreamProcessor] Failed to parse JSON for prefix '${prefix}':`, contentData, parseError);
                        }
                    } else if (line.trim() !== '') {
                        console.warn('[StreamProcessor] Received stream line without expected prefix format:', line);
                    }
                }
            } catch (readError) {
                console.error("[StreamProcessor] Error reading from stream:", readError);
                this._postMessageCallback({ type: 'addMessage', sender: 'assistant', text: `Error reading AI response stream.` });
                isDone = true; // Stop processing on read error
            }
        } // End while loop

        console.log(`[StreamProcessor] Stream processing loop finished for message ID: ${assistantMessageId}.`);
        this._postMessageCallback({ type: 'streamFinished' });

        // --- Final AI History Update ---
        try {
            const finalAssistantCoreMessage = await streamResult.finalMessagePromise;
            console.log(`[StreamProcessor] Received final CoreMessage for ID: ${assistantMessageId}`);
            await this._historyManager.reconcileFinalAssistantMessage(assistantMessageId, finalAssistantCoreMessage);
        } catch (finalMsgError) {
            console.error(`[StreamProcessor] Error retrieving or reconciling final message for ID ${assistantMessageId}:`, finalMsgError);
            // The UI history might be slightly inconsistent if reconciliation fails
        }
    }

    /**
     * Handles a single parsed part of the stream based on its prefix.
     */
    private async handleStreamPart(prefix: string, contentData: string, assistantMessageId: string): Promise<void> {
        const part = JSON.parse(contentData);
        // console.log(`[StreamProcessor] Handling Prefix ${prefix}, Parsed Part:`, JSON.stringify(part).substring(0, 200)); // Verbose logging

        if (prefix >= '0' && prefix <= '7') { // Text/Error Chunks
            let textDelta = '';
            if (typeof part === 'string') {
                textDelta = part;
            } else if (typeof part === 'object' && part?.type === 'text-delta') {
                textDelta = part.textDelta;
            } else if (typeof part === 'object' && part?.type === 'error') {
                console.error(`[StreamProcessor] Received stream error part: ${part.error}`);
                vscode.window.showErrorMessage(`Stream Error: ${part.error}`);
                this._postMessageCallback({ type: 'addMessage', sender: 'assistant', text: `Sorry, a stream error occurred: ${part.error}` });
                // Append error to history as text
                await this._historyManager.appendTextChunk(assistantMessageId, `\n[STREAM ERROR: ${part.error}]`);
                return; // Stop processing this part
            } else {
                console.warn(`[StreamProcessor] Unhandled part structure for prefix ${prefix}:`, JSON.stringify(part));
                return;
            }

            if (textDelta) {
                // console.log(`[StreamProcessor] Sending appendMessageChunk: ${JSON.stringify(textDelta)}`); // Verbose
                this._postMessageCallback({ type: 'appendMessageChunk', sender: 'assistant', textDelta: textDelta });
                await this._historyManager.appendTextChunk(assistantMessageId, textDelta);
            }
        } else if (prefix === '9') { // Tool Call
            if (part.toolCallId && part.toolName && part.args !== undefined) {
                this._postMessageCallback({ type: 'addToolCall', payload: { toolCallId: part.toolCallId, toolName: part.toolName, args: part.args } });
                await this._historyManager.addToolCall(assistantMessageId, part.toolCallId, part.toolName, part.args);
            } else {
                 console.warn("[StreamProcessor] Received tool call ('9') without complete data:", part);
            }
        } else if (prefix === 'a') { // Tool Result (from SDK internal processing - often redundant if 'd' is used)
            if (part.toolCallId && part.result !== undefined && part.toolName) {
                // Send UI update
                this._postMessageCallback({ type: 'toolStatusUpdate', toolCallId: part.toolCallId, status: 'complete', message: part.result, toolName: part.toolName });
                // Update history
                await this._historyManager.updateToolStatus(part.toolCallId, 'complete', part.result);
            } else {
                console.warn("[StreamProcessor] Received tool result ('a') without complete data:", part);
            }
        } else if (prefix === 'd') { // Data/Annotations (e.g., custom tool progress/completion)
            if (part.type === 'message-annotation' && part.toolCallId && part.toolName) {
                const statusMessage = (typeof part.message === 'string') ? part.message : undefined;
                const finalStatus = part.status as 'complete' | 'error' | 'running';
                // Send UI update
                this._postMessageCallback({ type: 'toolStatusUpdate', toolCallId: part.toolCallId, toolName: part.toolName, status: finalStatus, message: statusMessage });
                // Update history
                await this._historyManager.updateToolStatus(part.toolCallId, finalStatus, statusMessage);
            } else if (part.type === 'error') {
                vscode.window.showErrorMessage(`Stream Error: ${part.error}`);
                this._postMessageCallback({ type: 'addMessage', sender: 'assistant', text: `Sorry, a stream error occurred: ${part.error}` });
                // Append error to history as text
                await this._historyManager.appendTextChunk(assistantMessageId, `\n[STREAM ERROR: ${part.error}]`);
            } else {
                 console.warn("[StreamProcessor] Received data/annotation ('d') with unknown structure:", part);
            }
        } else if (prefix === 'e') { // Events/Errors (Generic)
            if (part.error) {
                vscode.window.showErrorMessage(`Stream Event Error: ${part.error}`);
                this._postMessageCallback({ type: 'addMessage', sender: 'assistant', text: `Sorry, an error occurred: ${part.error}` });
                // Append error to history as text
                await this._historyManager.appendTextChunk(assistantMessageId, `\n[STREAM EVENT ERROR: ${part.error}]`);
            } else {
                 console.warn("[StreamProcessor] Received event ('e') without error field:", part);
            }
        } else {
             console.warn(`[StreamProcessor] Unhandled stream prefix: ${prefix}`);
        }
    }
}