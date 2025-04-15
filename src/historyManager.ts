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

/**
 * Manages reading chat history, adding new message frames, deleting messages/history,
 * and translating message formats. Modifying existing message content is delegated
 * to MessageModifier. Relies on ChatSessionManager for session data access.
 */
export class HistoryManager {
    private readonly _sessionManager: ChatSessionManager;
    private readonly _messageModifier: MessageModifier;
    private _postMessageCallback?: (message: any) => void;

    constructor(sessionManager: ChatSessionManager) {
        this._sessionManager = sessionManager;
        this._messageModifier = new MessageModifier(sessionManager);
        console.log(`[HistoryManager constructor] Instance created. Callback initially: ${typeof this._postMessageCallback}`);
    }

    // Use arrow function for setter to ensure consistent 'this' if needed elsewhere
    public setPostMessageCallback = (callback: (message: any) => void): void => {
        console.log(`[HistoryManager setPostMessageCallback START] Current callback type: ${typeof this._postMessageCallback}. Received callback type: ${typeof callback}`);
        this._postMessageCallback = callback;
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

    public addUserMessage = async (chatId: string, content: UiMessageContentPart[]): Promise<string> => { // Arrow function
        console.log(`[HistoryManager addUserMessage START] Checking callback. Is set? ${!!this._postMessageCallback}. Type: ${typeof this._postMessageCallback}`);
        const chat = this._sessionManager.getChatSession(chatId);
        if (!chat) {
            console.warn(`[HistoryManager] Chat session not found: ${chatId} (addUserMessage)`);
            return '';
        }
        if (!Array.isArray(content) || content.length === 0) {
            console.warn(`[HistoryManager] Attempted to add user message with invalid content to chat ${chatId}.`);
            return '';
        }

        const userUiMessage: UiMessage = {
            id: `user-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            role: 'user',
            content: content,
            timestamp: Date.now()
        };
        chat.history.push(userUiMessage);
        await this._sessionManager.touchChatSession(chatId);

        if (this._postMessageCallback) {
            console.log(`[HistoryManager addUserMessage] Callback IS set. Pushing delta...`);
            const delta: HistoryAddMessageDelta = { type: 'historyAddMessage', chatId, message: userUiMessage };
            const topic = `chatHistoryUpdate/${chatId}`;
            this._postMessageCallback({ type: 'pushUpdate', payload: { topic, data: delta } });
             console.log(`[HistoryManager] Pushed user message delta: ${userUiMessage.id}`);
        } else {
            console.warn(`[HistoryManager] Cannot push user message delta, postMessageCallback not set.`);
        }

        return userUiMessage.id;
    }

    public addAssistantMessageFrame = async (chatId: string): Promise<string> => { // Arrow function
        console.log(`[HistoryManager addAssistantMessageFrame START] Checking callback. Is set? ${!!this._postMessageCallback}. Type: ${typeof this._postMessageCallback}`);
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
            timestamp: Date.now()
        };
        chat.history.push(initialAssistantUiMessage);
        await this._sessionManager.touchChatSession(chatId);

        if (this._postMessageCallback) {
             console.log(`[HistoryManager addAssistantMessageFrame] Callback IS set. Pushing delta...`);
             const delta: HistoryAddMessageDelta = { type: 'historyAddMessage', chatId, message: initialAssistantUiMessage };
             const topic = `chatHistoryUpdate/${chatId}`;
             this._postMessageCallback({ type: 'pushUpdate', payload: { topic, data: delta } });
             console.log(`[HistoryManager] Pushed assistant message frame delta: ${assistantUiMsgId}`);
        } else {
             console.warn(`[HistoryManager] Cannot push assistant message frame delta, postMessageCallback not set.`);
        }

        return assistantUiMsgId;
    }

    // --- History Deletion ---

    public clearHistory = async (chatId: string): Promise<void> => { // Arrow function
        console.log(`[HistoryManager clearHistory] Checking callback. Is set? ${!!this._postMessageCallback}. Type: ${typeof this._postMessageCallback}`);
        const chat = this._sessionManager.getChatSession(chatId);
        if (!chat || !this._postMessageCallback) {
            console.warn(`[HistoryManager clearHistory] Chat not found or callback not set for chat ${chatId}.`);
            return;
        }

        chat.history = [];
        await this._sessionManager.touchChatSession(chatId);

        const delta: HistoryClearDelta = { type: 'historyClear', chatId };
        const topic = `chatHistoryUpdate/${chatId}`;
        console.log(`[HistoryManager clearHistory] Callback IS set. Pushing delta...`);
        this._postMessageCallback({ type: 'pushUpdate', payload: { topic, data: delta } });

        console.log(`[HistoryManager] Cleared history for chat: ${chat.name} (ID: ${chatId}) and pushed delta.`);
    }

    public deleteMessageFromHistory = async (chatId: string, messageId: string): Promise<void> => { // Arrow function
        console.log(`[HistoryManager deleteMessageFromHistory] Checking callback. Is set? ${!!this._postMessageCallback}. Type: ${typeof this._postMessageCallback}`);
        const chat = this._sessionManager.getChatSession(chatId);
        if (!chat || !this._postMessageCallback) {
            console.warn(`[HistoryManager deleteMessageFromHistory] Chat not found or callback not set for chat ${chatId}.`);
             return;
        }

        const initialLength = chat.history.length;
        chat.history = chat.history.filter((msg: UiMessage) => msg.id !== messageId);

        if (chat.history.length < initialLength) {
            await this._sessionManager.touchChatSession(chatId);

            const delta: HistoryDeleteMessageDelta = { type: 'historyDeleteMessage', chatId, messageId };
            const topic = `chatHistoryUpdate/${chatId}`;
            console.log(`[HistoryManager deleteMessageFromHistory] Callback IS set. Pushing delta...`);
            this._postMessageCallback({ type: 'pushUpdate', payload: { topic, data: delta } });

            console.log(`[HistoryManager] Deleted message ${messageId} from chat ${chatId} and pushed delta.`);
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
