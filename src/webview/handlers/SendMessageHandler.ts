import * as vscode from 'vscode';
import { CoreMessage, Tool, StreamTextResult } from 'ai'; // Import necessary types
import { MessageHandler, HandlerContext } from './MessageHandler';
import { StreamProcessor } from '../../streamProcessor'; // Import StreamProcessor

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
            const userMessageText = message.text;
            const modelId = message.modelId;

            if (!modelId) {
                console.error("[SendMessageHandler] No modelId provided.");
                context.postMessage({ type: 'addMessage', sender: 'assistant', text: 'Error: No model ID specified.' });
                return;
            }
            if (typeof userMessageText !== 'string' || !userMessageText) {
                console.error("[SendMessageHandler] Invalid or empty text received.");
                // Optionally inform the user via context.postMessage
                return;
            }

            // Add user message via HistoryManager
            await context.historyManager.addUserMessage(userMessageText);

            // Translate history for AI
            const coreMessagesForAi = context.historyManager.translateUiHistoryToCoreMessages();
            console.log(`[SendMessageHandler] Translated ${context.historyManager.getHistory().length} UI messages to ${coreMessagesForAi.length} CoreMessages.`);

            // Get AI response stream
            // Add assistant message frame *before* calling AI to get the ID
            const assistantUiMsgId = await context.historyManager.addAssistantMessageFrame();

            // Call getAiResponseStream without historyManager/assistantUiMsgId
            const streamResult = await context.aiService.getAiResponseStream(
                userMessageText,
                coreMessagesForAi,
                modelId
            );

            // Add assistant message frame via HistoryManager
            // assistantUiMsgId is already created above

            // Send start signal to UI
            context.postMessage({ type: 'startAssistantMessage', sender: 'assistant', messageId: assistantUiMsgId });

            // Process the stream using the StreamProcessor instance
            // Pass the StreamTextResult object to the processor and get the final structured object
            const finalStructuredResponse = await this._streamProcessor.process(streamResult, assistantUiMsgId);

            // --- Final AI History Update & Suggested Actions ---
            try {
                console.log(`[SendMessageHandler] Received final StructuredResponse from processor:`, finalStructuredResponse);

                // We no longer await streamResult.text here.
                // HistoryManager will use the accumulated text from appendTextChunk.

                // Handle suggested actions if they exist in the structured response
                if (finalStructuredResponse?.suggested_actions && finalStructuredResponse.suggested_actions.length > 0) {
                    console.log("[SendMessageHandler] Received suggested actions:", finalStructuredResponse.suggested_actions);
                    context.postMessage({ type: 'addSuggestedActions', payload: { messageId: assistantUiMsgId, actions: finalStructuredResponse.suggested_actions } });
                } else if (!finalStructuredResponse) {
                     console.warn(`[SendMessageHandler] Stream processor returned null final structured response for ID: ${assistantUiMsgId}. Suggested actions might be missing.`);
                }

                // Reconcile history using the accumulated text (handled internally by HistoryManager)
                // and passing null for finalCoreMessage as we only need it for tool calls.
                await context.historyManager.reconcileFinalAssistantMessage(assistantUiMsgId, null);

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