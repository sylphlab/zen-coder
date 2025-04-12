import * as vscode from 'vscode';
import { Tool, CoreMessage, StreamTextResult, TextStreamPart, ToolCallPart, ToolResultPart, ToolSet } from 'ai'; // Import necessary types
// AiServiceResponse import removed
import { structuredAiResponseSchema, StructuredAiResponse } from './common/types';
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
    public async process<TOOLS extends ToolSet, PARTIAL_OUTPUT>(streamResult: StreamTextResult<TOOLS, PARTIAL_OUTPUT>, assistantMessageId: string): Promise<StructuredAiResponse | null> { // Change streamResult type to any
        console.log(`[StreamProcessor] Starting processing for message ID: ${assistantMessageId}`);
        let accumulatedStructuredResponse: Partial<StructuredAiResponse> = {}; // Initialize accumulator

        // --- Process Text Stream ---
        try {
            // Iterate directly over textStream, assuming each part is the text delta string
            for await (const textDelta of streamResult.textStream) {
                this._postMessageCallback({ type: 'appendMessageChunk', sender: 'assistant', textDelta: textDelta });
                await this._historyManager.appendTextChunk(assistantMessageId, textDelta);
            }
            console.log("[StreamProcessor] Finished processing textStream.");
        } catch (error) { // Corrected catch block placement
            console.error("[StreamProcessor] Error processing textStream:", error);
            // Handle error appropriately, maybe post to UI
        }

        // --- Process Tool Calls (Await the promise) ---
        try {
            const toolCalls = await streamResult.toolCalls;
            if (toolCalls && toolCalls.length > 0) {
                console.log("[StreamProcessor] Processing toolCalls:", toolCalls);
                for (const part of toolCalls) {
                     if (part.type === 'tool-call') {
                        this._postMessageCallback({ type: 'addToolCall', payload: { toolCallId: part.toolCallId, toolName: part.toolName, args: part.args } });
                        await this._historyManager.addToolCall(assistantMessageId, part.toolCallId, part.toolName, part.args);
                     }
                }
            } else {
                 console.log("[StreamProcessor] No tool calls received.");
            }
        } catch (error) {
             console.error("[StreamProcessor] Error processing toolCalls:", error);
        }

        // --- Process Tool Results (Await the promise) ---
         try {
            const toolResults = await streamResult.toolResults;
             if (toolResults && toolResults.length > 0) {
                 console.log("[StreamProcessor] Processing toolResults:", toolResults);
                 for (const part of toolResults) {
                     if (part.type === 'tool-result') {
                         this._postMessageCallback({ type: 'toolStatusUpdate', toolCallId: part.toolCallId, status: 'complete', message: part.result, toolName: part.toolName });
                         await this._historyManager.updateToolStatus(part.toolCallId, 'complete', part.result);
                     }
                 }
             } else {
                  console.log("[StreamProcessor] No tool results received.");
             }
         } catch (error) {
              console.error("[StreamProcessor] Error processing toolResults:", error);
         }

        // --- Process Partial Structured Output Stream ---
        try {
            // Check if experimental_partialOutputStream exists before iterating
            for await (const partial of streamResult.experimental_partialOutputStream) {
                // console.log("[StreamProcessor] Received partial structured output:", partial);
                // Basic accumulation: merge properties. More sophisticated merging might be needed.
                accumulatedStructuredResponse = { ...accumulatedStructuredResponse, ...partial };
            }
            console.log("[StreamProcessor] Finished processing experimental_partialOutputStream.");
        } catch (error) {
             console.error("[StreamProcessor] Error processing experimental_partialOutputStream:", error);
        }

        console.log(`[StreamProcessor] All stream processing finished for message ID: ${assistantMessageId}.`);
        this._postMessageCallback({ type: 'streamFinished' });

        // Return the accumulated structured response (might be incomplete if stream errored)
        // Validate the final accumulated object before returning?
        const validationResult = structuredAiResponseSchema.safeParse(accumulatedStructuredResponse);
        if (validationResult.success) {
             console.log("[StreamProcessor] Accumulated structured response validated:", validationResult.data);
             return validationResult.data;
        } else {
             console.error("[StreamProcessor] Final accumulated structured output failed validation:", validationResult.error);
             console.error("[StreamProcessor] Raw accumulated object:", accumulatedStructuredResponse);
             // Decide what to return on validation failure - null or a default?
             // Returning null for now.
             return null;
        }

        // --- Final AI History Update Removed ---
        // This logic is moved to SendMessageHandler after streamResult.final() resolves.
    }

    // handleStreamPart method is no longer needed as logic is moved into the main process loop
}