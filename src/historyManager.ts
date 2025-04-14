import * as vscode from 'vscode';
import { CoreMessage, ToolCallPart as CoreToolCallPart, ToolResultPart as CoreToolResultPart } from 'ai';
import {
    UiMessage,
    UiMessageContentPart,
    UiToolCallPart,
    ChatSession,
    ChatConfig,
    WorkspaceChatState,
    DefaultChatConfig, // Import new types
    AvailableModel // Needed for provider lookup logic
} from './common/types';
import {
    parseAndValidateSuggestedActions,
    reconstructUiContent,
    translateUserMessageToCore,
    translateAssistantMessageToCore
} from './utils/historyUtils';
import { v4 as uuidv4 } from 'uuid'; // Use uuid for unique IDs

// Type for the merged configuration used by AiService
// Includes the final model IDs and the derived provider ID for the chat model
export interface EffectiveChatConfig {
    chatModelId?: string;       // Final chat model ID (e.g., "anthropic:claude-3.5-sonnet-20240620")
    providerId?: string;        // Provider ID derived from chatModelId (e.g., "anthropic")
    imageModelId?: string;      // Final image model ID
    optimizeModelId?: string;   // Final optimize model ID
}

/**
 * Manages multiple chat sessions within a workspace, including persistence
 * and translation between UI format (UiMessage) and AI SDK format (CoreMessage).
 */
export class HistoryManager {
    // Use workspaceState for multi-chat persistence per project
    private readonly WORKSPACE_STATE_KEY = 'zenCoderWorkspaceChats';
    // Initialize with default lastLocation
    private _workspaceState: WorkspaceChatState = { chats: {}, lastActiveChatId: null, lastLocation: '/index.html' };
    private _context: vscode.ExtensionContext;
    private _lastSavedStateJson: string = '{}'; // Track last saved state

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
        this.loadWorkspaceState();
    }

    /**
     * Loads workspace chat state from VS Code workspace state.
     * Initializes with a default chat if none exists.
     */
    public loadWorkspaceState(): void {
        try {
            const loadedState = this._context.workspaceState.get<WorkspaceChatState>(this.WORKSPACE_STATE_KEY);

            if (loadedState && typeof loadedState === 'object' && typeof loadedState.chats === 'object' && loadedState.chats !== null) {
                // Basic validation of loaded structure
                const validChats: { [chatId: string]: ChatSession } = {};
                let validLastActiveId: string | null = null;
                let validLastLocation: string | undefined = undefined; // Load lastLocation

                 for (const chatId in loadedState.chats) {
                     const chat = loadedState.chats[chatId];
                     // Add more robust validation if needed (e.g., check history/config structure)
                     if (chat && chat.id === chatId && typeof chat.name === 'string' && Array.isArray(chat.history) && typeof chat.config === 'object') {
                         // Validate/fix message roles within history
                         chat.history.forEach((msg: any, index: number) => {
                             if (!msg.role || !['user', 'assistant', 'system', 'tool'].includes(msg.role)) {
                                 // Attempt to infer from old 'sender' or default
                                 const inferredRole = msg.sender === 'user' ? 'user' : 'assistant'; // Basic inference
                                 console.warn(`[HistoryManager] Chat ${chatId}, Message ${index}: Missing or invalid role. Inferring as '${inferredRole}'. Message ID: ${msg.id}`);
                                 msg.role = inferredRole;
                             }
                             // Ensure content is an array (basic check)
                             if (!Array.isArray(msg.content)) {
                                 console.warn(`[HistoryManager] Chat ${chatId}, Message ${index}: Content is not an array. Resetting. Message ID: ${msg.id}`);
                                 msg.content = [{ type: 'text', text: '[Invalid Content]' }];
                             }
                         });
                         validChats[chatId] = chat;
                     } else {
                         console.warn(`[HistoryManager] Invalid chat session data found for ID ${chatId}. Skipping.`);
                     }
                 }
                 this._workspaceState.chats = validChats;

                 if (loadedState.lastActiveChatId && this._workspaceState.chats[loadedState.lastActiveChatId]) {
                     validLastActiveId = loadedState.lastActiveChatId;
                 }
                this._workspaceState.lastActiveChatId = validLastActiveId;

                // Load lastLocation if it exists and is a string
                if (typeof loadedState.lastLocation === 'string') {
                    validLastLocation = loadedState.lastLocation;
                }
                this._workspaceState.lastLocation = validLastLocation; // Assign loaded or undefined

                console.log(`[HistoryManager] Loaded ${Object.keys(this._workspaceState.chats).length} chats. Last Active ID: ${validLastActiveId}, Last Location: ${validLastLocation}`);

            } else {
                console.log("[HistoryManager] No valid workspace state found or state is empty. Initializing.");
                // Initialize with default lastLocation
                this._workspaceState = { chats: {}, lastActiveChatId: null, lastLocation: '/index.html' };
            }

            // Ensure at least one chat exists
            if (Object.keys(this._workspaceState.chats).length === 0) {
                console.log("[HistoryManager] No chats found, creating default chat session.");
                // Use async immediately invoked function expression (IIFE) to handle async creation
                (async () => {
                    try {
                        const defaultChat = await this.createChatSession("Default Chat");
                        // Check if state is still empty after async operation
                        if (Object.keys(this._workspaceState.chats).length === 1 && this._workspaceState.chats[defaultChat.id]) {
                            this._workspaceState.lastActiveChatId = defaultChat.id;
                            // Set default location when creating default chat
                            this._workspaceState.lastLocation = '/index.html';
                             await this.saveWorkspaceStateIfNeeded(true); // Force save after creating default
                        }
                    } catch (err) {
                        console.error("Failed to create initial default chat:", err);
                    }
                })();
            } else if (!this._workspaceState.lastActiveChatId) {
                 // If chats exist but no last active, set the first one as active
                this._workspaceState.lastActiveChatId = Object.keys(this._workspaceState.chats)[0];
                // If resetting active ID, also reset location to default chat view
                this._workspaceState.lastLocation = '/index.html';
                 // Use IIFE for async save
                 (async () => {
                     await this.saveWorkspaceStateIfNeeded(true);
                 })();
            }


            this._lastSavedStateJson = JSON.stringify(this._workspaceState); // Update tracker
        } catch (e: any) {
            console.error("[HistoryManager] Error loading or parsing workspace state, initializing fresh:", e);
            // Initialize with default lastLocation
            this._workspaceState = { chats: {}, lastActiveChatId: null, lastLocation: '/index.html' };
             // Attempt to create default chat even after error using IIFE
            (async () => {
                try {
                    const defaultChat = await this.createChatSession("Default Chat");
                     if (Object.keys(this._workspaceState.chats).length === 1 && this._workspaceState.chats[defaultChat.id]) {
                        this._workspaceState.lastActiveChatId = defaultChat.id;
                        this._workspaceState.lastLocation = '/index.html'; // Set default location
                        await this.saveWorkspaceStateIfNeeded(true);
                     }
                } catch (err) {
                    console.error("Failed to create initial default chat after load error:", err);
                }
            })();
            this._lastSavedStateJson = '{}'; // Reset tracker
        }

        // Ensure lastLocation has a default value if it's missing after loading/initialization
        if (this._workspaceState.lastLocation === undefined || this._workspaceState.lastLocation === null) {
             this._workspaceState.lastLocation = this._workspaceState.lastActiveChatId ? '/index.html' : '/chats';
             console.log(`[HistoryManager] Setting default lastLocation to: ${this._workspaceState.lastLocation}`);
             // Use IIFE for async save if corrected
             (async () => {
                 await this.saveWorkspaceStateIfNeeded(true);
             })();
        }
    }

    /**
     * Saves the current workspace state to VS Code workspace state if it has changed.
     * @param forceSave - If true, saves even if the state hasn't changed according to the tracker.
     */
    private async saveWorkspaceStateIfNeeded(forceSave: boolean = false): Promise<void> {
        try {
            // Add a deep copy mechanism or more robust change detection if needed
            const currentStateJson = JSON.stringify(this._workspaceState);
            if (forceSave || currentStateJson !== this._lastSavedStateJson) {
                await this._context.workspaceState.update(this.WORKSPACE_STATE_KEY, this._workspaceState);
                this._lastSavedStateJson = currentStateJson;
                // console.log(`[HistoryManager] Saved workspace state.`); // Optional: Verbose logging
            }
        } catch (error) {
            console.error("[HistoryManager] Failed to save workspace state:", error);
            // Consider notifying the user or implementing retry logic
        }
    }

    // --- Chat Session Management ---

    /**
     * Creates a new chat session.
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
            config: { useDefaults: true }, // Start with default config
            createdAt: now,
            lastModified: now,
        };
        this._workspaceState.chats[newChatId] = newChat;
        this._workspaceState.lastActiveChatId = newChatId; // Make the new chat active
        await this.saveWorkspaceStateIfNeeded(true); // Force save
        console.log(`[HistoryManager] Created new chat session: ${newChat.name} (ID: ${newChatId})`);
        return newChat;
    }

    /**
     * Deletes a chat session by its ID.
     * If the deleted chat was the last active one, sets the last active ID to null or another chat.
     * @param chatId - The ID of the chat session to delete.
     */
    public async deleteChatSession(chatId: string): Promise<void> {
        if (!this._workspaceState.chats[chatId]) {
            console.warn(`[HistoryManager] Attempted to delete non-existent chat session: ${chatId}`);
            return;
        }

        const deletedChatName = this._workspaceState.chats[chatId].name;
        delete this._workspaceState.chats[chatId];
        console.log(`[HistoryManager] Deleted chat session: ${deletedChatName} (ID: ${chatId})`);

        if (this._workspaceState.lastActiveChatId === chatId) {
            const remainingChatIds = Object.keys(this._workspaceState.chats);
            this._workspaceState.lastActiveChatId = remainingChatIds.length > 0 ? remainingChatIds[0] : null;
            console.log(`[HistoryManager] Reset last active chat ID to: ${this._workspaceState.lastActiveChatId}`);
        }

        await this.saveWorkspaceStateIfNeeded(true); // Force save
    }

    /**
     * Retrieves a specific chat session by its ID.
     * @param chatId - The ID of the chat session.
     * @returns The ChatSession object or undefined if not found.
     */
    public getChatSession(chatId: string): ChatSession | undefined {
        return this._workspaceState.chats[chatId];
    }

    /**
     * Retrieves all chat sessions.
     * @returns An array of ChatSession objects, sorted by lastModified descending.
     */
    public getAllChatSessions(): ChatSession[] {
        return Object.values(this._workspaceState.chats).sort((a, b) => b.lastModified - a.lastModified);
    }

    /**
     * Updates properties of a specific chat session (e.g., name, config).
     * @param chatId - The ID of the chat session to update.
     * @param updates - An object containing the properties to update.
     */
    public async updateChatSession(chatId: string, updates: Partial<Pick<ChatSession, 'name' | 'config'>>): Promise<void> {
        const chat = this.getChatSession(chatId);
        if (!chat) {
            console.warn(`[HistoryManager] Attempted to update non-existent chat session: ${chatId}`);
            return;
        }

        let changed = false;
        if (updates.name !== undefined && chat.name !== updates.name) {
            chat.name = updates.name;
            changed = true;
        }
        if (updates.config !== undefined) {
            // Simple merge for now, could be more sophisticated
            chat.config = { ...chat.config, ...updates.config };
            changed = true;
        }

        if (changed) {
            chat.lastModified = Date.now();
            await this.saveWorkspaceStateIfNeeded();
            console.log(`[HistoryManager] Updated chat session: ${chat.name} (ID: ${chatId})`);
        }
    }

    /**
     * Gets the ID of the last active chat session in the workspace.
     */
    public getLastActiveChatId(): string | null {
        // Ensure the last active ID still points to an existing chat
        if (this._workspaceState.lastActiveChatId && !this._workspaceState.chats[this._workspaceState.lastActiveChatId]) {
            const remainingChatIds = Object.keys(this._workspaceState.chats);
            const newActiveId = remainingChatIds.length > 0 ? remainingChatIds[0] : null;
             console.warn(`[HistoryManager] Last active chat ID (${this._workspaceState.lastActiveChatId}) was invalid, resetting to ${newActiveId}.`);
             this._workspaceState.lastActiveChatId = newActiveId;
             // Use IIFE for async save if corrected
             if (this._workspaceState.lastActiveChatId !== null) {
                 (async () => {
                     await this.saveWorkspaceStateIfNeeded(true);
                 })();
             }
        }
        return this._workspaceState.lastActiveChatId;
    }

    /**
     * Sets the last active chat session ID.
     * @param chatId - The ID of the chat session to set as active, or null.
     */
    public async setLastActiveChatId(chatId: string | null): Promise<void> {
        if (chatId !== null && !this._workspaceState.chats[chatId]) {
            console.warn(`[HistoryManager] Attempted to set last active chat ID to non-existent chat: ${chatId}`);
            return;
        }
        if (this._workspaceState.lastActiveChatId !== chatId) {
            this._workspaceState.lastActiveChatId = chatId;
            await this.saveWorkspaceStateIfNeeded();
            console.log(`[HistoryManager] Set last active chat ID to: ${chatId}`);
        }
    }
    /**
     * Gets the last known location (route) within the webview for this workspace.
     */
    public getLastLocation(): string {
        // Return the stored location, defaulting to chat view if somehow undefined
        return this._workspaceState.lastLocation ?? '/index.html';
    }

    /**
     * Sets the last known location (route) and saves the state.
     * @param location - The route string (e.g., '/chats', '/settings').
     */
    public async setLastLocation(location: string): Promise<void> {
        if (typeof location === 'string' && this._workspaceState.lastLocation !== location) {
            this._workspaceState.lastLocation = location;
            await this.saveWorkspaceStateIfNeeded();
            // console.log(`[HistoryManager] Set last location to: ${location}`); // Optional logging
        }
    }


    // --- History Management (Per Chat) ---

    /**
     * Gets the history for a specific chat session.
     * @param chatId - The ID of the chat session.
     * @returns The history as an array of UiMessage objects, or an empty array if chat not found.
     */
    public getHistory(chatId: string): UiMessage[] {
        return this.getChatSession(chatId)?.history || [];
    }

    /**
     * Adds a user message to the specified chat session's history and saves.
     * @param chatId - The ID of the chat session.
     * @param content - An array of content parts (text and/or images).
     * @returns The ID of the added message, or an empty string if chat not found or content invalid.
     */
    public async addUserMessage(chatId: string, content: UiMessageContentPart[]): Promise<string> {
        const chat = this.getChatSession(chatId);
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
            role: 'user', // Use role
            content: content,
            timestamp: Date.now()
        };
        chat.history.push(userUiMessage);
        chat.lastModified = Date.now();
        await this.saveWorkspaceStateIfNeeded();
        // console.log(`Added user message to UI history for chat ${chatId}. Count: ${chat.history.length}`);
        return userUiMessage.id;
    }

    /**
     * Adds an initial, empty assistant message frame to the specified chat session's history and saves.
     * @param chatId - The ID of the chat session.
     * @returns The ID of the created message frame, or an empty string if chat not found.
     */
    public async addAssistantMessageFrame(chatId: string): Promise<string> {
        const chat = this.getChatSession(chatId);
        if (!chat) {
            console.warn(`[HistoryManager] Chat session not found: ${chatId} (addAssistantMessageFrame)`);
            return '';
        }

        const assistantUiMsgId = `asst-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const initialAssistantUiMessage: UiMessage = {
            id: assistantUiMsgId,
            role: 'assistant', // Use role
            content: [],
            timestamp: Date.now()
        };
        chat.history.push(initialAssistantUiMessage);
        chat.lastModified = Date.now();
        await this.saveWorkspaceStateIfNeeded();
        // console.log(`Added initial assistant message frame to UI history for chat ${chatId}. Count: ${chat.history.length}`);
        return assistantUiMsgId;
    }

    /**
     * Appends a text chunk to the assistant message specified by ID within a given chat session.
     * @param chatId - The ID of the chat session.
     * @param assistantMessageId - The ID of the assistant message.
     * @param textDelta - The text chunk to append.
     */
    public async appendTextChunk(chatId: string, assistantMessageId: string, textDelta: string): Promise<void> {
        const chat = this.getChatSession(chatId);
        if (!chat) {
            // console.warn(`[HistoryManager] Chat session not found: ${chatId} (appendTextChunk)`); // Reduce noise
            return;
        }
        const message = chat.history.find(msg => msg.id === assistantMessageId);
        if (message?.role === 'assistant') { // Use role
            if (!Array.isArray(message.content)) { message.content = []; }
            const lastContentPart = message.content[message.content.length - 1];
            if (lastContentPart?.type === 'text') {
                lastContentPart.text += textDelta;
            } else {
                message.content.push({ type: 'text', text: textDelta });
            }
            chat.lastModified = Date.now(); // Update timestamp on modification
            await this.saveWorkspaceStateIfNeeded();
        } else {
            // console.warn(`[HistoryManager] Could not find assistant message ID ${assistantMessageId} in chat ${chatId} to append text chunk.`); // Reduce noise
        }
    }

    /**
     * Adds a tool call part to the assistant message specified by ID within a given chat session.
     * @param chatId - The ID of the chat session.
     * @param assistantMessageId - The ID of the assistant message.
     * @param toolCallId - The ID of the tool call.
     * @param toolName - The name of the tool being called.
     * @param args - The arguments for the tool call.
     */
    public async addToolCall(chatId: string, assistantMessageId: string, toolCallId: string, toolName: string, args: any): Promise<void> {
        const chat = this.getChatSession(chatId);
        if (!chat) {
            // console.warn(`[HistoryManager] Chat session not found: ${chatId} (addToolCall)`); // Reduce noise
            return;
        }
        const message = chat.history.find(msg => msg.id === assistantMessageId);
        if (message?.role === 'assistant') { // Use role
            if (!Array.isArray(message.content)) { message.content = []; }
            const toolCallPart: UiToolCallPart = { type: 'tool-call', toolCallId, toolName, args, status: 'pending' };
            message.content.push(toolCallPart);
            chat.lastModified = Date.now();
            await this.saveWorkspaceStateIfNeeded();
        } else {
            // console.warn(`[HistoryManager] Could not find assistant message ID ${assistantMessageId} in chat ${chatId} to add tool call.`); // Reduce noise
        }
    }

    /**
     * Updates the status, result, or progress of a specific tool call within a given chat session.
     * @param chatId - The ID of the chat session.
     * @param toolCallId - The ID of the tool call to update.
     * @param status - The new status ('running', 'complete', 'error').
     * @param resultOrProgress - The result (for complete/error) or progress message (for running).
     */
    public async updateToolStatus(chatId: string, toolCallId: string, status: 'running' | 'complete' | 'error', resultOrProgress?: any): Promise<void> {
        const chat = this.getChatSession(chatId);
        if (!chat) {
            // console.warn(`[HistoryManager] Chat session not found: ${chatId} (updateToolStatus)`); // Reduce noise
            return;
        }

        let historyChanged = false;
        for (let i = chat.history.length - 1; i >= 0; i--) {
            const msg = chat.history[i];
            if (msg.role === 'assistant' && Array.isArray(msg.content)) { // Use role
                const toolCallIndex = msg.content.findIndex((p: any) => p.type === 'tool-call' && p.toolCallId === toolCallId);
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
            chat.lastModified = Date.now();
            await this.saveWorkspaceStateIfNeeded();
        } else {
             // console.warn(`[HistoryManager] Could not find tool call ID ${toolCallId} in chat ${chatId} to update status.`); // Reduce noise
        }
    }

    /**
     * Reconciles the final state of an assistant message within a specific chat session.
     * Parses suggested actions, reconstructs content, saves state, and sends actions to UI.
     * @param chatId - The ID of the chat session.
     * @param assistantMessageId - The ID of the assistant message to reconcile.
     * @param finalCoreMessage - The final CoreMessage from the AI SDK, if available.
     * @param postMessageCallback - Callback function to send messages (like suggested actions) to the UI.
     */
    public async reconcileFinalAssistantMessage(chatId: string, assistantMessageId: string, finalCoreMessage: CoreMessage | null, postMessageCallback: (message: any) => void): Promise<void> {
        const chat = this.getChatSession(chatId);
        if (!chat) {
            console.warn(`[HistoryManager] Chat session not found: ${chatId} (reconcileFinalAssistantMessage)`);
            return;
        }

        const uiMessageIndex = chat.history.findIndex(msg => msg.id === assistantMessageId);
        if (uiMessageIndex === -1) {
            console.warn(`[HistoryManager] Could not find UI message frame (ID: ${assistantMessageId}) in chat ${chatId} to reconcile final state.`);
            return;
        }

        const finalUiMessage = chat.history[uiMessageIndex];
        let finalCoreToolCalls: CoreToolCallPart[] = [];

        // Extract accumulated text
        let finalAccumulatedText = finalUiMessage.content
            .filter(part => part.type === 'text')
            .map(part => (part as any).text) // Type assertion needed temporarily
            .join('');

        // Extract tool calls from finalCoreMessage
        if (finalCoreMessage && finalCoreMessage.role === 'assistant' && Array.isArray(finalCoreMessage.content)) {
            finalCoreMessage.content.forEach(part => {
                if (part.type === 'tool-call') { finalCoreToolCalls.push(part); }
            });
        } else if (finalCoreMessage) {
             console.warn(`[HistoryManager] Received finalCoreMessage for reconcile in chat ${chatId}, but it's not a valid assistant message. ID: ${assistantMessageId}.`);
        }

        // Parse suggested actions and get text without the JSON block
        const { actions: parsedActions, textWithoutBlock } = parseAndValidateSuggestedActions(finalAccumulatedText);

        // Reconstruct UI content
        const reconstructedUiContent = reconstructUiContent(finalCoreToolCalls, finalUiMessage.content, textWithoutBlock);
        finalUiMessage.content = reconstructedUiContent;
        chat.lastModified = Date.now();

        // Save the final reconciled UI message state
        await this.saveWorkspaceStateIfNeeded();
        // console.log(`[HistoryManager] Reconciled final UI state for message ID: ${assistantMessageId} in chat ${chatId}.`);

        // Send parsed actions to UI
        if (parsedActions && parsedActions.length > 0) {
            postMessageCallback({ type: 'addSuggestedActions', payload: { chatId: chatId, messageId: assistantMessageId, actions: parsedActions } }); // Include chatId
            // console.log(`[HistoryManager] Sent suggested actions to UI for message ${assistantMessageId} in chat ${chatId}.`);
        }
    }

    /**
     * Clears the history for a specific chat session.
     * @param chatId - The ID of the chat session to clear.
     */
    public async clearHistory(chatId: string): Promise<void> {
        const chat = this.getChatSession(chatId);
        if (!chat) {
            console.warn(`[HistoryManager] Chat session not found: ${chatId} (clearHistory)`);
            return;
        }
        chat.history = [];
        chat.lastModified = Date.now();
        await this.saveWorkspaceStateIfNeeded();
        console.log(`[HistoryManager] Cleared history for chat: ${chat.name} (ID: ${chatId})`);
    }

    /**
     * Deletes a specific message from a chat session's history.
     * @param chatId - The ID of the chat session.
     * @param messageId - The ID of the message to delete.
     */
    public async deleteMessageFromHistory(chatId: string, messageId: string): Promise<void> {
        const chat = this.getChatSession(chatId);
        if (!chat) {
            console.warn(`[HistoryManager] Chat session not found: ${chatId} (deleteMessageFromHistory)`);
            return;
        }

        const initialLength = chat.history.length;
        chat.history = chat.history.filter(msg => msg.id !== messageId);

        if (chat.history.length < initialLength) {
            chat.lastModified = Date.now();
            await this.saveWorkspaceStateIfNeeded();
            console.log(`[HistoryManager] Deleted message ${messageId} from chat ${chatId}.`);
        } else {
            console.warn(`[HistoryManager] Message ${messageId} not found in chat ${chatId} for deletion.`);
        }
    }

    /**
     * Translates the UI history of a specific chat session (UiMessage[]) into the format
     * required by the Vercel AI SDK (CoreMessage[]).
     * @param chatId - The ID of the chat session.
     * @returns An array of CoreMessage objects, or an empty array if chat not found.
     */
    public translateUiHistoryToCoreMessages(chatId: string): CoreMessage[] {
        const chatHistory = this.getHistory(chatId);
        if (!chatHistory) return [];

        const coreMessages: CoreMessage[] = [];
        for (const uiMsg of chatHistory) {
            if (uiMsg.role === 'user') { // Use role
                const coreMsg = translateUserMessageToCore(uiMsg);
                if (coreMsg) {
                    coreMessages.push(coreMsg);
                }
            } else if (uiMsg.role === 'assistant') { // Use role
                const coreMsgs = translateAssistantMessageToCore(uiMsg);
                coreMessages.push(...coreMsgs);
            }
        }
        return coreMessages;
    }

    // --- Configuration Management (Basic Stubs) ---
    // TODO: Implement loading/saving of default config (globalState or settings)
    // TODO: Implement merging logic for chat-specific config + defaults

    public getDefaultConfig(): DefaultChatConfig {
        const config = vscode.workspace.getConfiguration('zencoder.defaults');
        // Provide fallback values (e.g., undefined or a known default model) if settings are missing
        const defaultConfig: DefaultChatConfig = {
            defaultProviderId: config.get<string>('defaultProviderId'), // Use correct setting ID
            defaultModelId: config.get<string>('defaultModelId'),       // Use correct setting ID
            defaultImageModelId: config.get<string>('imageModelId'),
            defaultOptimizeModelId: config.get<string>('optimizeModelId'),
        };
        // console.log("[HistoryManager] Loaded default config:", defaultConfig); // Optional logging
        return defaultConfig;
    }

    public getChatEffectiveConfig(chatId: string): EffectiveChatConfig {
        const chat = this.getChatSession(chatId);
        const defaults = this.getDefaultConfig();
        const effectiveConfig: EffectiveChatConfig = {}; // Start empty

        // Determine final providerId and modelName based on chat config and defaults
        let finalProviderId: string | undefined;
        let finalModelId: string | undefined; // Changed from finalModelName

        if (chat?.config.useDefaults === false) {
            // Use only chat-specific settings if defined
            finalProviderId = chat.config.providerId;
            // If not using defaults, use the chat-specific providerId and modelId
            finalProviderId = chat.config.providerId;
            finalModelId = chat.config.modelId;
            // We will combine these later if both are present
            // finalProviderId = chat.config.providerId; // Keep for reference if needed elsewhere
            finalModelId = chat.config.modelId; // Keep for reference if needed elsewhere
            effectiveConfig.imageModelId = chat.config.imageModelId; // Keep combined for now
            effectiveConfig.optimizeModelId = chat.config.optimizeModelId; // Keep combined for now
        } else {
            // Use defaults, overridden by chat specifics if they exist
            finalProviderId = chat?.config.providerId ?? defaults.defaultProviderId; // Use defaultProviderId
            finalModelId = chat?.config.modelId ?? defaults.defaultModelId;       // Use defaultModelId
            effectiveConfig.imageModelId = chat?.config.imageModelId ?? defaults.defaultImageModelId;
            effectiveConfig.optimizeModelId = chat?.config.optimizeModelId ?? defaults.defaultOptimizeModelId;
        }

        // Store the derived providerId
        effectiveConfig.providerId = finalProviderId;

        // Combine providerId and modelId into the chatModelId expected by AiService
        // This block is primarily for the case where defaults are used or partially overridden
        // Combine providerId and modelId into the chatModelId
        if (finalProviderId && finalModelId) {
            effectiveConfig.chatModelId = `${finalProviderId}:${finalModelId}`;
        } else {
            effectiveConfig.chatModelId = undefined; // Set to undefined if either part is missing
            if (finalProviderId || finalModelId) {
                 // Log a warning if only one part is defined, indicating inconsistent state
                 console.warn(`[HistoryManager] Inconsistent chat model config for chat ${chatId}. Provider: ${finalProviderId}, Model: ${finalModelId}. Setting chatModelId to undefined.`);
            }
        }

        // console.log(`[HistoryManager] Effective config for chat ${chatId}:`, effectiveConfig); // Optional logging
        return effectiveConfig;
    }

    /**
     * Gets a specific message from a chat session's history.
     * @param chatId The ID of the chat session.
     * @param messageId The ID of the message to retrieve.
     * @returns The UiMessage object or null if not found.
     */
    public getMessage(chatId: string, messageId: string): UiMessage | null {
        const chat = this.getChatSession(chatId);
        return chat?.history.find(msg => msg.id === messageId) ?? null;
    }

    /**
     * Finds the assistant message containing a specific tool call ID.
     * @param chatId The ID of the chat session.
     * @param toolCallId The ID of the tool call to find.
     * @returns The UiMessage object or null if not found.
     */
    public findMessageByToolCallId(chatId: string, toolCallId: string): UiMessage | null {
        const chat = this.getChatSession(chatId);
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
