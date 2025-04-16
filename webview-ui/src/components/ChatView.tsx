import { FunctionalComponent } from 'preact';
import { useState, useRef, useEffect, useMemo, useCallback } from 'preact/hooks';
import { useStore } from '@nanostores/react'; // Correct import for Preact
import { router } from '../stores/router'; // Use correct path for router
import {
    $sendMessage,
    $executeToolAction,
    $suggestedActions,
    $deleteMessage,
    $clearChatHistory,
    $stopGeneration,
    $updateChatConfig,
    $isStreamingResponse,
    SendMessagePayload, // Import SendMessagePayload
    $chatSessions // Import $chatSessions
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
import { MessagesArea } from './MessagesArea'; // Removed MessagesAreaProps
import { InputArea } from './InputArea'; // Removed InputAreaProps
// Removed ModelSelector import (unused)
import { ConfirmationDialog } from './ConfirmationDialog';
import { HeaderControls } from './HeaderControls'; // Removed HeaderControlsProps
import { useImageUpload } from '../hooks/useImageUpload';
import { SelectedImage } from './InputArea'; // Import SelectedImage from InputArea
import { TargetedEvent } from 'preact/compat'; // Import for event type
import { generateUniqueId } from '../utils/communication'; // Import ID generator
import { Operation } from 'fast-json-patch'; // Import Operation type

 interface ChatViewProps {
    // No props needed as chatId comes from router
}

// Helper function to calculate effective config
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


export const ChatView: FunctionalComponent<ChatViewProps> = () => {
    const route = useStore(router);
    const chatId = useMemo(() => {
        if (!route || !('params' in route) || !route.params || !('chatId' in route.params)) {
            return null;
        }
        return route.params.chatId;
    }, [route]);

    // --- State Management ---
    const [inputValue, _setInputValue] = useState('');
    // Local state for optimistic UI updates of provider/model selection
    const [optimisticConfig, setOptimisticConfig] = useState<{ providerId: string | null; modelId: string | null } | null>(null);
    // No local optimisticMessages state needed anymore
    const setInputValue = useCallback((value: string) => {
        _setInputValue(value);
    }, []);

    // Use Nanostores for backend-driven state
    const currentChatSession = useStore($activeChatSession);
    const defaultConfigStoreValue = useStore($defaultConfig);

    // Get mutate functions and loading states at the top level
    const { mutate: sendMessageMutate, loading: isSending } = useStore($sendMessage);
    const { mutate: clearChatHistoryMutate } = useStore($clearChatHistory);
    const { mutate: executeToolActionMutate } = useStore($executeToolAction);
    const { mutate: stopGenerationMutate } = useStore($stopGeneration);
    const { mutate: updateChatConfigMutate } = useStore($updateChatConfig);
    const { mutate: deleteMessageMutate } = useStore($deleteMessage);

    const messagesState = useStore($activeChatHistory);
    const isHistoryLoading = messagesState === 'loading';

    const isStreamingStoreValue = useStore($isStreamingResponse);
    // Correctly check if the store value is boolean true
    const isStreaming = typeof isStreamingStoreValue === 'boolean' && isStreamingStoreValue === true;


    const suggestedActionsStoreValue = useStore($suggestedActions);
    // Correctly get the map from the store value, handling loading/error states
    const suggestedActionsMap = (typeof suggestedActionsStoreValue === 'object' && suggestedActionsStoreValue !== null && !('loading' in suggestedActionsStoreValue) && !('error' in suggestedActionsStoreValue))
        ? suggestedActionsStoreValue
        : {};

    // Derived state
    const isLoadingSessionData = currentChatSession === 'loading';
    const sessionLoadError = currentChatSession === null && !isLoadingSessionData;
    const historyLoadError = messagesState === 'error';
    const messages = (messagesState === 'loading' || messagesState === 'error' || messagesState === null) ? [] : messagesState;

    // Correct defaultConfig check
    const defaultConfig = (defaultConfigStoreValue !== 'loading' && defaultConfigStoreValue !== 'error' && defaultConfigStoreValue !== null) ? defaultConfigStoreValue : null;
    // Correct currentChatSession check
    const session = (currentChatSession !== 'loading' && currentChatSession !== null) ? currentChatSession : null;

    const effectiveConfig = useMemo(() => {
        return calculateEffectiveConfig(session, defaultConfig);
    }, [session, defaultConfig]);

    // Determine the provider/model IDs to use, prioritizing optimistic state
    const providerId = optimisticConfig?.providerId ?? effectiveConfig.providerId;
    const modelId = optimisticConfig?.modelId ?? effectiveConfig.modelId;

    // Refs
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // --- Custom Hooks ---
    const {
        selectedImages,
        setSelectedImages,
        fileInputRef,
        handleImageFileChange,
        triggerImageUpload,
        removeSelectedImage,
        clearSelectedImages
    } = useImageUpload();


    // --- Logging ---
    console.log(`[ChatView Render] chatId=${chatId}, isLoadingSession=${isLoadingSessionData}, isHistoryLoading=${isHistoryLoading}, sessionStatus=${currentChatSession === 'loading' ? 'loading' : (session ? 'loaded' : 'not-found/error')}, isStreaming=${isStreaming}`);


    // --- Effects ---
    // Scroll to bottom effect
    useEffect(() => {
        if (!isHistoryLoading && messages.length > 0) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isHistoryLoading]);

    // Removed useEffect that resets optimisticConfig based on effectiveConfig catching up.

    // Removed unused handleInputChange

    // --- Event Handlers ---
    const handleSend = useCallback(async () => {
        if ((inputValue.trim() || selectedImages.length > 0) && !isSending && !isStreaming && providerId && modelId && chatId) {
            // 1. Prepare content parts
            const contentParts: UiMessageContentPart[] = selectedImages.map((img: SelectedImage) => {
                const mediaType = img.mediaType ?? (img.data.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png');
                return { type: 'image', mediaType, data: img.data.split(',')[1] } as UiImagePart;
            });
             const optimisticContentParts: UiMessageContentPart[] = selectedImages.map((img: SelectedImage) => {
                 return { type: 'image', mediaType: img.mediaType, data: img.data } as UiImagePart;
             });

            if (inputValue.trim()) {
                const textPart = { type: 'text', text: inputValue.trim() } as UiTextMessagePart;
                contentParts.push(textPart);
                optimisticContentParts.push(textPart);
            }

            // 2. Calculate Optimistic State
            const timestamp = Date.now();
            const tempId = generateUniqueId();
            const optimisticAssistantId = `pending-assistant-${timestamp}`;
            const optimisticUserMessage: UiMessage = { id: tempId, tempId: tempId, role: 'user', content: optimisticContentParts, timestamp: timestamp };
            const optimisticPendingMessage: UiMessage = { id: optimisticAssistantId, role: 'assistant', content: [], timestamp: timestamp + 1, status: 'pending', providerId: providerId, providerName: session?.config?.providerName ?? providerId, modelId: modelId, modelName: session?.config?.modelName ?? modelId };

            const currentActualHistory = $activeChatHistory.getActualState();
            let optimisticState: UiMessage[] | null = null;
            if (Array.isArray(currentActualHistory)) {
                optimisticState = [...currentActualHistory, optimisticUserMessage, optimisticPendingMessage];
            } else {
                optimisticState = [optimisticUserMessage, optimisticPendingMessage];
            }
            console.log(`[ChatView|${chatId}] Preparing optimistic state:`, optimisticState);

            // 3. Clear inputs
            setInputValue('');
            clearSelectedImages();
            if (textareaRef.current) textareaRef.current.style.height = 'auto';

            // 4. Prepare Backend Payload
            const backendPayload: SendMessagePayload = { chatId, content: contentParts, providerId, modelId, tempId };

            // 5. Send to Backend with Optimistic State
            try {
                console.log(`[ChatView|${chatId}] handleSend: Using providerId='${backendPayload.providerId}', modelId='${backendPayload.modelId}' for mutation.`);
                console.log(`[ChatView|${chatId}] Sending payload to backend mutation:`, backendPayload);
                await sendMessageMutate(backendPayload, { optimisticState }); // Pass optimisticState
            } catch (error) {
                console.error(`[ChatView|${chatId}] Error sending message via mutation:`, error);
                // createMutationStore handles rollback
            }
        } else {
            console.warn(`[ChatView|${chatId}] Conditions NOT met (chatId:${!!chatId}, sending:${isSending}, streaming:${isStreaming}, provider:${!!providerId}, model:${!!modelId}).`);
        }
    }, [ inputValue, selectedImages, isSending, isStreaming, chatId, providerId, modelId, setInputValue, clearSelectedImages, textareaRef, sendMessageMutate, session ]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey && !isSending && !isStreaming) { console.log(`[ChatView|${chatId}] Enter pressed, calling handleSend.`); e.preventDefault(); handleSend(); } }, [handleSend, isSending, isStreaming, chatId]);
    // Removed unused handleClearChat
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
                        // Calculate optimistic state
                        const currentActualHistoryAction = $activeChatHistory.getActualState();
                        let optimisticStateAction: UiMessage[] | null = null;
                        const optimisticUserMessageAction: UiMessage = { id: tempId, tempId: tempId, role: 'user', content: [{ type: 'text', text: text }], timestamp: Date.now() };
                        const optimisticPendingMessageAction: UiMessage = { id: `pending-assistant-${Date.now()}`, role: 'assistant', content: [], timestamp: Date.now() + 1, status: 'pending', providerId: providerId, providerName: session?.config?.providerName ?? providerId, modelId: modelId, modelName: session?.config?.modelName ?? modelId };
                        if (Array.isArray(currentActualHistoryAction)) {
                            optimisticStateAction = [...currentActualHistoryAction, optimisticUserMessageAction, optimisticPendingMessageAction];
                        } else {
                            optimisticStateAction = [optimisticUserMessageAction, optimisticPendingMessageAction];
                        }
                        // Call mutate with payload and optimistic state
                        await sendMessageMutate(payload, { optimisticState: optimisticStateAction }); // Pass optimisticState
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
        } catch (error) {
            console.error(`Error handling suggested action:`, error);
            // createMutationStore handles rollback
        }
    }, [ chatId, providerId, modelId, setInputValue, textareaRef, sendMessageMutate, executeToolActionMutate, session ]);
    const handleStopGeneration = useCallback(async () => { try { await stopGenerationMutate(); } catch (error) { console.error('Error stopping generation:', error); } }, [stopGenerationMutate]);
    const handleChatModelChange = useCallback(async (newProviderId: string | null, newModelId: string | null) => {
        if (chatId) {
            console.log(`[ChatView handleChatModelChange] User selected Provider: ${newProviderId}, Model: ${newModelId}`);
            setOptimisticConfig({ providerId: newProviderId, modelId: newModelId }); // Local optimistic update for selector UI

            const cfg: Partial<ChatConfig> = { providerId: newProviderId ?? undefined, modelId: newModelId ?? undefined, useDefaults: false };
            try {
                // Calculate optimistic state for chat session config update
                const currentSessions = $chatSessions.getActualState(); // Use getActualState
                let optimisticStateSessions: ChatSession[] | null = null; // Initialize as null

                if (Array.isArray(currentSessions)) {
                    const sessionIndex = currentSessions.findIndex(s => s.id === chatId);
                    if (sessionIndex !== -1) {
                        optimisticStateSessions = JSON.parse(JSON.stringify(currentSessions)); // Deep clone
                        // Safely access the element after confirming index
                        // Check if optimisticStateSessions is not null before accessing index
                        if (optimisticStateSessions) {
                            optimisticStateSessions[sessionIndex].config.providerId = newProviderId ?? undefined;
                            optimisticStateSessions[sessionIndex].config.modelId = newModelId ?? undefined;
                            optimisticStateSessions[sessionIndex].config.useDefaults = false;
                            optimisticStateSessions[sessionIndex].lastModified = Date.now(); // Optimistically update timestamp
                            optimisticStateSessions.sort((a, b) => b.lastModified - a.lastModified); // Keep sorted
                        }
                    } else {
                         // If session not found, pass the current state without modification
                         optimisticStateSessions = currentSessions;
                    }
                }
                // If currentSessions was not an array (loading/error/null), optimisticStateSessions remains null
                // Call mutate with payload and optimistic state (which might be null)
                await updateChatConfigMutate({ chatId: chatId, config: cfg }, { optimisticState: optimisticStateSessions }); // Pass optimisticState
                console.log(`[ChatView handleChatModelChange] Backend update triggered for chat ${chatId}.`);
            } catch (e) {
                console.error(`[ChatView handleChatModelChange] Error updating chat config:`, e);
                setOptimisticConfig(null); // Revert local optimistic config state on error
                // createMutationStore handles rollback of the targetAtom ($chatSessions)
            }
        }
    }, [chatId, updateChatConfigMutate]); // Removed $chatSessions dependency

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
            // Calculate optimistic state for message deletion
            const currentMessages = $activeChatHistory.getActualState();
            let optimisticStateDelete: UiMessage[] | null = null;
            if (Array.isArray(currentMessages)) {
                const messageIndex = currentMessages.findIndex(m => m.id === messageId);
                if (messageIndex !== -1) {
                    optimisticStateDelete = [...currentMessages]; // Clone
                    optimisticStateDelete.splice(messageIndex, 1); // Remove message
                } else {
                     optimisticStateDelete = currentMessages; // No change if message not found
                }
            }
            // Call mutate with payload and optimistic state
            await deleteMessageMutate({ chatId, messageId }, { optimisticState: optimisticStateDelete }); // Pass optimisticState
        } catch (error) {
            console.error(`Error deleting message:`, error);
            // createMutationStore handles rollback
        }
     }, [chatId, deleteMessageMutate]);

    // --- Render Logic ---
    if (!chatId) {
        console.error("[ChatView Render] No chatId found, rendering error.");
        return <div>Error: No chat selected.</div>;
    }

    const isLoading = isLoadingSessionData || isHistoryLoading;

    if (isLoading) {
        console.log(`[ChatView Render] Loading... isLoadingSession=${isLoadingSessionData}, isHistoryLoading=${isHistoryLoading}`);
        return (
            <div class="flex flex-col h-full items-center justify-center text-gray-500 dark:text-gray-400">
                Loading Chat...
            </div>
        );
    }

    if (sessionLoadError || historyLoadError) {
        return (
            <div class="flex flex-col h-full items-center justify-center text-red-500">
                Error loading chat data. Please try again later or select a different chat.
            </div>
        );
    }

    const currentSuggestedActionsMap = suggestedActionsMap;

    console.log(`[ChatView Render] Rendering main UI. Msgs: ${messages.length}`);
    return (
        <div class="flex flex-col h-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            {/* Header */}
            <div class="p-2 border-b border-gray-200 dark:border-gray-700">
                <HeaderControls
                    selectedProviderId={providerId ?? null}
                    selectedModelId={modelId ?? null}
                    onModelChange={handleChatModelChange}
                />
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
                className="flex-1 overflow-y-auto mb-4 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent"
            />

            {/* Input Area */}
            <InputArea
                className="mt-auto"
                handleKeyDown={handleKeyDown}
                handleSend={handleSend}
                selectedImages={selectedImages}
                handleImageFileChange={handleImageFileChange}
                triggerImageUpload={triggerImageUpload}
                fileInputRef={fileInputRef}
                removeSelectedImage={removeSelectedImage}
                setSelectedImages={setSelectedImages}
                handleStopGeneration={handleStopGeneration}
                currentModelId={modelId ?? null}
                inputValue={inputValue}
                setInputValue={setInputValue}
                isStreaming={isStreaming}
            />
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
