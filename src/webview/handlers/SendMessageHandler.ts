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
        let assistantUiMsgId: string | undefined;
        let chatId: string | undefined; // Declare chatId here for broader scope

        try {
            // Validate input and assign chatId to the higher-scoped variable
            const validationResult = this._validateInput(message, context);
            chatId = validationResult.chatId ?? undefined; // Assign to higher scope, handle null
            const { userMessageContent, providerId, modelId } = validationResult;
            if (!userMessageContent) return; // Validation failed, error posted in helper

            // Add user message
            // Add user message to the specific chat
            await context.historyManager.addUserMessage(chatId!, userMessageContent); // Add chatId

            // Prepare and send to AI
            // Prepare and send to AI for the specific chat
            const { streamResult, assistantId } = await this._prepareAndSendToAI(context, chatId!, providerId!, modelId!); // Add chatId
            assistantUiMsgId = assistantId; // Store the ID

            // Process the response
            // Process the response for the specific chat
            await this._processAIResponse(streamResult, chatId!, assistantUiMsgId, context); // Add chatId

            // Finalize history
            // Finalize history for the specific chat
            await this._finalizeHistory(chatId!, assistantUiMsgId, context); // Add chatId

        } catch (error: any) {
            console.error("[SendMessageHandler] Error processing AI stream:", error);
            vscode.window.showErrorMessage(`Failed to get AI response: ${error.message}`);
            // Post a generic error message to the UI
            context.postMessage({ type: 'addMessage', sender: 'assistant', text: `Sorry, an error occurred: ${error.message}` });
            // Attempt to reconcile history even on error, using null for finalCoreMessage
            if (assistantUiMsgId) {
                try {
                    console.warn(`[SendMessageHandler] Attempting to reconcile history for ${assistantUiMsgId} after error.`);
                    // Reconcile history for the specific chat
                    // Use the higher-scoped chatId, ensuring it's defined before calling
                    if (chatId) {
                        await context.historyManager.reconcileFinalAssistantMessage(chatId, assistantUiMsgId, null, context.postMessage);
                    } else {
                         console.error("[SendMessageHandler] Cannot reconcile history after error: chatId is undefined.");
                    }
                } catch (reconcileError) {
                    console.error(`[SendMessageHandler] Error during post-error history reconciliation for ${assistantUiMsgId}:`, reconcileError);
                }
            }
        }
    }

    /** Validates the input message structure. Returns null if invalid. */
    private _validateInput(message: any, context: HandlerContext): { chatId: string | null, userMessageContent: UiMessageContentPart[] | null, providerId: string | null, modelId: string | null } {
        const chatId = message.chatId; // Get chatId from message
        const userMessageContent: UiMessageContentPart[] = message.content;
        const providerId = message.providerId;
        const modelId = message.modelId;

        if (!chatId) { // Validate chatId
            console.error("[SendMessageHandler] No chatId provided.");
            context.postMessage({ type: 'addMessage', sender: 'assistant', text: 'Error: No chat ID specified.' });
            return { chatId: null, userMessageContent: null, providerId: null, modelId: null };
        }
        if (!providerId) {
            console.error("[SendMessageHandler] No providerId provided.");
            context.postMessage({ type: 'addMessage', sender: 'assistant', text: 'Error: No provider ID specified.' });
            return { chatId: null, userMessageContent: null, providerId: null, modelId: null };
        }
        if (!modelId) {
            console.error("[SendMessageHandler] No modelId provided.");
            context.postMessage({ type: 'addMessage', sender: 'assistant', text: 'Error: No model ID specified.' });
            return { chatId: null, userMessageContent: null, providerId: null, modelId: null };
        }
        if (!Array.isArray(userMessageContent) || userMessageContent.length === 0) {
             console.error("[SendMessageHandler] Invalid or empty content array received.");
             return { chatId: null, userMessageContent: null, providerId: null, modelId: null };
        }
        const isValidContent = userMessageContent.every(part =>
             (part.type === 'text' && typeof part.text === 'string') ||
             (part.type === 'image' && typeof part.mediaType === 'string' && typeof part.data === 'string')
         );
         if (!isValidContent) {
             console.error("[SendMessageHandler] Invalid content part structure received.");
             return { chatId: null, userMessageContent: null, providerId: null, modelId: null };
         }

        return { chatId, userMessageContent, providerId, modelId };
    }

    /** Prepares data and calls the AI service. */
    private async _prepareAndSendToAI(context: HandlerContext, chatId: string, providerId: string, modelId: string): Promise<{ streamResult: StreamTextResult<any, any>, assistantId: string }> {
        // Get history for the specific chat
        const coreMessagesForAi = context.historyManager.translateUiHistoryToCoreMessages(chatId);
        console.log(`[SendMessageHandler] Translated ${context.historyManager.getHistory(chatId).length} UI messages to ${coreMessagesForAi.length} CoreMessages for chat ${chatId}.`);

        // Add frame to the specific chat
        const assistantId = await context.historyManager.addAssistantMessageFrame(chatId);

        // Call AI service for the specific chat
        const streamResult = await context.aiService.getAiResponseStream(chatId);
        return { streamResult, assistantId };
    }

    /** Processes the AI response stream. */
    private async _processAIResponse(streamResult: StreamTextResult<any, any>, chatId: string, assistantUiMsgId: string, context: HandlerContext): Promise<void> {
        // Include chatId in the message to UI
        context.postMessage({ type: 'startAssistantMessage', payload: { chatId: chatId, sender: 'assistant', messageId: assistantUiMsgId } });
        // Pass chatId to stream processor
        await this._streamProcessor.process(streamResult, chatId, assistantUiMsgId);
    }

    /** Finalizes the history after stream processing. */
    private async _finalizeHistory(chatId: string, assistantUiMsgId: string, context: HandlerContext): Promise<void> {
        try {
            console.log(`[SendMessageHandler] Stream processing finished for ${assistantUiMsgId}. Reconciling history.`);
            // Reconcile history using accumulated text and null for finalCoreMessage
            // Reconcile history for the specific chat
            await context.historyManager.reconcileFinalAssistantMessage(chatId, assistantUiMsgId, null, context.postMessage);
        } catch (finalMsgError) {
            console.error(`[SendMessageHandler] Error during final history reconciliation for ID ${assistantUiMsgId}:`, finalMsgError);
            // Optionally re-throw or handle further? For now, just log.
        }
    }
}