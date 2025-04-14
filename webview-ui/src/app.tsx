import { useEffect, useRef, useCallback, useState } from 'preact/hooks';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import { Router, Route, useLocation, Switch, Redirect } from "wouter";
import './app.css';
import { SettingPage } from './pages/SettingPage';
import { ChatListPage } from './pages/ChatListPage';
import { useImageUpload } from './hooks/useImageUpload';
import { requestData, generateUniqueId } from './utils/communication'; // Removed postMessage import
import { HeaderControls } from './components/HeaderControls';
import { MessagesArea } from './components/MessagesArea';
import { InputArea } from './components/InputArea';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import {
    SuggestedAction as CommonSuggestedAction,
    ChatConfig,
    UiMessageContentPart,
    UiMessage,
    UiTextMessagePart,
    UiImagePart
} from '../../src/common/types';
import {
    chatSessionsAtom,
    activeChatIdAtom,
    providerStatusAtom,
    availableProvidersAtom,
    isStreamingAtom,
    inputValueAtom,
    selectedImagesAtom,
    suggestedActionsMapAtom,
    activeChatMessagesAtom,
    activeChatProviderIdAtom,
    activeChatModelIdAtom,
    activeChatCombinedModelIdAtom,
    isChatListLoadingAtom
} from './store/atoms';

// --- Type Definitions ---
export type SuggestedAction = CommonSuggestedAction;
export interface InternalUiMessage extends UiMessage {
    thinking?: string;
}
export type ApiProviderKey = 'ANTHROPIC' | 'GOOGLE' | 'OPENROUTER' | 'DEEPSEEK';
export type ProviderInfoAndStatus = {
     id: string;
     name: string;
     apiKeyUrl?: string;
     requiresApiKey: boolean;
     enabled: boolean;
     apiKeySet: boolean;
 };
export type AllProviderStatus = ProviderInfoAndStatus[];
interface McpServerConfig {
    name: string;
    enabled: boolean;
    type: 'stdio' | 'sse';
    command?: string;
    args?: string[];
    cwd?: string;
    url?: string;
    headers?: Record<string, string>;
    _uiId?: string;
}

// Removed VS Code API Helper and postMessage definition (now in communication.ts)
// Removed generateUniqueId definition (now in communication.ts)

// --- App Component ---
export function App() {
    // --- Jotai State ---
    const [chatSessions, setChatSessions] = useAtom(chatSessionsAtom);
    const [activeChatId, setActiveChatId] = useAtom(activeChatIdAtom);
    const [inputValue, setInputValue] = useAtom(inputValueAtom);
    const [isStreaming, setIsStreaming] = useAtom(isStreamingAtom);
    const [providerStatus, setProviderStatus] = useAtom(providerStatusAtom);
    const availableProviders = useAtomValue(availableProvidersAtom);
    const activeChatMessages = useAtomValue(activeChatMessagesAtom);
    const activeChatProviderId = useAtomValue(activeChatProviderIdAtom);
    const currentModelId = useAtomValue(activeChatModelIdAtom);
    const activeChatCombinedModelId = useAtomValue(activeChatCombinedModelIdAtom);
    const suggestedActionsMap = useAtomValue(suggestedActionsMapAtom);

    // --- Local UI State ---
    const [location, setLocation] = useLocation();
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // --- Jotai Setters ---
    const setChatSessionsDirect = useSetAtom(chatSessionsAtom);
    const setActiveChatIdDirect = useSetAtom(activeChatIdAtom);
    const setInputValueDirect = useSetAtom(inputValueAtom);
    const setIsStreamingDirect = useSetAtom(isStreamingAtom);
    const setSelectedImagesAtomDirect = useSetAtom(selectedImagesAtom);
    const setIsChatListLoading = useSetAtom(isChatListLoadingAtom);

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

    // Read atom values needed in callbacks
    const currentInputValue = useAtomValue(inputValueAtom);
    const currentSelectedImages = useAtomValue(selectedImagesAtom);
    const currentIsStreaming = useAtomValue(isStreamingAtom);
    const currentActiveChatId = useAtomValue(activeChatIdAtom);
    const currentProviderId = useAtomValue(activeChatProviderIdAtom);
    const currentChatSessions = useAtomValue(chatSessionsAtom);
    const isChatListLoading = useAtomValue(isChatListLoadingAtom);

    // --- Effects ---
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [activeChatMessages]);

    useEffect(() => {
        console.log(`[App useEffect] Active Provider ID changed to: ${activeChatProviderId}`);
    }, [activeChatProviderId]);

    useEffect(() => {
        console.log(`[App useEffect] Active Model ID changed to: ${currentModelId}`);
    }, [currentModelId]);

    // --- Event Handlers ---
    const handleSend = useCallback(() => {
        if ((currentInputValue.trim() || currentSelectedImages.length > 0) && !currentIsStreaming && currentProviderId && currentModelId && currentActiveChatId) {
            const contentParts: UiMessageContentPart[] = currentSelectedImages.map(img => ({
                type: 'image',
                mediaType: img.mediaType,
                data: img.data
            } as UiImagePart));

            if (currentInputValue.trim()) {
                contentParts.push({ type: 'text', text: currentInputValue });
            }
            const newUserMessage: UiMessage = { id: generateUniqueId(), role: 'user', content: contentParts, timestamp: Date.now() };
            setChatSessionsDirect(prevSessions =>
                prevSessions.map(session =>
                    session.id === currentActiveChatId
                        ? { ...session, history: [...session.history, newUserMessage], lastModified: Date.now() }
                        : session
                )
            );
            const combinedModelId = currentProviderId && currentModelId ? `${currentProviderId}:${currentModelId}` : null;
            if (combinedModelId) {
                 // Use requestData for sendMessage
                 requestData('sendMessage', { chatId: currentActiveChatId, content: contentParts, providerId: currentProviderId, modelId: combinedModelId })
                    .catch(error => console.error(`Error sending message for chat ${currentActiveChatId}:`, error)); // Add error handling
            } else {
                 console.error("Cannot send message: Missing provider or model ID for active chat.");
                 setIsStreamingDirect(false);
                 return;
            }
            setInputValueDirect('');
            clearSelectedImages();
            setIsStreamingDirect(true);
        } else if (!currentActiveChatId) {
             console.warn("Cannot send message: No active chat selected.");
        } else if (!currentProviderId || !currentModelId) {
             console.warn("Cannot send message: Provider or Model ID not selected for the active chat.");
        }
    }, [
         currentInputValue, currentSelectedImages, currentIsStreaming, currentActiveChatId, currentProviderId, currentModelId,
         setChatSessionsDirect, setInputValueDirect, setIsStreamingDirect, clearSelectedImages
    ]);

    const isStreamingValue = useAtomValue(isStreamingAtom);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey && !isStreamingValue) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend, isStreamingValue]);

     const handleClearChat = useCallback(() => {
         if (currentActiveChatId) {
             setShowClearConfirm(true);
         } else {
             console.warn("Cannot clear chat: No active chat selected.");
         }
     }, [currentActiveChatId]);

     const confirmClearChat = useCallback(() => {
         const currentActiveChatIdForClear = currentActiveChatId;
         if (currentActiveChatIdForClear) {
             setChatSessionsDirect(prevSessions =>
                 prevSessions.map(session =>
                     session.id === currentActiveChatIdForClear
                         ? { ...session, history: [], lastModified: Date.now() }
                         : session
                 )
             );
             requestData('clearChatHistory', { chatId: currentActiveChatIdForClear })
                 .catch(error => console.error(`Error clearing chat history for ${currentActiveChatIdForClear}:`, error));
             setShowClearConfirm(false);
         }
     }, [currentActiveChatId, setChatSessionsDirect]);

     const cancelClearChat = useCallback(() => {
         setShowClearConfirm(false);
     }, []);

    const handleSuggestedActionClick = useCallback((action: SuggestedAction) => {
        const currentActiveChatIdForSuggest = currentActiveChatId;
        const currentProviderIdForSuggest = currentProviderId;
        const currentModelIdForSuggest = currentModelId;
        const combinedModelIdForAction = currentProviderIdForSuggest && currentModelIdForSuggest ? `${currentProviderIdForSuggest}:${currentModelIdForSuggest}` : null;
        if (currentActiveChatIdForSuggest && currentProviderIdForSuggest && currentModelIdForSuggest && combinedModelIdForAction) {
            switch (action.action_type) {
                case 'send_message':
                    if (typeof action.value === 'string') {
                        // Use requestData for sendMessage
                        requestData('sendMessage', { chatId: currentActiveChatIdForSuggest, content: [{ type: 'text', text: action.value }], providerId: currentProviderIdForSuggest, modelId: combinedModelIdForAction })
                           .catch(error => console.error(`Error sending suggested message for chat ${currentActiveChatIdForSuggest}:`, error)); // Add error handling
                        setIsStreamingDirect(true);
                    } else { console.warn("Invalid value/state for send_message action"); }
                    break;
                case 'run_tool':
                    if (typeof action.value === 'object' && action.value?.toolName) {
                        console.warn("run_tool action type not fully implemented yet.");
                        // Use requestData for executeToolAction (even if not fully implemented yet)
                        requestData('executeToolAction', { toolName: action.value.toolName, args: action.value.args ?? {} }) // Assuming args might exist
                           .then(result => console.log(`Tool action ${action.value.toolName} requested, result:`, result)) // Log result/ack
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
    }, [ currentActiveChatId, currentProviderId, currentModelId, setInputValueDirect, setIsStreamingDirect]);

    const handleStopGeneration = useCallback(() => {
        console.log("[App Handler] Stop generation requested.");
        requestData('stopGeneration') // Use requestData
            .catch(error => console.error('Error sending stopGeneration request:', error));
    }, []);

    // --- Event Handlers (Navigation) ---
    const handleSettingsClick = useCallback(() => {
        setLocation('/settings');
    }, [setLocation]);

    const handleChatsClick = useCallback(() => {
        setLocation('/chats');
    }, [setLocation]);

    // --- Chat List Handlers ---
    const handleSelectChat = useCallback((chatId: string) => {
        console.log(`[App Handler] Selecting chat: ${chatId}`);
        setActiveChatIdDirect(chatId);
        requestData('setActiveChat', { chatId }) // Use requestData
            .catch(error => console.error(`Error setting active chat to ${chatId}:`, error));
        setLocation('/index.html');
    }, [setLocation, setActiveChatIdDirect]);

    const handleCreateChat = useCallback(() => {
        console.log("[App Handler] Requesting new chat creation...");
        setIsChatListLoading(true);
        requestData('createChat') // Use requestData
            .then(response => {
                console.log('New chat created response:', response);
                // Backend now returns { newChatId: string }
                // We might want to automatically select the new chat here
                // if (response?.newChatId) {
                //     handleSelectChat(response.newChatId);
                // }
            })
            .catch(error => console.error('Error creating chat:', error))
            .finally(() => setIsChatListLoading(false));
    }, [setIsChatListLoading]); // Removed handleSelectChat dependency for now

    const handleDeleteChat = useCallback((chatId: string) => {
        console.log(`[App Handler] Requesting delete chat: ${chatId}`);
        setIsChatListLoading(true);
        requestData('deleteChat', { chatId }) // Use requestData
            .then(() => console.log(`Chat ${chatId} deleted successfully.`))
            .catch(error => console.error(`Error deleting chat ${chatId}:`, error))
            .finally(() => setIsChatListLoading(false));
    }, [setIsChatListLoading]);

    // --- Handler for Chat-Specific Model Change ---
    const handleChatModelChange = useCallback((newProviderId: string | null, newModelId: string | null) => {
        const currentActiveChatIdForModelChange = currentActiveChatId;
        if (currentActiveChatIdForModelChange) {
            console.log(`[App Handler] Updating model for chat ${currentActiveChatIdForModelChange} to Provider: ${newProviderId}, Model: ${newModelId}`);
            const newConfig: Partial<ChatConfig> = {
                providerId: newProviderId ?? undefined,
                modelId: newModelId ?? undefined,
                useDefaults: false
            };

            setChatSessionsDirect(prevSessions =>
                prevSessions.map(session =>
                    session.id === currentActiveChatIdForModelChange
                        ? {
                            ...session,
                            config: { ...session.config, ...newConfig },
                            lastModified: Date.now()
                          }
                        : session
                )
            );
            requestData('updateChatConfig', { chatId: currentActiveChatIdForModelChange, config: newConfig }) // Use requestData
                .catch(error => console.error(`Error updating chat config for ${currentActiveChatIdForModelChange}:`, error));

        } else {
            console.warn("Cannot change chat model: No active chat selected.");
        }
    }, [currentActiveChatId, setChatSessionsDirect]);

    // --- App-level Provider Change Handler ---
    const handleModelSelectorChange = useCallback((newProviderId: string | null, newModelId: string | null) => {
         console.log(`[App handleModelSelectorChange] Received Provider: ${newProviderId}, Model: ${newModelId}`);
         handleChatModelChange(newProviderId, newModelId);
    }, [handleChatModelChange]);

    // --- Message Action Handlers ---
    const handleCopyMessage = useCallback((messageId: string) => {
        const currentActiveChatIdForCopy = currentActiveChatId;
        const currentChatSessionsForCopy = currentChatSessions;
        if (!currentActiveChatIdForCopy) return;
        const activeSession = currentChatSessionsForCopy.find(session => session.id === currentActiveChatIdForCopy);
        const messageToCopy = activeSession?.history.find(msg => msg.id === messageId);

        if (messageToCopy && Array.isArray(messageToCopy.content)) {
            const textToCopy = messageToCopy.content
                .filter((part): part is UiTextMessagePart => part.type === 'text')
                .map(part => part.text)
                .join('\n');

            if (textToCopy) {
                navigator.clipboard.writeText(textToCopy)
                    .then(() => {
                        console.log(`Copied message ${messageId} to clipboard.`);
                    })
                    .catch(err => {
                        console.error(`Failed to copy message ${messageId}:`, err);
                    });
            } else {
                console.warn(`No text content found to copy in message ${messageId}.`);
            }
        } else {
            console.warn(`Could not find message ${messageId} to copy.`);
        }
    }, [currentActiveChatId, currentChatSessions]);

    const handleDeleteMessage = useCallback((messageId: string) => {
        const currentActiveChatIdForDelete = currentActiveChatId;
        if (!currentActiveChatIdForDelete) return;

        console.log(`Requesting delete message ${messageId} from chat ${currentActiveChatIdForDelete}`);

        setChatSessionsDirect(prevSessions =>
            prevSessions.map(session =>
                session.id === currentActiveChatIdForDelete
                    ? {
                        ...session,
                        history: session.history.filter(msg => msg.id !== messageId),
                        lastModified: Date.now()
                      }
                    : session
            )
        );

        requestData('deleteMessage', { chatId: currentActiveChatIdForDelete, messageId }) // Use requestData
            .catch(error => console.error(`Error deleting message ${messageId}:`, error));

    }, [currentActiveChatId, setChatSessionsDirect]);

    // --- Main Render ---
    return (
        <Router>
            <div class="app-layout h-screen flex flex-col bg-gray-100 dark:bg-gray-850 text-gray-900 dark:text-gray-100">
                <main class="content-area flex-1 flex flex-col overflow-hidden">
                    <Switch>
                        <Route path="/index.html">
                            <div class="chat-container flex flex-col flex-1 h-full p-4 overflow-hidden">
                                <HeaderControls
                                    onModelChange={handleModelSelectorChange}
                                    onSettingsClick={handleSettingsClick}
                                    onChatsClick={handleChatsClick}
                                />
                                <MessagesArea
                                    handleSuggestedActionClick={handleSuggestedActionClick}
                                    messagesEndRef={messagesEndRef}
                                    onCopyMessage={handleCopyMessage}
                                    onDeleteMessage={handleDeleteMessage}
                                    className="flex-1 overflow-y-auto mb-4 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent"
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
                                />
                            </div>
                        </Route>
                        <Route path="/settings">
                            <SettingPage />
                        </Route>
                        <Route path="/chats">
                            <ChatListPage
                                onSelectChat={handleSelectChat}
                                onCreateChat={handleCreateChat}
                                onDeleteChat={handleDeleteChat}
                                isLoading={isChatListLoading}
                            />
                        </Route>
                        <Route>
                            {() => {
                                const currentActiveChatId = useAtomValue(activeChatIdAtom);
                                if (location === '/') {
                                    return <Redirect to={currentActiveChatId ? "/index.html" : "/chats"} />;
                                }
                                return <div class="p-6 text-center text-red-500">404: Page Not Found<br/>Path: {location}</div>;
                            }}
                        </Route>
                    </Switch>
                </main>
                <ConfirmationDialog
                    show={showClearConfirm}
                    title="Confirm Clear History"
                    message="Are you sure you want to clear the history for this chat? This cannot be undone."
                    onCancel={cancelClearChat}
                    onConfirm={confirmClearChat}
                    confirmText="Confirm Clear"
                />
            </div>
        </Router>
    );
}
