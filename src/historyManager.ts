import * as vscode from 'vscode';
import { CoreMessage } from 'ai';
import {
    UiMessage,
    UiMessageContentPart,
    UiToolCallPart,
    HistoryClearDelta,
    HistoryDeleteMessageDelta,
    HistoryAddMessageDelta,
} from './common/types';
import {
    translateUserMessageToCore,
    translateAssistantMessageToCore,
    translateUiHistoryToCoreMessages
} from './utils/historyUtils';
import { ChatSessionManager } from './session/chatSessionManager';
import { MessageModifier } from './history/messageModifier';
import { SubscriptionManager } from './ai/subscriptionManager'; // Import SubscriptionManager

/**
 * Manages reading chat history, adding new message frames, deleting messages/history,
 * and translating message formats. Modifying existing message content is delegated
 * to MessageModifier. Relies on ChatSessionManager for session data access.
 * Pushes history delta updates via SubscriptionManager.
 */
export class HistoryManager {
    private readonly _sessionManager: ChatSessionManager;
    private readonly _messageModifier: MessageModifier;
    private readonly _subscriptionManager: SubscriptionManager; // Store SubscriptionManager instance
    private _postMessageCallback?: (message: any) => void; // Keep for now, but primarily use SubscriptionManager

    // Modify constructor to accept SubscriptionManager
    constructor(sessionManager: ChatSessionManager, subscriptionManager: SubscriptionManager) {
        this._sessionManager = sessionManager;
        this._subscriptionManager = subscriptionManager; // Store SubscriptionManager
        // Pass SubscriptionManager to MessageModifier
        this._messageModifier = new MessageModifier(sessionManager, this._subscriptionManager); // Pass the stored instance
        console.log(`[HistoryManager constructor] Instance created. SubscriptionManager injected.`);
    }

    // Use arrow function for setter to ensure consistent 'this' if needed elsewhere
    public setPostMessageCallback = (callback: (message: any) => void): void => {
        console.log(`[HistoryManager setPostMessageCallback START] Current callback type: ${typeof this._postMessageCallback}. Received callback type: ${typeof callback}`);
        this._postMessageCallback = callback;
        // Pass it down to modifier if it still needs it for other purposes (like suggested actions *before* refactor)
        // this._messageModifier.setPostMessageCallback(callback); // Modify MessageModifier if needed
        console.log(`[HistoryManager setPostMessageCallback END] Internal _postMessageCallback type after assignment: ${typeof this._postMessageCallback}. Is set? ${!!this._postMessageCallback}`);
    }

    public get messageModifier(): MessageModifier {
        return this._messageModifier;
    }

    // --- History Reading and Frame Creation ---

    public getHistory = (chatId: string): UiMessage[] => { // Arrow function
        const chat = this._sessionManager.getChatSession(chatId);
        return chat ? [...chat.history] : [];
    }

    // Modified to accept optional tempId
    public addUserMessage = async (chatId: string, content: UiMessageContentPart[], tempId?: string): Promise<string> => {
        const chat = this._sessionManager.getChatSession(chatId);
        if (!chat) {
            console.warn(`[HistoryManager] Chat session not found: ${chatId} (addUserMessage)`);
            return '';
        }
        if (!Array.isArray(content) || content.length === 0) {
            console.warn(`[HistoryManager] Attempted to add user message with invalid content to chat ${chatId}.`);
            return '';
        }

        const finalId = `user-${Date.now()}-${Math.random().toString(16).slice(2)}`; // Generate final ID
        const userUiMessage: UiMessage = {
            id: finalId, // Use final ID here
            tempId: tempId, // Include tempId if provided
            role: 'user',
            content: content,
            timestamp: Date.now()
        };
        chat.history.push(userUiMessage);
        await this._sessionManager.touchChatSession(chatId); // Triggers save and session update delta

        // Use SubscriptionManager to push delta (message now includes tempId if passed)
        const delta: HistoryAddMessageDelta = { type: 'historyAddMessage', chatId, message: userUiMessage };
        this._subscriptionManager.notifyChatHistoryUpdate(chatId, delta);
        console.log(`[HistoryManager] Pushed user message delta via SubscriptionManager: ID=${finalId}, TempID=${tempId}`);

        return finalId; // Return the final generated ID
    }

    // Modified to accept model/provider info for optimistic display
    public addAssistantMessageFrame = async (
        chatId: string,
        providerId?: string,
        providerName?: string,
        modelId?: string,
        modelName?: string
    ): Promise<string> => { // Arrow function
        const chat = this._sessionManager.getChatSession(chatId);
        if (!chat) {
            console.warn(`[HistoryManager] Chat session not found: ${chatId} (addAssistantMessageFrame)`);
            return '';
        }

        const assistantUiMsgId = `asst-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const initialAssistantUiMessage: UiMessage = {
            id: assistantUiMsgId,
            role: 'assistant',
            content: [],
            timestamp: Date.now(),
            status: 'pending', // Start in pending state
            // Add model/provider info if available
            providerId: providerId,
            providerName: providerName,
            modelId: modelId,
            modelName: modelName
        };
        chat.history.push(initialAssistantUiMessage);
        await this._sessionManager.touchChatSession(chatId); // Triggers save and session update delta

        // Use SubscriptionManager to push delta (including model info)
        const delta: HistoryAddMessageDelta = { type: 'historyAddMessage', chatId, message: initialAssistantUiMessage };
        this._subscriptionManager.notifyChatHistoryUpdate(chatId, delta);
        console.log(`[HistoryManager] Pushed assistant message frame delta (with model info) via SubscriptionManager: ${assistantUiMsgId}`);


        return assistantUiMsgId;
    }

    // --- History Deletion ---

    public clearHistory = async (chatId: string): Promise<void> => { // Arrow function
        const chat = this._sessionManager.getChatSession(chatId);
        if (!chat) {
            console.warn(`[HistoryManager clearHistory] Chat not found for chat ${chatId}.`);
            return;
        }

        chat.history = [];
        await this._sessionManager.touchChatSession(chatId); // Triggers save and session update delta

        // Use SubscriptionManager to push delta
        const delta: HistoryClearDelta = { type: 'historyClear', chatId };
        this._subscriptionManager.notifyChatHistoryUpdate(chatId, delta);

        console.log(`[HistoryManager] Cleared history for chat: ${chat.name} (ID: ${chatId}) and pushed delta via SubscriptionManager.`);
    }

    public deleteMessageFromHistory = async (chatId: string, messageId: string): Promise<void> => { // Arrow function
        const chat = this._sessionManager.getChatSession(chatId);
        if (!chat) {
            console.warn(`[HistoryManager deleteMessageFromHistory] Chat not found for chat ${chatId}.`);
             return;
        }

        const initialLength = chat.history.length;
        chat.history = chat.history.filter((msg: UiMessage) => msg.id !== messageId);

        if (chat.history.length < initialLength) {
            await this._sessionManager.touchChatSession(chatId); // Triggers save and session update delta

            // Use SubscriptionManager to push delta
            const delta: HistoryDeleteMessageDelta = { type: 'historyDeleteMessage', chatId, messageId };
            this._subscriptionManager.notifyChatHistoryUpdate(chatId, delta);

            console.log(`[HistoryManager] Deleted message ${messageId} from chat ${chatId} and pushed delta via SubscriptionManager.`);
        } else {
            console.warn(`[HistoryManager] Message ${messageId} not found in chat ${chatId} for deletion.`);
        }
    }

    // --- Translation & Retrieval ---

    public translateUiHistoryToCoreMessages = (chatId: string): CoreMessage[] => { // Arrow function
        const chatHistory = this.getHistory(chatId);
        return translateUiHistoryToCoreMessages(chatHistory);
    }

    public getMessage = (chatId: string, messageId: string): UiMessage | null => { // Arrow function
        const chat = this._sessionManager.getChatSession(chatId);
        return chat?.history.find((msg: UiMessage) => msg.id === messageId) ?? null;
    }

    public findMessageByToolCallId = (chatId: string, toolCallId: string): UiMessage | null => { // Arrow function
        const chat = this._sessionManager.getChatSession(chatId);
        if (!chat) return null;

        for (const message of chat.history) {
            if (message.role === 'assistant' && Array.isArray(message.content)) {
                for (const part of message.content) {
                    if (part.type === 'tool-call' && part.toolCallId === toolCallId) {
                        return message;
                    }
                }
            }
        }
        return null;
    }
}
