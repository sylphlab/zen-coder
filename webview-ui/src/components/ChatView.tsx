import { useEffect, useRef, useCallback, useState } from 'preact/hooks';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import { HeaderControls } from './HeaderControls';
import { MessagesArea } from './MessagesArea';
import { InputArea } from './InputArea';
import { ConfirmationDialog } from './ConfirmationDialog';
import { useImageUpload } from '../hooks/useImageUpload';
import { requestData, generateUniqueId } from '../utils/communication';
import {
    SuggestedAction,
    UiMessageContentPart,
    UiImagePart,
    UiMessage,
    ChatConfig,
    UiTextMessagePart,
    ChatSession // Import ChatSession
} from '../../../src/common/types';
import {
    // chatSessionsAtom, // No longer needed directly here
    isStreamingAtom,
    inputValueAtom,
    selectedImagesAtom,
    suggestedActionsMapAtom,
    chatSessionAtomFamily, // Import the atom family
    effectiveChatConfigAtomFamily, // Import the effective config family
} from '../store/atoms';

interface ChatViewProps {
    chatIdFromRoute: string; // Passed from the route parameter
    // Removed navigation callback props
}

export function ChatView({ chatIdFromRoute }: ChatViewProps) { // Destructure props
    // --- Jotai State ---
    // Use the atom family to get the state for the current chat ID
    const [currentChat, setCurrentChat] = useAtom(chatSessionAtomFamily(chatIdFromRoute)); // Get session state and setter

    // Use local state or derived atoms specific to this chat ID
    const [isStreaming, setIsStreaming] = useAtom(isStreamingAtom); // Keep global streaming state? Or make it chat-specific? Let's keep global for now.
    const [inputValue, setInputValue] = useAtom(inputValueAtom);
    const [suggestedActionsMap, setSuggestedActionsMap] = useAtom(suggestedActionsMapAtom); // Keep global map?
    // Get effective config using the atom family
    const effectiveConfig = useAtomValue(effectiveChatConfigAtomFamily(chatIdFromRoute));
    const providerId = effectiveConfig.providerId; // Use effective providerId
    const modelId = effectiveConfig.modelId;       // Use effective modelId

    // --- Local UI State ---
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // --- Jotai Setters ---
    // const setChatSessionsDirect = useSetAtom(chatSessionsAtom); // No longer needed here
    const setInputValueDirect = useSetAtom(inputValueAtom);
    const setIsStreamingDirect = useSetAtom(isStreamingAtom);
    const setSelectedImagesAtomDirect = useSetAtom(selectedImagesAtom);
    const setSuggestedActionsMapDirect = useSetAtom(suggestedActionsMapAtom);

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

    // Sync hook state to Jotai atom
    useEffect(() => {
        setSelectedImagesAtomDirect(selectedImages);
    }, [selectedImages, setSelectedImagesAtomDirect]);

    // --- Derived State (Specific to this chat) ---
    // Get data directly from the currentChat state object
    const messages = currentChat?.history ?? [];
    // const config = currentChat?.config; // Keep if needed for other config fields like 'name' or 'useDefaults' display

    // --- Effects ---
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Effect to potentially clear input/suggestions when chat changes
    useEffect(() => {
        setInputValueDirect('');
        clearSelectedImages();
        // Clear suggestions for this chat? Or keep global map?
        // setSuggestedActionsMapDirect(prev => ({ ...prev, [chatIdFromRoute]: [] }));
    }, [chatIdFromRoute, setInputValueDirect, clearSelectedImages]);


    // --- Event Handlers (Copied and adapted from App.tsx) ---
    const handleSend = useCallback(() => {
        // Use effective providerId and modelId from derived state
        if ((inputValue.trim() || selectedImages.length > 0) && !isStreaming && providerId && modelId && chatIdFromRoute) {
            const contentParts: UiMessageContentPart[] = selectedImages.map(img => ({
                type: 'image',
                mediaType: img.mediaType,
                data: img.data
            } as UiImagePart));

            if (inputValue.trim()) {
                contentParts.push({ type: 'text', text: inputValue });
            }
            // const newUserMessage: UiMessage = { id: generateUniqueId(), role: 'user', content: contentParts, timestamp: Date.now() }; // No longer needed with backend push

            // Removed optimistic update for user message
            const combinedModelId = providerId && modelId ? `${providerId}:${modelId}` : null;
            if (combinedModelId) {
                 requestData('sendMessage', { chatId: chatIdFromRoute, content: contentParts, providerId: providerId, modelId: combinedModelId })
                    .catch(error => console.error(`Error sending message for chat ${chatIdFromRoute}:`, error));
            } else {
                 console.error("Cannot send message: Missing provider or model ID for active chat.");
                 setIsStreamingDirect(false);
                 return;
            }
            setInputValueDirect('');
            clearSelectedImages();
            setIsStreamingDirect(true);
        } else if (!chatIdFromRoute) {
             console.warn("Cannot send message: No active chat selected (chatIdFromRoute missing).");
        } else if (!providerId || !modelId) {
             console.warn("Cannot send message: Provider or Model ID not selected for the active chat.");
        }
    }, [
         inputValue, selectedImages, isStreaming, chatIdFromRoute, providerId, modelId, // Use effective IDs
         /*setChatSessionsDirect,*/ setInputValueDirect, setIsStreamingDirect, clearSelectedImages // Removed setChatSessionsDirect
    ]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey && !isStreaming) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend, isStreaming]);

     const handleClearChat = useCallback(() => {
         if (chatIdFromRoute) {
             setShowClearConfirm(true);
         } else {
             console.warn("Cannot clear chat: No active chat selected.");
         }
     }, [chatIdFromRoute]);

     const confirmClearChat = useCallback(() => {
         if (chatIdFromRoute) {
             // Removed optimistic update for clear history
             requestData('clearChatHistory', { chatId: chatIdFromRoute })
                 .catch(error => console.error(`Error clearing chat history for ${chatIdFromRoute}:`, error));
             setShowClearConfirm(false);
         }
     }, [chatIdFromRoute/*, setChatSessionsDirect*/]); // Removed setChatSessionsDirect

     const cancelClearChat = useCallback(() => {
         setShowClearConfirm(false);
     }, []);

    const handleSuggestedActionClick = useCallback((action: SuggestedAction) => {
        // Use effective providerId and modelId
        const combinedModelIdForAction = providerId && modelId ? `${providerId}:${modelId}` : null;
        if (chatIdFromRoute && providerId && modelId && combinedModelIdForAction) {
            switch (action.action_type) {
                case 'send_message':
                    if (typeof action.value === 'string') {
                        requestData('sendMessage', { chatId: chatIdFromRoute, content: [{ type: 'text', text: action.value }], providerId: providerId, modelId: combinedModelIdForAction })
                           .catch(error => console.error(`Error sending suggested message for chat ${chatIdFromRoute}:`, error));
                        setIsStreamingDirect(true);
                    } else { console.warn("Invalid value/state for send_message action"); }
                    break;
                case 'run_tool':
                    if (typeof action.value === 'object' && action.value?.toolName) {
                        console.warn("run_tool action type not fully implemented yet.");
                        requestData('executeToolAction', { toolName: action.value.toolName, args: action.value.args ?? {} })
                           .then(result => console.log(`Tool action ${action.value.toolName} requested, result:`, result))
                           .catch(error => console.error(`Error requesting tool action ${action.value.toolName}:`, error));
                    } else { console.warn("Invalid value for run_tool action"); }
                    break;
                case 'fill_input':
                     if (typeof action.value === 'string') { setInputValueDirect(action.value); }
                     else { console.warn("Invalid value for fill_input action"); }
                    break;
                default: console.warn("Unknown suggested action type");
            }
        } else {
             console.warn("Cannot handle suggested action: Missing activeChatId, provider, or model ID for the chat.");
        }
    }, [ chatIdFromRoute, providerId, modelId, setInputValueDirect, setIsStreamingDirect]); // Use effective IDs

    const handleStopGeneration = useCallback(() => {
        console.log("[ChatView Handler] Stop generation requested.");
        requestData('stopGeneration')
            .catch(error => console.error('Error sending stopGeneration request:', error));
    }, []);

    // --- Handler for Chat-Specific Model Change (from HeaderControls) ---
    const handleChatModelChange = useCallback((newProviderId: string | null, newModelId: string | null) => {
        if (chatIdFromRoute) {
            console.log(`[ChatView Handler] Updating model for chat ${chatIdFromRoute} to Provider: ${newProviderId}, Model: ${newModelId}`);
            const newConfig: Partial<ChatConfig> = {
                providerId: newProviderId ?? undefined,
                modelId: newModelId ?? undefined,
                useDefaults: false // Explicitly setting means not using defaults
            };
            // Removed optimistic update for config change
            requestData('updateChatConfig', { chatId: chatIdFromRoute, config: newConfig })
                .catch(error => console.error(`Error updating chat config for ${chatIdFromRoute}:`, error));
        } else {
            console.warn("Cannot change chat model: No active chat selected.");
        }
    }, [chatIdFromRoute/*, setChatSessionsDirect*/]); // Removed setChatSessionsDirect

    // --- Message Action Handlers (from MessagesArea) ---
    const handleCopyMessage = useCallback((messageId: string) => {
        const messageToCopy = messages.find(msg => msg.id === messageId);
        if (messageToCopy && Array.isArray(messageToCopy.content)) {
            const textToCopy = messageToCopy.content
                .filter((part): part is UiTextMessagePart => part.type === 'text')
                .map(part => part.text)
                .join('\n');
            if (textToCopy) {
                navigator.clipboard.writeText(textToCopy)
                    .then(() => console.log(`Copied message ${messageId} to clipboard.`))
                    .catch(err => console.error(`Failed to copy message ${messageId}:`, err));
            } else { console.warn(`No text content found to copy in message ${messageId}.`); }
        } else { console.warn(`Could not find message ${messageId} to copy.`); }
    }, [messages]);

    const handleDeleteMessage = useCallback((messageId: string) => {
        if (!chatIdFromRoute) return;
        console.log(`Requesting delete message ${messageId} from chat ${chatIdFromRoute}`);
        // Removed optimistic update for message deletion
        requestData('deleteMessage', { chatId: chatIdFromRoute, messageId })
            .catch(error => console.error(`Error deleting message ${messageId}:`, error));
    }, [chatIdFromRoute/*, setChatSessionsDirect*/]); // Removed setChatSessionsDirect


    // --- Render ---
    if (!currentChat) {
        // Handle case where chat ID from route doesn't match any session
        // This might happen briefly during loading or if the ID is invalid
        return <div class="p-6 text-center text-yellow-500">Loading chat or chat not found...</div>;
    }

    return (
        <div class="chat-container flex flex-col flex-1 h-full p-4 overflow-hidden">
            <HeaderControls
                // Pass only the model change callback
                onModelChange={handleChatModelChange}
                // Navigation callbacks removed
            />
            <MessagesArea
                // Props are just callbacks and ref now
                handleSuggestedActionClick={handleSuggestedActionClick}
                messagesEndRef={messagesEndRef}
                onCopyMessage={handleCopyMessage}
                onDeleteMessage={handleDeleteMessage}
                className="flex-1 overflow-y-auto mb-4 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent"
            />
            <InputArea
                className="mt-auto"
                // Props are just callbacks and ref now
                handleKeyDown={handleKeyDown}
                handleSend={handleSend}
                setSelectedImages={setSelectedImages} // Pass hook setter
                fileInputRef={fileInputRef} // Pass ref from hook
                triggerImageUpload={triggerImageUpload} // Pass handler from hook
                removeSelectedImage={removeSelectedImage} // Pass handler from hook
                handleImageFileChange={handleImageFileChange} // Pass handler from hook
                handleStopGeneration={handleStopGeneration}
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
