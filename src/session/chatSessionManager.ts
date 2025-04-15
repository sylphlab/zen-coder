import * as vscode from 'vscode';
import { ChatSession, WorkspaceChatState, ChatConfig } from '../common/types';
import { WorkspaceStateManager } from '../state/workspaceStateManager';
import { v4 as uuidv4 } from 'uuid';

/**
 * Manages the lifecycle and metadata of chat sessions within the workspace.
 * Handles loading/saving the overall workspace state via WorkspaceStateManager.
 */
export class ChatSessionManager {
    private _workspaceState: WorkspaceChatState;
    private readonly _stateManager: WorkspaceStateManager;

    constructor(context: vscode.ExtensionContext) {
        this._stateManager = new WorkspaceStateManager(context);
        this._workspaceState = this._stateManager.loadState();
    }

    /** Helper to save the current state using the state manager. */
    private async saveState(force: boolean = false): Promise<void> {
        await this._stateManager.saveState(this._workspaceState, force);
    }

    /**
     * Creates a new chat session and saves the updated state.
     * @param name - Optional name for the new chat.
     * @returns The newly created ChatSession.
     */
    public async createChatSession(name?: string): Promise<ChatSession> {
        const newChatId = uuidv4();
        const now = Date.now();
        const newChat: ChatSession = {
            id: newChatId,
            name: name || `Chat ${Object.keys(this._workspaceState.chats).length + 1}`,
            history: [],
            config: { useDefaults: true },
            createdAt: now,
            lastModified: now,
        };
        this._workspaceState.chats[newChatId] = newChat;
        this._workspaceState.lastActiveChatId = newChatId; // Make new chat active
        await this.saveState(true);
        console.log(`[ChatSessionManager] Created new chat session: ${newChat.name} (ID: ${newChatId})`);
        return newChat;
    }

    /**
     * Deletes a chat session by its ID and saves the updated state.
     * Adjusts the last active chat ID if necessary.
     * @param chatId - The ID of the chat session to delete.
     */
    public async deleteChatSession(chatId: string): Promise<void> {
        if (!this._workspaceState.chats[chatId]) {
            console.warn(`[ChatSessionManager] Attempted to delete non-existent chat session: ${chatId}`);
            return;
        }

        const deletedChatName = this._workspaceState.chats[chatId].name;
        delete this._workspaceState.chats[chatId];
        console.log(`[ChatSessionManager] Deleted chat session: ${deletedChatName} (ID: ${chatId})`);

        if (this._workspaceState.lastActiveChatId === chatId) {
            const remainingChatIds = Object.keys(this._workspaceState.chats);
            this._workspaceState.lastActiveChatId = remainingChatIds.length > 0 ? remainingChatIds[0] : null;
            console.log(`[ChatSessionManager] Reset last active chat ID to: ${this._workspaceState.lastActiveChatId}`);
        }

        await this.saveState(true);
    }

    /**
     * Retrieves a specific chat session by its ID from the in-memory state.
     * @param chatId - The ID of the chat session.
     * @returns The ChatSession object or undefined if not found.
     */
    public getChatSession(chatId: string): ChatSession | undefined {
        return this._workspaceState.chats[chatId];
    }

    /**
     * Retrieves all chat sessions from the in-memory state.
     * @returns An array of ChatSession objects, sorted by lastModified descending.
     */
    public getAllChatSessions(): ChatSession[] {
        return Object.values(this._workspaceState.chats).sort((a, b) => b.lastModified - a.lastModified);
    }

    /**
     * Updates properties (name, config) of a specific chat session and saves state.
     * @param chatId - The ID of the chat session to update.
     * @param updates - An object containing the properties to update.
     */
    public async updateChatSession(chatId: string, updates: Partial<Pick<ChatSession, 'name' | 'config' | 'lastModified'>>): Promise<void> {
        const chat = this.getChatSession(chatId);
        if (!chat) {
            console.warn(`[ChatSessionManager] Attempted to update non-existent chat session: ${chatId}`);
            return;
        }

        let changed = false;
        if (updates.name !== undefined && chat.name !== updates.name) {
            chat.name = updates.name;
            changed = true;
        }
        if (updates.config !== undefined) {
            chat.config = { ...chat.config, ...updates.config };
            changed = true;
        }
        // Allow explicit update of lastModified if provided (e.g., when history changes)
        if (updates.lastModified !== undefined && chat.lastModified !== updates.lastModified) {
            chat.lastModified = updates.lastModified;
            changed = true;
        } else if (changed) {
            // Otherwise, update lastModified only if name/config changed
            chat.lastModified = Date.now();
        }


        if (changed) {
            await this.saveState(); // Save if any changes occurred
            console.log(`[ChatSessionManager] Updated chat session: ${chat.name} (ID: ${chatId})`);
        }
    }

    /**
     * Gets the ID of the last active chat session, validating its existence.
     */
    public async getLastActiveChatId(): Promise<string | null> {
        const lastId = this._workspaceState.lastActiveChatId;
        if (lastId && !this._workspaceState.chats[lastId]) {
            const remainingChatIds = Object.keys(this._workspaceState.chats);
            const newActiveId = remainingChatIds.length > 0 ? remainingChatIds[0] : null;
             console.warn(`[ChatSessionManager] Last active chat ID (${lastId}) was invalid, resetting to ${newActiveId}.`);
             this._workspaceState.lastActiveChatId = newActiveId;
             if (newActiveId !== null) {
                await this.saveState(true); // Save the correction
             }
             return newActiveId;
        }
        return lastId;
    }

    /**
     * Sets the last active chat session ID and saves state.
     * @param chatId - The ID of the chat session to set as active, or null.
     */
    public async setLastActiveChatId(chatId: string | null): Promise<void> {
        if (chatId !== null && !this._workspaceState.chats[chatId]) {
            console.warn(`[ChatSessionManager] Attempted to set last active chat ID to non-existent chat: ${chatId}`);
            return;
        }
        if (this._workspaceState.lastActiveChatId !== chatId) {
            this._workspaceState.lastActiveChatId = chatId;
            await this.saveState();
            console.log(`[ChatSessionManager] Set last active chat ID to: ${chatId}`);
        }
    }

    /**
     * Gets the last known webview location for the workspace.
     */
    public getLastLocation(): string {
        return this._workspaceState.lastLocation ?? '/index.html';
    }

    /**
     * Sets the last known webview location and saves state.
     * @param location - The route string.
     */
    public async setLastLocation(location: string): Promise<void> {
        if (typeof location === 'string' && this._workspaceState.lastLocation !== location) {
            this._workspaceState.lastLocation = location;
            await this.saveState();
        }
    }

    /**
     * Directly updates the timestamp of a chat session (used by HistoryManager when history changes).
     * This avoids triggering a full 'updateChatSession' just for the timestamp.
     * @param chatId The ID of the chat session.
     */
    public async touchChatSession(chatId: string): Promise<void> {
         const chat = this.getChatSession(chatId);
         if (chat) {
             const now = Date.now();
             if (chat.lastModified !== now) { // Avoid saving if timestamp hasn't changed (unlikely but possible)
                 chat.lastModified = now;
                 await this.saveState();
             }
         }
    }
}
