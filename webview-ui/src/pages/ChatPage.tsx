import { FunctionalComponent } from 'preact';
import { useState, useRef, useEffect, useMemo, useCallback } from 'preact/hooks';
import { useStore } from '@nanostores/react';
import { router } from '../stores/router'; // Restore router import
import {
    $sendMessage,
    $executeToolAction,
    $suggestedActions,
    $deleteMessage,
    $clearChatHistory,
    $stopGeneration,
    $updateChatConfig,
    $isStreamingResponse,
    // SendMessagePayload removed from here
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
    UiMessage,
    SendMessagePayload // Import SendMessagePayload from correct location
} from '../../../src/common/types';
// Updated import paths after moving from components/ to pages/
import { MessagesArea } from '../components/MessagesArea';
import { InputArea, SelectedImage } from '../components/InputArea';
import { useAssistantStore } from '../stores/assistantStores'; // Import assistant store
// Removed unused ConfirmationDialog import (Already removed?)
// Removed duplicate import
import { useImageUpload } from '../hooks/useImageUpload';
import { generateUniqueId } from '../utils/communication';
// Removed unused Button import (Already removed?)
// Removed ChatListPage import

// Helper function to calculate effective config (Updated for Assistant)
const calculateEffectiveConfig = (chatSession: ChatSession | null | undefined, defaultConfig: DefaultChatConfig | null): ChatConfig => {
    const baseDefaults: ChatConfig = { useDefaults: true, assistantId: defaultConfig?.defaultAssistantId };
    if (!chatSession) return baseDefaults;

    const chatConfig = chatSession.config;
    if (chatConfig.useDefaults) {
        // If chat uses defaults, return the base defaults (which includes defaultAssistantId)
        return baseDefaults;
    } else {
        // If chat has specific config, use its assistantId, otherwise fallback to defaultAssistantId
        return {
            useDefaults: false,
            assistantId: chatConfig.assistantId ?? defaultConfig?.defaultAssistantId,
        };
    }
};

// Removed SVG Icon components - using UnoCSS icons directly

// Restore chatIdFromRoute prop and router logic
// Renamed component from ChatView to ChatPage
export const ChatPage: FunctionalComponent<{ chatIdFromRoute?: string }> = ({ chatIdFromRoute }) => {
    // Initialize chatId: use prop or generate a new UUID if prop is missing
    const [chatId, setChatId] = useState<string | null>(() => {
        if (chatIdFromRoute) {
            return chatIdFromRoute;
        } else {
            const newId = crypto.randomUUID();
            console.log(`[ChatPage] Initializing with generated ID: ${newId}`);
            // We need to update the URL, but useEffect is better for side effects
            return newId;
        }
    });
    const isInitiallyNew = useRef(!chatIdFromRoute); // Track if we started with a generated ID

    // Effect to update URL only once if a new ID was generated on mount
    useEffect(() => {
        if (isInitiallyNew.current && chatId) {
            console.log(`[ChatPage] Updating URL for newly generated ID: ${chatId}`);
            router.open(`/chat/${chatId}`, true); // true for replace
            isInitiallyNew.current = false; // Ensure this runs only once
        }
    }, [chatId]); // Run when chatId is set/updated

    // Effect to update internal chatId if the route prop changes (e.g., navigating between chats)
     useEffect(() => {
        if (chatIdFromRoute && chatIdFromRoute !== chatId) {
             console.log(`[ChatPage] Route prop changed to: ${chatIdFromRoute}. Updating internal state.`);
            setChatId(chatIdFromRoute);
            isInitiallyNew.current = false; // Navigating to existing, not new
        }
     }, [chatIdFromRoute, chatId]);

    // --- State Management ---
    const [inputValue, _setInputValue] = useState('');
    // Removed optimisticConfig for provider/model
    const setInputValue = useCallback((value: string) => { _setInputValue(value); }, []);

    // Nanostores state
    // Use internalChatId to drive $activeChatSession and $activeChatHistory
    // Need to manually trigger session/history loading based on internalChatId change
    // This replaces the automatic loading driven by router in the stores
    const currentChatSession = useStore($activeChatSession);
    const messagesState = useStore($activeChatHistory);
    // Removed useEffect for manual store triggering - relying on stores reacting to router change
    const defaultConfigStoreValue = useStore($defaultConfig);
    const { mutate: sendMessageMutate, loading: isSending } = useStore($sendMessage);
    // Removed unused clearChatHistoryMutate
    const { mutate: executeToolActionMutate } = useStore($executeToolAction);
    const { mutate: stopGenerationMutate } = useStore($stopGeneration);
    const { mutate: updateChatConfigMutate } = useStore($updateChatConfig);
    const { mutate: deleteMessageMutate } = useStore($deleteMessage);
    // messagesState already defined above
    const isHistoryLoading = messagesState === 'loading';
    const isStreamingStoreValue = useStore($isStreamingResponse);
    const isStreaming = typeof isStreamingStoreValue === 'boolean' && isStreamingStoreValue === true;
    const suggestedActionsStoreValue = useStore($suggestedActions);
    const suggestedActionsMap = (typeof suggestedActionsStoreValue === 'object' && suggestedActionsStoreValue !== null && !('loading' in suggestedActionsStoreValue) && !('error' in suggestedActionsStoreValue))
        ? suggestedActionsStoreValue
        : {};

    // Derived state
    const isLoadingSessionData = currentChatSession === 'loading';
    // Removed duplicate isHistoryLoading declaration below
    const historyLoadError = messagesState === 'error';
    // Treat session === null after loading as "not found / new chat", not necessarily an error
    // Removed unused isNewChatScenario
    // Messages are empty if loading, error, null, or explicitly empty array
    const messages = (isHistoryLoading || historyLoadError || messagesState === null || !Array.isArray(messagesState)) ? [] : messagesState;
    const defaultConfig = (defaultConfigStoreValue !== 'loading' && defaultConfigStoreValue !== 'error' && defaultConfigStoreValue !== null) ? defaultConfigStoreValue : null;
    const session = (currentChatSession !== 'loading' && currentChatSession !== null) ? currentChatSession : null;
    const effectiveConfig = useMemo(() => calculateEffectiveConfig(session, defaultConfig), [session, defaultConfig]);
    const assistantId = effectiveConfig.assistantId;

    // Get assistant details from the store
    const { assistantMap } = useAssistantStore.getState(); // Get map directly for memo
    const selectedAssistant = useMemo(() => {
        if (!assistantId) return null;
        // Fetch from the assistantMap in the store
        const assistant = assistantMap[assistantId];
        if (!assistant) {
            console.warn(`[ChatPage] Assistant with ID ${assistantId} not found in store map.`);
            // Return a minimal placeholder or null if not found
            return null;
            // Or return a placeholder structure if needed for downstream logic:
            // return { id: assistantId, name: 'Unknown Assistant', description: '', instructions: '', modelConfig: { providerId: '', modelId: '' }, createdAt: '', updatedAt: '' };
        }
        return assistant;
    }, [assistantId, assistantMap]); // Depend on assistantId and the map itself




    // Derive actual provider/model from the selected assistant
    const actualProviderId = selectedAssistant?.modelConfig.providerId; // Access via modelConfig
    const actualModelId = selectedAssistant?.modelConfig.modelId; // Access via modelConfig
    const assistantName = selectedAssistant?.name || (effectiveConfig.useDefaults ? 'Default Assistant' : 'Unknown Assistant');
    // Removed customInstructions from here, it's resolved later if needed

    // Refs
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    // Removed showClearConfirm state

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
        // Use actualProviderId and actualModelId derived from selectedAssistant
        if ((inputValue.trim() || selectedImages.length > 0) && !isSending && !isStreaming && actualProviderId && actualModelId && chatId) {
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
            // Update pending message: Use actual IDs, remove provider/model names from config
            const optimisticPendingMessage: UiMessage = { id: optimisticAssistantId, role: 'assistant', content: [], timestamp: timestamp + 1, status: 'pending', providerId: actualProviderId, modelId: actualModelId };
            const currentActualHistory = $activeChatHistory.getActualState();
            let optimisticState: UiMessage[] | null = Array.isArray(currentActualHistory) ? [...currentActualHistory, optimisticUserMessage, optimisticPendingMessage] : [optimisticUserMessage, optimisticPendingMessage];

            setInputValue('');
            clearSelectedImages();
            if (textareaRef.current) textareaRef.current.style.height = 'auto';

            // Update backend payload: Use actual IDs and pass assistantId
            const backendPayload: SendMessagePayload = { chatId, content: contentParts, assistantId: assistantId, providerId: actualProviderId, modelId: actualModelId, tempId };
            try {
                await sendMessageMutate(backendPayload, { optimisticState });
            } catch (error) { console.error(`Error sending message:`, error); }
        } else {
             console.warn("Send cancelled: Missing required info", { inputValue: !!inputValue.trim(), selectedImages: selectedImages.length, isSending, isStreaming, actualProviderId, actualModelId, chatId });
             // TODO: Show user feedback if send fails due to missing info
        }
    }, [ inputValue, selectedImages, isSending, isStreaming, chatId, assistantId, actualProviderId, actualModelId, setInputValue, clearSelectedImages, textareaRef, sendMessageMutate ]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey && !isSending && !isStreaming) { e.preventDefault(); handleSend(); } }, [handleSend, isSending, isStreaming]);
    // Removed confirmClearChat and cancelClearChat handlers
    const handleSuggestedActionClick = useCallback(async (action: SuggestedAction) => {
        // Use actualProviderId and actualModelId
        if (!chatId || !actualProviderId || !actualModelId) return;
        try {
            switch (action.action_type) {
                case 'send_message':
                    if (typeof action.value === 'string') {
                        const text = action.value;
                        const tempId = generateUniqueId();
                        // Update payload: Use actual IDs and pass assistantId
                        const payload: SendMessagePayload = { chatId, content: [{ type: 'text', text: text }], assistantId: assistantId, providerId: actualProviderId, modelId: actualModelId, tempId };
                        const currentActualHistoryAction = $activeChatHistory.getActualState();
                        let optimisticStateAction: UiMessage[] | null = null;
                        const optimisticUserMessageAction: UiMessage = { id: tempId, tempId: tempId, role: 'user', content: [{ type: 'text', text: text }], timestamp: Date.now() };
                        // Update pending message: Use actual IDs, remove provider/model names from config
                        const optimisticPendingMessageAction: UiMessage = { id: `pending-assistant-${Date.now()}`, role: 'assistant', content: [], timestamp: Date.now() + 1, status: 'pending', providerId: actualProviderId, modelId: actualModelId };
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
}, [ chatId, assistantId, actualProviderId, actualModelId, setInputValue, textareaRef, sendMessageMutate, executeToolActionMutate ]);

    const handleStopGeneration = useCallback(async () => { try { await stopGenerationMutate(); } catch (error) { console.error('Error stopping generation:', error); } }, [stopGenerationMutate]);

    // Handler for when the assistant selection changes in InputArea
    const handleAssistantChange = useCallback(async (newAssistantId: string | null) => {
        if (chatId) {
            // Determine if we are setting a specific assistant or reverting to default
            const useDefaults = newAssistantId === null;
            const cfg: Partial<ChatConfig> = {
                assistantId: useDefaults ? undefined : newAssistantId, // Set ID only if not using default
                useDefaults: useDefaults
            };
            try {
                // Optimistic update for session list (similar to old model change)
                const currentSessions = $chatSessions.getActualState();
                let optimisticStateSessions: ChatSession[] | null = null;
                if (Array.isArray(currentSessions)) {
                    const sessionIndex = currentSessions.findIndex(s => s.id === chatId);
                    if (sessionIndex !== -1) {
                        optimisticStateSessions = JSON.parse(JSON.stringify(currentSessions));
                        if (optimisticStateSessions) {
                            optimisticStateSessions[sessionIndex].config.assistantId = useDefaults ? undefined : newAssistantId;
                            optimisticStateSessions[sessionIndex].config.useDefaults = useDefaults;
                            optimisticStateSessions[sessionIndex].lastModified = Date.now();
                            optimisticStateSessions.sort((a, b) => b.lastModified - a.lastModified);
                        }
                    } else { optimisticStateSessions = currentSessions; }
                }
                // Call the mutation store
                await updateChatConfigMutate({ chatId: chatId, config: cfg }, { optimisticState: optimisticStateSessions });
                console.log(`Chat config updated for ${chatId}: Assistant set to ${newAssistantId ?? 'Default'}`);
            } catch (e) {
                console.error(`Error updating chat config for assistant change:`, e);
                // TODO: Revert optimistic update? Show error?
            }
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

    // Update handleChatsClick to navigate to /sessions
    const handleChatsClick = useCallback(() => router.open('/sessions'), []);
    const handleSettingsClick = useCallback(() => router.open('/settings'), []);

    // --- Render Logic ---
    if (!chatId) { 
        return (
            <div class="flex flex-col h-full items-center justify-center text-gray-500 dark:text-gray-400 animate-pulse">
                No chat selected
            </div>
        );
    }

    // Combined loading state
    const isLoading = isLoadingSessionData || isHistoryLoading;
    if (isLoading) {
        return (
            <div class="flex flex-col h-full items-center justify-center">
                <div class="text-gray-500 dark:text-gray-400 flex items-center space-x-2">
                    {/* Corrected icon name */}
                    <span class="i-carbon-circle-dash animate-spin h-5 w-5 text-[var(--vscode-foreground)] opacity-75"></span>
                    <span>Loading chat...</span>
                </div>
            </div>
        );
    }

    // Show specific error only if history fetch failed
    if (historyLoadError) {
         return (
             <div class="flex flex-col h-full items-center justify-center text-[var(--vscode-errorForeground)]">
                 <div class="flex items-center space-x-2">
                     <span class="i-carbon-warning-alt h-5 w-5"></span>
                     <span>Error loading chat history</span>
                 </div>
             </div>
         );
     }

    // If not loading and not error, proceed to render.
    // The `messages` array will be empty for a new chat (isNewChatScenario is true).
    // The `session` object will be null for a new chat. `effectiveConfig` handles this.

    const currentSuggestedActionsMap = suggestedActionsMap;

    return (
        // Restored original single-column layout
        <div class="flex flex-col h-full">
            {/* Simple minimalist header - just back button and chat name */}
            <div class="flex justify-between items-center px-4 py-2 flex-shrink-0 bg-[var(--vscode-editor-background)]">
                <button
                    onClick={handleChatsClick}
                    class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--vscode-button-hoverBackground)] transition-colors"
                    aria-label="Back to chats"
                >
                    {/* Removed display: block */}
                    <span class="i-carbon-chevron-left h-5 w-5 text-[var(--vscode-foreground)]"></span>
                </button>
                
                {/* Display Assistant Name in Header */}
                <div class="absolute left-1/2 transform -translate-x-1/2 text-sm text-[var(--vscode-foreground)] opacity-80 font-medium flex items-center gap-1" title={assistantName}>
                     <span class="i-carbon-user-avatar h-3.5 w-3.5 opacity-70"></span> {/* TODO: Use Assistant avatar */}
                     <span class="truncate max-w-xs">{assistantName}</span>
                </div>
                
                <button
                    onClick={handleSettingsClick}
                    class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--vscode-button-hoverBackground)] transition-colors"
                    title="Settings"
                >
                    {/* Removed display: block */}
                    <span class="i-carbon-settings-adjust h-4.5 w-4.5 text-[var(--vscode-foreground)] opacity-70"></span>
                </button>
            </div>

            {/* Messages Area - Pure conversation without system elements */}
            <MessagesArea
                messages={messages}
                suggestedActionsMap={currentSuggestedActionsMap}
                // Removed isStreaming prop
                handleSuggestedActionClick={handleSuggestedActionClick}
                messagesEndRef={messagesEndRef}
                onCopyMessage={handleCopyMessage}
                onDeleteMessage={handleDeleteMessage}
                className="flex-1 overflow-y-auto px-3 py-4"
                onSamplePromptSelect={setInputValue} // Pass setInputValue to handle sample prompt clicks
            />

            {/* Input area with suggestion chips that appear when empty */}
            <div class="p-3 bg-[var(--vscode-editor-background)]">
                {inputValue.trim() === '' && !isStreaming && (
                    <div class="mb-3 flex flex-wrap gap-2">
                        <button
                            onClick={() => setInputValue("Explain this code to me")}
                            class="px-3 py-1 rounded-md text-xs bg-vscode-button-secondary-background text-vscode-button-secondary-foreground hover:bg-opacity-75 transition-colors"
                        >
                            Explain code
                        </button>
                        <button
                            onClick={() => setInputValue("Fix bugs in this code")}
                            class="px-3 py-1 rounded-md text-xs bg-vscode-button-secondary-background text-vscode-button-secondary-foreground hover:bg-opacity-75 transition-colors"
                        >
                            Debug this
                        </button>
                        <button
                            onClick={() => setInputValue("Add tests for this function")}
                            class="px-3 py-1 rounded-md text-xs bg-vscode-button-secondary-background text-vscode-button-secondary-foreground hover:bg-opacity-75 transition-colors"
                        >
                            Write tests
                        </button>
                        <button
                            onClick={() => setInputValue("Optimize this code")}
                            class="px-3 py-1 rounded-md text-xs bg-vscode-button-secondary-background text-vscode-button-secondary-foreground hover:bg-opacity-75 transition-colors"
                        >
                            Optimize
                        </button>
                    </div>
                )}
                
                {/* Wrap InputArea and Clear button in a group */}
                <div class="relative group">
                    <InputArea
                        className="" // Removed border, shadow, rounded-lg for borderless look
                        handleKeyDown={handleKeyDown}
                    handleSend={handleSend}
                    selectedImages={selectedImages}
                    handleImageFileChange={handleImageFileChange}
                    triggerImageUpload={triggerImageUpload}
                    fileInputRef={fileInputRef}
                    removeSelectedImage={removeSelectedImage}
                    setSelectedImages={setSelectedImages}
                    handleStopGeneration={handleStopGeneration}
                    // Pass assistantId and the new handler
                    selectedAssistantId={assistantId ?? null}
                    onAssistantChange={handleAssistantChange}
                    // Ensure all required props are passed
                    inputValue={inputValue}
                    setInputValue={setInputValue}
                    isStreaming={isStreaming}
                    textareaRef={textareaRef}
                    /* No useAtMention prop since it's not defined in InputArea */
                    />
                    {/* Removed Clear conversation button and its wrapper div */}
                </div> {/* Close group wrapper */}
            </div>
            
            {/* Removed Confirmation Dialog */}
        </div> // Close main flex-col div
    );
};
