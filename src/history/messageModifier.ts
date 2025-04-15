import * as vscode from 'vscode';
import { CoreMessage, ToolCallPart as CoreToolCallPart } from 'ai';
import {
    UiMessage,
    UiMessageContentPart,
    UiToolCallPart,
} from '../common/types';
import { ChatSessionManager } from '../session/chatSessionManager';
import {
    parseAndValidateSuggestedActions,
    reconstructUiContent,
} from '../utils/historyUtils';

/**
 * Handles modifications to the content of existing messages within a chat history.
 * Relies on ChatSessionManager to access session data and trigger saves.
 */
export class MessageModifier {
    private readonly _sessionManager: ChatSessionManager;

    constructor(sessionManager: ChatSessionManager) {
        this._sessionManager = sessionManager;
    }

    /**
     * Appends a text chunk to the assistant message specified by ID within a given chat session.
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
            await this._sessionManager.touchChatSession(chatId);
        }
    }

    /**
     * Adds a tool call part to the assistant message specified by ID within a given chat session.
     */
    public async addToolCall(chatId: string, assistantMessageId: string, toolCallId: string, toolName: string, args: any): Promise<void> {
        const chat = this._sessionManager.getChatSession(chatId);
        if (!chat) { return; }
        const message = chat.history.find((msg: UiMessage) => msg.id === assistantMessageId);
        if (message?.role === 'assistant') {
            if (!Array.isArray(message.content)) { message.content = []; }
            const toolCallPart: UiToolCallPart = { type: 'tool-call', toolCallId, toolName, args, status: 'pending' };
            message.content.push(toolCallPart);
            await this._sessionManager.touchChatSession(chatId);
        }
    }

    /**
     * Updates the status, result, or progress of a specific tool call within a given chat session.
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
            await this._sessionManager.touchChatSession(chatId);
        }
    }

    /**
     * Reconciles the final state of an assistant message within a specific chat session.
     * Parses suggested actions, reconstructs content, saves state, and sends actions to UI.
     */
    public async reconcileFinalAssistantMessage(chatId: string, assistantMessageId: string, finalCoreMessage: CoreMessage | null, postMessageCallback: (message: any) => void): Promise<void> {
        const chat = this._sessionManager.getChatSession(chatId);
        if (!chat) { return; }

        const uiMessageIndex = chat.history.findIndex((msg: UiMessage) => msg.id === assistantMessageId);
        if (uiMessageIndex === -1) { return; }

        const finalUiMessage = chat.history[uiMessageIndex];
        let finalCoreToolCalls: CoreToolCallPart[] = [];

        let finalAccumulatedText = finalUiMessage.content
            .filter((part: UiMessageContentPart) => part.type === 'text')
            .map(part => (part as { type: 'text', text: string }).text) // Type assertion for text part
            .join('');

        if (finalCoreMessage && finalCoreMessage.role === 'assistant' && Array.isArray(finalCoreMessage.content)) {
            finalCoreMessage.content.forEach(part => {
                if (part.type === 'tool-call') { finalCoreToolCalls.push(part); }
            });
        } else if (finalCoreMessage) {
             console.warn(`[MessageModifier] Received finalCoreMessage for reconcile in chat ${chatId}, but it's not a valid assistant message. ID: ${assistantMessageId}.`);
        }

        const { actions: parsedActions, textWithoutBlock } = parseAndValidateSuggestedActions(finalAccumulatedText);
        const reconstructedUiContent = reconstructUiContent(finalCoreToolCalls, finalUiMessage.content, textWithoutBlock);

        finalUiMessage.content = reconstructedUiContent;
        await this._sessionManager.touchChatSession(chatId);

        if (parsedActions && parsedActions.length > 0) {
            postMessageCallback({ type: 'addSuggestedActions', payload: { chatId: chatId, messageId: assistantMessageId, actions: parsedActions } });
        }
    }
}
