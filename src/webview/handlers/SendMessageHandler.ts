import * as vscode from 'vscode';
import { CoreMessage, Tool, StreamTextResult } from 'ai'; // Import necessary types
import { RequestHandler, HandlerContext } from './RequestHandler';
import { StreamProcessor } from '../../streamProcessor';

import {
    UiMessageContentPart,
    ChatSession,
    // Removed HistoryUpdateMessageStatusDelta import
    UiMessage,                     // Added
    HistoryAddMessageDelta,        // Keep for now, might remove later
} from '../../common/types';
// Import the parsing function
import { parseAndValidateSuggestedActions } from '../../utils/historyUtils';
import { generatePatch } from '../../utils/patchUtils'; // Import patch generator

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

        // Define oldHistoryBeforeStream outside the try block but capture inside
        let oldHistoryBeforeStream: UiMessage[] = [];

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
            // --- Capture history state BEFORE stream ---
            oldHistoryBeforeStream = JSON.parse(JSON.stringify(context.historyManager.getHistory(chatId))); // Deep clone BEFORE stream starts

            const { streamResult } = await this._prepareAndSendToAI(context, chatId, providerId, modelId); // Pass validated IDs

            // 4. Process the AI response stream and get the result
            // StreamProcessor will modify the history in-memory via HistoryManager methods
            // StreamProcessor will modify the history in-memory via internal HistoryManager methods
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

             // 5. Log stream outcome AFTER processing
             // Patch pushing now happens during stream processing via HistoryManager methods
             if (streamProcessingResult.streamError) {
                  console.error(`[SendMessageHandler|${chatId}] Stream ended with error for message ${assistantUiMsgId}:`, streamProcessingResult.streamError);
                  // HistoryManager's updateToolStatus (called via StreamProcessor) should handle pushing the error status patch.
             } else {
                  console.log(`[SendMessageHandler|${chatId}] Stream completed successfully for message ${assistantUiMsgId}. Finish reason: ${streamProcessingResult.finishReason}`);
                  // HistoryManager's appendTextChunk or updateToolStatus should handle clearing pending status via patch.
             }


            // 6. Finalize after stream completion (success or error)
            try {
                console.log(`[SendMessageHandler|${chatId}] Finalizing message ${assistantUiMsgId} after stream.`);
                // Get the final message content (which should have been saved incrementally)
                const finalMessage = context.historyManager.getMessage(chatId, assistantUiMsgId);
                const finalAccumulatedText = finalMessage?.content
                    .filter((part): part is { type: 'text', text: string } => part.type === 'text')
                    .map(part => part.text)
                    .join('') ?? '';

                // Parse suggested actions from the final text
                const { actions: parsedActions, textWithoutBlock } = parseAndValidateSuggestedActions(finalAccumulatedText);

                // If the text changed due to action block removal, we might need a way
                // to update just the text part without re-saving everything,
                // or accept that the final save might include the block if parsing failed.
                // For now, we assume incremental saves handled the text.

                // Push suggested actions update
                subscriptionManager.notifySuggestedActionsUpdate({
                    type: 'setActions',
                    chatId: chatId,
                    messageId: assistantUiMsgId,
                    actions: parsedActions ?? []
                });
                console.log(`[SendMessageHandler|${chatId}] Pushed suggested actions for ${assistantUiMsgId} (Count: ${parsedActions?.length ?? 0}).`);

                // Optional: Trigger one final save as a safeguard, though incremental saves should cover it.
                // await context.chatSessionManager.touchChatSession(chatId);
                // console.log(`[SendMessageHandler|${chatId}] Optional final save triggered for ${assistantUiMsgId}.`);

            } catch (finalizationError) {
                 console.error(`[SendMessageHandler|${chatId}] Error during finalization for ${assistantUiMsgId}:`, finalizationError);
            }

        } catch (error: any) {
            console.error("[SendMessageHandler] Error processing AI stream:", error);
            vscode.window.showErrorMessage(`Failed to get AI response: ${error.message}`);
            // Notify UI about the error
            if (chatId && assistantUiMsgId) {
                 console.error(`[SendMessageHandler|${chatId}] Handling CATCH block error for message ${assistantUiMsgId}:`, error);
                 // Attempt to update status to 'error' via HistoryManager method, which will push a patch
                 try {
                      // Use oldHistoryBeforeStream captured at the beginning of the main try block
                      const currentHistoryState = context.historyManager.getHistory(chatId); // Get potentially modified state
                      const messageIndexInError = currentHistoryState.findIndex(m => m.id === assistantUiMsgId);
                      let historyForErrorPatch = currentHistoryState;

                      if (messageIndexInError !== -1 && currentHistoryState[messageIndexInError].status !== 'error') {
                           console.log(`[SendMessageHandler|${chatId}] Updating status to 'error' in CATCH block for ${assistantUiMsgId}.`);
                           // Create a new history array with the updated status
                           historyForErrorPatch = JSON.parse(JSON.stringify(currentHistoryState));
                           historyForErrorPatch[messageIndexInError].status = 'error';
                      }

                      // Generate patch against the state *before* the stream started
                      // Use oldHistoryBeforeStream which should be available in this scope
                      const errorPatch = generatePatch(oldHistoryBeforeStream, historyForErrorPatch);
                      if (errorPatch.length > 0) {
                           subscriptionManager.notifyChatHistoryUpdate(chatId, errorPatch);
                           console.log(`[SendMessageHandler|${chatId}] Pushed CATCH block error status patch for ${assistantUiMsgId}. Patch:`, JSON.stringify(errorPatch));
                      } else {
                           console.log(`[SendMessageHandler|${chatId}] No CATCH block error status patch generated for ${assistantUiMsgId}.`);
                      }
                 } catch (patchError) {
                      console.error(`[SendMessageHandler|${chatId}] Error generating/pushing patch within CATCH block for ${assistantUiMsgId}:`, patchError);
                 }

                 // Attempt to save state even after error (touchChatSession saves current state)
                 try {
                      console.warn(`[SendMessageHandler|${chatId}] Attempting final save for ${assistantUiMsgId} after error.`);
                      await context.chatSessionManager.touchChatSession(chatId); // Save whatever state exists
                      // Clear suggested actions on error
                      subscriptionManager.notifySuggestedActionsUpdate({
                          type: 'setActions',
                          chatId: chatId,
                          messageId: assistantUiMsgId,
                          actions: []
                      });
                 } catch (saveError) {
                      console.error(`[SendMessageHandler|${chatId}] Error during post-error save for ${assistantUiMsgId}:`, saveError);
                 }
            } else {
                 // If we don't have IDs, send a general error message
                 context.postMessage({ type: 'addMessage', sender: 'assistant', text: `Sorry, an error occurred: ${error.message}` });
            }
            // Removed the second _finalizeHistory call from catch block
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

    // Removed _finalizeHistory method
}
