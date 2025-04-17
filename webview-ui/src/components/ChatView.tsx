import { FunctionalComponent } from 'preact';
import { useState, useRef, useEffect, useMemo, useCallback } from 'preact/hooks';
import { useStore } from '@nanostores/react';
import { router } from '../stores/router';
import {
    $sendMessage,
    $executeToolAction,
    $suggestedActions,
    $deleteMessage,
    $clearChatHistory,
    $stopGeneration,
    $updateChatConfig,
    $isStreamingResponse,
    SendMessagePayload,
    $chatSessions
} from '../stores/chatStores';
import { $activeChatHistory, $activeChatSession } from '../stores/activeChatHistoryStore';
import { $defaultConfig } from '../stores/chatStores';
import {
    SuggestedAction,
    UiMessageContentPart,
    UiImagePart,
    ChatConfig,
    UiTextMessagePart,
    ChatSession,
    DefaultChatConfig,
    UiMessage
} from '../../../src/common/types';
import { MessagesArea } from './MessagesArea';
import { InputArea, SelectedImage } from './InputArea';
import { ConfirmationDialog } from './ConfirmationDialog';
import { useImageUpload } from '../hooks/useImageUpload';
import { generateUniqueId } from '../utils/communication';
import { Button } from './ui/Button';

// Helper function to calculate effective config (Keep as is)
const calculateEffectiveConfig = (chatSession: ChatSession | null | undefined, defaultConfig: DefaultChatConfig | null): ChatConfig => {
    const baseDefaults: Partial<ChatConfig> = { useDefaults: true };
    const effectiveDefaults = { ...baseDefaults, ...(defaultConfig ?? {}) };
    if (!chatSession) return effectiveDefaults as ChatConfig;
    const chatConfig = chatSession.config;
    if (chatConfig.useDefaults) {
        return {
            ...effectiveDefaults,
            ...chatConfig,
            providerId: chatConfig.providerId ?? effectiveDefaults.defaultProviderId,
            modelId: chatConfig.modelId ?? effectiveDefaults.defaultModelId,
            useDefaults: true
        } as ChatConfig;
    } else {
        return {
            useDefaults: false,
            providerId: chatConfig.providerId ?? effectiveDefaults.defaultProviderId,
            modelId: chatConfig.modelId ?? effectiveDefaults.defaultModelId,
        };
    }
};

// SVG Icons for minimalist header
const ChatsIcon: FunctionalComponent<{ className?: string }> = ({ className = "h-5 w-5" }) => (
    <svg class={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
);

const SettingsIcon: FunctionalComponent<{ className?: string }> = ({ className = "h-5 w-5" }) => (
    <svg class={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
);

export const ChatView: FunctionalComponent<{ chatIdFromRoute?: string }> = ({ chatIdFromRoute }) => {
    const route = useStore(router);
    const chatId = useMemo(() => {
        // Prioritize chatIdFromRoute from props if available
        if (chatIdFromRoute) {
            return chatIdFromRoute;
        }
        // Otherwise fall back to route params
        if (!route || !('params' in route) || !route.params || !('chatId' in route.params)) {
            return null;
        }
        return route.params.chatId;
    }, [route, chatIdFromRoute]);

    // --- State Management ---
    const [inputValue, _setInputValue] = useState('');
    const [optimisticConfig, setOptimisticConfig] = useState<{ providerId: string | null; modelId: string | null } | null>(null);
    const setInputValue = useCallback((value: string) => { _setInputValue(value); }, []);

    // Nanostores state
    const currentChatSession = useStore($activeChatSession);
    const defaultConfigStoreValue = useStore($defaultConfig);
    const { mutate: sendMessageMutate, loading: isSending } = useStore($sendMessage);
    const { mutate: clearChatHistoryMutate } = useStore($clearChatHistory);
    const { mutate: executeToolActionMutate } = useStore($executeToolAction);
    const { mutate: stopGenerationMutate } = useStore($stopGeneration);
    const { mutate: updateChatConfigMutate } = useStore($updateChatConfig);
    const { mutate: deleteMessageMutate } = useStore($deleteMessage);
    const messagesState = useStore($activeChatHistory);
    const isHistoryLoading = messagesState === 'loading';
    const isStreamingStoreValue = useStore($isStreamingResponse);
    const isStreaming = typeof isStreamingStoreValue === 'boolean' && isStreamingStoreValue === true;
    const suggestedActionsStoreValue = useStore($suggestedActions);
    const suggestedActionsMap = (typeof suggestedActionsStoreValue === 'object' && suggestedActionsStoreValue !== null && !('loading' in suggestedActionsStoreValue) && !('error' in suggestedActionsStoreValue))
        ? suggestedActionsStoreValue
        : {};

    // Derived state
    const isLoadingSessionData = currentChatSession === 'loading';
    const sessionLoadError = currentChatSession === null && !isLoadingSessionData;
    const historyLoadError = messagesState === 'error';
    const messages = (messagesState === 'loading' || messagesState === 'error' || messagesState === null) ? [] : messagesState;
    const defaultConfig = (defaultConfigStoreValue !== 'loading' && defaultConfigStoreValue !== 'error' && defaultConfigStoreValue !== null) ? defaultConfigStoreValue : null;
    const session = (currentChatSession !== 'loading' && currentChatSession !== null) ? currentChatSession : null;
    const effectiveConfig = useMemo(() => calculateEffectiveConfig(session, defaultConfig), [session, defaultConfig]);
    const providerId = optimisticConfig?.providerId ?? effectiveConfig.providerId;
    const modelId = optimisticConfig?.modelId ?? effectiveConfig.modelId;

    // Refs
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // Custom Hooks
    const {
        selectedImages,
        setSelectedImages,
        fileInputRef,
        handleImageFileChange,
        triggerImageUpload,
        removeSelectedImage,
        clearSelectedImages
    } = useImageUpload();

    // --- Effects ---
    useEffect(() => { // Scroll to bottom
        if (!isHistoryLoading && messages.length > 0) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isHistoryLoading]);

    // --- Event Handlers ---
    const handleSend = useCallback(async () => {
        if ((inputValue.trim() || selectedImages.length > 0) && !isSending && !isStreaming && providerId && modelId && chatId) {
            const contentParts: UiMessageContentPart[] = selectedImages.map((img: SelectedImage) => ({ type: 'image', mediaType: img.mediaType ?? (img.data.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png'), data: img.data.split(',')[1] } as UiImagePart));
            const optimisticContentParts: UiMessageContentPart[] = selectedImages.map((img: SelectedImage) => ({ type: 'image', mediaType: img.mediaType, data: img.data } as UiImagePart));
            if (inputValue.trim()) {
                const textPart = { type: 'text', text: inputValue.trim() } as UiTextMessagePart;
                contentParts.push(textPart);
                optimisticContentParts.push(textPart);
            }
            const timestamp = Date.now();
            const tempId = generateUniqueId();
            const optimisticAssistantId = `pending-assistant-${timestamp}`;
            const optimisticUserMessage: UiMessage = { id: tempId, tempId: tempId, role: 'user', content: optimisticContentParts, timestamp: timestamp };
            const optimisticPendingMessage: UiMessage = { id: optimisticAssistantId, role: 'assistant', content: [], timestamp: timestamp + 1, status: 'pending', providerId: providerId, providerName: session?.config?.providerName ?? providerId, modelId: modelId, modelName: session?.config?.modelName ?? modelId };
            const currentActualHistory = $activeChatHistory.getActualState();
            let optimisticState: UiMessage[] | null = Array.isArray(currentActualHistory) ? [...currentActualHistory, optimisticUserMessage, optimisticPendingMessage] : [optimisticUserMessage, optimisticPendingMessage];

            setInputValue('');
            clearSelectedImages();
            if (textareaRef.current) textareaRef.current.style.height = 'auto';

            const backendPayload: SendMessagePayload = { chatId, content: contentParts, providerId, modelId, tempId };
            try {
                await sendMessageMutate(backendPayload, { optimisticState });
            } catch (error) { console.error(`Error sending message:`, error); }
        }
    }, [ inputValue, selectedImages, isSending, isStreaming, chatId, providerId, modelId, setInputValue, clearSelectedImages, textareaRef, sendMessageMutate, session ]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey && !isSending && !isStreaming) { e.preventDefault(); handleSend(); } }, [handleSend, isSending, isStreaming]);
    const confirmClearChat = useCallback(async () => { if (chatId) { setShowClearConfirm(false); try { await clearChatHistoryMutate({ chatId }); } catch (error) { console.error(`Error clearing chat history:`, error); } } }, [chatId, clearChatHistoryMutate]);
    const cancelClearChat = useCallback(() => { setShowClearConfirm(false); }, []);
    const handleSuggestedActionClick = useCallback(async (action: SuggestedAction) => {
        if (!chatId || !providerId || !modelId) return;
        try {
            switch (action.action_type) {
                case 'send_message':
                    if (typeof action.value === 'string') {
                        const text = action.value;
                        const tempId = generateUniqueId();
                        const payload: SendMessagePayload = { chatId, content: [{ type: 'text', text: text }], providerId, modelId, tempId };
                        const currentActualHistoryAction = $activeChatHistory.getActualState();
                        let optimisticStateAction: UiMessage[] | null = null;
                        const optimisticUserMessageAction: UiMessage = { id: tempId, tempId: tempId, role: 'user', content: [{ type: 'text', text: text }], timestamp: Date.now() };
                        const optimisticPendingMessageAction: UiMessage = { id: `pending-assistant-${Date.now()}`, role: 'assistant', content: [], timestamp: Date.now() + 1, status: 'pending', providerId: providerId, providerName: session?.config?.providerName ?? providerId, modelId: modelId, modelName: session?.config?.modelName ?? modelId };
                        if (Array.isArray(currentActualHistoryAction)) { optimisticStateAction = [...currentActualHistoryAction, optimisticUserMessageAction, optimisticPendingMessageAction]; } else { optimisticStateAction = [optimisticUserMessageAction, optimisticPendingMessageAction]; }
                        await sendMessageMutate(payload, { optimisticState: optimisticStateAction });
                    }
                    break;
                case 'run_tool':
                    if (typeof action.value === 'object' && action.value?.toolName) {
                        await executeToolActionMutate({ toolName: action.value.toolName, args: action.value.args ?? {} });
                    }
                    break;
                case 'fill_input':
                    if (typeof action.value === 'string') {
                        setInputValue(action.value);
                        textareaRef.current?.focus();
                    }
                    break;
            }
        } catch (error) { console.error(`Error handling suggested action:`, error); }
    }, [ chatId, providerId, modelId, setInputValue, textareaRef, sendMessageMutate, executeToolActionMutate, session ]);

    const handleStopGeneration = useCallback(async () => { try { await stopGenerationMutate(); } catch (error) { console.error('Error stopping generation:', error); } }, [stopGenerationMutate]);

    const handleChatModelChange = useCallback(async (newProviderId: string | null, newModelId: string | null) => {
        if (chatId) {
            setOptimisticConfig({ providerId: newProviderId, modelId: newModelId });
            const cfg: Partial<ChatConfig> = { providerId: newProviderId ?? undefined, modelId: newModelId ?? undefined, useDefaults: false };
            try {
                const currentSessions = $chatSessions.getActualState();
                let optimisticStateSessions: ChatSession[] | null = null;
                if (Array.isArray(currentSessions)) {
                    const sessionIndex = currentSessions.findIndex(s => s.id === chatId);
                    if (sessionIndex !== -1) {
                        optimisticStateSessions = JSON.parse(JSON.stringify(currentSessions));
                        if (optimisticStateSessions) {
                            optimisticStateSessions[sessionIndex].config.providerId = newProviderId ?? undefined;
                            optimisticStateSessions[sessionIndex].config.modelId = newModelId ?? undefined;
                            optimisticStateSessions[sessionIndex].config.useDefaults = false;
                            optimisticStateSessions[sessionIndex].lastModified = Date.now();
                            optimisticStateSessions.sort((a, b) => b.lastModified - a.lastModified);
                        }
                    } else { optimisticStateSessions = currentSessions; }
                }
                await updateChatConfigMutate({ chatId: chatId, config: cfg }, { optimisticState: optimisticStateSessions });
            } catch (e) { console.error(`Error updating chat config:`, e); setOptimisticConfig(null); }
        }
    }, [chatId, updateChatConfigMutate]);

    const handleCopyMessage = useCallback((messageId: string) => {
        const msg = Array.isArray(messages) ? messages.find(m => m.id === messageId) : null;
        if (msg?.content) {
            const txt = msg.content.filter((p): p is UiTextMessagePart => p.type === 'text').map(p => p.text).join('\n');
            if (txt) navigator.clipboard.writeText(txt).catch(err => console.error(`Copy failed:`, err));
        }
    }, [messages]);

    const handleDeleteMessage = useCallback(async (messageId: string) => {
        if (!chatId) return;
        try {
            const currentMessages = $activeChatHistory.getActualState();
            let optimisticStateDelete: UiMessage[] | null = null;
            if (Array.isArray(currentMessages)) {
                const messageIndex = currentMessages.findIndex(m => m.id === messageId);
                if (messageIndex !== -1) { optimisticStateDelete = [...currentMessages]; optimisticStateDelete.splice(messageIndex, 1); } else { optimisticStateDelete = currentMessages; }
            }
            await deleteMessageMutate({ chatId, messageId }, { optimisticState: optimisticStateDelete });
        } catch (error) { console.error(`Error deleting message:`, error); }
    }, [chatId, deleteMessageMutate]);

    // New handlers for minimalist header
    const handleChatsClick = useCallback(() => router.open('/'), []);
    const handleSettingsClick = useCallback(() => router.open('/settings'), []);

    // --- Render Logic ---
    if (!chatId) { 
        return (
            <div class="flex flex-col h-full items-center justify-center text-gray-500 dark:text-gray-400 animate-pulse">
                No chat selected
            </div>
        );
    }
    
    const isLoading = isLoadingSessionData || isHistoryLoading;
    if (isLoading) { 
        return (
            <div class="flex flex-col h-full items-center justify-center">
                <div class="text-gray-500 dark:text-gray-400 flex items-center space-x-2">
                    <svg class="animate-spin h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Loading chat...</span>
                </div>
            </div>
        );
    }
    
    if (sessionLoadError || historyLoadError) { 
        return (
            <div class="flex flex-col h-full items-center justify-center text-rose-500">
                <div class="flex items-center space-x-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Error loading chat data</span>
                </div>
            </div>
        );
    }

    const currentSuggestedActionsMap = suggestedActionsMap;

    return (
        <div class="flex flex-col h-full text-gray-900 dark:text-gray-100">
            {/* Minimalist Header */}
            <div class="flex justify-between items-center px-3 py-2 flex-shrink-0 border-b border-black/5 dark:border-white/5">
                {/* Left: Chats Button */}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleChatsClick}
                    className="text-gray-600 dark:text-gray-300 hover:bg-transparent" // Remove hover background
                >
                    <ChatsIcon className="h-4 w-4 mr-1.5" />
                    <span class="text-xs">Chats</span>
                </Button>
                
                {/* Center: Chat Title - Optional */}
                <div class="text-xs font-medium truncate max-w-[50%] opacity-70">
                    {session?.name || 'Chat'}
                </div>
                
                {/* Right: Settings Button */}
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleSettingsClick}
                    className="text-gray-600 dark:text-gray-300 hover:bg-transparent h-8 w-8" // Remove hover background
                >
                    <SettingsIcon className="h-4 w-4" />
                </Button>
            </div>

            {/* Messages Area */}
            <MessagesArea
                messages={messages}
                suggestedActionsMap={currentSuggestedActionsMap}
                isStreaming={isStreaming}
                handleSuggestedActionClick={handleSuggestedActionClick}
                messagesEndRef={messagesEndRef}
                onCopyMessage={handleCopyMessage}
                onDeleteMessage={handleDeleteMessage}
                className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-thumb-rounded-full scrollbar-track-transparent"
            />

            {/* Input Area */}
            <InputArea
                className="p-3 border-t border-black/5 dark:border-white/5"
                handleKeyDown={handleKeyDown}
                handleSend={handleSend}
                selectedImages={selectedImages}
                handleImageFileChange={handleImageFileChange}
                triggerImageUpload={triggerImageUpload}
                fileInputRef={fileInputRef}
                removeSelectedImage={removeSelectedImage}
                setSelectedImages={setSelectedImages}
                handleStopGeneration={handleStopGeneration}
                selectedProviderId={providerId ?? null}
                selectedModelId={modelId ?? null}
                onModelChange={handleChatModelChange}
                inputValue={inputValue}
                setInputValue={setInputValue}
                isStreaming={isStreaming}
                textareaRef={textareaRef}
            />
            
            {/* Confirmation Dialog */}
            <ConfirmationDialog
                show={showClearConfirm}
                title="Confirm Clear History"
                message="Are you sure you want to clear the history for this chat? This cannot be undone."
                onCancel={cancelClearChat}
                onConfirm={confirmClearChat}
                confirmText="Confirm Clear"
            />
        </div>
    );
};
