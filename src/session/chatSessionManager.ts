import * as vscode from 'vscode';
import {
    ChatSession,
    WorkspaceChatState,
    ChatConfig,
    // Removed SessionAddDelta, SessionDeleteDelta, SessionUpdateDelta
} from '../common/types';
import { WorkspaceStateManager } from '../state/workspaceStateManager';
import { SubscriptionManager } from '../ai/subscriptionManager'; // Added SubscriptionManager import
import { generatePatch } from '../utils/patchUtils'; // Import patch generator
import { Operation } from 'fast-json-patch'; // Import Operation type
import { v4 as uuidv4 } from 'uuid';

const CHAT_SESSIONS_TOPIC = 'chatSessionsUpdate'; // Define the topic constant

/**
 * Manages the lifecycle and metadata of chat sessions within the workspace.
 * Handles loading/saving the overall workspace state via WorkspaceStateManager.
 * Notifies subscribers about changes via SubscriptionManager using JSON Patch.
 */
export class ChatSessionManager {
    private _workspaceState: WorkspaceChatState;
    private readonly _stateManager: WorkspaceStateManager;
    private readonly _subscriptionManager: SubscriptionManager;

    constructor(context: vscode.ExtensionContext, subscriptionManager: SubscriptionManager) {
        this._stateManager = new WorkspaceStateManager(context);
        this._workspaceState = this._stateManager.loadState();
        this._subscriptionManager = subscriptionManager;
    }

    /** Helper to save the current state using the state manager. */
    private async saveState(force: boolean = false): Promise<void> {
        console.log(`[ChatSessionManager saveState] Triggered. Force save: ${force}`);
        await this._stateManager.saveState(this._workspaceState, force);
        console.log(`[ChatSessionManager saveState] Completed.`);
    }

    /**
     * Creates a new chat session, saves the updated state, and pushes a JSON Patch update.
     * @param name - Optional name for the new chat.
     * @returns The newly created ChatSession.
     */
    public async createChatSession(name?: string): Promise<ChatSession> {
        const oldSessions = JSON.parse(JSON.stringify(Object.values(this._workspaceState.chats))); // Capture state before change
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
        const newSessions = Object.values(this._workspaceState.chats); // Get state after change

        // Push JSON Patch update
        const patch = generatePatch(oldSessions, newSessions);
        if (patch.length > 0) {
            this._subscriptionManager.notifyChatSessionsUpdate(patch); // Push the patch array
        }

        console.log(`[ChatSessionManager] Created new chat session: ${newChat.name} (ID: ${newChatId}) and pushed patch.`);
        return newChat;
    }

    /**
     * Deletes a chat session by its ID, saves the updated state, pushes a JSON Patch update,
     * and adjusts the last active chat ID if necessary.
     * @param chatId - The ID of the chat session to delete.
     */
    public async deleteChatSession(chatId: string): Promise<void> {
        if (!this._workspaceState.chats[chatId]) {
            console.warn(`[ChatSessionManager] Attempted to delete non-existent chat session: ${chatId}`);
            return;
        }

        const deletedChatName = this._workspaceState.chats[chatId].name;
        const oldSessions = JSON.parse(JSON.stringify(Object.values(this._workspaceState.chats))); // Capture state before change
        const sessionIndex = oldSessions.findIndex((s: ChatSession) => s.id === chatId); // Find index in the array representation
        delete this._workspaceState.chats[chatId]; // Modify state

        if (this._workspaceState.lastActiveChatId === chatId) {
            const remainingChatIds = Object.keys(this._workspaceState.chats);
            this._workspaceState.lastActiveChatId = remainingChatIds.length > 0 ? remainingChatIds[0] : null;
            console.log(`[ChatSessionManager] Reset last active chat ID to: ${this._workspaceState.lastActiveChatId}`);
        }

        await this.saveState(true); // Save the change
        const newSessions = Object.values(this._workspaceState.chats); // Get state after change

        // Push JSON Patch update
        const patch = generatePatch(oldSessions, newSessions);
        if (patch.length > 0) {
            this._subscriptionManager.notifyChatSessionsUpdate(patch); // Push the patch array
        } else if (sessionIndex !== -1) { // Ensure we only log warning if index was found but patch is empty
            console.warn(`[ChatSessionManager] No patch generated for deleting chat ${chatId}, though index was found.`);
        }

        console.log(`[ChatSessionManager] Deleted chat session: ${deletedChatName} (ID: ${chatId}) and pushed patch.`);
    }

    /**
     * Retrieves a specific chat session by its ID from the in-memory state.
     */
    public getChatSession(chatId: string): ChatSession | undefined {
        return this._workspaceState.chats[chatId];
    }

    /**
     * Retrieves all chat sessions from the in-memory state.
     */
    public getAllChatSessions(): ChatSession[] {
        return Object.values(this._workspaceState.chats).sort((a, b) => b.lastModified - a.lastModified);
    }

    /**
     * Updates properties (name, config) of a specific chat session, saves state, and pushes a JSON Patch update.
     */
    public async updateChatSession(chatId: string, updates: Partial<Pick<ChatSession, 'name' | 'config'>>): Promise<void> {
        const chat = this.getChatSession(chatId);
        if (!chat) {
            console.warn(`[ChatSessionManager] Attempted to update non-existent chat session: ${chatId}`);
            return;
        }

        let changed = false;
        const oldSessions = JSON.parse(JSON.stringify(Object.values(this._workspaceState.chats))); // Capture state before change

        if (updates.name !== undefined && chat.name !== updates.name) {
            chat.name = updates.name;
            changed = true;
        }
        if (updates.config !== undefined) {
            const newConfig = { ...chat.config, ...updates.config };
            if (JSON.stringify(chat.config) !== JSON.stringify(newConfig)) {
                chat.config = newConfig;
                changed = true;
            }
        }

        if (changed) {
            chat.lastModified = Date.now(); // Update timestamp if name/config changed
            await this.saveState(); // Save if any changes occurred
            const newSessions = Object.values(this._workspaceState.chats); // Get state after change

            // Push JSON Patch update
            const patch = generatePatch(oldSessions, newSessions);
            if (patch.length > 0) {
                this._subscriptionManager.notifyChatSessionsUpdate(patch); // Push the patch array
            } else {
                 console.warn(`[ChatSessionManager] No patch generated for updating chat ${chatId}, though changes were detected.`);
            }

            console.log(`[ChatSessionManager] Updated chat session: ${chat.name} (ID: ${chatId}) and pushed patch.`);
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
     */
    public async setLastLocation(location: string): Promise<void> {
        if (typeof location === 'string' && this._workspaceState.lastLocation !== location) {
            this._workspaceState.lastLocation = location;
            await this.saveState();
        }
    }

    /**
     * Directly updates the timestamp of a chat session (used by HistoryManager when history changes)
     * and pushes a JSON Patch update for the timestamp. Also forces a save to persist history changes.
     */
    public async touchChatSession(chatId: string): Promise<void> {
         const chat = this.getChatSession(chatId);
         if (chat) {
             const now = Date.now();
             // Capture state *before* timestamp update for patch generation
             const oldSessionsTouch = JSON.parse(JSON.stringify(Object.values(this._workspaceState.chats)));
             const touchIndex = oldSessionsTouch.findIndex((s: ChatSession) => s.id === chatId); // Add type

             // Update timestamp and save
             chat.lastModified = now;
             await this.saveState(true); // Force save to ensure latest history is persisted

             // Push JSON Patch update for lastModified
             if (touchIndex !== -1) {
                 const patch: Operation[] = [{ op: 'replace', path: `/${touchIndex}/lastModified`, value: now }]; // Define type
                 this._subscriptionManager.notifyChatSessionsUpdate(patch); // Push the patch array
             } else {
                  console.warn(`[ChatSessionManager touchChatSession] Could not find index for chat ${chatId} to generate timestamp patch.`);
             }
             console.log(`[ChatSessionManager] Touched session ${chatId}, forced save, and pushed timestamp patch.`);
         }
    }
}
