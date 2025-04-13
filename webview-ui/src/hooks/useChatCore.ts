import { useState, useCallback } from 'preact/hooks';
import { Message, SuggestedAction, UiMessageContentPart, ApiProviderKey, generateUniqueId, postMessage } from '../app'; // Assuming types/helpers are exported

// Define props for the hook, including dependencies from App
interface UseChatCoreProps {
    selectedProvider: ApiProviderKey | null;
    currentModelInput: string;
    selectedImages: { id: string; data: string; mediaType: string; name: string }[];
    clearSelectedImages: () => void;
}

export function useChatCore({
    selectedProvider,
    currentModelInput,
    selectedImages,
    clearSelectedImages
}: UseChatCoreProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [suggestedActionsMap, setSuggestedActionsMap] = useState<Record<string, SuggestedAction[]>>({});
    // currentAssistantMessageId is managed by useMessageHandler

    const handleSend = useCallback(() => {
        if ((inputValue.trim() || selectedImages.length > 0) && !isStreaming && currentModelInput && selectedProvider) {
            const contentParts: UiMessageContentPart[] = [];
            selectedImages.forEach(img => {
                contentParts.push({ type: 'image', mediaType: img.mediaType, data: img.data });
            });
            if (inputValue.trim()) {
                contentParts.push({ type: 'text', text: inputValue });
            }
            const newUserMessage: Message = { id: generateUniqueId(), sender: 'user', content: contentParts, timestamp: Date.now() };
            setMessages(prev => [...prev, newUserMessage]);
            postMessage({ type: 'sendMessage', content: contentParts, providerId: selectedProvider, modelId: currentModelInput });
            setInputValue('');
            clearSelectedImages();
            setIsStreaming(true);
        } else if (!currentModelInput || !selectedProvider) {
             console.warn("Cannot send message: Provider or Model not selected.");
        }
    }, [inputValue, selectedImages, isStreaming, currentModelInput, selectedProvider, clearSelectedImages, setMessages, setIsStreaming, setInputValue]);

    const handleClearChat = useCallback(() => { setShowClearConfirm(true); }, []);

    const confirmClearChat = useCallback(() => {
        setMessages([]);
        postMessage({ type: 'clearChatHistory' });
        setShowClearConfirm(false);
    }, [setMessages]); // Added dependency

    const cancelClearChat = useCallback(() => { setShowClearConfirm(false); }, []);

    const handleSuggestedActionClick = useCallback((action: SuggestedAction) => {
        console.log("Suggested action clicked:", action);
        switch (action.action_type) {
            case 'send_message':
                if (typeof action.value === 'string' && selectedProvider && currentModelInput) {
                    postMessage({ type: 'sendMessage', content: [{ type: 'text', text: action.value }], providerId: selectedProvider, modelId: currentModelInput });
                    setIsStreaming(true);
                } else { console.warn("Invalid value/state for send_message action"); }
                break;
            case 'run_tool':
                if (typeof action.value === 'object' && action.value?.toolName) {
                    console.warn("run_tool action type not fully implemented yet.");
                    postMessage({ type: 'logAction', message: `User wants to run tool: ${action.value.toolName}` });
                } else { console.warn("Invalid value for run_tool action"); }
                break;
            case 'fill_input':
                 if (typeof action.value === 'string') { setInputValue(action.value); }
                 else { console.warn("Invalid value for fill_input action"); }
                break;
            default: console.warn("Unknown suggested action type");
        }
    }, [currentModelInput, selectedProvider, setInputValue, setIsStreaming]); // Added dependencies

    return {
        messages,
        setMessages, // Expose if needed by useMessageHandler
        inputValue,
        setInputValue,
        isStreaming,
        setIsStreaming, // Expose if needed by useMessageHandler
        showClearConfirm,
        suggestedActionsMap,
        setSuggestedActionsMap, // Expose if needed by useMessageHandler
        handleSend,
        handleClearChat,
        confirmClearChat,
        cancelClearChat,
        handleSuggestedActionClick
    };
}