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

            if (!streamResult) {
                console.log("[SendMessageHandler] getAiResponseStream returned null, AI service likely handled error.");
                // HistoryManager keeps the user message; error was likely shown by AiService
                return;
            }

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

                let finalCoreMessage: CoreMessage | null = null;
                if (finalStructuredResponse) {
                    // Create a CoreMessage containing only the main_content for history
                    finalCoreMessage = {
                        role: 'assistant',
                        content: finalStructuredResponse.main_content || '', // Use main_content, fallback to empty string
                    };
                    // Handle suggested_actions - send them to the UI separately
                    if (finalStructuredResponse.suggested_actions && finalStructuredResponse.suggested_actions.length > 0) {
                         console.log("[SendMessageHandler] Received suggested actions:", finalStructuredResponse.suggested_actions);
                         context.postMessage({ type: 'addSuggestedActions', payload: { messageId: assistantUiMsgId, actions: finalStructuredResponse.suggested_actions } });
                    }
                } else {
                     console.warn(`[SendMessageHandler] Stream processor returned null final structured response for ID: ${assistantUiMsgId}`);
                }

                await context.historyManager.reconcileFinalAssistantMessage(assistantUiMsgId, finalCoreMessage);

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