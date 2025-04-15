import {
    CoreToolChoice,
    StreamData, // Keep for potential future use or type checking context
    TextStreamPart,
    ToolCallPart,     // Corrected import
    ToolResultPart,   // Corrected import
    // FinishStreamPart and ErrorStreamPart are not standard exports, handle by type string
} from 'ai';
import { HistoryManager } from './historyManager';
import {
    SuggestedAction,
    structuredAiResponseSchema
} from './common/types';
import { SubscriptionManager } from './ai/subscriptionManager';
import { HistoryUpdateMessageStatusDelta } from './common/types';

// Define a union type for the expected parts based on actual exports and observed types
type ExpectedStreamPart =
    | TextStreamPart<any> // TextStreamPart might still be generic
    | ToolCallPart
    | ToolResultPart
    // Add other known part types if necessary
    // Finish and Error will be handled by checking part.type string
    | { type: 'finish'; finishReason: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number; }; toolCalls?: any[] } // Inferred structure
    | { type: 'error'; error: any }; // Inferred structure

/**
 * Processes the AI stream, handling text deltas, tool calls, and final output.
 */
export class StreamProcessor {
    private _historyManager: HistoryManager;
    private _subscriptionManager: SubscriptionManager;
    private _currentChatId: string | null = null;
    private _currentMessageId: string | null = null;
    private _accumulatedText: string = '';
    private _toolCallsInProgress: { [toolCallId: string]: boolean } = {};

    constructor(historyManager: HistoryManager, subscriptionManager: SubscriptionManager) {
        this._historyManager = historyManager;
        this._subscriptionManager = subscriptionManager;
        console.log("[StreamProcessor] Instantiated.");
    }

    private resetState() {
        this._currentChatId = null;
        this._currentMessageId = null;
        this._accumulatedText = '';
        this._toolCallsInProgress = {};
    }

    /**
     * Processes the stream parts received from the AI SDK.
     * @param stream The async iterable stream from the AI SDK (yielding specific StreamPart objects).
     * @param chatId The ID of the chat session.
     * @param messageId The ID of the assistant message being processed.
     */
    public async processStream(
        stream: AsyncIterable<ExpectedStreamPart>, // Use the corrected union type
        chatId: string,
        messageId: string,
        toolChoice?: CoreToolChoice<any> | undefined
    ): Promise<{ finishReason: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number; }; finalOutput?: string; finalToolCalls?: any[] }> {
        this.resetState();
        this._currentChatId = chatId;
        this._currentMessageId = messageId;
        let usage: { promptTokens: number; completionTokens: number; totalTokens: number; } = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
        let finishReason = 'unknown';
        let finalOutput: string | undefined;
        let finalToolCalls: any[] | undefined;
        let streamFinishedCleanly = false;

        try {
            for await (const part of stream) { // part is now one of ExpectedStreamPart

                 // console.log(`[StreamProcessor|${chatId}] Raw Stream Part:`, part);

                switch (part.type) {
                    case 'text-delta':
                         console.log(`[StreamProcessor|${chatId}] Step: text-delta`);
                        this._accumulatedText += part.textDelta;
                        await this._historyManager.messageModifier.appendTextChunk(chatId, messageId, part.textDelta);
                        break;
                    case 'tool-call': // Type is ToolCallPart (non-generic)
                        console.log(`[StreamProcessor|${chatId}] Step: tool-call`);
                        const toolCallId_call = part.toolCallId;
                        if (toolCallId_call) {
                             this._toolCallsInProgress[toolCallId_call] = true;
                             await this._historyManager.messageModifier.addToolCall(
                                 chatId,
                                 messageId,
                                 toolCallId_call,
                                 part.toolName,
                                 part.args
                             );
                        } else {
                             console.warn(`[StreamProcessor|${chatId}] Received tool-call part without toolCallId.`);
                        }
                        break;
                    case 'tool-result': // Type is ToolResultPart (non-generic)
                         console.log(`[StreamProcessor|${chatId}] Step: tool-result`);
                        const toolCallId_result = part.toolCallId;
                         if (toolCallId_result) {
                             if (this._toolCallsInProgress[toolCallId_result]) {
                                  delete this._toolCallsInProgress[toolCallId_result];
                             }
                             // Determine status: Check for an 'error' property or assume 'complete'
                             const status = (part as any).error ? 'error' : 'complete';
                             await this._historyManager.messageModifier.updateToolStatus(
                                  chatId,
                                  toolCallId_result,
                                  status, // Use derived status
                                  part.result
                             );
                         } else {
                             console.warn(`[StreamProcessor|${chatId}] Received tool-result part without toolCallId.`);
                         }
                        break;
                    case 'finish': // Handle as string type
                         console.log(`[StreamProcessor|${chatId}] Step: finish`);
                        // Cast to access properties defined in our inferred type
                        const finishPart = part as { type: 'finish'; finishReason: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number; }; toolCalls?: any[] };
                        finishReason = finishPart.finishReason;
                        usage = finishPart.usage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
                        finalOutput = this._accumulatedText;
                        finalToolCalls = finishPart.toolCalls;
                        streamFinishedCleanly = true;
                        console.log(`[StreamProcessor|${chatId}] Stream Finished. Reason: ${finishReason} Usage:`, usage);
                        break;
                    case 'error': // Handle as string type
                        console.log(`[StreamProcessor|${chatId}] Step: error`);
                         // Cast to access properties defined in our inferred type
                         const errorPart = part as { type: 'error'; error: any };
                        console.error(`[StreamProcessor|${chatId}] Stream error reported in part:`, errorPart.error);
                        finishReason = 'error';
                        streamFinishedCleanly = false;
                        const errorDelta: HistoryUpdateMessageStatusDelta = { type: 'historyUpdateMessageStatus', chatId, messageId, status: 'error' };
                        console.log(`[StreamProcessor|${chatId}] Sending message status update: msgId=${messageId}, status='error' (Stream Error Part)`);
                        this._subscriptionManager.notifyChatHistoryUpdate(chatId, errorDelta);
                        break; // Stop processing on explicit error part
                    default:
                         // Use a type assertion to log the type if it's not covered by the switch
                         const unknownPart: any = part;
                         console.log(`[StreamProcessor|${chatId}] Unhandled stream part type: ${unknownPart.type}`, unknownPart);
                }
            }

             // --- Post-Stream Processing ---
             if (streamFinishedCleanly) {
                 await this.handlePostStreamProcessing(chatId, messageId, this._accumulatedText);
                 const successDelta: HistoryUpdateMessageStatusDelta = { type: 'historyUpdateMessageStatus', chatId, messageId, status: undefined };
                 console.log(`[StreamProcessor|${chatId}] Sending message status update: msgId=${messageId}, status='undefined' (Stream Success)`);
                 this._subscriptionManager.notifyChatHistoryUpdate(chatId, successDelta);
                 console.log(`[StreamProcessor|${chatId}] Finished processing stream cleanly for message ${messageId}.`);
             } else if (finishReason !== 'error') {
                  console.warn(`[StreamProcessor|${chatId}] Stream for message ${messageId} ended unexpectedly without 'finish' or 'error'. Finish reason: ${finishReason}.`);
                  await this.handlePostStreamProcessing(chatId, messageId, this._accumulatedText);
             }

        } catch (error) {
            console.error(`[StreamProcessor|${chatId}] Error processing stream loop for message ${messageId}:`, error);
            finishReason = 'error';
            streamFinishedCleanly = false;
             const errorDelta: HistoryUpdateMessageStatusDelta = { type: 'historyUpdateMessageStatus', chatId, messageId, status: 'error' };
             console.log(`[StreamProcessor|${chatId}] Sending message status update: msgId=${messageId}, status='error' (Catch Block)`);
             this._subscriptionManager.notifyChatHistoryUpdate(chatId, errorDelta);
        } finally {
            this.resetState();
            console.log(`[StreamProcessor|${chatId}] Stream processing 'finally' block executed for message ID: ${messageId}.`);
        }

        return { finishReason, usage, finalOutput, finalToolCalls };
    }


     /**
     * Parses potential trailing JSON (like suggested actions) after the main stream finishes.
     */
     private async handlePostStreamProcessing(chatId: string, messageId: string, fullText: string): Promise<void> {
          console.log(`[StreamProcessor|${chatId}] Starting post-stream processing for message ${messageId}.`);
          try {
               await this._historyManager.messageModifier.reconcileFinalAssistantMessage(
                   chatId,
                   messageId,
                   null,
                   () => {}
               );
                console.log(`[StreamProcessor|${chatId}] Completed post-stream processing (reconcile) for message ${messageId}.`);
          } catch (error) {
               console.error(`[StreamProcessor|${chatId}] Error during reconcileFinalAssistantMessage for message ${messageId}:`, error);
          }
     }
}
