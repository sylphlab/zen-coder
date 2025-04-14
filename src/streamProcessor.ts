import * as vscode from 'vscode';
import { Tool, CoreMessage, StreamTextResult, TextStreamPart, ToolCallPart, ToolResultPart, ToolSet } from 'ai'; // Import necessary types
// AiServiceResponse import removed
import { StructuredAiResponse, UiTextMessagePart } from './common/types'; // Import UiTextMessagePart, removed structuredAiResponseSchema for now
import { allTools } from './tools'; // Correct path for allTools
import { HistoryManager } from './historyManager';
import { isPromise } from 'util/types';

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
    // Update parameter type to StreamTextResult with both generics
    public async process<TOOLS extends ToolSet, PARTIAL_OUTPUT>(streamResult: StreamTextResult<TOOLS, PARTIAL_OUTPUT>, chatId: string, assistantMessageId: string): Promise<void> { // Add chatId parameter
        console.log(`[StreamProcessor] Starting processing for message ID: ${assistantMessageId}`);
        // Removed accumulatedStructuredResponse variable

        // --- Process Full Stream ---
        try {
            for await (const part of streamResult.fullStream) {
                await this._handleStreamPart(part, chatId, assistantMessageId); // Pass chatId
            }
            console.log("[StreamProcessor] Finished processing fullStream.");
        } catch (error) {
            console.error("[StreamProcessor] Error processing fullStream:", error);
            // Post error to UI if not already done by 'error' part handling
            if (!(error instanceof Error && error.message.startsWith('Stream error:'))) {
                 this._postMessageCallback({ type: 'streamError', error: error instanceof Error ? error.message : String(error) });
            }
            // Re-throw the error to signal failure to the caller (SendMessageHandler)
            throw error;
        }

        // --- experimental_partialOutputStream processing removed ---
        // We are no longer using experimental_output, so this stream is not expected.

        console.log(`[StreamProcessor] All stream processing finished for message ID: ${assistantMessageId}.`);
        // Send final streaming status update
        this._postMessageCallback({ type: 'pushUpdate', payload: { topic: 'streamingStatusUpdate', data: false } });

        // --- Post-Stream Parsing Removed ---
        // Final parsing and handling of potential <content> / <actions> tags
        // will be done in HistoryManager.reconcileFinalAssistantMessage after the full stream.

        // This method's primary return value isn't used for structured output anymore.
        // It mainly signals completion or errors during the stream.
        // No return value needed now
        }

        // --- Final AI History Update Removed ---
        // This logic is moved to SendMessageHandler after streamResult.final() resolves.
    // Removed extra closing brace for process method here

    /**
     * Handles a single part from the AI stream.
     */
    private async _handleStreamPart(part: any, chatId: string, assistantMessageId: string): Promise<void> {
        // console.log("[StreamProcessor] Handling part:", part.type); // DEBUG
        switch (part.type) {
            case 'text-delta':
                await this._handleTextDelta(part, chatId, assistantMessageId); // Pass chatId
                break;
            case 'tool-call':
                await this._handleToolCall(part, chatId, assistantMessageId); // Pass chatId
                break;
            case 'tool-call-streaming-start':
                this._handleToolCallStreamingStart(part);
                break;
            case 'tool-call-delta':
                this._handleToolCallDelta(part);
                break;
            case 'tool-result':
                await this._handleToolResult(part, chatId); // Pass chatId
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
                this._handleError(part, chatId); // Pass chatId
                break; // Throwing error is handled in the main loop now
            default:
                console.warn("[StreamProcessor] Unhandled stream part type:", part.type);
        }
    }

    // --- Private Handlers for Specific Stream Part Types ---

    private async _handleTextDelta(part: { textDelta: string }, chatId: string, assistantMessageId: string): Promise<void> {
        await this._historyManager.appendTextChunk(chatId, assistantMessageId, part.textDelta);
        // Get updated session and push
        const updatedSession = await this._historyManager.getChatSession(chatId);
        if (updatedSession) {
            this._postMessageCallback({ type: 'pushUpdate', payload: { topic: 'chatUpdate', data: updatedSession } });
        }
    }

    private async _handleToolCall(part: ToolCallPart, chatId: string, assistantMessageId: string): Promise<void> {
        await this._historyManager.addToolCall(chatId, assistantMessageId, part.toolCallId, part.toolName, part.args);
        // Get updated session and push
        const updatedSession = await this._historyManager.getChatSession(chatId);
        if (updatedSession) {
            this._postMessageCallback({ type: 'pushUpdate', payload: { topic: 'chatUpdate', data: updatedSession } });
        }
    }

    private _handleToolCallStreamingStart(part: { type: 'tool-call-streaming-start', toolCallId: string, toolName: string }): void {
        console.log(`[StreamProcessor] Tool call streaming start: ${part.toolName} (${part.toolCallId})`);
        // TODO: Consider if a specific 'toolCallStart' pushUpdate topic is needed for UI feedback
    }

    private _handleToolCallDelta(part: { type: 'tool-call-delta', toolCallId: string, toolName: string, argsTextDelta: string }): void {
        // Optional UI update: console.log(`[StreamProcessor] Tool call delta: ${part.toolName} (${part.toolCallId}), Args Delta: ${part.argsTextDelta}`);
        // TODO: Consider if a specific 'toolCallDelta' pushUpdate topic is needed for UI feedback
    }

    private async _handleToolResult(part: ToolResultPart, chatId: string): Promise<void> {
        await this._historyManager.updateToolStatus(chatId, part.toolCallId, 'complete', part.result); // Use updateToolStatus
        // Get updated session and push
        const updatedSession = await this._historyManager.getChatSession(chatId);
        if (updatedSession) {
            this._postMessageCallback({ type: 'pushUpdate', payload: { topic: 'chatUpdate', data: updatedSession } });
        }
    }

    private _handleReasoning(part: { type: 'reasoning', textDelta: string }): void {
        console.log("[StreamProcessor] Reasoning Part Received:", part.textDelta);
        // TODO: Decide how to handle reasoning steps. Push via 'chatUpdate' with a special marker? Or a separate topic?
        // For now, just log it.
        console.log("[StreamProcessor] Reasoning:", part.textDelta);
        // Note: Reasoning steps are not saved to history by default.
    }

    private _handleSource(part: { type: 'source', source: any }): void {
        console.log("[StreamProcessor] Source:", part.source);
        // Optional UI update: this._postMessageCallback({ type: 'addSource', source: part.source });
    }

    private _handleFile(part: { type: 'file', name: string, content: string, encoding: string }): void {
        console.log("[StreamProcessor] File:", part);
        // Optional UI update: this._postMessageCallback({ type: 'addFile', file: part });
    }

    private _handleError(part: { type: 'error', error: any }, chatId: string): void { // Add chatId
        console.error("[StreamProcessor] Error part received in stream:", part.error);
        // Send streaming status update to indicate failure/stop
        this._postMessageCallback({ type: 'pushUpdate', payload: { topic: 'streamingStatusUpdate', data: false } });
        // Optionally push an error message to the chat history via chatUpdate?
        // For now, just log and stop the stream processing by throwing.
        throw new Error(`Stream error: ${part.error}`);
    }

} // End of StreamProcessor class

// --- Helper Function Removed ---
// extractJsonBlock is no longer needed here.