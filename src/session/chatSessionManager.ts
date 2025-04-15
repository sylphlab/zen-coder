import * as vscode from 'vscode';
import {
    ChatSession,
    WorkspaceChatState,
    ChatConfig,
    SessionAddDelta,
    SessionDeleteDelta,
    SessionUpdateDelta
} from '../common/types'; // Added Delta types
import { WorkspaceStateManager } from '../state/workspaceStateManager';
import { SubscriptionManager } from '../ai/subscriptionManager'; // Added SubscriptionManager import
import { v4 as uuidv4 } from 'uuid';

const CHAT_SESSIONS_TOPIC = 'chatSessionsUpdate'; // Define the topic constant

/**
 * Manages the lifecycle and metadata of chat sessions within the workspace.
 * Handles loading/saving the overall workspace state via WorkspaceStateManager.
 * Notifies subscribers about changes via SubscriptionManager.
 */
export class ChatSessionManager {
    private _workspaceState: WorkspaceChatState;
    private readonly _stateManager: WorkspaceStateManager;
    private readonly _subscriptionManager: SubscriptionManager; // Added SubscriptionManager instance

    constructor(context: vscode.ExtensionContext, subscriptionManager: SubscriptionManager) { // Added subscriptionManager param
        this._stateManager = new WorkspaceStateManager(context);
        this._workspaceState = this._stateManager.loadState();
        this._subscriptionManager = subscriptionManager; // Store SubscriptionManager
    }

    /** Helper to save the current state using the state manager. */
    private async saveState(force: boolean = false): Promise<void> {
        console.log(`[ChatSessionManager saveState] Triggered. Force save: ${force}`); // Add log
        await this._stateManager.saveState(this._workspaceState, force);
        console.log(`[ChatSessionManager saveState] Completed.`); // Add log
    }

    /**
     * Creates a new chat session, saves the updated state, and pushes a delta update.
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
        await this.saveState(true); // Save the change

        // Push delta update
        const delta: SessionAddDelta = { type: 'sessionAdd', session: newChat };
        this._subscriptionManager.notifyChatSessionsUpdate(delta); // Use specific notifier

        console.log(`[ChatSessionManager] Created new chat session: ${newChat.name} (ID: ${newChatId}) and pushed delta.`);
        return newChat;
    }

    /**
     * Deletes a chat session by its ID, saves the updated state, pushes a delta update,
     * and adjusts the last active chat ID if necessary.
     * @param chatId - The ID of the chat session to delete.
     */
    public async deleteChatSession(chatId: string): Promise<void> {
        if (!this._workspaceState.chats[chatId]) {
            console.warn(`[ChatSessionManager] Attempted to delete non-existent chat session: ${chatId}`);
            return;
        }

        const deletedChatName = this._workspaceState.chats[chatId].name;
        delete this._workspaceState.chats[chatId]; // Modify state

        if (this._workspaceState.lastActiveChatId === chatId) {
            const remainingChatIds = Object.keys(this._workspaceState.chats);
            this._workspaceState.lastActiveChatId = remainingChatIds.length > 0 ? remainingChatIds[0] : null;
            console.log(`[ChatSessionManager] Reset last active chat ID to: ${this._workspaceState.lastActiveChatId}`);
        }

        await this.saveState(true); // Save the change

        // Push delta update
        const delta: SessionDeleteDelta = { type: 'sessionDelete', sessionId: chatId };
        this._subscriptionManager.notifyChatSessionsUpdate(delta); // Use specific notifier

        console.log(`[ChatSessionManager] Deleted chat session: ${deletedChatName} (ID: ${chatId}) and pushed delta.`);
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
     * Updates properties (name, config) of a specific chat session, saves state, and pushes a delta update.
     * @param chatId - The ID of the chat session to update.
     * @param updates - An object containing the properties to update (name, config).
     */
    public async updateChatSession(chatId: string, updates: Partial<Pick<ChatSession, 'name' | 'config'>>): Promise<void> { // Only allow name/config updates here
        const chat = this.getChatSession(chatId);
        if (!chat) {
            console.warn(`[ChatSessionManager] Attempted to update non-existent chat session: ${chatId}`);
            return;
        }

        let changed = false;
        const deltaUpdate: Partial<SessionUpdateDelta> = { type: 'sessionUpdate', sessionId: chatId };

        if (updates.name !== undefined && chat.name !== updates.name) {
            chat.name = updates.name;
            deltaUpdate.name = chat.name; // Include in delta
            changed = true;
        }
        if (updates.config !== undefined) {
            // Perform a shallow merge for config updates
            const newConfig = { ...chat.config, ...updates.config };
            // Basic check if config actually changed (doesn't handle deep equality)
            if (JSON.stringify(chat.config) !== JSON.stringify(newConfig)) {
                chat.config = newConfig;
                deltaUpdate.config = chat.config; // Include in delta
                changed = true;
            }
        }

        if (changed) {
            chat.lastModified = Date.now(); // Update timestamp if name/config changed
            deltaUpdate.lastModified = chat.lastModified; // Include in delta
            await this.saveState(); // Save if any changes occurred

            // Push delta update
            this._subscriptionManager.notifyChatSessionsUpdate(deltaUpdate as SessionUpdateDelta); // Use specific notifier, assert type

            console.log(`[ChatSessionManager] Updated chat session: ${chat.name} (ID: ${chatId}) and pushed delta.`);
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
                // Optionally push an update for lastActiveChatId if needed elsewhere? Topic: 'activeChatIdUpdate'?
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
            // Optionally push an update for lastActiveChatId? Topic: 'activeChatIdUpdate'?
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
             // Optionally push an update for lastLocation? Topic: 'lastLocationUpdate'?
        }
    }

    /**
     * Directly updates the timestamp of a chat session (used by HistoryManager when history changes)
     * and pushes a delta update for the timestamp. Also forces a save to persist history changes.
     * @param chatId The ID of the chat session.
     */
    public async touchChatSession(chatId: string): Promise<void> {
         const chat = this.getChatSession(chatId);
         if (chat) {
             const now = Date.now();
             // Always trigger save, even if only timestamp changed, to persist history modifications
             chat.lastModified = now;
             await this.saveState(true); // Force save to ensure latest history is persisted

             // Push delta update for lastModified
             const delta: SessionUpdateDelta = { type: 'sessionUpdate', sessionId: chatId, lastModified: now };
             this._subscriptionManager.notifyChatSessionsUpdate(delta); // Use specific notifier
             console.log(`[ChatSessionManager] Touched session ${chatId} and forced save.`); // Added log
         }
    }
}
