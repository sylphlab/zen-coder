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
    ChatSession,
    DefaultChatConfig
} from '../../../src/common/types';
// Import Nanostore stores
import {
    $chatSessions,
    $defaultConfig,
    $sendMessage,
    $deleteMessage,
    $clearChatHistory,
    $executeToolAction,
    $stopGeneration,
    $updateChatConfig
    // Removed activeChatIdAtom import
} from '../stores/chatStores';
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
    // --- Nanostores State ---
    const allChatSessions = useStore($chatSessions);
    // Removed useStore(activeChatIdAtom)
    const defaultConfig = useStore($defaultConfig);
    const { mutate: sendMessageMutate, loading: isSending } = useStore($sendMessage);
    const { mutate: deleteMessageMutate, loading: isDeletingMsg } = useStore($deleteMessage);
    const { mutate: clearHistoryMutate, loading: isClearing } = useStore($clearChatHistory);
    const { mutate: executeToolMutate, loading: isExecutingTool } = useStore($executeToolAction);
    const { mutate: stopGenerationMutate, loading: isStopping } = useStore($stopGeneration);
    const { mutate: updateConfigMutate, loading: isUpdatingConfig } = useStore($updateChatConfig);

    // --- Local UI State ---
    const [inputValue, setInputValue] = useState('');
    // TODO: Replace with Nanostore listening to backend 'suggestedActionsUpdate' topic
    const [suggestedActionsMap, setSuggestedActionsMap] = useState<Record<string, SuggestedAction[]>>({});
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // --- Nanostores Derived State ---
    const isStreaming = useStore($sendMessage).loading;

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
    const currentChat = useMemo(() => {
        return allChatSessions?.find(s => s.id === chatIdFromRoute) ?? null;
    }, [allChatSessions, chatIdFromRoute]);

    const messages = useMemo(() => currentChat?.history ?? [], [currentChat]);

    const effectiveConfig = useMemo(() => calculateEffectiveConfig(currentChat, defaultConfig), [currentChat, defaultConfig]);
    const providerId = effectiveConfig.providerId;
    const modelId = effectiveConfig.modelId;

    // --- Effects ---
    // Removed activeChatIdAtom sync effect

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Redirect if chat not found (or deleted)
     useEffect(() => {
         if (chatIdFromRoute && allChatSessions !== null && !currentChat) {
             console.log(`[ChatView] Chat ${chatIdFromRoute} not found in sessions, redirecting to chat list.`);
             router.open('/'); // Navigate to chat list page
         }
     }, [chatIdFromRoute, allChatSessions, currentChat]);

    // Clear input on chat change
    useEffect(() => {
        setInputValue('');
        clearSelectedImages();
    }, [chatIdFromRoute, setInputValue, clearSelectedImages]);


    // --- Event Handlers ---
    const handleSend = useCallback(async () => {
        if ((inputValue.trim() || selectedImages.length > 0) && !isSending && !isStreaming && providerId && modelId && chatIdFromRoute) {
            const contentParts: UiMessageContentPart[] = selectedImages.map(img => ({ type: 'image', mediaType: img.mediaType, data: img.data } as UiImagePart));
            if (inputValue.trim()) {
                contentParts.push({ type: 'text', text: inputValue });
            }
            const payload = { chatId: chatIdFromRoute, content: contentParts, providerId: providerId, modelId: modelId };
            setInputValue('');
            clearSelectedImages();
            try {
                await sendMessageMutate(payload);
            } catch (error) {
                 console.error(`Error sending message:`, error);
                 // TODO: Show error notification
            }
        }
    }, [ inputValue, selectedImages, isSending, isStreaming, chatIdFromRoute, providerId, modelId, sendMessageMutate, setInputValue, clearSelectedImages ]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey && !isSending && !isStreaming) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend, isSending, isStreaming]);

     const handleClearChat = useCallback(() => {
         if (chatIdFromRoute) setShowClearConfirm(true);
     }, [chatIdFromRoute]);

     const confirmClearChat = useCallback(async () => {
         if (chatIdFromRoute) {
             setShowClearConfirm(false);
             try {
                 await clearHistoryMutate({ chatId: chatIdFromRoute });
             } catch (error) {
                  console.error(`Error clearing chat history:`, error);
                  // TODO: Show error
             }
         }
     }, [chatIdFromRoute, clearHistoryMutate]);

     const cancelClearChat = useCallback(() => {
         setShowClearConfirm(false);
     }, []);

    const handleSuggestedActionClick = useCallback(async (action: SuggestedAction) => {
        if (!chatIdFromRoute || !providerId || !modelId) return;
        try {
            switch (action.action_type) {
                case 'send_message':
                    if (typeof action.value === 'string') {
                        await sendMessageMutate({ chatId: chatIdFromRoute, content: [{ type: 'text', text: action.value }], providerId: providerId, modelId: modelId });
                    }
                    break;
                case 'run_tool':
                    if (typeof action.value === 'object' && action.value?.toolName) {
                        await executeToolMutate({ toolName: action.value.toolName, args: action.value.args ?? {} });
                    }
                    break;
                case 'fill_input':
                     if (typeof action.value === 'string') {
                         setInputValue(action.value);
                     }
                    break;
            }
            // TODO: Revisit how to clear suggestions for the specific message
        } catch (error) {
             console.error(`Error handling suggested action:`, error);
             // TODO: Show error
        }
    }, [ chatIdFromRoute, providerId, modelId, sendMessageMutate, executeToolMutate, setInputValue ]);

    const handleStopGeneration = useCallback(async () => {
        try {
            await stopGenerationMutate();
        } catch (error) {
            console.error('Error stopping generation:', error);
            // TODO: Show error
        }
    }, [stopGenerationMutate]);

    const handleChatModelChange = useCallback(async (newProviderId: string | null, newModelId: string | null) => {
        if (chatIdFromRoute) {
            const newConfig: Partial<ChatConfig> = {
                providerId: newProviderId ?? undefined,
                modelId: newModelId ?? undefined,
                useDefaults: false
            };
            try {
                await updateConfigMutate({ chatId: chatIdFromRoute, config: newConfig });
            } catch (error) {
                 console.error(`Error updating chat config:`, error);
                 // TODO: Show error
            }
        }
    }, [chatIdFromRoute, updateConfigMutate]);

    const handleCopyMessage = useCallback((messageId: string) => {
        const messageToCopy = messages.find(msg => msg.id === messageId);
        if (messageToCopy?.content) {
            const textToCopy = messageToCopy.content.filter((part): part is UiTextMessagePart => part.type === 'text').map(part => part.text).join('\n');
            if (textToCopy) navigator.clipboard.writeText(textToCopy).catch(err => console.error(`Copy failed:`, err));
        }
    }, [messages]);

    const handleDeleteMessage = useCallback(async (messageId: string) => {
        if (!chatIdFromRoute) return;
        try {
            await deleteMessageMutate({ chatId: chatIdFromRoute, messageId });
        } catch (error) {
            console.error(`Error deleting message:`, error);
            // TODO: Show error
        }
    }, [chatIdFromRoute, deleteMessageMutate]);

    // --- Render Logic ---
    // Display loading only if sessions haven't loaded initially
    if (allChatSessions === null) {
        return <div class="p-6 text-center text-gray-500">Loading chats...</div>;
    }
    // If sessions loaded but current chat isn't found (potentially due to deletion/navigation)
    // The redirect effect above should handle navigation, but we can show a brief message.
    if (!currentChat) {
        return <div class="p-6 text-center text-yellow-500">Loading chat or chat not found...</div>;
    }

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
                messages={messages}
                suggestedActionsMap={suggestedActionsMap}
                isStreaming={isStreaming}
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
                isStreaming={isStreaming}
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
