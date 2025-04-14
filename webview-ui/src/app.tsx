import { useEffect, useRef, useCallback, useState } from 'preact/hooks'; // Keep useState for local UI state
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import { Router, Route, useLocation, Switch, Redirect } from "wouter";
import { Suspense } from 'preact/compat'; // Import Suspense
import { JSX } from 'preact/jsx-runtime'; // Import JSX namespace
import './app.css';
import { SettingPage } from './pages/SettingPage';
import { ChatListPage } from './pages/ChatListPage'; // Import ChatListPage
// Removed: import { useMessageHandler } from './hooks/useMessageHandler';
import { useImageUpload } from './hooks/useImageUpload';
import { handleResponse as handleRequestManagerResponse } from './utils/requestManager'; // Import the response handler
// Removed: import { useModelSelection } from './hooks/useModelSelection';
import { HeaderControls } from './components/HeaderControls';
import { MessagesArea } from './components/MessagesArea';
import { InputArea } from './components/InputArea';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import {
    AvailableModel,
    SuggestedAction as CommonSuggestedAction,
    ChatSession,
    ChatConfig, // <-- Add missing import
    UiMessageContentPart,
    UiMessage,
    UiToolCallPart,
    UiTextMessagePart,
    UiImagePart
} from '../../src/common/types'; // Corrected path: up from webview-ui/src to webview-ui, up to root, then down to src/common
import {
    chatSessionsAtom,
    activeChatIdAtom,
    providerStatusAtom,
    availableProvidersAtom,
    isStreamingAtom,
    inputValueAtom,
    selectedImagesAtom,
    suggestedActionsMapAtom,
    activeChatAtom,
    activeChatMessagesAtom,
    activeChatEffectiveConfigAtom, // Use the renamed atom
    activeChatProviderIdAtom,
    activeChatModelIdAtom, // Corrected import
    activeChatCombinedModelIdAtom,
    webviewLocationAtom, // Added for potential future sync
    isChatListLoadingAtom // Import the new atom
} from './store/atoms'; // Import Jotai atoms

// --- Type Definitions ---
export type SuggestedAction = CommonSuggestedAction;
// Renamed internal Message type to InternalUiMessage to avoid conflict with imported UiMessage
export interface InternalUiMessage extends UiMessage {
    thinking?: string; // Keep UI-specific state if needed
}
// Keep Provider types for now, might move later
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
interface McpServerConfig { // Keep for now if needed by SettingsPage indirectly
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

// --- VS Code API Helper ---
// @ts-ignore
const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
export const postMessage = (message: any) => {
    if (vscode) {
        vscode.postMessage(message);
    } else {
        console.log("VS Code API not available, message not sent:", message);
        // Mock responses for development
        if (message.type === 'webviewReady') {
             setTimeout(() => {
                 window.dispatchEvent(new MessageEvent('message', { data: { type: 'availableModels', payload: [ { id: 'mock-claude', label: 'Mock Claude', providerId: 'ANTHROPIC' }, { id: 'mock-gemini', label: 'Mock Gemini', providerId: 'GOOGLE' } ] } }));
                 window.dispatchEvent(new MessageEvent('message', { data: { type: 'providerStatus', payload: [ { id: 'ANTHROPIC', name: 'Anthropic', requiresApiKey: true, enabled: true, apiKeySet: true }, { id: 'GOOGLE', name: 'Google', requiresApiKey: true, enabled: false, apiKeySet: false } ] } }));
                 // Mock loadChatState instead of loadUiHistory
                 const mockChatId = generateUniqueId();
                 window.dispatchEvent(new MessageEvent('message', { data: { type: 'loadChatState', payload: { chats: [{ id: mockChatId, name: 'Default Mock Chat', history: [], config: { useDefaults: true }, createdAt: Date.now(), lastModified: Date.now() }], lastActiveChatId: mockChatId } } }));
                 window.dispatchEvent(new MessageEvent('message', { data: { type: 'updateMcpServers', payload: [] } }));
             }, 300);
        }
    }
};

// --- Helper Functions ---
export const generateUniqueId = () => `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// Removed StateUpdateMessageHandler component and its useEffect hook.
// State updates are now handled by MessageHandlerComponent rendered in main.tsx.


// --- App Component ---
export function App() {
    // --- Jotai State ---
    const [chatSessions, setChatSessions] = useAtom(chatSessionsAtom);
    const [activeChatId, setActiveChatId] = useAtom(activeChatIdAtom);
    const [inputValue, setInputValue] = useAtom(inputValueAtom);
    const [isStreaming, setIsStreaming] = useAtom(isStreamingAtom);
    const [providerStatus, setProviderStatus] = useAtom(providerStatusAtom);
    // Removed: const setSuggestedActionsMap = useSetAtom(suggestedActionsMapAtom); // Setter used only in MessageHandlerComponent
    const availableProviders = useAtomValue(availableProvidersAtom);
    // Removed: const providerModelsMap = useAtomValue(providerModelsMapAtom); // Use atomFamily instead where needed
    // Use derived atoms directly
    const activeChatMessages = useAtomValue(activeChatMessagesAtom);
    const activeChatProviderId = useAtomValue(activeChatProviderIdAtom);
    const currentModelId = useAtomValue(activeChatModelIdAtom); // Corrected: Read model ID atom
    const activeChatCombinedModelId = useAtomValue(activeChatCombinedModelIdAtom);
    const suggestedActionsMap = useAtomValue(suggestedActionsMapAtom); // Read derived value

    // --- Local UI State (Can remain useState or become atoms if needed elsewhere) ---
    const [location, setLocation] = useLocation(); // Keep wouter for routing for now
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    // const [isChatListLoading, setIsChatListLoading] = useState(false); // Replaced with atom

    // --- Define ALL Jotai Setters at the Top ---
    const setChatSessionsDirect = useSetAtom(chatSessionsAtom);
    const setActiveChatIdDirect = useSetAtom(activeChatIdAtom);
    const setInputValueDirect = useSetAtom(inputValueAtom);
    // Removed setSelectedImagesDirect - will sync from hook state
    const setIsStreamingDirect = useSetAtom(isStreamingAtom);
    // Removed setter for read-only async atom:
    const setSelectedImagesAtomDirect = useSetAtom(selectedImagesAtom); // Setter for the atom
    const setIsChatListLoading = useSetAtom(isChatListLoadingAtom); // Get setter for the new atom

    // --- Custom Hooks ---
    // Call useImageUpload and get state and functions
    const {
        selectedImages, // State from the hook
        setSelectedImages, // Setter from the hook
        fileInputRef,
        handleImageFileChange,
        triggerImageUpload,
        removeSelectedImage,
        clearSelectedImages // Clear function from the hook
    } = useImageUpload();

    // Sync hook state to Jotai atom
    useEffect(() => {
        setSelectedImagesAtomDirect(selectedImages);
    }, [selectedImages, setSelectedImagesAtomDirect]);

    // Removed duplicate clearSelectedImages definition. Using the one from useImageUpload hook.

    // Removed useModelSelection hook
    // Removed useMessageHandler hook call

    // Setters defined above

    // Read atom values needed in callbacks
    const currentInputValue = useAtomValue(inputValueAtom);
    const currentSelectedImages = useAtomValue(selectedImagesAtom);
    const currentIsStreaming = useAtomValue(isStreamingAtom);
    const currentActiveChatId = useAtomValue(activeChatIdAtom);
    const currentProviderId = useAtomValue(activeChatProviderIdAtom);
    // const currentModelName = useAtomValue(activeChatModelNameAtom); // Removed, use currentModelId
    const currentChatSessions = useAtomValue(chatSessionsAtom);
    const isChatListLoading = useAtomValue(isChatListLoadingAtom); // Read value from atom

    // --- Effects ---
    // Scroll to bottom when active chat messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [activeChatMessages]); // Dependency on atom value is fine

    // Removed useEffect for location updates (can be handled differently if needed, maybe via atom effect)
    // Removed useEffect for initial setup messages (moved to MessageHandlerComponent)

    // Add useEffect to log derived state changes for debugging
    useEffect(() => {
        console.log(`[App useEffect] Active Provider ID changed to: ${activeChatProviderId}`);
    }, [activeChatProviderId]);

    useEffect(() => {
        // Assuming activeChatModelNameAtom holds the selected model ID for now based on atom definition
        console.log(`[App useEffect] Active Model ID changed to: ${currentModelId}`); // Corrected to use currentModelId
    }, [currentModelId]); // Corrected dependency


    // --- Event Handlers (Remaining in App) ---
    // --- Event Handlers (Refactored for Jotai) ---
    const handleSend = useCallback(() => {
        // Use values read outside the callback

        // Use setters defined above
        if ((currentInputValue.trim() || currentSelectedImages.length > 0) && !currentIsStreaming && currentProviderId && currentModelId && currentActiveChatId) { // Check currentModelId
            // Map SelectedImage[] to UiImagePart[] for the backend message
            const contentParts: UiMessageContentPart[] = currentSelectedImages.map(img => ({
                type: 'image',
                mediaType: img.mediaType,
                data: img.data
            } as UiImagePart));

            // Removed redundant forEach loop
            if (currentInputValue.trim()) {
                contentParts.push({ type: 'text', text: currentInputValue });
            }
            // Add message optimistically to the correct chat session
            const newUserMessage: UiMessage = { id: generateUniqueId(), role: 'user', content: contentParts, timestamp: Date.now() }; // Use role instead of sender
            setChatSessionsDirect(prevSessions =>
                prevSessions.map(session =>
                    session.id === currentActiveChatId
                        ? { ...session, history: [...session.history, newUserMessage], lastModified: Date.now() }
                        : session
                )
            );
            // Send message with chatId
            // Combine provider and model name for the backend message
            const combinedModelId = currentProviderId && currentModelId ? `${currentProviderId}:${currentModelId}` : null; // Use currentModelId
            if (combinedModelId) {
                 postMessage({ type: 'sendMessage', chatId: currentActiveChatId, content: contentParts, providerId: currentProviderId, modelId: combinedModelId });
            } else {
                 console.error("Cannot send message: Missing provider or model ID for active chat."); // Corrected log
                 setIsStreamingDirect(false); // Stop streaming indicator if we can't send
                 return; // Prevent sending
            }
            setInputValueDirect('');
            // clearSelectedImages(); // This needs to update the atom now
            clearSelectedImages(); // Use the function from the hook, dependency added below
            setIsStreamingDirect(true);
        } else if (!currentActiveChatId) {
             console.warn("Cannot send message: No active chat selected.");
        } else if (!currentProviderId || !currentModelId) { // Check currentModelId
             console.warn("Cannot send message: Provider or Model ID not selected for the active chat."); // Corrected log
        }
    }, [ // Add atom values read outside to dependency array
         currentInputValue, currentSelectedImages, currentIsStreaming, currentActiveChatId, currentProviderId, currentModelId, // Use currentModelId in dependencies
         setChatSessionsDirect, setInputValueDirect, setIsStreamingDirect, clearSelectedImages
    ]);

    // Read isStreaming value outside the callback
    const isStreamingValue = useAtomValue(isStreamingAtom);

    // Define handleKeyDown separately
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Use the value read outside the callback
        if (e.key === 'Enter' && !e.shiftKey && !isStreamingValue) {
            e.preventDefault();
            handleSend(); // Call the existing handleSend callback
        }
    }, [handleSend, isStreamingValue]); // Add isStreamingValue to dependencies


     // Use activeChatId read outside
     const handleClearChat = useCallback(() => {
         if (currentActiveChatId) {
             setShowClearConfirm(true);
         } else {
             console.warn("Cannot clear chat: No active chat selected.");
         }
     }, [currentActiveChatId]); // Add dependency

     // Use activeChatId read outside
     const confirmClearChat = useCallback(() => {
         const currentActiveChatIdForClear = currentActiveChatId; // Use value from closure
         if (currentActiveChatIdForClear) {
             setChatSessionsDirect(prevSessions =>
                 prevSessions.map(session =>
                     session.id === currentActiveChatIdForClear
                         ? { ...session, history: [], lastModified: Date.now() }
                         : session
                 )
             );
             postMessage({ type: 'clearChatHistory', payload: { chatId: currentActiveChatIdForClear } });
             setShowClearConfirm(false);
         }
     }, [currentActiveChatId, setChatSessionsDirect]); // Add dependency

     const cancelClearChat = useCallback(() => {
         setShowClearConfirm(false);
     }, []);

    // Use values read outside
    const handleSuggestedActionClick = useCallback((action: SuggestedAction) => {
        const currentActiveChatIdForSuggest = currentActiveChatId;
        const currentProviderIdForSuggest = currentProviderId;
        const currentModelIdForSuggest = currentModelId; // Use currentModelId
        const combinedModelIdForAction = currentProviderIdForSuggest && currentModelIdForSuggest ? `${currentProviderIdForSuggest}:${currentModelIdForSuggest}` : null; // Use currentModelIdForSuggest
        if (currentActiveChatIdForSuggest && currentProviderIdForSuggest && currentModelIdForSuggest && combinedModelIdForAction) { // Check currentModelIdForSuggest
            switch (action.action_type) {
                case 'send_message':
                    if (typeof action.value === 'string') {
                        postMessage({ type: 'sendMessage', chatId: currentActiveChatIdForSuggest, content: [{ type: 'text', text: action.value }], providerId: currentProviderIdForSuggest, modelId: combinedModelIdForAction });
                        setIsStreamingDirect(true);
                    } else { console.warn("Invalid value/state for send_message action"); }
                    break;
                case 'run_tool':
                    if (typeof action.value === 'object' && action.value?.toolName) {
                        console.warn("run_tool action type not fully implemented yet.");
                        postMessage({ type: 'logAction', message: `User wants to run tool: ${action.value.toolName} in chat ${currentActiveChatIdForSuggest}` });
                    } else { console.warn("Invalid value for run_tool action"); }
                    break;
                case 'fill_input':
                     if (typeof action.value === 'string') { setInputValueDirect(action.value); }
                     else { console.warn("Invalid value for fill_input action"); }
                    break;
                default: console.warn("Unknown suggested action type");
            }
        } else {
             console.warn("Cannot handle suggested action: Missing activeChatId, provider, or model ID for the chat."); // Corrected log
        }
    }, [ currentActiveChatId, currentProviderId, currentModelId, setInputValueDirect, setIsStreamingDirect]); // Use currentModelId in dependencies

    const handleStopGeneration = useCallback(() => {
        console.log("[App Handler] Stop generation requested.");
        postMessage({ type: 'stopGeneration' });
    }, []);

    // --- Event Handlers (Navigation) ---
    const handleSettingsClick = useCallback(() => {
        setLocation('/settings');
    }, [setLocation]);

    const handleChatsClick = useCallback(() => {
        setLocation('/chats');
    }, [setLocation]);

    // --- Chat List Handlers ---
    // setActiveChatIdDirect defined above
    const handleSelectChat = useCallback((chatId: string) => {
        console.log(`[App Handler] Selecting chat: ${chatId}`);
        setActiveChatIdDirect(chatId);
        postMessage({ type: 'setActiveChat', payload: { chatId } }); // Inform backend
        setLocation('/index.html'); // Navigate back to chat view
    }, [setLocation, setActiveChatIdDirect]); // Dependency is correct

    const handleCreateChat = useCallback(() => {
        console.log("[App Handler] Requesting new chat creation...");
        setIsChatListLoading(true); // Start loading
        postMessage({ type: 'createChat' });
        // Loading will stop when 'loadChatState' is received and handled in MessageHandlerComponent
    }, [setIsChatListLoading]); // Keep dependency on the setter

    const handleDeleteChat = useCallback((chatId: string) => {
        console.log(`[App Handler] Requesting delete chat: ${chatId}`);
        setIsChatListLoading(true); // Start loading
        postMessage({ type: 'deleteChat', payload: { chatId } });
        // Loading will stop when 'loadChatState' is received and handled in MessageHandlerComponent
        // If the deleted chat was active, the backend/HistoryManager should handle resetting activeChatId.
    }, [setIsChatListLoading]); // Keep dependency on the setter

    // --- Handler for Chat-Specific Model Change ---
    // Use activeChatId read outside
    const handleChatModelChange = useCallback((newProviderId: string | null, newModelId: string | null) => {
        const currentActiveChatIdForModelChange = currentActiveChatId; // Use value from closure
        if (currentActiveChatIdForModelChange) {
            console.log(`[App Handler] Updating model for chat ${currentActiveChatIdForModelChange} to Provider: ${newProviderId}, Model: ${newModelId}`);
            const newConfig: Partial<ChatConfig> = {
                providerId: newProviderId ?? undefined, // Store null as undefined
                modelId: newModelId ?? undefined,
                useDefaults: false // Explicitly set model, so don't use defaults
            };

            setChatSessionsDirect(prevSessions =>
                prevSessions.map(session =>
                    session.id === currentActiveChatIdForModelChange
                        ? {
                            ...session,
                            config: { ...session.config, ...newConfig }, // Merge new config parts
                            lastModified: Date.now()
                          }
                        : session
                )
            );
            // Inform backend about the config change using separate fields
            postMessage({ type: 'updateChatConfig', payload: { chatId: currentActiveChatIdForModelChange, config: newConfig } });

        } else {
            console.warn("Cannot change chat model: No active chat selected.");
        }
    }, [currentActiveChatId, setChatSessionsDirect]); // Add dependency

    // --- App-level Provider Change Handler ---
    // This now handles setting the provider *and* updating the chat's model
    // This handler is now simplified as ModelSelector handles finding the default model
    // It just needs to call handleChatModelChange with the new provider and model
    // This handler now correctly accepts two arguments: providerId and modelId
    const handleModelSelectorChange = useCallback((newProviderId: string | null, newModelId: string | null) => {
         console.log(`[App handleModelSelectorChange] Received Provider: ${newProviderId}, Model: ${newModelId}`); // Updated log

         // Directly call the actual update function with the received IDs
         // No need for parsing logic here anymore
         handleChatModelChange(newProviderId, newModelId);

    }, [handleChatModelChange]);

    // --- Message Action Handlers ---
    // Use values read outside
    const handleCopyMessage = useCallback((messageId: string) => {
        const currentActiveChatIdForCopy = currentActiveChatId;
        const currentChatSessionsForCopy = currentChatSessions;
        if (!currentActiveChatIdForCopy) return;
        const activeSession = currentChatSessionsForCopy.find(session => session.id === currentActiveChatIdForCopy);
        const messageToCopy = activeSession?.history.find(msg => msg.id === messageId);

        if (messageToCopy && Array.isArray(messageToCopy.content)) {
            const textToCopy = messageToCopy.content
                .filter((part): part is UiTextMessagePart => part.type === 'text') // Type guard
                .map(part => part.text)
                .join('\n'); // Join text parts with newline

            if (textToCopy) {
                navigator.clipboard.writeText(textToCopy)
                    .then(() => {
                        console.log(`Copied message ${messageId} to clipboard.`);
                        // Optional: Show a temporary "Copied!" feedback
                    })
                    .catch(err => {
                        console.error(`Failed to copy message ${messageId}:`, err);
                        // Optional: Show error feedback
                    });
            } else {
                console.warn(`No text content found to copy in message ${messageId}.`);
            }
        } else {
            console.warn(`Could not find message ${messageId} to copy.`);
        }
    }, [currentActiveChatId, currentChatSessions]); // Add dependencies
// setChatSessionsDirect defined above
const handleDeleteMessage = useCallback((messageId: string) => {
    // Use value read outside
    const currentActiveChatIdForDelete = currentActiveChatId;
    if (!currentActiveChatIdForDelete) return;

    console.log(`Requesting delete message ${messageId} from chat ${currentActiveChatIdForDelete}`);

        // Optimistically update UI state
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

        // Inform backend to delete the message from persistent storage
        postMessage({ type: 'deleteMessage', payload: { chatId: currentActiveChatIdForDelete, messageId } });

    }, [currentActiveChatId, setChatSessionsDirect]); // Add dependency

    // --- Main Render ---
    return (
        <Router>
            {/* Removed StateUpdateMessageHandler rendering */}
            {/* Wrap the main content in Suspense */}
            <Suspense fallback={<div class="flex justify-center items-center h-full">Loading...</div>}>
            {/* Use a slightly different dark background for the main app */}
            <div class="app-layout h-screen flex flex-col bg-gray-100 dark:bg-gray-850 text-gray-900 dark:text-gray-100">
                {/* Remove padding from main, apply to inner containers */}
                <main class="content-area flex-1 flex flex-col overflow-hidden"> {/* Changed overflow-y-auto to overflow-hidden */}
                    <Switch>
                        <Route path="/index.html">
                            {/* Added padding here, removed from main */}
                            <div class="chat-container flex flex-col flex-1 h-full p-4 overflow-hidden"> {/* Added overflow-hidden */}
                                {/* TODO: Update HeaderControls to potentially show chat name/list button */}
                                <HeaderControls
                                    // Pass only the required callback props
                                    onModelChange={handleModelSelectorChange}
                                    onSettingsClick={handleSettingsClick}
                                    onChatsClick={handleChatsClick}
                                />
                                {/* MessagesArea will now handle its own scrolling */}
                                <MessagesArea
                                    // Removed props: messages, suggestedActionsMap, isStreaming
                                    handleSuggestedActionClick={handleSuggestedActionClick}
                                    messagesEndRef={messagesEndRef}
                                    onCopyMessage={handleCopyMessage} // Pass copy handler
                                    onDeleteMessage={handleDeleteMessage} // Pass delete handler
                                    className="flex-1 overflow-y-auto mb-4 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent"
                                />
                                {/* Add some margin-top to InputArea */}
                                <InputArea
                                    className="mt-auto"
                                    // Pass only required props (callbacks, refs, image handlers)
                                    // Pass refactored handleKeyDown
                                    handleKeyDown={handleKeyDown}
                                    handleSend={handleSend}
                                    // Image related props from useImageUpload hook
                                    // selectedImages prop removed as InputArea reads from atom
                                    setSelectedImages={setSelectedImages}
                                    fileInputRef={fileInputRef} // Keep ref from useImageUpload for now
                                    // Removed duplicate fileInputRef prop
                                    triggerImageUpload={triggerImageUpload}
                                    removeSelectedImage={removeSelectedImage}
                                    handleImageFileChange={handleImageFileChange}
                                    handleStopGeneration={handleStopGeneration}
                                />
                            </div>
                        </Route>
                        <Route path="/settings">
                            <SettingPage /> {/* Remove props */}
                        </Route>
                        {/* Chat List Route */}
                        <Route path="/chats">
                            <ChatListPage
                                // Removed props: chatSessions, activeChatId
                                onSelectChat={handleSelectChat}
                                onCreateChat={handleCreateChat}
                                onDeleteChat={handleDeleteChat}
                                isLoading={isChatListLoading} // Pass loading state from atom
                            />
                        </Route>
                        {/* Default route - Redirect to last active chat or chat list */}
                        <Route>
                            {/* Default route component function */}
                            {() => {
                                // Read atom value inside the render function for freshness
                                const currentActiveChatId = useAtomValue(activeChatIdAtom);
                                if (location === '/') {
                                    return <Redirect to={currentActiveChatId ? "/index.html" : "/chats"} />;
                                }
                                // Show 404 for any other unhandled path
                                return <div class="p-6 text-center text-red-500">404: Page Not Found<br/>Path: {location}</div>;
                            }}
                        </Route>
                    </Switch>
                </main>
                <ConfirmationDialog
                    show={showClearConfirm}
                    title="Confirm Clear History"
                    message="Are you sure you want to clear the history for this chat? This cannot be undone." // Updated message
                    onCancel={cancelClearChat}
                    onConfirm={confirmClearChat}
                    confirmText="Confirm Clear"
                />
            </div>
            </Suspense>
        </Router>
    );
}
