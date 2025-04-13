import { useState, useEffect, useRef, useCallback, useMemo } from 'preact/hooks'; // Add useMemo
import { Router, Route, useLocation, Switch, Redirect } from "wouter";
import { JSX } from 'preact/jsx-runtime'; // Import JSX namespace
import './app.css';
import { SettingPage } from './pages/SettingPage';
import { ChatListPage } from './pages/ChatListPage'; // Import ChatListPage
import { useMessageHandler } from './hooks/useMessageHandler';
import { useImageUpload } from './hooks/useImageUpload';
import { useModelSelection } from './hooks/useModelSelection';
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
} from '../../src/common/types';

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

// --- App Component ---
export function App() {
    // --- State Variables ---
    // Replace single messages state with chat sessions and active ID
    const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    // const [messages, setMessages] = useState<InternalUiMessage[]>([]); // Removed, derived from chatSessions

    const [inputValue, setInputValue] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [providerStatus, setProviderStatus] = useState<AllProviderStatus>([]);
    const [location, setLocation] = useLocation();
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [isChatListLoading, setIsChatListLoading] = useState(false); // State for chat list operations
    const [suggestedActionsMap, setSuggestedActionsMap] = useState<Record<string, SuggestedAction[]>>({});

    // --- Custom Hooks ---
    const {
        selectedImages,
        fileInputRef,
        handleImageFileChange,
        triggerImageUpload,
        removeSelectedImage,
        clearSelectedImages
    } = useImageUpload();

    // Destructure from useModelSelection, removing handleModelInputChange
    // --- Derived State for Model Selection ---
    // Derive active chat's provider and model name separately
    const activeChatProviderId = useMemo(() => {
        if (!activeChatId) return null;
        const activeSession = chatSessions.find(session => session.id === activeChatId);
        if (!activeSession) return null;
        // TODO: Implement logic to get default provider ID from settings if useDefaults is true
        return activeSession.config.providerId || null;
    }, [chatSessions, activeChatId]);

    const activeChatModelName = useMemo(() => {
        if (!activeChatId) return null;
        const activeSession = chatSessions.find(session => session.id === activeChatId);
        if (!activeSession) return null;
        // TODO: Implement logic to get default model name from settings if useDefaults is true
        return activeSession.config.modelName || null;
    }, [chatSessions, activeChatId]);

    // Combine them into the format needed by useModelSelection (or maybe adjust the hook later)
    const activeChatCombinedModelId = useMemo(() => {
        if (activeChatProviderId && activeChatModelName) {
            return `${activeChatProviderId}:${activeChatModelName}`;
        }
        return null;
    }, [activeChatProviderId, activeChatModelName]);

    const {
        availableModels, // Add back availableModels
        setAvailableModels,
        selectedProvider,
        setSelectedProvider,
        displayModelName,
        uniqueProviders,
        filteredModels,
        handleProviderChange: handleProviderSelectChange,
    } = useModelSelection(undefined, activeChatCombinedModelId); // Pass combined ID to hook for now

    // Update useMessageHandler hook call to manage chatSessions and activeChatId
    // Pass the required state and setters to the updated hook
    useMessageHandler(
        activeChatId,
        setChatSessions,
        setActiveChatId,
        setIsStreaming,
        setSuggestedActionsMap,
        setLocation
        // Note: We might need to pass setIsChatListLoading here if the hook handles the response
    );

    // --- Derived State ---
    // Derive messages for the active chat
    const activeChatMessages = useMemo(() => {
        if (!activeChatId) return [];
        const activeSession = chatSessions.find(session => session.id === activeChatId);
        // Map UiMessage to InternalUiMessage if needed, otherwise just return history
        return activeSession ? activeSession.history.map(msg => ({ ...msg })) : [];
    }, [chatSessions, activeChatId]);

    // --- Effects ---
    // Scroll to bottom when active chat messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [activeChatMessages]);

    // Send location updates to backend when location changes
    useEffect(() => {
        // Avoid sending initial '/' or redundant updates
        // Check against the last known location *sent by the backend* (implicitly stored in workspaceState now)
        // We don't have direct access to workspaceState here, so we rely on the backend to handle redundancy.
        // Send update on every location change except initial '/'
        if (location && location !== '/') {
             console.log(`[App Effect] Location changed to: ${location}. Sending update to backend.`);
             postMessage({ type: 'updateLastLocation', payload: { location: location } });
             // Remove immediate update to vscode.setState, rely on backend persistence via HistoryManager
        }
    }, [location]); // Depend only on location
    // Handle initial setup messages (now includes loadChatState with lastLocation)
    useEffect(() => {
        const handleSetupMessage = (event: MessageEvent) => {
             const message = event.data;
             switch (message.type) {
                 case 'availableModels':
                     if (Array.isArray(message.payload)) {
                         setAvailableModels(message.payload as AvailableModel[]);
                     }
                     break;
                 case 'providerStatus':
                     if (Array.isArray(message.payload)) {
                         setProviderStatus(message.payload);
                     }
                     break;
                case 'loadChatState': // Handle new message type with lastLocation
                    if (message.payload && Array.isArray(message.payload.chats)) {
                        const loadedChats = message.payload.chats;
                        const loadedActiveId = message.payload.lastActiveChatId;
                        const loadedLocation = message.payload.lastLocation;

                        setChatSessions(loadedChats);
                        setActiveChatId(loadedActiveId);
                        setIsChatListLoading(false); // Stop loading indicator
                        console.log(`[App Effect] Loaded ${loadedChats.length} chats. Active: ${loadedActiveId}. Location: ${loadedLocation}`);

                        // Restore location AFTER setting state, only if it's different from current
                        // and not the root path (which is handled by redirect)
                        if (loadedLocation && loadedLocation !== location && loadedLocation !== '/') {
                            console.log(`[App Effect] Restoring location from loadChatState: ${loadedLocation}`);
                            // Use timeout to allow state updates to potentially settle before navigation
                            setTimeout(() => setLocation(loadedLocation, { replace: true }), 50); // Slightly longer delay?
                        }
                        // No need for fallback navigation here, the Router's default route handles '/'
                    }
                    break;
                case 'updateMcpServers':
                     if (Array.isArray(message.payload)) {
                         // console.log("Received MCP server configs (now unused in App state):", message.payload);
                     }
                     break;
            }
        };
       window.addEventListener('message', handleSetupMessage);
       postMessage({ type: 'webviewReady' }); // Request initial data
       return () => {
           window.removeEventListener('message', handleSetupMessage);
       }
        // Dependencies: setAvailableModels is stable. setLocation might cause re-renders if not stable.
        // location is needed for the logic inside loadChatState handler.
    }, [setAvailableModels, setLocation, location]); // Removed activeChatId dependency as it's handled within the message payload now

    // --- Event Handlers (Remaining in App) ---
    const handleSend = useCallback(() => {
        // Use activeChatId
        if ((inputValue.trim() || selectedImages.length > 0) && !isStreaming && activeChatProviderId && activeChatModelName && activeChatId) { // Use separate provider/model name check
            const contentParts: UiMessageContentPart[] = [];
            selectedImages.forEach(img => {
                contentParts.push({ type: 'image', mediaType: img.mediaType, data: img.data });
            });
            if (inputValue.trim()) {
                contentParts.push({ type: 'text', text: inputValue });
            }
            // Add message optimistically to the correct chat session
            const newUserMessage: UiMessage = { id: generateUniqueId(), sender: 'user', content: contentParts, timestamp: Date.now() };
            setChatSessions(prevSessions =>
                prevSessions.map(session =>
                    session.id === activeChatId
                        ? { ...session, history: [...session.history, newUserMessage], lastModified: Date.now() }
                        : session
                )
            );
            // Send message with chatId
            // Combine provider and model name for the backend message
            const combinedModelId = activeChatProviderId && activeChatModelName ? `${activeChatProviderId}:${activeChatModelName}` : null;
            if (combinedModelId) {
                 postMessage({ type: 'sendMessage', chatId: activeChatId, content: contentParts, providerId: activeChatProviderId, modelId: combinedModelId });
            } else {
                 console.error("Cannot send message: Missing provider or model name for active chat.");
                 setIsStreaming(false); // Stop streaming indicator if we can't send
                 return; // Prevent sending
            }
            setInputValue('');
            clearSelectedImages();
            setIsStreaming(true);
        } else if (!activeChatId) {
             console.warn("Cannot send message: No active chat selected.");
        } else if (!activeChatProviderId || !activeChatModelName) {
             console.warn("Cannot send message: Provider or Model not selected for the active chat.");
        }
    }, [inputValue, selectedImages, isStreaming, activeChatProviderId, activeChatModelName, activeChatId, clearSelectedImages, setChatSessions, setIsStreaming, setInputValue]); // Use separate provider/model name

    const handleProviderToggle = useCallback((providerId: string, enabled: boolean) => {
         setProviderStatus(prevStatus =>
             prevStatus.map(p =>
                 p.id === providerId ? { ...p, enabled: enabled } : p
             )
         );
         postMessage({ type: 'setProviderEnabled', payload: { provider: providerId, enabled: enabled } });
     }, []);

     const handleClearChat = useCallback(() => {
         if (activeChatId) { // Only show confirm if a chat is active
             setShowClearConfirm(true);
         } else {
             console.warn("Cannot clear chat: No active chat selected.");
         }
     }, [activeChatId]); // Depend on activeChatId

     const confirmClearChat = useCallback(() => {
         if (activeChatId) {
             // Clear history for the active chat optimistically
             setChatSessions(prevSessions =>
                 prevSessions.map(session =>
                     session.id === activeChatId
                         ? { ...session, history: [], lastModified: Date.now() }
                         : session
                 )
             );
             // Send message with chatId
             postMessage({ type: 'clearChatHistory', payload: { chatId: activeChatId } });
             setShowClearConfirm(false);
         }
     }, [activeChatId, setChatSessions]); // Add activeChatId dependency

     const cancelClearChat = useCallback(() => {
         setShowClearConfirm(false);
     }, []);

    const handleSuggestedActionClick = useCallback((action: SuggestedAction) => {
        // Include activeChatId when sending message
        const combinedModelIdForAction = activeChatProviderId && activeChatModelName ? `${activeChatProviderId}:${activeChatModelName}` : null;
        if (activeChatId && activeChatProviderId && combinedModelIdForAction) {
            switch (action.action_type) {
                case 'send_message':
                    if (typeof action.value === 'string') {
                        postMessage({ type: 'sendMessage', chatId: activeChatId, content: [{ type: 'text', text: action.value }], providerId: activeChatProviderId, modelId: combinedModelIdForAction });
                        setIsStreaming(true);
                    } else { console.warn("Invalid value/state for send_message action"); }
                    break;
                case 'run_tool':
                    if (typeof action.value === 'object' && action.value?.toolName) {
                        console.warn("run_tool action type not fully implemented yet.");
                        postMessage({ type: 'logAction', message: `User wants to run tool: ${action.value.toolName} in chat ${activeChatId}` });
                    } else { console.warn("Invalid value for run_tool action"); }
                    break;
                case 'fill_input':
                     if (typeof action.value === 'string') { setInputValue(action.value); }
                     else { console.warn("Invalid value for fill_input action"); }
                    break;
                default: console.warn("Unknown suggested action type");
            }
        } else {
             console.warn("Cannot handle suggested action: Missing activeChatId, provider, or model name for the chat.");
        }
    }, [activeChatId, activeChatProviderId, activeChatModelName, setInputValue, setIsStreaming]); // Use separate provider/model name

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
    const handleSelectChat = useCallback((chatId: string) => {
        console.log(`[App Handler] Selecting chat: ${chatId}`);
        setActiveChatId(chatId);
        postMessage({ type: 'setActiveChat', payload: { chatId } }); // Inform backend
        setLocation('/index.html'); // Navigate back to chat view
    }, [setLocation, setActiveChatId]);

    const handleCreateChat = useCallback(() => {
        console.log("[App Handler] Requesting new chat creation...");
        setIsChatListLoading(true); // Start loading
        postMessage({ type: 'createChat' });
        // Loading will stop when 'loadChatState' is received
    }, [setIsChatListLoading]); // Add dependency

    const handleDeleteChat = useCallback((chatId: string) => {
        console.log(`[App Handler] Requesting delete chat: ${chatId}`);
        setIsChatListLoading(true); // Start loading
        postMessage({ type: 'deleteChat', payload: { chatId } });
        // Loading will stop when 'loadChatState' is received
        // If the deleted chat was active, the backend/HistoryManager should handle resetting activeChatId.
    }, [setIsChatListLoading]); // Add dependency

    // --- Handler for Chat-Specific Model Change ---
    // Now accepts separate providerId and modelName
    const handleChatModelChange = useCallback((newProviderId: string | null, newModelName: string | null) => {
        if (activeChatId) {
            console.log(`[App Handler] Updating model for chat ${activeChatId} to Provider: ${newProviderId}, Model: ${newModelName}`);
            const newConfig: Partial<ChatConfig> = {
                providerId: newProviderId ?? undefined, // Store null as undefined
                modelName: newModelName ?? undefined,   // Store null as undefined
                useDefaults: false // Explicitly set model, so don't use defaults
            };

            setChatSessions(prevSessions =>
                prevSessions.map(session =>
                    session.id === activeChatId
                        ? {
                            ...session,
                            config: { ...session.config, ...newConfig }, // Merge new config parts
                            lastModified: Date.now()
                          }
                        : session
                )
            );
            // Inform backend about the config change using separate fields
            postMessage({ type: 'updateChatConfig', payload: { chatId: activeChatId, config: newConfig } });

        } else {
            console.warn("Cannot change chat model: No active chat selected.");
        }
    }, [activeChatId, setChatSessions]); // Dependencies

    // --- App-level Provider Change Handler ---
    // This now handles setting the provider *and* updating the chat's model
    // This handler is now simplified as ModelSelector handles finding the default model
    // It just needs to call handleChatModelChange with the new provider and model
    const handleModelSelectorChange = useCallback((newCombinedModelId: string) => {
         if (newCombinedModelId && newCombinedModelId.includes(':')) {
             const [newProviderId, ...modelNameParts] = newCombinedModelId.split(':');
             const newModelName = modelNameParts.join(':');
             handleChatModelChange(newProviderId, newModelName);
         } else {
             // Handle invalid or cleared selection
             handleChatModelChange(null, null);
         }
    }, [handleChatModelChange]);

    // --- Message Action Handlers ---
    const handleCopyMessage = useCallback((messageId: string) => {
        if (!activeChatId) return;
        const activeSession = chatSessions.find(session => session.id === activeChatId);
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
    }, [chatSessions, activeChatId]);

    const handleDeleteMessage = useCallback((messageId: string) => {
        if (!activeChatId) return;

        console.log(`Requesting delete message ${messageId} from chat ${activeChatId}`);

        // Optimistically update UI state
        setChatSessions(prevSessions =>
            prevSessions.map(session =>
                session.id === activeChatId
                    ? {
                        ...session,
                        history: session.history.filter(msg => msg.id !== messageId),
                        lastModified: Date.now()
                      }
                    : session
            )
        );

        // Inform backend to delete the message from persistent storage
        postMessage({ type: 'deleteMessage', payload: { chatId: activeChatId, messageId } });

    }, [activeChatId, setChatSessions]);

    // --- Main Render ---
    return (
        <Router>
            <div class="app-layout h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                <main class="content-area flex-1 flex flex-col overflow-y-auto p-4">
                    <Switch>
                        <Route path="/index.html">
                            <div class="chat-container flex flex-col flex-1 h-full">
                                {/* TODO: Update HeaderControls to potentially show chat name/list button */}
                                <HeaderControls
                                    // Pass props matching the new ModelSelector integration
                                    allAvailableModels={availableModels}
                                    selectedModelId={activeChatCombinedModelId ?? null} // Pass combined ID for now
                                    onModelChange={handleModelSelectorChange} // Use the new wrapper handler
                                    // Removed: handleClearChat, isStreaming, hasMessages
                                    hasMessages={activeChatMessages.length > 0}
                                    onSettingsClick={handleSettingsClick}
                                    onChatsClick={handleChatsClick}
                                />
                                <MessagesArea
                                    messages={activeChatMessages} // Use derived messages
                                    suggestedActionsMap={suggestedActionsMap}
                                    handleSuggestedActionClick={handleSuggestedActionClick}
                                    isStreaming={isStreaming}
                                    messagesEndRef={messagesEndRef}
                                    onCopyMessage={handleCopyMessage} // Pass copy handler
                                    onDeleteMessage={handleDeleteMessage} // Pass delete handler
                                />
                                <InputArea
                                    inputValue={inputValue}
                                    setInputValue={setInputValue}
                                    handleInputChange={(e) => setInputValue(e.currentTarget.value)}
                                    handleKeyDown={(e) => {
                                         if (e.key === 'Enter' && !e.shiftKey && !isStreaming) {
                                             e.preventDefault(); handleSend();
                                         }
                                     }}
                                    handleSend={handleSend}
                                    isStreaming={isStreaming}
                                    currentModelInput={activeChatModelName ?? ''} // Pass just the model name
                                    selectedImages={selectedImages}
                                    setSelectedImages={() => {}} // Dummy setter
                                    fileInputRef={fileInputRef}
                                    triggerImageUpload={triggerImageUpload}
                                    removeSelectedImage={removeSelectedImage}
                                    handleImageFileChange={handleImageFileChange}
                                    handleStopGeneration={handleStopGeneration}
                                />
                            </div>
                        </Route>
                        <Route path="/settings">
                            <SettingPage
                                providerStatus={providerStatus}
                                onProviderToggle={handleProviderToggle}
                            />
                        </Route>
                        {/* Chat List Route */}
                        <Route path="/chats">
                            <ChatListPage
                                chatSessions={chatSessions}
                                activeChatId={activeChatId}
                                onSelectChat={handleSelectChat}
                                onCreateChat={handleCreateChat}
                                onDeleteChat={handleDeleteChat}
                                isLoading={isChatListLoading} // Pass loading state
                            />
                        </Route>
                        {/* Default route - Redirect to last active chat or chat list */}
                        <Route>
                            {/* Default route redirect logic: If at root, redirect based on active chat */}
                            {location === '/' ? (
                                <Redirect to={activeChatId ? "/index.html" : "/chats"} />
                            ) : (
                                // Show 404 for any other unhandled path that wasn't restored
                                <div class="p-6 text-center text-red-500">404: Page Not Found<br/>Path: {location}</div>
                            )}
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
        </Router>
    );
}
