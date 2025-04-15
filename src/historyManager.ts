import * as vscode from 'vscode';
import { CoreMessage } from 'ai'; // Removed unused ToolCallPart, ToolResultPart
import {
    UiMessage,
    UiMessageContentPart,
    UiToolCallPart,
    // ChatSession, // No longer needed directly
    // ChatConfig, // No longer needed directly here
    // WorkspaceChatState, // No longer managing full state here
    // DefaultChatConfig, // Config handled by ConfigResolver
    // AvailableModel // No longer needed here
} from './common/types';
import {
    // parseAndValidateSuggestedActions, // Moved to MessageModifier
    // reconstructUiContent, // Moved to MessageModifier
    translateUserMessageToCore,
    translateAssistantMessageToCore,
    translateUiHistoryToCoreMessages // Keep utility import
} from './utils/historyUtils';
import { ChatSessionManager } from './session/chatSessionManager';
import { MessageModifier } from './history/messageModifier'; // Corrected import path

/**
 * Manages reading chat history, adding new message frames, deleting messages/history,
 * and translating message formats. Modifying existing message content is delegated
 * to MessageModifier. Relies on ChatSessionManager for session data access.
 */
export class HistoryManager {
    private readonly _sessionManager: ChatSessionManager; // Instance of the session manager
    private readonly _messageModifier: MessageModifier; // Instance of MessageModifier

    // Inject ChatSessionManager and create MessageModifier
    constructor(sessionManager: ChatSessionManager) {
        this._sessionManager = sessionManager;
        this._messageModifier = new MessageModifier(sessionManager); // Create MessageModifier instance
    }

    // --- Public Accessor for MessageModifier ---
    public get messageModifier(): MessageModifier {
        return this._messageModifier;
    }

    // --- History Reading and Frame Creation ---

    /**
     * Gets the history for a specific chat session.
     * @param chatId - The ID of the chat session.
     * @returns A copy of the history as an array of UiMessage objects, or an empty array if chat not found.
     */
    public getHistory(chatId: string): UiMessage[] {
        const chat = this._sessionManager.getChatSession(chatId);
        // Return a copy to prevent accidental mutation outside this manager
        return chat ? [...chat.history] : [];
    }

    /**
     * Adds a user message frame to the specified chat session's history and saves.
     * @param chatId - The ID of the chat session.
     * @param content - An array of content parts (text and/or images).
     * @returns The ID of the added message, or an empty string if the chat session is not found or content is invalid.
     */
    public async addUserMessage(chatId: string, content: UiMessageContentPart[]): Promise<string> {
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
        return userUiMessage.id;
    }

    /**
     * Adds an initial, empty assistant message frame to the specified chat session's history and saves.
     * @param chatId - The ID of the chat session.
     * @returns The ID of the created message frame, or an empty string if the chat session is not found.
     */
    public async addAssistantMessageFrame(chatId: string): Promise<string> {
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
        return assistantUiMsgId;
    }

    // --- Message Content Modification Methods Removed (Now in MessageModifier) ---
    /*
    public async appendTextChunk(...) { ... }
    public async addToolCall(...) { ... }
    public async updateToolStatus(...) { ... }
    public async reconcileFinalAssistantMessage(...) { ... }
    */

    // --- History Deletion ---

    /**
     * Clears the history for a specific chat session.
     * @param chatId - The ID of the chat session to clear.
     */
    public async clearHistory(chatId: string): Promise<void> {
        const chat = this._sessionManager.getChatSession(chatId);
        if (!chat) { return; }
        chat.history = []; // Modify history array
        await this._sessionManager.touchChatSession(chatId);
        console.log(`[HistoryManager] Cleared history for chat: ${chat.name} (ID: ${chatId})`);
    }

    /**
     * Deletes a specific message from a chat session's history.
     * @param chatId - The ID of the chat session.
     * @param messageId - The ID of the message to delete.
     */
    public async deleteMessageFromHistory(chatId: string, messageId: string): Promise<void> {
        const chat = this._sessionManager.getChatSession(chatId);
        if (!chat) { return; }

        const initialLength = chat.history.length;
        // Modify history array
        chat.history = chat.history.filter((msg: UiMessage) => msg.id !== messageId); // Add explicit type

        if (chat.history.length < initialLength) {
            await this._sessionManager.touchChatSession(chatId);
            console.log(`[HistoryManager] Deleted message ${messageId} from chat ${chatId}.`);
        } else {
            console.warn(`[HistoryManager] Message ${messageId} not found in chat ${chatId} for deletion.`);
        }
    }

    // --- Translation & Retrieval ---

    /**
     * Translates the UI history of a specific chat session (UiMessage[]) into the format
     * required by the Vercel AI SDK (CoreMessage[]). Delegates to utility function.
     * @param chatId - The ID of the chat session.
     * @returns An array of CoreMessage objects, or an empty array if chat not found.
     */
    public translateUiHistoryToCoreMessages(chatId: string): CoreMessage[] {
        const chatHistory = this.getHistory(chatId);
        // Use the imported utility function
        return translateUiHistoryToCoreMessages(chatHistory);
    }

    /**
     * Gets a specific message from a chat session's history.
     * @param chatId The ID of the chat session.
     * @param messageId The ID of the message to retrieve.
     * @returns The UiMessage object or null if not found.
     */
    public getMessage(chatId: string, messageId: string): UiMessage | null {
        const chat = this._sessionManager.getChatSession(chatId);
        return chat?.history.find((msg: UiMessage) => msg.id === messageId) ?? null; // Add explicit type
    }

    /**
     * Finds the assistant message containing a specific tool call ID.
     * @param chatId The ID of the chat session.
     * @param toolCallId The ID of the tool call to find.
     * @returns The UiMessage object or null if not found.
     */
    public findMessageByToolCallId(chatId: string, toolCallId: string): UiMessage | null {
        const chat = this._sessionManager.getChatSession(chatId);
        if (!chat) return null;

        for (const message of chat.history) {
            if (message.role === 'assistant' && Array.isArray(message.content)) {
                for (const part of message.content) {
                    // Ensure part has toolCallId before accessing
                    if (part.type === 'tool-call' && part.toolCallId === toolCallId) {
                        return message;
                    }
                }
            }
        }
        return null;
    }
}
