import * as vscode from 'vscode';
import { CoreMessage, Tool, StreamTextResult } from 'ai'; // Import necessary types
import { RequestHandler, HandlerContext } from './RequestHandler';
import { StreamProcessor } from '../../streamProcessor';

import {
    UiMessageContentPart,
    ChatSession,
    HistoryUpdateMessageStatusDelta, // Existing
    UiMessage,                     // Added
    HistoryAddMessageDelta         // Added
} from '../../common/types';

export class SendMessageHandler implements RequestHandler {
    public readonly requestType = 'sendMessage';

    // Constructor is empty
    constructor() {}

    public async handle(message: any, context: HandlerContext): Promise<void> {
        console.log("[SendMessageHandler] Handling sendMessage request...");
        let assistantUiMsgId: string | undefined;
        let chatId: string | undefined;
        let providerId: string | undefined; // Declare higher scope
        let modelId: string | undefined; // Declare higher scope
        let providerName: string | undefined; // Declare higher scope
        let modelName: string | undefined; // Declare higher scope

        // Get dependencies from context
        const streamProcessor = context.aiService.streamProcessor;
        const subscriptionManager = context.aiService.getSubscriptionManager(); // Use getter

        try {
            // Validate input (also get tempId)
            const { tempId: userMessageTempId } = message; // Extract and rename tempId for clarity
            // Pass userMessageTempId to the validation function
            const validationResult = this._validateInput(message, context, userMessageTempId);
            // Assign validated IDs to higher-scoped variables
            chatId = validationResult.chatId ?? undefined;
            providerId = validationResult.providerId ?? undefined;
            modelId = validationResult.modelId ?? undefined;
            const { userMessageContent } = validationResult; // Only get content here

            if (!userMessageContent || !chatId || !providerId || !modelId) {
                 console.error("[SendMessageHandler] Input validation failed.");
                 // Error message already posted by _validateInput
                 return;
            }
            // Validate tempId existence (renamed to userMessageTempId)
            if (!userMessageTempId) {
                  console.error("[SendMessageHandler] Missing tempId in sendMessage payload.");
                  // TODO: Consider sending an error message back to the UI here as well
                  return; // Stop processing if tempId is missing
             }

            // 1. Add user message (pass userMessageTempId)
            await context.historyManager.addUserMessage(chatId, userMessageContent, userMessageTempId); // Pass chatId and userMessageTempId

            // --- Get Provider and Model Names (EARLIER) ---
            // Use providerMap to get provider instance name
            const providerInstance = context.aiService.providerManager.providerMap.get(providerId);
            providerName = providerInstance?.name ?? providerId; // Assign to higher-scoped variable

            // Get model name from provider status
            const allProviderStatus = await context.aiService.providerManager.getProviderStatus();
            const providerStatus = allProviderStatus.find(p => p.id === providerId);
            const modelInfo = providerStatus?.models.find(m => m.id === modelId);
            modelName = modelInfo?.name ?? modelId; // Assign to higher-scoped variable
            // *** ADDED LOGGING ***
            console.log(`[SendMessageHandler|${chatId}] Fetched Model Info (Early): ProviderStatus found=${!!providerStatus}, ModelInfo found=${!!modelInfo}, Resolved modelName='${modelName}' (from modelInfo.name='${modelInfo?.name}', fallback modelId='${modelId}')`);

            // Ensure definite strings with fallbacks before passing
            const finalProviderId = providerId;
            const finalProviderName = providerName;
            const finalModelId = modelId;
            const finalModelName = modelName;
            // --- End Get Names ---

            // 2. Add assistant message frame (pass names for optimistic display)
            assistantUiMsgId = await context.historyManager.addAssistantMessageFrame(
                chatId!,
                finalProviderId,
                finalProviderName,
                finalModelId,
                finalModelName
            );
            if (!assistantUiMsgId) {
                throw new Error("Failed to add assistant message frame.");
            }

            // 3. Prepare and initiate AI stream
            const { streamResult } = await this._prepareAndSendToAI(context, chatId, providerId, modelId); // Pass validated IDs

            // 4. Process the AI response stream and get the result
            const streamProcessingResult = await streamProcessor.processStream(
                streamResult.fullStream,
                chatId,
                assistantUiMsgId,
                finalProviderId, // Pass definite ID
                finalProviderName, // Pass definite Name
                finalModelId, // Pass definite ID
                finalModelName // Pass definite Name
                // No notification callback passed here
            );

             console.log(`[SendMessageHandler|${chatId}] Stream processing completed. Result:`, streamProcessingResult);

             // 5. Send final status notification AFTER processing
             const finalDelta: { error?: any } = {};
             if (streamProcessingResult.streamError) {
                 finalDelta.error = streamProcessingResult.streamError;
                 console.error(`[SendMessageHandler|${chatId}] Notifying UI of stream error for message ${assistantUiMsgId}:`, finalDelta.error);
             } else {
                 // Only log successful finish reason if no error occurred
                 console.log(`[SendMessageHandler|${chatId}] Notifying UI of successful stream completion for message ${assistantUiMsgId}. Finish reason: ${streamProcessingResult.finishReason}`);
             }

             // Always send a final notification (error or undefined)
             subscriptionManager.notifyChatHistoryUpdate(chatId, {
                 type: 'historyUpdateMessageStatus',
                 chatId: chatId,
                 messageId: assistantUiMsgId,
                 status: finalDelta.error ? 'error' : undefined
             });


            // 6. Finalize history (reconcile text, extract suggested actions, add model info)
            // Use the already fetched names from higher scope
            await this._finalizeHistory(chatId, assistantUiMsgId, providerId, providerName, modelId, modelName, context); // Pass details

        } catch (error: any) {
            console.error("[SendMessageHandler] Error processing AI stream:", error);
            vscode.window.showErrorMessage(`Failed to get AI response: ${error.message}`);
            // Notify UI about the error
            if (chatId && assistantUiMsgId) {
                 console.error(`[SendMessageHandler|${chatId}] Notifying UI of stream processing error for message ${assistantUiMsgId}:`, error);
                 subscriptionManager.notifyChatHistoryUpdate(chatId, {
                     type: 'historyUpdateMessageStatus',
                     chatId: chatId,
                     messageId: assistantUiMsgId,
                     status: 'error'
                 });
            } else {
                 // If we don't have IDs, send a general error message
                 context.postMessage({ type: 'addMessage', sender: 'assistant', text: `Sorry, an error occurred: ${error.message}` });
            }

            // Reconciliation is now handled in finalizeHistory, which might still be useful
            // even after an error (e.g., to save partial text). Let finalize run.
            if (chatId && assistantUiMsgId) {
                try {
                     console.warn(`[SendMessageHandler|${chatId}] Attempting to finalize history for ${assistantUiMsgId} after error.`);
                    // Use higher-scoped variables, provide fallbacks if they are somehow still undefined
                    await this._finalizeHistory(
                        chatId,
                        assistantUiMsgId,
                        providerId ?? 'unknown',
                        providerName ?? 'Unknown',
                        modelId ?? 'unknown',
                        modelName ?? 'Unknown',
                        context
                    );
                } catch (finalizationError) {
                    console.error(`[SendMessageHandler|${chatId}] Error during post-error history finalization for ${assistantUiMsgId}:`, finalizationError);
                }
            }
        }
    }

    /** Validates the input message structure. Returns null if invalid. */
    // Add userMessageTempId to the parameters
    private _validateInput(message: any, context: HandlerContext, userMessageTempId: string | undefined): { chatId: string | null, userMessageContent: UiMessageContentPart[] | null, providerId: string | null, modelId: string | null } {
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
            context.postMessage({ type: 'pushUpdate', payload: { topic: `chatHistoryUpdate/${chatId}`, data: { type: 'messageStatus', messageId: 'error-no-provider', delta: { error: 'No provider ID specified.' } } } });
            return { chatId: null, userMessageContent: null, providerId: null, modelId: null };
        }
        if (!modelId) {
            console.error("[SendMessageHandler] No modelId provided.");
            context.postMessage({ type: 'pushUpdate', payload: { topic: `chatHistoryUpdate/${chatId}`, data: { type: 'messageStatus', messageId: 'error-no-model', delta: { error: 'No model ID specified.' } } } });
            return { chatId: null, userMessageContent: null, providerId: null, modelId: null };
        }
        if (!Array.isArray(userMessageContent) || userMessageContent.length === 0) {
             console.error("[SendMessageHandler] Invalid or empty content array received.");
             context.postMessage({ type: 'pushUpdate', payload: { topic: `chatHistoryUpdate/${chatId}`, data: { type: 'messageStatus', messageId: 'error-no-content', delta: { error: 'Cannot send empty message.' } } } });
             return { chatId: null, userMessageContent: null, providerId: null, modelId: null };
        }
        const isValidContent = userMessageContent.every(part =>
             (part.type === 'text' && typeof part.text === 'string') ||
             (part.type === 'image' && typeof part.mediaType === 'string' && typeof part.data === 'string')
         );
         if (!isValidContent) {
             console.error("[SendMessageHandler] Invalid content part structure received.");
             // Send a new error message instead of a status update
             const errorMessage: UiMessage = {
                 id: `error-invalid-content-${Date.now()}`,
                 role: 'assistant',
                 content: [{ type: 'text', text: 'Error: Invalid message content structure.' }],
                 timestamp: Date.now(),
                 status: 'error',
                 tempId: userMessageTempId // Link error back to the user message tempId
             };
             const errorDelta: HistoryAddMessageDelta = {
                 type: 'historyAddMessage',
                 chatId: chatId,
                 message: errorMessage
             };
             context.postMessage({ type: 'pushUpdate', payload: { topic: `chatHistoryUpdate/${chatId}`, data: errorDelta } });
             return { chatId: null, userMessageContent: null, providerId: null, modelId: null };
         }
 
         // --- Add check for multimodal support ---
         const hasText = userMessageContent.some(part => part.type === 'text' && part.text.trim() !== '');
         const hasImage = userMessageContent.some(part => part.type === 'image');
 
         if (hasText && hasImage) {
             // TODO: Replace this with a more robust check based on actual model capabilities from ModelResolver/ProviderManager
             const supportedMultimodalProviders = ['anthropic', 'openai', 'google']; // Example list
             if (!supportedMultimodalProviders.includes(providerId)) {
                  console.error(`[SendMessageHandler] Provider '${providerId}' (Model: ${modelId}) does not support mixed text and image input.`);
                  // Send a new error message instead of a status update
                  const errorMessage: UiMessage = {
                      id: `error-multimodal-${Date.now()}`,
                      role: 'assistant',
                      content: [{ type: 'text', text: `Error: The selected model (${modelId}) does not support sending text and images together.` }],
                      timestamp: Date.now(),
                      status: 'error',
                      tempId: userMessageTempId // Link error back to the user message tempId
                  };
                   const errorDelta: HistoryAddMessageDelta = {
                      type: 'historyAddMessage',
                      chatId: chatId,
                      message: errorMessage
                  };
                  context.postMessage({ type: 'pushUpdate', payload: { topic: `chatHistoryUpdate/${chatId}`, data: errorDelta } });
                  // Also reject the request
                  return { chatId: null, userMessageContent: null, providerId: null, modelId: null };
             }
             console.log(`[SendMessageHandler] Mixed text/image content detected for supported provider '${providerId}'. Proceeding.`);
         }
         // --- End multimodal check ---
 
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

    // Removed _processAIResponse method - logic moved into handle

    /** Finalizes the history after stream processing (reconciles text, extracts actions, adds model info). */
    private async _finalizeHistory(
        chatId: string,
        assistantUiMsgId: string,
        providerId: string | undefined, // Allow undefined from catch block
        providerName: string | undefined, // Allow undefined
        modelId: string | undefined, // Allow undefined
        modelName: string | undefined, // Allow undefined
        context: HandlerContext
    ): Promise<void> {
        try {
            console.log(`[SendMessageHandler|${chatId}] Finalizing history for message ${assistantUiMsgId}.`);
            // Reconcile history using accumulated text and null for finalCoreMessage via messageModifier
            // Use fallbacks directly in the call if values might be undefined
            await context.historyManager.messageModifier.reconcileFinalAssistantMessage(
                chatId,
                assistantUiMsgId,
                null,
                providerId ?? 'unknown',
                providerName ?? 'Unknown',
                modelId ?? 'unknown',
                modelName ?? 'Unknown',
                context.postMessage // Pass callback (though likely unused now)
            );
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
