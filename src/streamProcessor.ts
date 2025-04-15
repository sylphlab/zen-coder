import {
    CoreToolChoice,
    StreamData,
    TextStreamPart,
    ToolCallPart,
    ToolResultPart,
} from 'ai';
import { HistoryManager } from './historyManager';
// Removed unused imports and SubscriptionManager related types
import { structuredAiResponseSchema, SuggestedAction } from './common/types';

type ExpectedStreamPart =
    | TextStreamPart<any>
    | ToolCallPart
    | ToolResultPart
    | { type: 'finish'; finishReason: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number; }; toolCalls?: any[] }
    | { type: 'error'; error: any };

/**
 * Processes the AI stream. Returns status info instead of calling notifications directly.
 */
export class StreamProcessor {
    private _historyManager: HistoryManager;
    // Removed SubscriptionManager field
    private _currentChatId: string | null = null;
    private _currentMessageId: string | null = null;
    private _accumulatedText: string = '';
    // Removed _toolCallsInProgress as it's not strictly needed without direct notification logic here

    // Constructor only takes HistoryManager
    constructor(historyManager: HistoryManager) {
        this._historyManager = historyManager;
        console.log("[StreamProcessor] Instantiated.");
    }

    // Removed resetState related to tool calls
    private resetState() {
        this._currentChatId = null;
        this._currentMessageId = null;
        this._accumulatedText = '';
        // Removed toolCallsInProgress reset
    }

    /**
     * Processes the stream parts received from the AI SDK.
     * @returns Enhanced result including stream completion status and any error.
     */
    public async processStream(
        stream: AsyncIterable<ExpectedStreamPart>,
        chatId: string,
        messageId: string,
        // Removed notifyUpdateCallback parameter
        toolChoice?: CoreToolChoice<any> | undefined
    ): Promise<{
        finishReason: string;
        usage: { promptTokens: number; completionTokens: number; totalTokens: number; };
        finalOutput?: string;
        finalToolCalls?: any[];
        streamError?: any; // Add property to signal stream error
    }> {
        this.resetState();
        this._currentChatId = chatId;
        this._currentMessageId = messageId;
        let usage: { promptTokens: number; completionTokens: number; totalTokens: number; } = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
        let finishReason = 'unknown';
        let finalOutput: string | undefined;
        let finalToolCalls: any[] | undefined;
        let streamFinishedCleanly = false;
        let streamError: any | undefined = undefined; // Store error encountered during stream

        try {
            for await (const part of stream) {
                // console.log(`[StreamProcessor|${chatId}] Raw Stream Part:`, part);

                switch (part.type) {
                    case 'text-delta':
                         console.log(`[StreamProcessor|${chatId}] Step: text-delta`);
                        this._accumulatedText += part.textDelta;
                        await this._historyManager.messageModifier.appendTextChunk(chatId, messageId, part.textDelta);
                        break;
                    case 'tool-call':
                        console.log(`[StreamProcessor|${chatId}] Step: tool-call`);
                        const toolCallId_call = part.toolCallId;
                        if (toolCallId_call) {
                            // Removed tracking tool calls in progress here
                             await this._historyManager.messageModifier.addToolCall(
                                 chatId, messageId, toolCallId_call, part.toolName, part.args
                             );
                        } else {
                             console.warn(`[StreamProcessor|${chatId}] Received tool-call part without toolCallId.`);
                        }
                        break;
                    case 'tool-result':
                         console.log(`[StreamProcessor|${chatId}] Step: tool-result`);
                        const toolCallId_result = part.toolCallId;
                         if (toolCallId_result) {
                             // Removed checking tool calls in progress here
                             const status = (part as any).error ? 'error' : 'complete';
                             await this._historyManager.messageModifier.updateToolStatus(
                                  chatId, toolCallId_result, status, part.result
                             );
                         } else {
                             console.warn(`[StreamProcessor|${chatId}] Received tool-result part without toolCallId.`);
                         }
                        break;
                    case 'finish':
                         console.log(`[StreamProcessor|${chatId}] Step: finish`);
                        const finishPart = part as { type: 'finish'; finishReason: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number; }; toolCalls?: any[] };
                        finishReason = finishPart.finishReason;
                        usage = finishPart.usage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
                        finalOutput = this._accumulatedText;
                        finalToolCalls = finishPart.toolCalls;
                        streamFinishedCleanly = true;
                        console.log(`[StreamProcessor|${chatId}] Stream Finished. Reason: ${finishReason} Usage:`, usage);
                        break;
                    case 'error':
                        console.log(`[StreamProcessor|${chatId}] Step: error`);
                         const errorPart = part as { type: 'error'; error: any };
                         streamError = errorPart.error; // Store the error
                        console.error(`[StreamProcessor|${chatId}] Stream error reported in part:`, streamError);
                        finishReason = 'error';
                        streamFinishedCleanly = false;
                        // NO NOTIFICATION CALL HERE
                        break;
                    default:
                         const unknownPart: any = part;
                         console.log(`[StreamProcessor|${chatId}] Unhandled stream part type: ${unknownPart.type}`, unknownPart);
                }
            }

             if (streamFinishedCleanly) {
                 await this.handlePostStreamProcessing(chatId, messageId, this._accumulatedText);
                 console.log(`[StreamProcessor|${chatId}] Finished processing stream cleanly for message ${messageId}.`);
                 // NO NOTIFICATION CALL HERE
             } else if (finishReason !== 'error') {
                  console.warn(`[StreamProcessor|${chatId}] Stream for message ${messageId} ended unexpectedly without 'finish' or 'error'. Finish reason: ${finishReason}.`);
                  await this.handlePostStreamProcessing(chatId, messageId, this._accumulatedText);
                  if (finishReason === 'unknown') finishReason = 'incomplete'; // Mark as incomplete if reason wasn't set
             }
             // If finishReason is 'error', streamError should be set

        } catch (error) {
            console.error(`[StreamProcessor|${chatId}] Error processing stream loop for message ${messageId}:`, error);
            finishReason = 'error';
            streamFinishedCleanly = false;
            streamError = error; // Store the catch block error
             // NO NOTIFICATION CALL HERE
        } finally {
            this.resetState();
            console.log(`[StreamProcessor|${chatId}] Stream processing 'finally' block executed for message ID: ${messageId}.`);
        }

        return { finishReason, usage, finalOutput, finalToolCalls, streamError }; // Return streamError
    }

    /**
      * Parses potential trailing JSON (like suggested actions) after the main stream finishes.
      * Note: This method now implicitly relies on reconcileFinalAssistantMessage using
      * its own injected SubscriptionManager to push suggested actions.
      */
     private async handlePostStreamProcessing(chatId: string, messageId: string, fullText: string): Promise<void> {
          console.log(`[StreamProcessor|${chatId}] Starting post-stream processing for message ${messageId}.`);
          try {
               await this._historyManager.messageModifier.reconcileFinalAssistantMessage(
                   chatId,
                   messageId,
                   null,
                   () => {} // Dummy callback
               );
                console.log(`[StreamProcessor|${chatId}] Completed post-stream processing (reconcile) for message ${messageId}.`);
          } catch (error) {
               console.error(`[StreamProcessor|${chatId}] Error during reconcileFinalAssistantMessage for message ${messageId}:`, error);
          }
     }
}
