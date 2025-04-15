import * as vscode from 'vscode';
import { WorkspaceChatState, ChatSession, UiMessageContentPart, UiMessage } from '../common/types'; // Added UiMessage
import { v4 as uuidv4 } from 'uuid'; // Needed for creating default chat

/**
 * Manages the persistence of the workspace chat state (all chat sessions, last active chat, etc.)
 * using VS Code's workspaceState API.
 */
export class WorkspaceStateManager {
    private readonly WORKSPACE_STATE_KEY = 'zenCoderWorkspaceChats';
    private _context: vscode.ExtensionContext;
    private _lastSavedStateJson: string = '{}'; // Track last saved state to minimize writes

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
    }

    /**
     * Loads workspace chat state from VS Code workspace state.
     * Performs validation and initializes with defaults if necessary.
     * Note: This load function now returns the loaded/initialized state.
     */
    public loadState(): WorkspaceChatState {
        let loadedState: WorkspaceChatState | undefined;
        let workspaceState: WorkspaceChatState = this.getInitialDefaultState(); // Start with default

        try {
            loadedState = this._context.workspaceState.get<WorkspaceChatState>(this.WORKSPACE_STATE_KEY);
            // --- Add Logging AFTER Load ---
            console.log(`[WorkspaceStateManager loadState] Raw loaded state from workspaceState.get:`, JSON.stringify(loadedState)?.substring(0, 500) + (JSON.stringify(loadedState)?.length > 500 ? '...' : ''));
            // --- End Logging ---

            if (loadedState && typeof loadedState === 'object' && typeof loadedState.chats === 'object' && loadedState.chats !== null) {
                // Basic validation and migration/fixing logic
                const validChats: { [chatId: string]: ChatSession } = {};
                let validLastActiveId: string | null = null;
                let validLastLocation: string | undefined = loadedState.lastLocation; // Keep loaded location

                for (const chatId in loadedState.chats) {
                    const chat = loadedState.chats[chatId];
                    if (this.isValidChatSession(chat, chatId)) {
                        this.validateAndFixChatHistory(chat); // Ensure history roles/content are valid
                        validChats[chatId] = chat;
                    } else {
                        console.warn(`[WorkspaceStateManager] Invalid chat session data found for ID ${chatId}. Skipping.`);
                    }
                }
                workspaceState.chats = validChats;

                // Validate last active chat ID
                if (loadedState.lastActiveChatId && workspaceState.chats[loadedState.lastActiveChatId]) {
                    validLastActiveId = loadedState.lastActiveChatId;
                }
                workspaceState.lastActiveChatId = validLastActiveId;

                // Validate last location (keep if valid string, otherwise use default later)
                workspaceState.lastLocation = (typeof validLastLocation === 'string') ? validLastLocation : undefined;

                console.log(`[WorkspaceStateManager] Loaded and validated ${Object.keys(workspaceState.chats).length} chats. Last Active ID: ${validLastActiveId}, Last Location: ${workspaceState.lastLocation}`);

            } else {
                console.log("[WorkspaceStateManager] No valid workspace state found or state is empty. Initializing.");
                // workspaceState is already the default initial state
            }

            // Ensure at least one chat exists after loading/initialization
            if (Object.keys(workspaceState.chats).length === 0) {
                console.log("[WorkspaceStateManager] No chats found, creating default chat session.");
                const defaultChat = this.createDefaultChatSession();
                workspaceState.chats[defaultChat.id] = defaultChat;
                workspaceState.lastActiveChatId = defaultChat.id;
                workspaceState.lastLocation = '/index.html'; // Default location for new workspace
                // Force save needed after creating default chat
                this.saveState(workspaceState, true);
            } else if (!workspaceState.lastActiveChatId) {
                // If chats exist but no valid last active ID, set the first one
                workspaceState.lastActiveChatId = Object.keys(workspaceState.chats)[0];
                workspaceState.lastLocation = '/index.html'; // Reset location when resetting active chat
                 // Force save needed
                 this.saveState(workspaceState, true);
            }

            // Ensure lastLocation has a default value if still missing
             if (workspaceState.lastLocation === undefined || workspaceState.lastLocation === null) {
                 workspaceState.lastLocation = workspaceState.lastActiveChatId ? '/index.html' : '/chats';
                 console.log(`[WorkspaceStateManager] Setting default lastLocation to: ${workspaceState.lastLocation}`);
                 // Force save needed
                 this.saveState(workspaceState, true);
            }

            this._lastSavedStateJson = JSON.stringify(workspaceState); // Update tracker after potential saves

        } catch (e: any) {
            console.error("[WorkspaceStateManager] Error loading or parsing workspace state, initializing fresh:", e);
            workspaceState = this.getInitialDefaultState(); // Reset to default
            // Attempt to create default chat even after error
            try {
                 const defaultChat = this.createDefaultChatSession();
                 workspaceState.chats[defaultChat.id] = defaultChat;
                 workspaceState.lastActiveChatId = defaultChat.id;
                 workspaceState.lastLocation = '/index.html'; // Set default location
                 this.saveState(workspaceState, true); // Force save
            } catch (err) {
                 console.error("Failed to create initial default chat after load error:", err);
            }
            this._lastSavedStateJson = '{}'; // Reset tracker
        }

        // --- Add Logging BEFORE Return ---
        console.log(`[WorkspaceStateManager loadState] State AFTER validation/initialization:`, JSON.stringify(workspaceState)?.substring(0, 500) + (JSON.stringify(workspaceState)?.length > 500 ? '...' : ''));
        // --- End Logging ---
        return workspaceState;
    }

    /**
     * Saves the provided workspace state to VS Code workspace state.
     * Now *always* attempts the update if forceSave is true, bypassing the JSON comparison.
     * @param stateToSave - The WorkspaceChatState object to save.
     * @param forceSave - If true, forces the update attempt.
     */
    public async saveState(stateToSave: WorkspaceChatState, forceSave: boolean = false): Promise<void> {
        try {
            const currentStateJson = JSON.stringify(stateToSave);
            // Modify the condition: Always save if forceSave is true. Only compare JSON if forceSave is false.
            if (forceSave || currentStateJson !== this._lastSavedStateJson) {
                 console.log(`[WorkspaceStateManager saveState] Attempting save (force: ${forceSave}). Changed: ${currentStateJson !== this._lastSavedStateJson}. State snapshot:`, currentStateJson.substring(0, 500) + (currentStateJson.length > 500 ? '...' : ''));
                await this._context.workspaceState.update(this.WORKSPACE_STATE_KEY, stateToSave);
                this._lastSavedStateJson = currentStateJson; // Update tracker *after* successful update
                console.log(`[WorkspaceStateManager saveState] State update successful.`);
            } else {
                console.log(`[WorkspaceStateManager saveState] Skipping save, state unchanged (force: ${forceSave}).`);
            }
        } catch (error) {
            console.error("[WorkspaceStateManager] Failed to save workspace state:", error);
            // Consider notifying the user or implementing retry logic
        }
    }

    /**
     * Returns the initial default state structure.
     */
    private getInitialDefaultState(): WorkspaceChatState {
        return { chats: {}, lastActiveChatId: null, lastLocation: '/index.html' };
    }

    /**
     * Creates a default ChatSession object.
     */
    private createDefaultChatSession(): ChatSession {
        const newChatId = uuidv4();
        const now = Date.now();
        return {
            id: newChatId,
            name: "Default Chat",
            history: [],
            config: { useDefaults: true },
            createdAt: now,
            lastModified: now,
        };
    }

    /**
     * Validates the basic structure of a loaded ChatSession.
     */
    private isValidChatSession(chat: any, expectedId: string): chat is ChatSession {
        return chat &&
               chat.id === expectedId &&
               typeof chat.name === 'string' &&
               Array.isArray(chat.history) && // Further history validation happens in validateAndFixChatHistory
               typeof chat.config === 'object' &&
               typeof chat.createdAt === 'number' &&
               typeof chat.lastModified === 'number';
    }

    /**
     * Validates and potentially fixes issues within a chat's history array in place.
     */
    private validateAndFixChatHistory(chat: ChatSession): void {
        if (!Array.isArray(chat.history)) {
             console.warn(`[WorkspaceStateManager validateAndFixChatHistory] Chat ${chat.id} history is not an array. Resetting.`);
             chat.history = [];
             return;
        }

        chat.history.forEach((msg: UiMessage, index: number) => { // Use UiMessage type
            let messageModified = false; // Track if modifications happen for logging
            // Validate Role
            if (!msg.role || !['user', 'assistant', 'system', 'tool'].includes(msg.role)) {
                const originalRole = msg.role;
                const inferredRole = (msg as any).sender === 'user' ? 'user' : 'assistant'; // Basic inference from old 'sender'
                console.warn(`[WorkspaceStateManager validateAndFixChatHistory] Chat ${chat.id}, Message ${index}: Missing/invalid role ('${originalRole}'). Inferring as '${inferredRole}'. ID: ${msg.id}`);
                msg.role = inferredRole;
                messageModified = true;
            }

            // Validate Content is Array
            if (!Array.isArray(msg.content)) {
                console.warn(`[WorkspaceStateManager validateAndFixChatHistory] Chat ${chat.id}, Message ${index}: Content not an array. Resetting. ID: ${msg.id}`);
                msg.content = [{ type: 'text', text: '[Invalid Content]' }];
                messageModified = true;
            } else {
                // Validate content parts
                const originalContent = JSON.stringify(msg.content); // Store original for comparison
                msg.content = msg.content.filter((part: any, partIndex: number) => {
                    const isValid = part && typeof part.type === 'string';
                    if (!isValid) {
                         console.warn(`[WorkspaceStateManager validateAndFixChatHistory] Chat ${chat.id}, Message ${index}, Part ${partIndex}: Invalid content part type or structure. Removing part. ID: ${msg.id}`, part);
                         messageModified = true;
                    }
                    return isValid;
                });
                 if (msg.content.length === 0 && originalContent !== '[]') {
                      console.warn(`[WorkspaceStateManager validateAndFixChatHistory] Chat ${chat.id}, Message ${index}: All content parts removed due to invalid structure. Adding placeholder. ID: ${msg.id}`);
                      msg.content = [{ type: 'text', text: '[Invalid Content Parts]' }];
                      messageModified = true;
                 }
            }

            // Ensure other essential fields exist (id, timestamp)
            if (!msg.id) {
                 msg.id = `msg-${Date.now()}-${index}`;
                 console.warn(`[WorkspaceStateManager validateAndFixChatHistory] Chat ${chat.id}, Message ${index}: Missing ID. Assigning new ID: ${msg.id}`);
                 messageModified = true;
            }
            if (!msg.timestamp) {
                 msg.timestamp = Date.now();
                 console.warn(`[WorkspaceStateManager validateAndFixChatHistory] Chat ${chat.id}, Message ${index}: Missing timestamp. Assigning current time. ID: ${msg.id}`);
                 messageModified = true;
            }

            if (messageModified) {
                 console.log(`[WorkspaceStateManager validateAndFixChatHistory] Chat ${chat.id}, Message ${index}: Modified message state due to validation issues. New state (content):`, JSON.stringify(msg.content));
            }
        });
    }
}
