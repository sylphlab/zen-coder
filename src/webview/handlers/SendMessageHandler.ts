import * as vscode from 'vscode';
import { CoreMessage, Tool, StreamTextResult } from 'ai'; // Import necessary types
import { RequestHandler, HandlerContext } from './RequestHandler';
import { StreamProcessor } from '../../streamProcessor';
import { UiMessageContentPart, ChatSession } from '../../common/types'; // Import ChatSession

export class SendMessageHandler implements RequestHandler { // Implement RequestHandler
    public readonly requestType = 'sendMessage'; // Change to requestType
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

            // 1. Add user message (this now pushes a delta)
            await context.historyManager.addUserMessage(chatId!, userMessageContent); // Add chatId

            // 2. Add assistant message frame (this now pushes a delta)
            assistantUiMsgId = await context.historyManager.addAssistantMessageFrame(chatId!);
            if (!assistantUiMsgId) {
                throw new Error("Failed to add assistant message frame.");
            }

            // 3. Prepare and initiate AI stream
            const { streamResult } = await this._prepareAndSendToAI(context, chatId!, providerId!, modelId!); // Don't need assistantId from here anymore

            // 4. Process the AI response stream
            await this._processAIResponse(streamResult, chatId!, assistantUiMsgId, context); // Pass the created assistantUiMsgId

            // 5. Finalize history
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
                        await context.historyManager.messageModifier.reconcileFinalAssistantMessage(chatId, assistantUiMsgId, null, context.postMessage); // Use messageModifier
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

    /** Prepares data and calls the AI service. Returns the stream result. */
    private async _prepareAndSendToAI(context: HandlerContext, chatId: string, providerId: string, modelId: string): Promise<{ streamResult: StreamTextResult<any, any> }> {
        // Get history for the specific chat
        const coreMessagesForAi = context.historyManager.translateUiHistoryToCoreMessages(chatId);
        console.log(`[SendMessageHandler] Translated ${context.historyManager.getHistory(chatId).length} UI messages to ${coreMessagesForAi.length} CoreMessages for chat ${chatId}.`);

        // Call AI service for the specific chat
        // Note: We now pass providerId and modelId explicitly if needed, or AiService resolves defaults
        const streamResult = await context.aiService.getAiResponseStream(chatId); // Assuming AiService uses chatId to get config including provider/model
        return { streamResult };
    }

    /** Processes the AI response stream using StreamProcessor. */
    private async _processAIResponse(streamResult: StreamTextResult<any, any>, chatId: string, assistantUiMsgId: string, context: HandlerContext): Promise<void> {
        // The old 'startAssistantMessage' postMessage is removed.
        // HistoryManager.addAssistantMessageFrame now handles pushing the initial frame delta.
        await this._streamProcessor.process(streamResult, chatId, assistantUiMsgId);
    }

    /** Finalizes the history after stream processing. */
    private async _finalizeHistory(chatId: string, assistantUiMsgId: string, context: HandlerContext): Promise<void> {
        try {
            console.log(`[SendMessageHandler] Stream processing finished for ${assistantUiMsgId}. Reconciling history.`);
            // Reconcile history using accumulated text and null for finalCoreMessage via messageModifier
            await context.historyManager.messageModifier.reconcileFinalAssistantMessage(chatId, assistantUiMsgId, null, context.postMessage); // Use messageModifier
// Get the updated session data AFTER reconciliation via ChatSessionManager
const updatedSession = context.chatSessionManager.getChatSession(chatId); // Use chatSessionManager
if (updatedSession) {
    // Trigger a push update for the specific chat session
    const topic = `chatSessionUpdate/${chatId}`;
    context.postMessage({
        type: 'pushUpdate',
        payload: {
            topic: topic,
            data: updatedSession // Send the full updated session object
        }
    });
    console.log(`[SendMessageHandler] History reconciled for chat ${chatId} and ${topic} pushed.`);
} else {
     console.warn(`[SendMessageHandler] Could not find session ${chatId} after reconciliation to push.`);
}

        } catch (finalMsgError) {
            console.error(`[SendMessageHandler] Error during final history reconciliation for ID ${assistantUiMsgId}:`, finalMsgError);
            // Optionally re-throw or handle further? For now, just log.
            // Consider if we should still push state even if reconciliation fails partially? Probably not.
        }
    }
}
