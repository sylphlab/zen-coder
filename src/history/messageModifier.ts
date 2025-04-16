import * as vscode from 'vscode';
import { CoreMessage, ToolCallPart as CoreToolCallPart } from 'ai';
import {
    UiMessage,
    UiMessageContentPart,
    UiToolCallPart,
    SuggestedActionsPayload, // Import payload type
    SUGGESTED_ACTIONS_TOPIC_PREFIX, // Import topic prefix
    SuggestedAction, // Import SuggestedAction type
    HistoryAppendChunkDelta, // <-- Import the delta type
    HistoryUpdateMessageStatusDelta // <-- Import status delta type
} from '../common/types';
import { ChatSessionManager } from '../session/chatSessionManager';
import { SubscriptionManager } from '../ai/subscriptionManager'; // Import SubscriptionManager
import {
    parseAndValidateSuggestedActions,
    reconstructUiContent,
} from '../utils/historyUtils';

/**
 * Handles modifications to the content of existing messages within a chat history.
 * Relies on ChatSessionManager to access session data and trigger saves.
 * Notifies SubscriptionManager about suggested action updates.
 */
export class MessageModifier {
    private readonly _sessionManager: ChatSessionManager;
    private readonly _subscriptionManager: SubscriptionManager; // Store SubscriptionManager

    // Modify constructor to accept SubscriptionManager
    constructor(sessionManager: ChatSessionManager, subscriptionManager: SubscriptionManager) {
        this._sessionManager = sessionManager;
        this._subscriptionManager = subscriptionManager; // Store injected instance
    }

    /**
     * Appends a text chunk to the assistant message specified by ID within a given chat session.
     * Does not trigger a save.
     */
    public async appendTextChunk(chatId: string, assistantMessageId: string, textDelta: string): Promise<void> {
        const chat = this._sessionManager.getChatSession(chatId);
        if (!chat) { return; }
        const message = chat.history.find((msg: UiMessage) => msg.id === assistantMessageId);
        if (message?.role === 'assistant') {
            if (!Array.isArray(message.content)) { message.content = []; }
            const lastContentPart = message.content[message.content.length - 1];
            if (lastContentPart?.type === 'text') {
                lastContentPart.text += textDelta;
            } else {
                message.content.push({ type: 'text', text: textDelta });
            }
            // Trigger save after appending chunk
            await this._sessionManager.touchChatSession(chatId);

            // Notify frontend about the chunk
            const delta: HistoryAppendChunkDelta = {
                type: 'historyAppendChunk',
                chatId,
                messageId: assistantMessageId,
                textChunk: textDelta, // Corrected property name
            };
            this._subscriptionManager.notifyChatHistoryUpdate(chatId, delta);
            // console.log(`[MessageModifier appendTextChunk] Pushed chunk delta for Msg ${assistantMessageId}`); // Optional: Add logging if needed
        }
    }

    /**
     * Adds a tool call part to the assistant message specified by ID within a given chat session.
     * Triggers a save.
     */
    public async addToolCall(chatId: string, assistantMessageId: string, toolCallId: string, toolName: string, args: any): Promise<void> {
        const chat = this._sessionManager.getChatSession(chatId);
        if (!chat) { return; }
        const message = chat.history.find((msg: UiMessage) => msg.id === assistantMessageId);
        if (message?.role === 'assistant') {
            if (!Array.isArray(message.content)) { message.content = []; }
            const toolCallPart: UiToolCallPart = { type: 'tool-call', toolCallId, toolName, args, status: 'pending' };
            message.content.push(toolCallPart);
            await this._sessionManager.touchChatSession(chatId); // Save after adding tool call
        }
    }

    /**
     * Updates the status, result, or progress of a specific tool call within a given chat session.
     * Triggers a save if changes were made.
     */
    public async updateToolStatus(chatId: string, toolCallId: string, status: 'running' | 'complete' | 'error', resultOrProgress?: any): Promise<void> {
        const chat = this._sessionManager.getChatSession(chatId);
        if (!chat) { return; }

        let historyChanged = false;
        for (let i = chat.history.length - 1; i >= 0; i--) {
            const msg: UiMessage = chat.history[i];
            if (msg.role === 'assistant' && Array.isArray(msg.content)) {
                const toolCallIndex = msg.content.findIndex((p: UiMessageContentPart) => p.type === 'tool-call' && (p as UiToolCallPart).toolCallId === toolCallId);
                if (toolCallIndex !== -1) {
                    const toolCallPart = msg.content[toolCallIndex] as UiToolCallPart;
                    toolCallPart.status = status;
                    if (status === 'complete' || status === 'error') {
                        toolCallPart.result = resultOrProgress ?? (status === 'complete' ? 'Completed' : 'Error');
                        toolCallPart.progress = undefined;
                    } else if (status === 'running') {
                        toolCallPart.progress = typeof resultOrProgress === 'string' ? resultOrProgress : toolCallPart.progress;
                    }
                    historyChanged = true;
                    break;
                }
            }
        }
        if (historyChanged) {
            await this._sessionManager.touchChatSession(chatId); // Save after updating tool status
        }
    }

    // Removed updateMessageContent function. Saving happens incrementally via appendTextChunk.
    // Finalization logic (parsing actions, pushing status/actions) moved to SendMessageHandler.

    // Removed reconcileFinalAssistantMessage function entirely.
    // Its responsibilities (parsing suggested actions, saving final state, pushing final status/model info)
    // should be handled by StreamProcessor and SendMessageHandler after stream completion/error.
}
