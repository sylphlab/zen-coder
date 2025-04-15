import * as vscode from 'vscode';
import { CoreMessage, ToolCallPart as CoreToolCallPart } from 'ai';
import {
    UiMessage,
    UiMessageContentPart,
    UiToolCallPart,
    SuggestedActionsPayload, // Import payload type
    SUGGESTED_ACTIONS_TOPIC_PREFIX, // Import topic prefix
    SuggestedAction // Import SuggestedAction type
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
            // Save is deferred until reconcileFinalAssistantMessage
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

    /**
     * Reconciles the final state of an assistant message within a specific chat session.
     * Parses suggested actions, reconstructs content, saves state, and sends actions update via SubscriptionManager.
     * @param _postMessageCallback - Deprecated parameter, no longer used directly for suggested actions.
     */
    public async reconcileFinalAssistantMessage(chatId: string, assistantMessageId: string, finalCoreMessage: CoreMessage | null, _postMessageCallback: (message: any) => void): Promise<void> {
        const chat = this._sessionManager.getChatSession(chatId);
        if (!chat) {
            console.warn(`[MessageModifier reconcile] Chat session ${chatId} not found.`);
            return;
        }

        const uiMessageIndex = chat.history.findIndex((msg: UiMessage) => msg.id === assistantMessageId);
        if (uiMessageIndex === -1) {
            console.warn(`[MessageModifier reconcile] Message ${assistantMessageId} not found in chat ${chatId}.`);
            return;
        }

        const finalUiMessage = chat.history[uiMessageIndex];
        let finalCoreToolCalls: CoreToolCallPart[] = [];

        // Ensure content exists and is an array before processing
        const currentContent = Array.isArray(finalUiMessage.content) ? finalUiMessage.content : [];

        let finalAccumulatedText = currentContent
            .filter((part: UiMessageContentPart): part is { type: 'text', text: string } => part.type === 'text') // Type guard
            .map(part => part.text)
            .join('');

        // Extract tool calls from finalCoreMessage if available
        if (finalCoreMessage?.role === 'assistant' && Array.isArray(finalCoreMessage.content)) {
            finalCoreMessage.content.forEach(part => {
                if (part.type === 'tool-call') { finalCoreToolCalls.push(part); }
            });
        } else if (finalCoreMessage) {
             console.warn(`[MessageModifier reconcile] Received finalCoreMessage for chat ${chatId}, but it's not a valid assistant message. ID: ${assistantMessageId}.`);
        }

        // Parse suggested actions *from the accumulated in-memory text*
        const { actions: parsedActions, textWithoutBlock } = parseAndValidateSuggestedActions(finalAccumulatedText);
        // Reconstruct content using potentially updated tool calls and text without the action block
        const reconstructedUiContent = reconstructUiContent(finalCoreToolCalls, currentContent, textWithoutBlock);

        finalUiMessage.content = reconstructedUiContent; // Update the message content in memory
        console.log(`[MessageModifier reconcile] Chat ${chatId}, Msg ${assistantMessageId}: Content BEFORE save:`, JSON.stringify(finalUiMessage.content));

        // Save the final reconciled state (including cleaned text and potentially updated tool call states)
        await this._sessionManager.touchChatSession(chatId);
        console.log(`[MessageModifier reconcile] Chat ${chatId}, Msg ${assistantMessageId}: touchChatSession completed.`);


        // Push suggested actions update via SubscriptionManager
        const payload: SuggestedActionsPayload = {
            type: 'setActions',
            chatId: chatId,
            messageId: assistantMessageId,
            actions: parsedActions ?? [] // Ensure actions is always an array
        };
        this._subscriptionManager.notifySuggestedActionsUpdate(payload);
        console.log(`[MessageModifier reconcile] Pushed suggested actions update for Msg ${assistantMessageId} (Count: ${payload.actions.length}).`);

    }
}
