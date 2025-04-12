import * as vscode from 'vscode';
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
            const streamResult = await context.aiService.getAiResponseStream(userMessageText, coreMessagesForAi, modelId);

            if (!streamResult) {
                console.log("[SendMessageHandler] getAiResponseStream returned null, AI service likely handled error.");
                // HistoryManager keeps the user message; error was likely shown by AiService
                return;
            }

            // Add assistant message frame via HistoryManager
            const assistantUiMsgId = await context.historyManager.addAssistantMessageFrame();

            // Send start signal to UI
            context.postMessage({ type: 'startAssistantMessage', sender: 'assistant', messageId: assistantUiMsgId });

            // Process the stream using the StreamProcessor instance
            await this._streamProcessor.process(streamResult, assistantUiMsgId);

        } catch (error: any) {
            console.error("[SendMessageHandler] Error processing AI stream:", error);
            vscode.window.showErrorMessage(`Failed to get AI response: ${error.message}`);
            context.postMessage({ type: 'addMessage', sender: 'assistant', text: `Sorry, an error occurred: ${error.message}` });
            // HistoryManager handles its own saving
        }
    }
}