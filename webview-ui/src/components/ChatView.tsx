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
    $isStreamingResponse
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
import { MessagesArea, MessagesAreaProps } from './MessagesArea'; // Import props type
import { InputArea, InputAreaProps } from './InputArea'; // Import props type
import { ModelSelector } from './ModelSelector';
import { ConfirmationDialog } from './ConfirmationDialog';
import { HeaderControls, HeaderControlsProps } from './HeaderControls'; // Import props type
import { useImageUpload } from '../hooks/useImageUpload';
import { SelectedImage } from './InputArea'; // Import SelectedImage from InputArea
import { TargetedEvent } from 'preact/compat'; // Import for event type
import { generateUniqueId } from '../utils/communication'; // Import ID generator

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
    const providerId = effectiveConfig.providerId;
    const modelId = effectiveConfig.modelId;

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
    useEffect(() => {
        if (!isHistoryLoading && messages.length > 0) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isHistoryLoading]);

     // Handle input change event (needed by InputArea)
    const handleInputChange = useCallback((event: TargetedEvent<HTMLTextAreaElement, Event>) => { // Correct event type
        const target = event.target as HTMLTextAreaElement;
        setInputValue(target.value);
        // Auto-resize textarea
        target.style.height = 'auto';
        target.style.height = `${target.scrollHeight}px`;
    }, [setInputValue]);


    // --- Event Handlers ---
    const handleSend = useCallback(async () => {
        if ((inputValue.trim() || selectedImages.length > 0) && !isSending && !isStreaming && providerId && modelId && chatId) {
            // 1. Prepare content parts for both optimistic update and backend payload
            const contentParts: UiMessageContentPart[] = selectedImages.map((img: SelectedImage) => {
                const mediaType = img.mediaType ?? (img.data.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png');
                return { type: 'image', mediaType, data: img.data.split(',')[1] } as UiImagePart; // Base64 for backend
            });
             const optimisticContentParts: UiMessageContentPart[] = selectedImages.map((img: SelectedImage) => {
                 // Keep full data URI for optimistic display
                 return { type: 'image', mediaType: img.mediaType, data: img.data } as UiImagePart;
             });

            if (inputValue.trim()) {
                const textPart = { type: 'text', text: inputValue.trim() } as UiTextMessagePart;
                contentParts.push(textPart);
                optimisticContentParts.push(textPart); // Add text to optimistic parts too
            }

            // 2. Optimistic Updates
            const timestamp = Date.now(); // Use consistent timestamp
            const tempId = generateUniqueId(); // Generate temporary ID for reconciliation
            // Use tempId as the initial ID for optimistic update
            const optimisticAssistantId = `pending-assistant-${timestamp}`; // Temporary ID for pending message

            const currentHistoryState = $activeChatHistory.get();
            console.log(`[ChatView|${chatId}] State before optimistic update:`, typeof currentHistoryState, Array.isArray(currentHistoryState) ? `Length: ${currentHistoryState.length}`: currentHistoryState); // Added chatId

            if (Array.isArray(currentHistoryState)) {
                const optimisticUserMessage: UiMessage = {
                    id: tempId, // Use tempId as the initial ID
                    tempId: tempId, // Also store it in the tempId field
                    role: 'user',
                    content: optimisticContentParts, // Use parts with full data URI for UI
                    timestamp: timestamp
                };

                const optimisticPendingMessage: UiMessage = {
                    id: optimisticAssistantId, // Use temporary ID
                    role: 'assistant',
                    content: [], // Empty content initially
                    timestamp: timestamp + 1, // Ensure slightly later timestamp
                    status: 'pending' // Mark as pending
                };

                console.log(`[ChatView|${chatId}] Optimistically adding user message: ${optimisticUserMessage.id}`); // Added chatId
                console.log(`[ChatView|${chatId}] Optimistically adding assistant pending message: ${optimisticPendingMessage.id}`); // Added chatId
                $activeChatHistory.set([...currentHistoryState, optimisticUserMessage, optimisticPendingMessage]); // Add both messages
                console.log(`[ChatView|${chatId}] Called $activeChatHistory.set() for optimistic updates.`); // Added chatId

            } else {
                console.warn(`[ChatView|${chatId}] Cannot optimistically update history, store state is not an array:`, currentHistoryState); // Added chatId
                 // Even if optimistic update fails, proceed to send to backend
            }

            // 3. Clear inputs AFTER preparing content
            setInputValue('');
            clearSelectedImages();
            if (textareaRef.current) textareaRef.current.style.height = 'auto';

            // 4. Prepare Backend Payload (Include tempId)
            const backendPayload = { chatId, content: contentParts, providerId, modelId, tempId };

            // 5. Send to Backend
            try {
                console.log(`[ChatView|${chatId}] Sending payload to backend mutation:`, backendPayload); // Added chatId
                await sendMessageMutate(backendPayload);
            } catch (error) {
                console.error(`[ChatView|${chatId}] Error sending message via mutation:`, error); // Added chatId
                // If sending fails, remove the optimistic messages (user and pending assistant)
                 const latestState = $activeChatHistory.get();
                 if (Array.isArray(latestState)) {
                      console.log(`[ChatView|${chatId}] Rolling back optimistic messages due to send error.`); // Added chatId
                      $activeChatHistory.set(latestState.filter(m => m.id !== tempId && m.id !== optimisticAssistantId)); // Filter using tempId for user msg
                 }
            }
        } else {
            console.warn(`[ChatView|${chatId}] Conditions NOT met (chatId:${!!chatId}, sending:${isSending}, streaming:${isStreaming}, provider:${!!providerId}, model:${!!modelId}).`); // Added chatId
        }
    // Add $activeChatHistory to dependencies for optimistic update
    }, [ inputValue, selectedImages, isSending, isStreaming, chatId, providerId, modelId, setInputValue, clearSelectedImages, textareaRef, sendMessageMutate, $activeChatHistory ]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey && !isSending && !isStreaming) { console.log(`[ChatView|${chatId}] Enter pressed, calling handleSend.`); e.preventDefault(); handleSend(); } }, [handleSend, isSending, isStreaming, chatId]); // Added chatId
    const handleClearChat = useCallback(() => { if (chatId) setShowClearConfirm(true); }, [chatId]);
    const confirmClearChat = useCallback(async () => { if (chatId) { setShowClearConfirm(false); try { await clearChatHistoryMutate({ chatId }); } catch (error) { console.error(`Error clearing chat history:`, error); } } }, [chatId, clearChatHistoryMutate]); // Use mutate function obtained at top level
    const cancelClearChat = useCallback(() => { setShowClearConfirm(false); }, []);
    const handleSuggestedActionClick = useCallback(async (action: SuggestedAction) => { if (!chatId || !providerId || !modelId) return; try { switch (action.action_type) { case 'send_message': if (typeof action.value === 'string') await sendMessageMutate({ chatId: chatId, content: [{ type: 'text', text: action.value }], providerId: providerId, modelId: modelId }); break; case 'run_tool': if (typeof action.value === 'object' && action.value?.toolName) await executeToolActionMutate({ toolName: action.value.toolName, args: action.value.args ?? {} }); break; case 'fill_input': if (typeof action.value === 'string') setInputValue(action.value); textareaRef.current?.focus(); break; } } catch (error) { console.error(`Error handling suggested action:`, error); } }, [ chatId, providerId, modelId, setInputValue, textareaRef, sendMessageMutate, executeToolActionMutate ]); // Use mutate functions obtained at top level
    const handleStopGeneration = useCallback(async () => { try { await stopGenerationMutate(); } catch (error) { console.error('Error stopping generation:', error); } }, [stopGenerationMutate]); // Use mutate function obtained at top level
    const handleChatModelChange = useCallback(async (newProviderId: string | null, newModelId: string | null) => { if (chatId) { const cfg: Partial<ChatConfig> = { providerId: newProviderId ?? undefined, modelId: newModelId ?? undefined, useDefaults: false }; try { await updateChatConfigMutate({ chatId: chatId, config: cfg }); } catch (e) { console.error(`Error updating chat config:`, e); } } }, [chatId, updateChatConfigMutate]); // Use mutate function obtained at top level
    const handleCopyMessage = useCallback((messageId: string) => {
        const msg = Array.isArray(messages) ? messages.find(m => m.id === messageId) : null;
        if (msg?.content) {
            const txt = msg.content.filter((p): p is UiTextMessagePart => p.type === 'text').map(p => p.text).join('\n');
            if (txt) navigator.clipboard.writeText(txt).catch(err => console.error(`Copy failed:`, err));
        }
    }, [messages]);
    const handleDeleteMessage = useCallback(async (messageId: string) => { if (!chatId) return; try { await deleteMessageMutate({ chatId, messageId }); } catch (error) { console.error(`Error deleting message:`, error); } }, [chatId, deleteMessageMutate]); // Use mutate function obtained at top level

    // --- Render Logic ---
    if (!chatId) {
        console.error("[ChatView Render] No chatId found, rendering error.");
        return <div>Error: No chat selected.</div>;
    }

    // Correct isLoading check
    const isLoading = isLoadingSessionData || isHistoryLoading; // Remove || session === undefined as session is derived differently

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

    // suggestedActionsMap is derived correctly above, ensuring it's an object
    const currentSuggestedActionsMap = suggestedActionsMap; // Just use the derived map

    console.log(`[ChatView Render] Rendering main UI. Msgs: ${messages.length}`);
    return (
        <div class="flex flex-col h-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            {/* Header */}
            <div class="p-2 border-b border-gray-200 dark:border-gray-700">
                <HeaderControls
                    selectedProviderId={providerId ?? null}
                    selectedModelId={modelId ?? null}
                    onModelChange={handleChatModelChange}
                    // Removed incorrect chatId prop
                />
            </div>

            {/* Messages Area */}
            <MessagesArea
                messages={messages}
                suggestedActionsMap={currentSuggestedActionsMap} // Use corrected variable name
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
                handleImageFileChange={handleImageFileChange} // Use correct prop name from InputAreaProps
                triggerImageUpload={triggerImageUpload}
                fileInputRef={fileInputRef}
                removeSelectedImage={removeSelectedImage}
                setSelectedImages={setSelectedImages} // Add missing prop
                handleStopGeneration={handleStopGeneration}
                currentModelId={modelId ?? null}
                inputValue={inputValue}
                setInputValue={setInputValue} // Pass setInputValue
                // handleInputChange is internal to ChatView, InputArea uses setInputValue
                isStreaming={isStreaming}
                // Removed incorrect textareaRef prop
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
