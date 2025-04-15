import { useEffect, useRef, useCallback, useState, useMemo } from 'preact/hooks';
import { useStore } from '@nanostores/react';
import { HeaderControls } from './HeaderControls';
import { MessagesArea } from './MessagesArea';
import { InputArea } from './InputArea';
import { ConfirmationDialog } from './ConfirmationDialog';
import { useImageUpload } from '../hooks/useImageUpload';
import {
    SuggestedAction,
    UiMessageContentPart,
    UiImagePart,
    UiMessage,
    ChatConfig,
    UiTextMessagePart,
    ChatSession, // Keep ChatSession
    DefaultChatConfig
} from '../../../src/common/types';
// Import Nanostore stores
import {
    $defaultConfig,
    $sendMessage,
    $deleteMessage,
    $clearChatHistory,
    $executeToolAction,
    $stopGeneration,
    $updateChatConfig,
    $isStreamingResponse // Import the new streaming status store
} from '../stores/chatStores';
// Import new stores and remove $chatSessions
import { $activeChatHistory, $activeChatSession } from '../stores/activeChatHistoryStore'; // Removed setActiveChatIdAndSubscribe
import { router } from '../stores/router';

interface ChatViewProps {
    chatIdFromRoute: string; // Passed from the route parameter
}

// Helper function to calculate effective config
const calculateEffectiveConfig = (chatSession: ChatSession | null | undefined, defaultConfig: DefaultChatConfig | null): ChatConfig => {
     const baseDefaults: ChatConfig = { useDefaults: true };
     const effectiveDefaults = { ...baseDefaults, ...defaultConfig };

     if (!chatSession) return effectiveDefaults;

     const chatConfig = chatSession.config;
     if (chatConfig.useDefaults) {
         return {
             ...effectiveDefaults,
             ...chatConfig,
             providerId: chatConfig.providerId ?? effectiveDefaults.defaultProviderId,
             modelId: chatConfig.modelId ?? effectiveDefaults.defaultModelId,
         };
     } else {
         return {
             useDefaults: false,
             providerId: chatConfig.providerId,
             modelId: chatConfig.modelId,
         };
     }
};

export function ChatView({ chatIdFromRoute }: ChatViewProps) {
    // --- Nanostores State ---竹ns
    const currentChatSession = useStore($activeChatSession); // Can be 'loading', null, or ChatSession
    const defaultConfig = useStore($defaultConfig);
    const { mutate: sendMessageMutate, loading: isSending } = useStore($sendMessage); // isSending is the loading state
    const { mutate: deleteMessageMutate, loading: isDeletingMsg } = useStore($deleteMessage);
    const { mutate: clearHistoryMutate, loading: isClearing } = useStore($clearChatHistory);
    const { mutate: executeToolMutate, loading: isExecutingTool } = useStore($executeToolAction);
    const { mutate: stopGenerationMutate, loading: isStopping } = useStore($stopGeneration);
    const { mutate: updateConfigMutate, loading: isUpdatingConfig } = useStore($updateChatConfig);

    // --- Use the store for messages ---
    const messages = useStore($activeChatHistory); // Now UiMessage[] | null | 'loading' | 'error'
    // Log the messages state received from the store hook
    console.log(`[ChatView useStore($activeChatHistory)] Received messages state:`, Array.isArray(messages) ? `Array(${messages.length}) IDs: ${messages.slice(-3).map(m => m.id).join(', ')}` : messages);
    const isHistoryLoading = messages === 'loading' || messages === null; // History is loading if 'loading' or null

    // --- Nanostores Derived State ---
    // Use the dedicated store for streaming status, handling non-boolean states
    const isStreamingStoreValue = useStore($isStreamingResponse);
    const isStreaming = typeof isStreamingStoreValue === 'boolean' ? isStreamingStoreValue : false;

    // --- Local UI State ---
    const [inputValue, _setInputValue] = useState('');
    // Add wrapper with logging
    const setInputValue = useCallback((value: string) => {
        console.log(`[ChatView setInputValue] Called with value: "${value}"`);
        _setInputValue(value);
    }, []);
    const [suggestedActionsMap, setSuggestedActionsMap] = useState<Record<string, SuggestedAction[]>>({});
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
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


    // --- Derived State (from Nanostores & Route) ---
    const isLoadingSessionData = currentChatSession === 'loading';

    // Calculate effective config *before* handlers that might need it
    // Handle 'loading'/'error' states for both session and default config
    const effectiveConfig = useMemo(() => {
        // Check if session is loaded and is a ChatSession object
        const session = (typeof currentChatSession === 'object' && currentChatSession !== null && currentChatSession !== 'loading') // Exclude 'loading'
            ? currentChatSession
            : null;
        // Check if defaultConfig is loaded and is an object
        const defaults: DefaultChatConfig | null = (typeof defaultConfig === 'object' && defaultConfig !== null && defaultConfig !== 'loading' && defaultConfig !== 'error') // Exclude 'loading'/'error'
            ? defaultConfig
            : null;
        return calculateEffectiveConfig(session, defaults);
    }, [currentChatSession, defaultConfig]);
    const providerId = effectiveConfig.providerId;
    const modelId = effectiveConfig.modelId;

    // --- Logging ---
    console.log(`[ChatView Render] chatId=${chatIdFromRoute}, isLoadingSession=${isLoadingSessionData}, isHistoryLoading=${isHistoryLoading}, sessionStatus=${currentChatSession === 'loading' ? 'loading' : (currentChatSession ? 'loaded' : 'not-found/error')}, isStreaming=${isStreaming}`);


    // --- Effects ---
    // Scroll to bottom
    useEffect(() => {
        // Check if messages is an array before accessing length
        if (!isHistoryLoading && Array.isArray(messages) && messages.length > 0) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isHistoryLoading]);

    // Removed the redundant redirect logic - ChatPage.tsx handles this
    // useEffect(() => { ... }, [chatIdFromRoute, allChatSessions, currentChatSession]);

    // History subscription is now handled within the $activeChatHistory store's onMount
    // Remove the useEffect hook that called setActiveChatIdAndSubscribe
    // useEffect(() => {
    //     console.log(`[ChatView Initial Task State Effect Subscribe] Subscribing to history for ${chatIdFromRoute}`);
    //     setActiveChatIdAndSubscribe(chatIdFromRoute);
    //     setInputValue('');
    //     clearSelectedImages();
    //     setSuggestedActionsMap({});
    // }, [chatIdFromRoute]);


    // --- Event Handlers ---
    const handleSend = useCallback(async () => {
        console.log(`[ChatView handleSend] Attempting to send message. Input: "${inputValue}", Images: ${selectedImages.length}, isSending: ${isSending}, isStreaming: ${isStreaming}, providerId: ${providerId}, modelId: ${modelId}, chatId: ${chatIdFromRoute}`);
        if ((inputValue.trim() || selectedImages.length > 0) && !isSending && !isStreaming && providerId && modelId && chatIdFromRoute) {
            console.log(`[ChatView handleSend] Conditions met. Preparing payload.`);
            const contentParts: UiMessageContentPart[] = selectedImages.map(img => ({ type: 'image', mediaType: img.mediaType, data: img.data } as UiImagePart));
            if (inputValue.trim()) {
                contentParts.push({ type: 'text', text: inputValue });
            }
            const payload = { chatId: chatIdFromRoute, content: contentParts, providerId: providerId, modelId: modelId };
            console.log(`[ChatView handleSend] Payload created:`, JSON.stringify(payload));
            setInputValue('');
            clearSelectedImages();
            try {
                console.log(`[ChatView handleSend] Calling sendMessageMutate...`);
                await sendMessageMutate(payload);
                console.log(`[ChatView handleSend] sendMessageMutate call finished.`);
            } catch (error) {
                console.error(`[ChatView handleSend] Error sending message via mutation:`, error);
            }
        } else {
            console.log(`[ChatView handleSend] Conditions NOT met.`);
        }
    }, [ inputValue, selectedImages, isSending, isStreaming, chatIdFromRoute, providerId, modelId, sendMessageMutate, setInputValue, clearSelectedImages ]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey && !isSending && !isStreaming) { console.log("[ChatView handleKeyDown] Enter pressed, calling handleSend."); e.preventDefault(); handleSend(); } }, [handleSend, isSending, isStreaming]);
    const handleClearChat = useCallback(() => { if (chatIdFromRoute) setShowClearConfirm(true); }, [chatIdFromRoute]);
    const confirmClearChat = useCallback(async () => { if (chatIdFromRoute) { setShowClearConfirm(false); try { await clearHistoryMutate({ chatId: chatIdFromRoute }); } catch (error) { console.error(`Error clearing chat history:`, error); } } }, [chatIdFromRoute, clearHistoryMutate]);
    const cancelClearChat = useCallback(() => { setShowClearConfirm(false); }, []);
    const handleSuggestedActionClick = useCallback(async (action: SuggestedAction) => { if (!chatIdFromRoute || !providerId || !modelId) return; try { switch (action.action_type) { case 'send_message': if (typeof action.value === 'string') await sendMessageMutate({ chatId: chatIdFromRoute, content: [{ type: 'text', text: action.value }], providerId: providerId, modelId: modelId }); break; case 'run_tool': if (typeof action.value === 'object' && action.value?.toolName) await executeToolMutate({ toolName: action.value.toolName, args: action.value.args ?? {} }); break; case 'fill_input': if (typeof action.value === 'string') setInputValue(action.value); break; } } catch (error) { console.error(`Error handling suggested action:`, error); } }, [ chatIdFromRoute, providerId, modelId, sendMessageMutate, executeToolMutate, setInputValue ]);
    const handleStopGeneration = useCallback(async () => { try { await stopGenerationMutate(); } catch (error) { console.error('Error stopping generation:', error); } }, [stopGenerationMutate]);
    const handleChatModelChange = useCallback(async (newProviderId: string | null, newModelId: string | null) => { if (chatIdFromRoute) { const cfg: Partial<ChatConfig> = { providerId: newProviderId ?? undefined, modelId: newModelId ?? undefined, useDefaults: false }; try { await updateConfigMutate({ chatId: chatIdFromRoute, config: cfg }); } catch (e) { console.error(`Error updating chat config:`, e); } } }, [chatIdFromRoute, updateConfigMutate]);
    const handleCopyMessage = useCallback((messageId: string) => {
        // Ensure messages is an array before using find
        const msg = Array.isArray(messages) ? messages.find(m => m.id === messageId) : null;
        if (msg?.content) {
            const txt = msg.content.filter((p): p is UiTextMessagePart => p.type === 'text').map(p => p.text).join('\n');
            if (txt) navigator.clipboard.writeText(txt).catch(err => console.error(`Copy failed:`, err));
        }
    }, [messages]);
    const handleDeleteMessage = useCallback(async (messageId: string) => { if (!chatIdFromRoute) return; try { await deleteMessageMutate({ chatId: chatIdFromRoute, messageId }); } catch (error) { console.error(`Error deleting message:`, error); } }, [chatIdFromRoute, deleteMessageMutate]);


    // --- Render Logic ---
    // Updated loading check based on new stores
    const isLoading = isLoadingSessionData || isHistoryLoading; // Combine loading states
    if (isLoading) {
        console.log(`[ChatView Render] Loading... isLoadingSession=${isLoadingSessionData}, isHistoryLoading=${isHistoryLoading}`);
        return (
            <div class="chat-container flex flex-col flex-1 h-full p-4 overflow-hidden">
                <div class="p-6 text-center text-gray-500">Loading chat...</div>
            </div>
        );
    }

    // If session loading finished but session is null (not found or error)
    if (currentChatSession === null) {
         console.log(`[ChatView Render] Session data loaded, but chat ${chatIdFromRoute} not found or error occurred. Waiting for redirect from ChatPage.`);
         // Render minimal placeholder while ChatPage handles redirect
         return (
             <div class="chat-container flex flex-col flex-1 h-full p-4 overflow-hidden">
                 <div class="p-6 text-center text-gray-500">Chat not found or failed to load.</div>
             </div>
         );
    }

    // --- Render Main Chat UI ---
    // Ensure messages is an array, default to empty if null or loading
    const displayMessages = Array.isArray(messages) ? messages : [];

    console.log(`[ChatView Render] Rendering main UI. Msgs: ${displayMessages.length}`);
    return (
        <div class="chat-container flex flex-col flex-1 h-full p-4 overflow-hidden">
            <HeaderControls
                selectedProviderId={providerId ?? null}
                selectedModelId={modelId ?? null}
                onModelChange={handleChatModelChange}
            />
            <MessagesArea
                handleSuggestedActionClick={handleSuggestedActionClick}
                messagesEndRef={messagesEndRef}
                onCopyMessage={handleCopyMessage}
                onDeleteMessage={handleDeleteMessage}
                className="flex-1 overflow-y-auto mb-4 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent"
                messages={displayMessages} // Pass the guaranteed array
                suggestedActionsMap={suggestedActionsMap}
                isStreaming={isStreaming} // Pass the resolved boolean value
            />
            <InputArea
                className="mt-auto"
                handleKeyDown={handleKeyDown}
                handleSend={handleSend}
                setSelectedImages={setSelectedImages}
                fileInputRef={fileInputRef}
                triggerImageUpload={triggerImageUpload}
                removeSelectedImage={removeSelectedImage}
                handleImageFileChange={handleImageFileChange}
                handleStopGeneration={handleStopGeneration}
                currentModelId={modelId ?? null}
                inputValue={inputValue}
                setInputValue={setInputValue}
                isStreaming={isStreaming} // Pass the resolved boolean value
                selectedImages={selectedImages}
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
}
