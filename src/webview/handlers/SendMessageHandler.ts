import * as vscode from 'vscode';
import { CoreMessage, Tool, StreamTextResult } from 'ai'; // Import necessary types
import { MessageHandler, HandlerContext } from './MessageHandler';
import { StreamProcessor } from '../../streamProcessor'; // Import StreamProcessor
import { UiMessageContentPart } from '../../common/types'; // Import shared type from common

export class SendMessageHandler implements MessageHandler {
    public readonly messageType = 'sendMessage';
    private _streamProcessor: StreamProcessor; // Requires StreamProcessor instance

    // We need to pass the StreamProcessor instance during construction or via context
    constructor(streamProcessor: StreamProcessor) {
        this._streamProcessor = streamProcessor;
    }

    public async handle(message: any, context: HandlerContext): Promise<void> {
        console.log("[SendMessageHandler] Handling sendMessage message...");

        try {
            // Expect 'content' array instead of 'text'
            const userMessageContent: UiMessageContentPart[] = message.content; // Array of UiMessageContentPart
            const providerId = message.providerId; // Extract providerId
            const modelId = message.modelId;

            if (!providerId) { // Check for providerId
                console.error("[SendMessageHandler] No providerId provided.");
                context.postMessage({ type: 'addMessage', sender: 'assistant', text: 'Error: No provider ID specified.' });
                return;
            }
            if (!modelId) {
                console.error("[SendMessageHandler] No modelId provided.");
                context.postMessage({ type: 'addMessage', sender: 'assistant', text: 'Error: No model ID specified.' });
                return;
            }
            // Validate the content array
            if (!Array.isArray(userMessageContent) || userMessageContent.length === 0) {
                 console.error("[SendMessageHandler] Invalid or empty content array received.");
                 // Optionally inform the user via context.postMessage
                 return;
            }
            // Basic validation of parts (can be enhanced)
            const isValidContent = userMessageContent.every(part =>
                 (part.type === 'text' && typeof part.text === 'string') ||
                 (part.type === 'image' && typeof part.mediaType === 'string' && typeof part.data === 'string')
             );
             if (!isValidContent) {
                 console.error("[SendMessageHandler] Invalid content part structure received.");
                 return;
             }

            // Add user message with potentially mixed content via HistoryManager
            await context.historyManager.addUserMessage(userMessageContent);

            // Translate history for AI
            const coreMessagesForAi = context.historyManager.translateUiHistoryToCoreMessages();
            console.log(`[SendMessageHandler] Translated ${context.historyManager.getHistory().length} UI messages to ${coreMessagesForAi.length} CoreMessages.`);

            // Get AI response stream
            // Add assistant message frame *before* calling AI to get the ID
            const assistantUiMsgId = await context.historyManager.addAssistantMessageFrame();

            // Call getAiResponseStream with providerId and modelId
            const streamResult = await context.aiService.getAiResponseStream(
                "", // Pass an empty string for the prompt, as it's included in the history
                coreMessagesForAi,
                providerId, // Pass providerId
                modelId
            );

            // Add assistant message frame via HistoryManager
            // assistantUiMsgId is already created above

            // Send start signal to UI
            context.postMessage({ type: 'startAssistantMessage', sender: 'assistant', messageId: assistantUiMsgId });

            // Process the stream using the StreamProcessor instance
            // Pass the StreamTextResult object to the processor and get the final structured object
            // Process the stream. This now returns void.
            await this._streamProcessor.process(streamResult, assistantUiMsgId);

            // --- Final AI History Update & Suggested Actions ---
            // --- Final AI History Update ---
            // Suggested actions are no longer handled here as StreamProcessor doesn't return them.
            // This logic will be moved to HistoryManager.reconcileFinalAssistantMessage.
            try {
                console.log(`[SendMessageHandler] Stream processing finished for ${assistantUiMsgId}. Reconciling history.`);

                // We no longer await streamResult.text here.
                // HistoryManager will use the accumulated text from appendTextChunk.

                // Reconcile history using the accumulated text (handled internally by HistoryManager)
                // and passing null for finalCoreMessage as we only need it for tool calls.
                await context.historyManager.reconcileFinalAssistantMessage(assistantUiMsgId, null, context.postMessage);

                // Optionally await the final promise from AiServiceResponse for usage/finishReason
                // const finalDetails = await streamResult.finalPromise;
                // console.log("[SendMessageHandler] Final stream details:", finalDetails);

            } catch (finalMsgError) {
                console.error(`[SendMessageHandler] Error processing final message or suggested actions for ID ${assistantUiMsgId}:`, finalMsgError);
            }

            // Final message handling is now done within AiService's onFinish callback

        } catch (error: any) {
            console.error("[SendMessageHandler] Error processing AI stream:", error);
            vscode.window.showErrorMessage(`Failed to get AI response: ${error.message}`);
            context.postMessage({ type: 'addMessage', sender: 'assistant', text: `Sorry, an error occurred: ${error.message}` });
            // HistoryManager handles its own saving
        }
    }
}