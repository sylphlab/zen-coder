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
    public async process<TOOLS extends ToolSet, PARTIAL_OUTPUT>(streamResult: StreamTextResult<TOOLS, PARTIAL_OUTPUT>, assistantMessageId: string): Promise<void> { // Return void now
        console.log(`[StreamProcessor] Starting processing for message ID: ${assistantMessageId}`);
        // Removed accumulatedStructuredResponse variable

        // --- Process Full Stream ---
        try {
            for await (const part of streamResult.fullStream) {
                // console.log("[StreamProcessor] Received part:", part.type, part); // DEBUG: Log received part type and content
                switch (part.type) {
                    case 'text-delta':
                        this._postMessageCallback({ type: 'appendMessageChunk', sender: 'assistant', textDelta: part.textDelta });
                        await this._historyManager.appendTextChunk(assistantMessageId, part.textDelta);
                        break;
                    case 'tool-call':
                        // Handle full tool call information (might appear after streaming deltas)
                        this._postMessageCallback({ type: 'addToolCall', payload: { toolCallId: part.toolCallId, toolName: part.toolName, args: part.args } });
                        await this._historyManager.addToolCall(assistantMessageId, part.toolCallId, part.toolName, part.args);
                        break;
                    case 'tool-call-streaming-start':
                        // Optional: Indicate tool call is starting (UI might show placeholder)
                        console.log(`[StreamProcessor] Tool call streaming start: ${part.toolName} (${part.toolCallId})`);
                        // You might want to add a placeholder in the UI here
                        // this._postMessageCallback({ type: 'toolCallStart', payload: { toolCallId: part.toolCallId, toolName: part.toolName } });
                        // HistoryManager might need an update if you want to store partial tool calls
                        break;
                    case 'tool-call-delta':
                        // Optional: Update UI with streaming arguments
                        // console.log(`[StreamProcessor] Tool call delta: ${part.toolName} (${part.toolCallId}), Args Delta: ${part.argsTextDelta}`);
                        // this._postMessageCallback({ type: 'toolCallDelta', payload: { toolCallId: part.toolCallId, argsTextDelta: part.argsTextDelta } });
                        // HistoryManager might need an update
                        break;
                    case 'tool-result':
                        // Handle the result returned from executing a tool
                        this._postMessageCallback({ type: 'toolStatusUpdate', toolCallId: part.toolCallId, status: 'complete', message: part.result, toolName: part.toolName });
                        await this._historyManager.updateToolStatus(part.toolCallId, 'complete', part.result);
                        break;
                    case 'reasoning':
                        // Handle reasoning steps if needed (e.g., display in UI)
                        console.log("[StreamProcessor] Reasoning:", part.textDelta);
                        // this._postMessageCallback({ type: 'appendReasoningChunk', textDelta: part.textDelta });
                        break;
                    case 'reasoning-signature':
                        console.log("[StreamProcessor] Reasoning Signature:", part.signature);
                        break;
                    case 'redacted-reasoning':
                        console.log("[StreamProcessor] Redacted Reasoning:", part.data);
                        break;
                    case 'source':
                        console.log("[StreamProcessor] Source:", part.source);
                        // Handle source information (e.g., display citations)
                        // this._postMessageCallback({ type: 'addSource', source: part.source });
                        break;
                    case 'file':
                        console.log("[StreamProcessor] File:", part);
                        // Handle generated file information
                        // this._postMessageCallback({ type: 'addFile', file: part });
                        break;
                    case 'step-start':
                        console.log("[StreamProcessor] Step Start:", part.messageId, part.request);
                        break;
                    case 'step-finish':
                        console.log("[StreamProcessor] Step Finish:", part.messageId, part.finishReason, part.usage);
                        // Final tool calls might be available here if not streamed earlier
                        // Note: The main `toolCalls` promise on streamResult might still be the primary source for final tool calls
                        break;
                    case 'finish':
                        console.log("[StreamProcessor] Stream Finished. Reason:", part.finishReason, "Usage:", part.usage);
                        // This indicates the end of the fullStream iteration
                        break;
                    case 'error':
                        console.error("[StreamProcessor] Error part received in stream:", part.error);
                        this._postMessageCallback({ type: 'streamError', error: part.error });
                        // Decide how to handle stream errors (e.g., stop processing, notify user)
                        throw new Error(`Stream error: ${part.error}`); // Re-throw to stop processing?
                    default:
                        console.warn("[StreamProcessor] Unhandled stream part type:", (part as any).type);
                }
            }
            console.log("[StreamProcessor] Finished processing fullStream.");
        } catch (error) {
            console.error("[StreamProcessor] Error processing fullStream:", error);
            // Post error to UI if not already done by 'error' part handling
            if (!(error instanceof Error && error.message.startsWith('Stream error:'))) {
                 this._postMessageCallback({ type: 'streamError', error: error instanceof Error ? error.message : String(error) });
            }
        }

        // --- experimental_partialOutputStream processing removed ---
        // We are no longer using experimental_output, so this stream is not expected.

        console.log(`[StreamProcessor] All stream processing finished for message ID: ${assistantMessageId}.`);
        this._postMessageCallback({ type: 'streamFinished' });

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

    // handleStreamPart method is no longer needed as logic is moved into the main process loop
} // End of StreamProcessor class

// --- Helper Function Removed ---
// extractJsonBlock is no longer needed here.