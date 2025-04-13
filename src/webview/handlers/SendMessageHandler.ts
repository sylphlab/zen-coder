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
        let assistantUiMsgId: string | undefined; // Define here to be accessible in catch block if needed

        try {
            const { userMessageContent, providerId, modelId } = this._validateInput(message, context);
            if (!userMessageContent) return; // Validation failed, error posted in helper

            // Add user message
            await context.historyManager.addUserMessage(userMessageContent);

            // Prepare and send to AI
            const { streamResult, assistantId } = await this._prepareAndSendToAI(context, providerId!, modelId!); // Add non-null assertions
            assistantUiMsgId = assistantId; // Store the ID

            // Process the response
            await this._processAIResponse(streamResult, assistantUiMsgId, context);

            // Finalize history
            await this._finalizeHistory(assistantUiMsgId, context);

        } catch (error: any) {
            console.error("[SendMessageHandler] Error processing AI stream:", error);
            vscode.window.showErrorMessage(`Failed to get AI response: ${error.message}`);
            // Post a generic error message to the UI
            context.postMessage({ type: 'addMessage', sender: 'assistant', text: `Sorry, an error occurred: ${error.message}` });
            // Attempt to reconcile history even on error, using null for finalCoreMessage
            if (assistantUiMsgId) {
                try {
                    console.warn(`[SendMessageHandler] Attempting to reconcile history for ${assistantUiMsgId} after error.`);
                    await context.historyManager.reconcileFinalAssistantMessage(assistantUiMsgId, null, context.postMessage);
                } catch (reconcileError) {
                    console.error(`[SendMessageHandler] Error during post-error history reconciliation for ${assistantUiMsgId}:`, reconcileError);
                }
            }
        }
    }

    /** Validates the input message structure. Returns null if invalid. */
    private _validateInput(message: any, context: HandlerContext): { userMessageContent: UiMessageContentPart[] | null, providerId: string | null, modelId: string | null } {
        const userMessageContent: UiMessageContentPart[] = message.content;
        const providerId = message.providerId;
        const modelId = message.modelId;

        if (!providerId) {
            console.error("[SendMessageHandler] No providerId provided.");
            context.postMessage({ type: 'addMessage', sender: 'assistant', text: 'Error: No provider ID specified.' });
            return { userMessageContent: null, providerId: null, modelId: null };
        }
        if (!modelId) {
            console.error("[SendMessageHandler] No modelId provided.");
            context.postMessage({ type: 'addMessage', sender: 'assistant', text: 'Error: No model ID specified.' });
            return { userMessageContent: null, providerId: null, modelId: null };
        }
        if (!Array.isArray(userMessageContent) || userMessageContent.length === 0) {
             console.error("[SendMessageHandler] Invalid or empty content array received.");
             return { userMessageContent: null, providerId: null, modelId: null };
        }
        const isValidContent = userMessageContent.every(part =>
             (part.type === 'text' && typeof part.text === 'string') ||
             (part.type === 'image' && typeof part.mediaType === 'string' && typeof part.data === 'string')
         );
         if (!isValidContent) {
             console.error("[SendMessageHandler] Invalid content part structure received.");
             return { userMessageContent: null, providerId: null, modelId: null };
         }

        return { userMessageContent, providerId, modelId };
    }

    /** Prepares data and calls the AI service. */
    private async _prepareAndSendToAI(context: HandlerContext, providerId: string, modelId: string): Promise<{ streamResult: StreamTextResult<any, any>, assistantId: string }> {
        const coreMessagesForAi = context.historyManager.translateUiHistoryToCoreMessages();
        console.log(`[SendMessageHandler] Translated ${context.historyManager.getHistory().length} UI messages to ${coreMessagesForAi.length} CoreMessages.`);

        const assistantId = await context.historyManager.addAssistantMessageFrame();

        const streamResult = await context.aiService.getAiResponseStream(
            coreMessagesForAi,
            providerId,
            modelId
        );
        return { streamResult, assistantId };
    }

    /** Processes the AI response stream. */
    private async _processAIResponse(streamResult: StreamTextResult<any, any>, assistantUiMsgId: string, context: HandlerContext): Promise<void> {
        context.postMessage({ type: 'startAssistantMessage', sender: 'assistant', messageId: assistantUiMsgId });
        await this._streamProcessor.process(streamResult, assistantUiMsgId);
    }

    /** Finalizes the history after stream processing. */
    private async _finalizeHistory(assistantUiMsgId: string, context: HandlerContext): Promise<void> {
        try {
            console.log(`[SendMessageHandler] Stream processing finished for ${assistantUiMsgId}. Reconciling history.`);
            // Reconcile history using accumulated text and null for finalCoreMessage
            await context.historyManager.reconcileFinalAssistantMessage(assistantUiMsgId, null, context.postMessage);
        } catch (finalMsgError) {
            console.error(`[SendMessageHandler] Error during final history reconciliation for ID ${assistantUiMsgId}:`, finalMsgError);
            // Optionally re-throw or handle further? For now, just log.
        }
    }
}