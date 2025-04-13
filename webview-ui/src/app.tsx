import { useState, useEffect, useRef, useCallback, useMemo } from 'preact/hooks';
import { JSX } from 'preact/jsx-runtime';
import { Router, Route, Link, useLocation, Switch } from "wouter"; // Import Switch
import './app.css';
import { SettingPage } from './pages/SettingPage'; // Restore import usage
import { useMessageHandler } from './hooks/useMessageHandler';
import { useImageUpload } from './hooks/useImageUpload';
import { useModelSelection } from './hooks/useModelSelection'; // Import model selection hook
import { HeaderControls } from './components/HeaderControls';
import { MessagesArea } from './components/MessagesArea';
import { InputArea, SelectedImage } from './components/InputArea';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { AvailableModel, SuggestedAction as CommonSuggestedAction } from '../../src/common/types';

// --- Type Definitions ---
export type SuggestedAction = CommonSuggestedAction;
export interface UiTextMessagePart { type: 'text'; text: string; }
export interface UiToolCallPart { type: 'tool-call'; toolCallId: string; toolName: string; args: any; status?: 'pending' | 'running' | 'complete' | 'error'; result?: any; progress?: string; }
export interface UiImagePart { type: 'image'; mediaType: string; data: string; }
export type UiMessageContentPart = UiTextMessagePart | UiToolCallPart | UiImagePart;
export interface Message {
    id: string;
    sender: 'user' | 'assistant';
    content: UiMessageContentPart[];
    timestamp: number;
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
                 window.dispatchEvent(new MessageEvent('message', { data: { type: 'loadUiHistory', payload: [] } }));
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
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [providerStatus, setProviderStatus] = useState<AllProviderStatus>([]);
    const [location, setLocation] = useLocation(); // Restore router hook
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [suggestedActionsMap, setSuggestedActionsMap] = useState<Record<string, SuggestedAction[]>>({});
    const [mcpServerConfigs, setMcpServerConfigs] = useState<McpServerConfig[]>([]);

    // --- Custom Hooks ---
    const {
        selectedImages,
        fileInputRef,
        handleImageFileChange,
        triggerImageUpload,
        removeSelectedImage,
        clearSelectedImages
    } = useImageUpload();

    const {
        // availableModels, // Provided by hook
        setAvailableModels,
        selectedProvider,
        currentModelInput,
        uniqueProviders,
        filteredModels,
        handleProviderChange,
        handleModelInputChange,
    } = useModelSelection(); // Use the hook

    // Restore real setLocation hook usage
    useMessageHandler(setMessages, setIsStreaming, setSuggestedActionsMap, setLocation);

    // --- Effects ---
    // Scroll to bottom
    useEffect(() => {
        // console.log("[App Effect] Messages updated, scrolling to bottom. Count:", messages.length);
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Handle initial setup messages
    useEffect(() => {
        // console.log("[App Effect] Initial setup effect running.");
        const handleSetupMessage = (event: MessageEvent) => {
             const message = event.data;
             // console.log("[App Effect] Received message:", message.type, message.payload);
             switch (message.type) {
                 case 'availableModels':
                     if (Array.isArray(message.payload)) {
                         setAvailableModels(message.payload as AvailableModel[]); // Use setter from hook
                     }
                     break;
                 case 'providerStatus':
                     if (Array.isArray(message.payload)) {
                         setProviderStatus(message.payload);
                     }
                     break;
                 case 'updateMcpServers':
                      if (Array.isArray(message.payload)) {
                          // console.log("Received MCP server configs:", message.payload);
                          setMcpServerConfigs(message.payload);
                      }
                      break;
             }
         };
        window.addEventListener('message', handleSetupMessage);
        postMessage({ type: 'webviewReady' });
        return () => {
            // console.log("[App Effect] Cleaning up setup message listener.");
            window.removeEventListener('message', handleSetupMessage);
        }
    }, [setAvailableModels]); // Dependency is the stable setter from the hook

    // --- Event Handlers (Remaining in App) ---
    const handleSend = useCallback(() => {
        // console.log("[App Handler] handleSend called.");
        // Use values from useModelSelection hook
        if ((inputValue.trim() || selectedImages.length > 0) && !isStreaming && currentModelInput && selectedProvider) {
            const contentParts: UiMessageContentPart[] = [];
            selectedImages.forEach(img => {
                contentParts.push({ type: 'image', mediaType: img.mediaType, data: img.data });
            });
            if (inputValue.trim()) {
                contentParts.push({ type: 'text', text: inputValue });
            }
            const newUserMessage: Message = { id: generateUniqueId(), sender: 'user', content: contentParts, timestamp: Date.now() };
            // console.log("[App Handler] Sending new user message:", newUserMessage);
            setMessages(prev => [...prev, newUserMessage]);
            postMessage({ type: 'sendMessage', content: contentParts, providerId: selectedProvider, modelId: currentModelInput });
            setInputValue('');
            clearSelectedImages();
            setIsStreaming(true);
        } else if (!currentModelInput || !selectedProvider) {
             console.warn("Cannot send message: Provider or Model not selected.");
        }
    }, [inputValue, selectedImages, isStreaming, currentModelInput, selectedProvider, clearSelectedImages, setMessages, setIsStreaming, setInputValue]);

    const handleProviderToggle = useCallback((providerId: string, enabled: boolean) => {
         // console.log(`[App Handler] Toggling provider ${providerId} to ${enabled}`);
         setProviderStatus(prevStatus =>
             prevStatus.map(p =>
                 p.id === providerId ? { ...p, enabled: enabled } : p
             )
         );
         postMessage({ type: 'setProviderEnabled', payload: { provider: providerId, enabled: enabled } });
     }, []);

     const handleClearChat = useCallback(() => {
         // console.log("[App Handler] handleClearChat called.");
         setShowClearConfirm(true);
     }, []);
     const confirmClearChat = useCallback(() => {
         // console.log("[App Handler] Confirming clear chat.");
         setMessages([]);
         postMessage({ type: 'clearChatHistory' });
         setShowClearConfirm(false);
     }, [setMessages]);
     const cancelClearChat = useCallback(() => {
         // console.log("[App Handler] Cancelling clear chat.");
         setShowClearConfirm(false);
     }, []);

    const handleSuggestedActionClick = useCallback((action: SuggestedAction) => {
        // console.log("[App Handler] Suggested action clicked:", action);
        // Use values from useModelSelection hook
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
    }, [currentModelInput, selectedProvider, setInputValue, setIsStreaming]);

    // --- Event Handlers (Navigation) ---
    const handleSettingsClick = useCallback(() => {
        // console.log("[App Handler] Settings icon clicked, navigating to /settings");
        setLocation('/settings'); // Restore router navigation
    }, [setLocation]); // Restore setLocation dependency

    // --- Main Render ---
    // console.log("[App Render] Rendering App component. Message count:", messages.length);
    return (
        <Router>
            <div class="app-layout h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                <main class="content-area flex-1 flex flex-col overflow-y-auto p-4">
                    <Switch>
                        <Route path="/index.html">
                            <div class="chat-container flex flex-col flex-1 h-full">
                                <HeaderControls
                                    uniqueProviders={uniqueProviders}
                                    selectedProvider={selectedProvider}
                                    handleProviderChange={handleProviderChange}
                                    currentModelInput={currentModelInput}
                                    handleModelInputChange={handleModelInputChange}
                                    filteredModels={filteredModels}
                                    handleClearChat={handleClearChat}
                                    isStreaming={isStreaming}
                                    hasMessages={messages.length > 0}
                                    onSettingsClick={handleSettingsClick}
                                />
                                <MessagesArea
                                    messages={messages}
                                    suggestedActionsMap={suggestedActionsMap}
                                    handleSuggestedActionClick={handleSuggestedActionClick}
                                    isStreaming={isStreaming}
                                    messagesEndRef={messagesEndRef}
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
                                    currentModelInput={currentModelInput}
                                    selectedImages={selectedImages}
                                    setSelectedImages={() => {}} // Dummy setter
                                    fileInputRef={fileInputRef}
                                    triggerImageUpload={triggerImageUpload}
                                    removeSelectedImage={removeSelectedImage}
                                    handleImageFileChange={handleImageFileChange}
                                />
                            </div>
                        </Route>
                        <Route path="/settings">
                            {/* Restore SettingPage component */}
                            <SettingPage
                                providerStatus={providerStatus}
                                onProviderToggle={handleProviderToggle}
                            />
                        </Route>
                        {/* Default route if no other matches */}
                        <Route>
                            <div class="p-6">404: Not Found - Current Path: {location}</div>
                        </Route>
                    </Switch>
                </main>
                <ConfirmationDialog
                    show={showClearConfirm}
                    title="Confirm Clear History"
                    message="Are you sure you want to clear the chat history? This cannot be undone."
                    onCancel={cancelClearChat}
                    onConfirm={confirmClearChat}
                    confirmText="Confirm Clear"
                />
            </div>
        </Router>
    );
}
