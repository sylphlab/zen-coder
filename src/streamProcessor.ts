import * as vscode from 'vscode';
import { Tool, CoreMessage, StreamTextResult, TextStreamPart, ToolCallPart, ToolResultPart, ToolSet } from 'ai'; // Import necessary types
import {
    UiTextMessagePart,
    ChatSession,
    STREAMING_STATUS_TOPIC, // Import the topic constant
    StreamingStatusPayload, // Import the payload type
    // Delta Imports
    ChatHistoryUpdateData,
    HistoryAppendChunkDelta,
    HistoryUpdateToolCallDelta,
    HistoryAddContentPartDelta, // Corrected import name
    UiToolCallPart,
    UiMessageContentPart
} from './common/types';
import { allTools } from './tools';
import { HistoryManager } from './historyManager';
import { isPromise } from 'util/types';
// SubscriptionManager import removed - using _postMessageCallback directly

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
    public async process<TOOLS extends ToolSet, PARTIAL_OUTPUT>(streamResult: StreamTextResult<TOOLS, PARTIAL_OUTPUT>, chatId: string, assistantMessageId: string): Promise<void> {
        console.log(`[StreamProcessor] Starting processing for message ID: ${assistantMessageId}`);

        const startStreamingPayload: StreamingStatusPayload = { streaming: true };
        this._postMessageCallback({ type: 'pushUpdate', payload: { topic: STREAMING_STATUS_TOPIC, data: startStreamingPayload } });
        console.log('[StreamProcessor] Sent streaming: true update');

        let streamFinishedCleanly = false;
        try {
            for await (const part of streamResult.fullStream) {
                await this._handleStreamPart(part, chatId, assistantMessageId);
            }
            console.log("[StreamProcessor] Finished processing fullStream cleanly.");
            streamFinishedCleanly = true;
        } catch (error: any) {
            // Check if it's an AbortError caused by a new stream starting
            if (error.name === 'AbortError' && error.message === 'New stream initiated by user') {
                console.log(`[StreamProcessor] Stream for message ${assistantMessageId} intentionally aborted by a newer stream request.`);
                streamFinishedCleanly = false; // Mark as not finished cleanly, but don't re-throw
            } else {
                console.error("[StreamProcessor] Error during fullStream processing:", error);
                // Re-throw other errors
                throw error;
            }
        } finally {
            // Send the final streaming status update regardless of clean finish or expected abort
            const endStreamingPayload: StreamingStatusPayload = { streaming: false };
            this._postMessageCallback({ type: 'pushUpdate', payload: { topic: STREAMING_STATUS_TOPIC, data: endStreamingPayload } });
            console.log(`[StreamProcessor] Sent streaming: false update (finally block). Stream finished cleanly: ${streamFinishedCleanly}`);
            console.log(`[StreamProcessor] Stream processing finally block executed for message ID: ${assistantMessageId}.`);
        }
    }


    /**
     * Handles a single part from the AI stream.
     */
    private async _handleStreamPart(part: any, chatId: string, assistantMessageId: string): Promise<void> {
        switch (part.type) {
            case 'text-delta':
                await this._handleTextDelta(part, chatId, assistantMessageId);
                break;
            case 'tool-call':
                await this._handleToolCall(part, chatId, assistantMessageId);
                break;
            case 'tool-call-streaming-start':
                this._handleToolCallStreamingStart(part);
                break;
            case 'tool-call-delta':
                this._handleToolCallDelta(part);
                break;
            case 'tool-result':
                await this._handleToolResult(part, chatId);
                break;
            case 'reasoning':
                this._handleReasoning(part);
                break;
            case 'reasoning-signature':
                console.log("[StreamProcessor] Reasoning Signature:", part.signature);
                break;
            case 'redacted-reasoning':
                console.log("[StreamProcessor] Redacted Reasoning:", part.data);
                break;
            case 'source':
                this._handleSource(part);
                break;
            case 'file':
                this._handleFile(part);
                break;
            case 'step-start':
                console.log("[StreamProcessor] Step Start:", part.messageId, part.request);
                break;
            case 'step-finish':
                console.log("[StreamProcessor] Step Finish:", part.messageId, part.finishReason, part.usage);
                break;
            case 'finish':
                console.log("[StreamProcessor] Stream Finished. Reason:", part.finishReason, "Usage:", part.usage);
                break;
            case 'error':
                this._handleError(part, chatId);
                break;
            default:
                console.warn("[StreamProcessor] Unhandled stream part type:", part.type);
        }
    }

    // --- Private Handlers for Specific Stream Part Types ---

    private async _handleTextDelta(part: { textDelta: string }, chatId: string, assistantMessageId: string): Promise<void> {
        const delta: HistoryAppendChunkDelta = {
            type: 'historyAppendChunk',
            chatId: chatId,
            messageId: assistantMessageId,
            textChunk: part.textDelta,
        };
        const topic = `chatHistoryUpdate/${chatId}`;
        this._postMessageCallback({ type: 'pushUpdate', payload: { topic: topic, data: delta } });
    }

    private async _handleToolCall(part: ToolCallPart, chatId: string, assistantMessageId: string): Promise<void> {
        const toolCallPart: UiToolCallPart = {
            type: 'tool-call',
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            args: part.args,
            status: 'pending', // Initial status
        };
        const delta: HistoryAddContentPartDelta = {
            type: 'historyAddContentPart',
            chatId: chatId,
            messageId: assistantMessageId,
            part: toolCallPart,
        };
        const topic = `chatHistoryUpdate/${chatId}`;
        this._postMessageCallback({ type: 'pushUpdate', payload: { topic: topic, data: delta } });
    }

    private _handleToolCallStreamingStart(part: { type: 'tool-call-streaming-start', toolCallId: string, toolName: string }): void {
        console.log(`[StreamProcessor] Tool call streaming start: ${part.toolName} (${part.toolCallId})`);
    }

    private _handleToolCallDelta(part: { type: 'tool-call-delta', toolCallId: string, toolName: string, argsTextDelta: string }): void {
        // Optional UI update
    }

    private async _handleToolResult(part: ToolResultPart, chatId: string): Promise<void> {
        const messageId = this._historyManager.findMessageByToolCallId(chatId, part.toolCallId)?.id;
        if (!messageId) {
            console.warn(`[StreamProcessor] Could not find messageId for toolCallId ${part.toolCallId} in chat ${chatId}. Cannot push delta update for tool result.`);
            return;
        }

        const delta: HistoryUpdateToolCallDelta = {
            type: 'historyUpdateToolCall',
            chatId: chatId,
            messageId: messageId,
            toolCallId: part.toolCallId,
            status: 'complete', // Assuming 'complete' on result
            result: part.result,
        };
        const topic = `chatHistoryUpdate/${chatId}`;
        this._postMessageCallback({ type: 'pushUpdate', payload: { topic: topic, data: delta } });
    }

    private _handleReasoning(part: { type: 'reasoning', textDelta: string }): void {
        console.log("[StreamProcessor] Reasoning:", part.textDelta);
    }

    private _handleSource(part: { type: 'source', source: any }): void {
        console.log("[StreamProcessor] Source:", part.source);
    }

    private _handleFile(part: { type: 'file', name: string, content: string, encoding: string }): void {
        console.log("[StreamProcessor] File:", part);
    }

    private _handleError(part: { type: 'error', error: any }, chatId: string): void {
        console.error("[StreamProcessor] Error part received in stream:", part.error);
        // No longer sending streaming: false here, finally block handles it.
        throw new Error(`Stream error: ${part.error}`); // Re-throw to be caught by the main loop
    }

} // End of StreamProcessor class
