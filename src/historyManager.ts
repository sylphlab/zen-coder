import * as vscode from 'vscode';
import { CoreMessage } from 'ai';
import {
    UiMessage,
    UiMessageContentPart,
    UiToolCallPart,
    HistoryAddMessageDelta, // Keep for now, might remove later if not needed by frontend optimistic logic
    // Removed HistoryClearDelta, HistoryDeleteMessageDelta imports
} from './common/types';
import { generatePatch } from './utils/patchUtils'; // Import patch generator
import {
    translateUserMessageToCore,
    translateAssistantMessageToCore,
    translateUiHistoryToCoreMessages
} from './utils/historyUtils';
import { ChatSessionManager } from './session/chatSessionManager';
// Removed MessageModifier import
import { SubscriptionManager } from './ai/subscriptionManager'; // Import SubscriptionManager
 
 /**
 * Manages reading chat history, adding new message frames, deleting messages/history,
 * and translating message formats. Modifying existing message content is delegated
 * to MessageModifier. Relies on ChatSessionManager for session data access.
 * Pushes history delta updates via SubscriptionManager.
 */
export class HistoryManager {
    private readonly _sessionManager: ChatSessionManager;
    // Removed _messageModifier field
    private readonly _subscriptionManager: SubscriptionManager; // Store SubscriptionManager instance
    private _postMessageCallback?: (message: any) => void; // Keep for now, but primarily use SubscriptionManager

    // Modify constructor to accept SubscriptionManager
    constructor(sessionManager: ChatSessionManager, subscriptionManager: SubscriptionManager) {
        this._sessionManager = sessionManager;
        this._subscriptionManager = subscriptionManager; // Store SubscriptionManager
        // Removed MessageModifier instantiation
        console.log(`[HistoryManager constructor] Instance created. SubscriptionManager injected.`);
    }

    // Use arrow function for setter to ensure consistent 'this' if needed elsewhere
    public setPostMessageCallback = (callback: (message: any) => void): void => {
        console.log(`[HistoryManager setPostMessageCallback START] Current callback type: ${typeof this._postMessageCallback}. Received callback type: ${typeof callback}`);
        this._postMessageCallback = callback;
        // Removed passing callback to MessageModifier
        console.log(`[HistoryManager setPostMessageCallback END] Internal _postMessageCallback type after assignment: ${typeof this._postMessageCallback}. Is set? ${!!this._postMessageCallback}`);
    }
 
    // Removed messageModifier getter

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
        const oldHistory = [...chat.history]; // Capture state before mutation
        chat.history.push(userUiMessage);
        await this._sessionManager.touchChatSession(chatId); // Triggers save and session update delta
 
        // Generate and push patch
        const patch = generatePatch(oldHistory, chat.history);
        if (patch.length > 0) {
            this._subscriptionManager.notifyChatHistoryUpdate(chatId, patch);
            console.log(`[HistoryManager addUserMessage] Pushed history patch via SubscriptionManager: ID=${finalId}, TempID=${tempId}, Patch:`, JSON.stringify(patch));
        } else {
             console.log(`[HistoryManager addUserMessage] No patch generated for message ID=${finalId}, TempID=${tempId}`);
        }
 
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
        const oldHistory = [...chat.history]; // Capture state before mutation
        chat.history.push(initialAssistantUiMessage);
        await this._sessionManager.touchChatSession(chatId); // Triggers save and session update delta
 
        // Generate and push patch
        const patch = generatePatch(oldHistory, chat.history);
        if (patch.length > 0) {
            this._subscriptionManager.notifyChatHistoryUpdate(chatId, patch);
            console.log(`[HistoryManager addAssistantMessageFrame] Pushed history patch via SubscriptionManager: ${assistantUiMsgId}, Patch:`, JSON.stringify(patch));
        } else {
             console.log(`[HistoryManager addAssistantMessageFrame] No patch generated for message ID=${assistantUiMsgId}`);
        }
 
        return assistantUiMsgId;
    }

    // --- History Deletion ---

    public clearHistory = async (chatId: string): Promise<void> => { // Arrow function
        const chat = this._sessionManager.getChatSession(chatId);
        if (!chat) {
            console.warn(`[HistoryManager clearHistory] Chat not found for chat ${chatId}.`);
            return;
        }
 
        const oldHistory = [...chat.history]; // Capture state before mutation
        chat.history = [];
        await this._sessionManager.touchChatSession(chatId); // Triggers save and session update delta
 
        // Generate and push patch
        const patch = generatePatch(oldHistory, chat.history);
        // Even if patch is empty (already empty), push it to signal clear on frontend
        this._subscriptionManager.notifyChatHistoryUpdate(chatId, patch);
        console.log(`[HistoryManager clearHistory] Pushed history patch for clear via SubscriptionManager: ${chat.name} (ID: ${chatId}), Patch:`, JSON.stringify(patch));
    }

    public deleteMessageFromHistory = async (chatId: string, messageId: string): Promise<void> => { // Arrow function
        const chat = this._sessionManager.getChatSession(chatId);
        if (!chat) {
            console.warn(`[HistoryManager deleteMessageFromHistory] Chat not found for chat ${chatId}.`);
             return;
        }
 
        const oldHistory = [...chat.history]; // Capture state before mutation
        const initialLength = oldHistory.length;
        const newHistory = oldHistory.filter((msg: UiMessage) => msg.id !== messageId);
 
        if (newHistory.length < initialLength) {
            chat.history = newHistory; // Update the actual history
            await this._sessionManager.touchChatSession(chatId); // Triggers save and session update delta
 
            // Generate and push patch
            const patch = generatePatch(oldHistory, newHistory);
            if (patch.length > 0) {
                this._subscriptionManager.notifyChatHistoryUpdate(chatId, patch);
                console.log(`[HistoryManager deleteMessageFromHistory] Pushed history patch for delete via SubscriptionManager: ${messageId}, Patch:`, JSON.stringify(patch));
            } else {
                 console.log(`[HistoryManager deleteMessageFromHistory] No patch generated for deleting message ID=${messageId}`);
            }
        } else {
            console.warn(`[HistoryManager deleteMessageFromHistory] Message ${messageId} not found in chat ${chatId} for deletion.`);
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
 
    // --- Public Methods for Modifying History (called by StreamProcessor or Handlers) ---
 
    /**
     * Appends a text chunk to an assistant message, saves state, and pushes a patch.
     */
    public async appendTextChunk(chatId: string, assistantMessageId: string, textDelta: string): Promise<void> {
        const chat = this._sessionManager.getChatSession(chatId);
        if (!chat) { return; }
        const messageIndex = chat.history.findIndex((msg: UiMessage) => msg.id === assistantMessageId);
 
        if (messageIndex !== -1 && chat.history[messageIndex]?.role === 'assistant') {
            const oldHistory = JSON.parse(JSON.stringify(chat.history)); // Deep clone before modification
            const message = chat.history[messageIndex]; // Get reference
 
            if (!Array.isArray(message.content)) { message.content = []; }
            const lastContentPart = message.content[message.content.length - 1];
 
            if (lastContentPart?.type === 'text') {
                lastContentPart.text += textDelta;
            } else {
                message.content.push({ type: 'text', text: textDelta });
            }
 
            // Also clear 'pending' status if this is the first chunk for a pending message
            if (message.status === 'pending') {
                 message.status = undefined;
                 console.log(`[HistoryManager appendTextChunk] Cleared pending status for ${assistantMessageId}`);
            }
 
            await this._sessionManager.touchChatSession(chatId); // Trigger save
 
            const patch = generatePatch(oldHistory, chat.history);
            if (patch.length > 0) {
                this._subscriptionManager.notifyChatHistoryUpdate(chatId, patch);
                // console.log(`[HistoryManager appendTextChunk] Pushed patch for Msg ${assistantMessageId}`);
            }
        }
    }
 
    /**
     * Adds a tool call part to an assistant message, saves state, and pushes a patch.
     */
    public async addToolCall(chatId: string, assistantMessageId: string, toolCallId: string, toolName: string, args: any): Promise<void> {
        const chat = this._sessionManager.getChatSession(chatId);
        if (!chat) { return; }
        const messageIndex = chat.history.findIndex((msg: UiMessage) => msg.id === assistantMessageId);
 
        if (messageIndex !== -1 && chat.history[messageIndex]?.role === 'assistant') {
            const oldHistory = JSON.parse(JSON.stringify(chat.history)); // Deep clone before modification
            const message = chat.history[messageIndex]; // Get reference
 
            if (!Array.isArray(message.content)) { message.content = []; }
            const toolCallPart: UiToolCallPart = { type: 'tool-call', toolCallId, toolName, args, status: 'pending' };
            message.content.push(toolCallPart);
 
             // Clear message 'pending' status if adding a tool call (implies stream started/progressing)
             if (message.status === 'pending') {
                  message.status = undefined;
                  console.log(`[HistoryManager addToolCall] Cleared pending status for ${assistantMessageId}`);
             }
 
            await this._sessionManager.touchChatSession(chatId); // Trigger save
 
            const patch = generatePatch(oldHistory, chat.history);
            if (patch.length > 0) {
                this._subscriptionManager.notifyChatHistoryUpdate(chatId, patch);
                console.log(`[HistoryManager addToolCall] Pushed patch for tool call ${toolCallId}`);
            }
        }
    }
 
    /**
     * Updates the status of a tool call, saves state, and pushes a patch.
     */
    public async updateToolStatus(chatId: string, toolCallId: string, status: 'running' | 'complete' | 'error', resultOrProgress?: any): Promise<void> {
        const chat = this._sessionManager.getChatSession(chatId);
        if (!chat) { return; }
 
        const oldHistory = JSON.parse(JSON.stringify(chat.history)); // Deep clone before modification
        let historyChanged = false;
        let targetMessageId: string | undefined;
 
        for (let i = chat.history.length - 1; i >= 0; i--) {
            const msg: UiMessage = chat.history[i]; // Get reference
            if (msg.role === 'assistant' && Array.isArray(msg.content)) {
                const toolCallIndex = msg.content.findIndex((p: UiMessageContentPart) => p.type === 'tool-call' && (p as UiToolCallPart).toolCallId === toolCallId);
                if (toolCallIndex !== -1) {
                    const toolCallPart = msg.content[toolCallIndex] as UiToolCallPart; // Get reference
                    let changedInPart = false;
                    // Update status, result, progress
                    if (toolCallPart.status !== status) { toolCallPart.status = status; changedInPart = true; }
                    if (status === 'complete' || status === 'error') {
                        const newResult = resultOrProgress ?? (status === 'complete' ? 'Completed' : 'Error');
                        if (toolCallPart.result !== newResult) { toolCallPart.result = newResult; changedInPart = true; }
                        if (toolCallPart.progress !== undefined) { toolCallPart.progress = undefined; changedInPart = true; }
                    } else if (status === 'running') {
                        const newProgress = typeof resultOrProgress === 'string' ? resultOrProgress : toolCallPart.progress;
                        if (toolCallPart.progress !== newProgress) { toolCallPart.progress = newProgress; changedInPart = true; }
                    }
 
                    // Clear message 'pending' status if tool call completes/errors
                    if (msg.status === 'pending' && (status === 'complete' || status === 'error')) {
                         msg.status = undefined;
                         changedInPart = true; // Ensure patch is generated even if only message status changes
                         console.log(`[HistoryManager updateToolStatus] Cleared pending status for ${msg.id}`);
                    }
 
                    if (changedInPart) {
                        historyChanged = true;
                        targetMessageId = msg.id;
                    }
                    break;
                }
            }
        }
 
        if (historyChanged) {
            await this._sessionManager.touchChatSession(chatId); // Trigger save
 
            const patch = generatePatch(oldHistory, chat.history);
            if (patch.length > 0) {
                this._subscriptionManager.notifyChatHistoryUpdate(chatId, patch);
                console.log(`[HistoryManager updateToolStatus] Pushed patch for tool call ${toolCallId} in Msg ${targetMessageId}`);
            } else {
                 console.log(`[HistoryManager updateToolStatus] No patch generated for tool call ${toolCallId} in Msg ${targetMessageId}`);
            }
        }
    }
}
