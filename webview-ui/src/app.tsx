import { useEffect, useRef, useCallback, useState } from 'preact/hooks'; // Keep useState for local UI state
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import { Router, Route, useLocation, Switch, Redirect } from "wouter";
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
    activeChatModelNameAtom,
    activeChatCombinedModelIdAtom,
    webviewLocationAtom // Added for potential future sync
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

// --- Message Handler Component (Handles messages from Extension Host) ---
const MessageHandlerComponent = () => {
    const setChatSessions = useSetAtom(chatSessionsAtom);
    const setActiveChatId = useSetAtom(activeChatIdAtom);
    // Removed setters for read-only async atoms:
    // const setProviderStatus = useSetAtom(providerStatusAtom);
    // const setAvailableProviders = useSetAtom(availableProvidersAtom);
    // const setProviderModelsMap = useSetAtom(providerModelsMapAtom);
    const setIsStreaming = useSetAtom(isStreamingAtom);
    const setSuggestedActionsMap = useSetAtom(suggestedActionsMapAtom);
    const setLocation = useSetAtom(webviewLocationAtom); // Use Jotai atom setter for location
    // Removed: const triggerFetchModels = useSetAtom(triggerFetchModelsForProviderAtom);
    // Removed: const triggerReady = useSetAtom(triggerWebviewReadyAtom);

    useEffect(() => {
        const handleMessagesFromExtension = (event: MessageEvent) => {
            const message = event.data;
            console.log("[MessageHandler] Received message:", message.type, message.payload); // Log all messages

            // First, check if it's a response to a pending request
            if (message.type === 'responseData') {
                handleRequestManagerResponse(message);
                return; // Stop further processing for this message
            }

            // Handle other non-response messages (state pushes, stream updates, etc.)
            switch (message.type) {
                // --- State Loading & Updates (Keep initial load) ---
                case 'loadChatState':
                    if (message.payload && Array.isArray(message.payload.chats)) {
                        const loadedChats = message.payload.chats;
                        const loadedActiveId = message.payload.lastActiveChatId;
                        const loadedLocation = message.payload.lastLocation;

                        setChatSessions(loadedChats);
                        setActiveChatId(loadedActiveId);
                        // Update location atom if needed (consider if wouter should drive this)
                        // if (loadedLocation && loadedLocation !== '/') {
                        //     setLocation(loadedLocation);
                        // }
                        console.log(`[MessageHandler] Loaded ${loadedChats.length} chats. Active: ${loadedActiveId}. Location: ${loadedLocation}`);
                    } else {
                         console.warn("[MessageHandler] Invalid loadChatState payload:", message.payload);
                    }
                    break;
                // Remove cases handled by request/response via async atoms
                // case 'providerStatus': ... removed ...
                // case 'availableProviders': ... removed ...
                // case 'providerModelsLoaded': ... removed ...
                // --- Streaming & Message Updates ---
                 case 'startAssistantMessage':
                     if (message.payload?.chatId && message.payload?.messageId) {
                         const { chatId, messageId } = message.payload;
                         setChatSessions(prev => prev.map(chat =>
                             chat.id === chatId
                                 ? { ...chat, history: [...chat.history, { id: messageId, sender: 'assistant', content: [], timestamp: Date.now() }] }
                                 : chat
                         ));
                         setIsStreaming(true);
                         setSuggestedActionsMap(prev => ({ ...prev, [messageId]: [] })); // Clear suggestions for new message
                     } else {
                          console.warn("[MessageHandler] Invalid startAssistantMessage payload:", message.payload);
                     }
                     break;
                 case 'appendMessageChunk':
                     if (message.payload?.chatId && message.payload?.messageId && message.payload?.contentChunk) {
                         const { chatId, messageId, contentChunk } = message.payload;
                         setChatSessions(prev => prev.map(chat => {
                             if (chat.id !== chatId) return chat;
                             const history = chat.history.map(msg => {
                                 if (msg.id !== messageId) return msg;
                                 // Ensure content is always an array
                                 const currentContent = Array.isArray(msg.content) ? msg.content : (msg.content ? [{ type: 'text', text: String(msg.content) } as UiTextMessagePart] : []); // Assert type
                                 let lastPart = currentContent[currentContent.length - 1];

                                 // Append to last text part or add new text part
                                 if (lastPart?.type === 'text' && contentChunk.type === 'text-delta') {
                                     // Create a new text part object
                                     const updatedTextPart: UiTextMessagePart = { ...lastPart, text: lastPart.text + contentChunk.textDelta };
                                     return { ...msg, content: [...currentContent.slice(0, -1), updatedTextPart] };
                                 } else if (contentChunk.type === 'text-delta') {
                                     // Create a new text part object
                                     const newTextPart: UiTextMessagePart = { type: 'text', text: contentChunk.textDelta };
                                     return { ...msg, content: [...currentContent, newTextPart] };
                                 }
                                 // Handle other chunk types if necessary (e.g., tool calls)
                                 // For now, just log unexpected chunk types
                                 console.warn("[MessageHandler] Received unhandled content chunk type:", contentChunk.type);
                                 return msg; // Return unmodified message if chunk type is not handled
                             });
                             return { ...chat, history };
                         }));
                     } else {
                          console.warn("[MessageHandler] Invalid appendMessageChunk payload:", message.payload);
                     }
                     break;
                 case 'updateToolCall':
                     // TODO: Implement logic to update tool call status within the message content
                     console.warn("[MessageHandler] updateToolCall not fully implemented yet.");
                     break;
                 case 'addSuggestedActions':
                      if (message.payload?.chatId && message.payload?.messageId && Array.isArray(message.payload?.actions)) {
                          const { messageId, actions } = message.payload;
                          setSuggestedActionsMap(prev => ({ ...prev, [messageId]: actions }));
                      } else {
                           console.warn("[MessageHandler] Invalid addSuggestedActions payload:", message.payload);
                      }
                     break;
                 case 'streamFinished':
                     setIsStreaming(false);
                     break;

                // --- Other Actions ---
                case 'showSettings': // May be deprecated if routing handles this
                    // setLocation('/settings'); // Example: Update location atom
                    console.log("[MessageHandler] Received showSettings message (potentially deprecated).");
                    break;
                case 'updateMcpServers': // Likely deprecated for App state
                    console.log("[MessageHandler] Received updateMcpServers message (potentially deprecated).");
                    break;
                default:
                    // console.log(`[MessageHandler] Received unhandled message type: ${message.type}`);
                    break;
            }
        };

        window.addEventListener('message', handleMessagesFromExtension);
        console.log("[MessageHandler] Initializing and triggering webviewReady.");
        // Removed: triggerReady(); // Initial load now handled by async atoms

        return () => {
            window.removeEventListener('message', handleMessagesFromExtension);
        };
        // Ensure dependencies cover all setters and trigger functions used inside
    // Removed dependencies on removed setters/triggers
    // Removed triggerReady/triggerFetchModels from dependencies
    }, [setChatSessions, setActiveChatId, setIsStreaming, setSuggestedActionsMap, setLocation]);

    return null; // This component does not render anything
};


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
    const activeChatModelName = useAtomValue(activeChatModelNameAtom);
    const activeChatCombinedModelId = useAtomValue(activeChatCombinedModelIdAtom);
    const suggestedActionsMap = useAtomValue(suggestedActionsMapAtom); // Read derived value

    // --- Local UI State (Can remain useState or become atoms if needed elsewhere) ---
    const [location, setLocation] = useLocation(); // Keep wouter for routing for now
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [isChatListLoading, setIsChatListLoading] = useState(false);

    // --- Define ALL Jotai Setters at the Top ---
    const setChatSessionsDirect = useSetAtom(chatSessionsAtom);
    const setActiveChatIdDirect = useSetAtom(activeChatIdAtom);
    const setInputValueDirect = useSetAtom(inputValueAtom);
    // Removed setSelectedImagesDirect - will sync from hook state
    const setIsStreamingDirect = useSetAtom(isStreamingAtom);
    // Removed setter for read-only async atom:
    const setSelectedImagesAtomDirect = useSetAtom(selectedImagesAtom); // Setter for the atom

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
    const currentModelName = useAtomValue(activeChatModelNameAtom);
    const currentChatSessions = useAtomValue(chatSessionsAtom);

    // --- Effects ---
    // Scroll to bottom when active chat messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [activeChatMessages]); // Dependency on atom value is fine

    // Removed useEffect for location updates (can be handled differently if needed, maybe via atom effect)
    // Removed useEffect for initial setup messages (moved to MessageHandlerComponent)

    // --- Event Handlers (Remaining in App) ---
    // --- Event Handlers (Refactored for Jotai) ---
    const handleSend = useCallback(() => {
        // Use values read outside the callback

        // Use setters defined above
        if ((currentInputValue.trim() || currentSelectedImages.length > 0) && !currentIsStreaming && currentProviderId && currentModelName && currentActiveChatId) {
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
            const newUserMessage: UiMessage = { id: generateUniqueId(), sender: 'user', content: contentParts, timestamp: Date.now() };
            setChatSessionsDirect(prevSessions =>
                prevSessions.map(session =>
                    session.id === currentActiveChatId
                        ? { ...session, history: [...session.history, newUserMessage], lastModified: Date.now() }
                        : session
                )
            );
            // Send message with chatId
            // Combine provider and model name for the backend message
            const combinedModelId = currentProviderId && currentModelName ? `${currentProviderId}:${currentModelName}` : null;
            if (combinedModelId) {
                 postMessage({ type: 'sendMessage', chatId: currentActiveChatId, content: contentParts, providerId: currentProviderId, modelId: combinedModelId });
            } else {
                 console.error("Cannot send message: Missing provider or model name for active chat.");
                 setIsStreamingDirect(false); // Stop streaming indicator if we can't send
                 return; // Prevent sending
            }
            setInputValueDirect('');
            // clearSelectedImages(); // This needs to update the atom now
            clearSelectedImages(); // Use the function from the hook, dependency added below
            setIsStreamingDirect(true);
        } else if (!currentActiveChatId) {
             console.warn("Cannot send message: No active chat selected.");
        } else if (!currentProviderId || !currentModelName) {
             console.warn("Cannot send message: Provider or Model not selected for the active chat.");
        }
    }, [ // Add atom values read outside to dependency array
         currentInputValue, currentSelectedImages, currentIsStreaming, currentActiveChatId, currentProviderId, currentModelName,
         setChatSessionsDirect, setInputValueDirect, setIsStreamingDirect, clearSelectedImages
    ]);

    // Define handleKeyDown separately
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Read isStreaming inside handler as it can change
        const currentIsStreamingVal = useAtomValue(isStreamingAtom);
        if (e.key === 'Enter' && !e.shiftKey && !currentIsStreamingVal) {
            e.preventDefault();
            handleSend(); // Call the existing handleSend callback
        }
    }, [handleSend]); // Dependency on handleSend


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
        const currentModelNameForSuggest = currentModelName;
        const combinedModelIdForAction = currentProviderIdForSuggest && currentModelNameForSuggest ? `${currentProviderIdForSuggest}:${currentModelNameForSuggest}` : null;
        if (currentActiveChatIdForSuggest && currentProviderIdForSuggest && combinedModelIdForAction) {
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
             console.warn("Cannot handle suggested action: Missing activeChatId, provider, or model name for the chat.");
        }
    }, [ currentActiveChatId, currentProviderId, currentModelName, setInputValueDirect, setIsStreamingDirect]); // Add dependencies

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
    // Use activeChatId read outside
    const handleChatModelChange = useCallback((newProviderId: string | null, newModelName: string | null) => {
        const currentActiveChatIdForModelChange = currentActiveChatId; // Use value from closure
        if (currentActiveChatIdForModelChange) {
            console.log(`[App Handler] Updating model for chat ${currentActiveChatIdForModelChange} to Provider: ${newProviderId}, Model: ${newModelName}`);
            const newConfig: Partial<ChatConfig> = {
                providerId: newProviderId ?? undefined, // Store null as undefined
                modelName: newModelName ?? undefined,   // Store null as undefined
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
    const handleModelSelectorChange = useCallback((newCombinedModelId: string | null) => { // Allow null
         if (newCombinedModelId && newCombinedModelId.includes(':')) {
             // Valid combined ID string
             const [newProviderId, ...modelNameParts] = newCombinedModelId.split(':');
             const newModelName = modelNameParts.join(':');
             handleChatModelChange(newProviderId, newModelName);
         } else {
             // Handle null (cleared selection) or invalid format
             handleChatModelChange(null, null);
         }
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
            {/* Add the non-rendering message handler component */}
            <MessageHandlerComponent />
            <div class="app-layout h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                <main class="content-area flex-1 flex flex-col overflow-y-auto p-4">
                    <Switch>
                        <Route path="/index.html">
                            <div class="chat-container flex flex-col flex-1 h-full">
                                {/* TODO: Update HeaderControls to potentially show chat name/list button */}
                                <HeaderControls
                                    // Pass only the required callback props
                                    onModelChange={handleModelSelectorChange}
                                    onSettingsClick={handleSettingsClick}
                                    onChatsClick={handleChatsClick}
                                />
                                <MessagesArea
                                    // Removed props: messages, suggestedActionsMap, isStreaming
                                    handleSuggestedActionClick={handleSuggestedActionClick}
                                    messagesEndRef={messagesEndRef}
                                    onCopyMessage={handleCopyMessage} // Pass copy handler
                                    onDeleteMessage={handleDeleteMessage} // Pass delete handler
                                />
                                <InputArea
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
                                isLoading={isChatListLoading} // Pass loading state
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
        </Router>
    );
}
