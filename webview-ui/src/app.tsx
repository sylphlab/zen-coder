import { useState, useEffect, useRef, useCallback, useMemo } from 'preact/hooks';
import { JSX } from 'preact/jsx-runtime';
import { Router, Route, Link, useLocation } from "wouter"; // Import wouter components (Corrected path)
import './app.css';
import { SettingPage } from './pages/SettingPage'; // Import SettingPage
import { ChatPage } from './pages/ChatPage'; // Import ChatPage (though we might inline chat for now)

// Define message structure
interface Message {
    id: string; // Unique ID for each message/tool call block
    sender: 'user' | 'assistant';
    content: (TextMessagePart | ToolCallPart | ToolResultPart)[]; // Array to hold text and tool calls/results
    timestamp: number;
}

interface TextMessagePart {
    type: 'text';
    text: string;
}

interface ToolCallPart {
    type: 'tool-call';
    toolCallId: string;
    toolName: string;
    args: any;
    status?: 'pending' | 'running' | 'complete' | 'error'; // Status for UI display
    result?: any; // Store result here for display
    progress?: string; // For progress updates like UUID generation
}

interface ToolResultPart {
    type: 'tool-result';
    toolCallId: string;
    toolName: string; // Include toolName for context
    result: any;
    // Note: We might not receive this directly if the AI summarizes,
    // but we store results linked to calls for potential display.
}

// Define structure for resolved models from AiService
type ResolvedModel = {
    id: string;
    label: string;
    provider: ApiProviderKey; // Use the type from AiService if possible, or string
    source: string;
};

// Define ApiProviderKey here for UI use (or import if shared)
export type ApiProviderKey = 'ANTHROPIC' | 'GOOGLE' | 'OPENROUTER' | 'DEEPSEEK'; // Export type

// --- Settings Types (from settings-ui) ---
type ProviderStatus = {
    enabled: boolean;
    apiKeySet: boolean;
};

// Update AllProviderStatus to be an array of the combined info type
// This type should match the one defined in AiService.ts
export type ProviderInfoAndStatus = {
     id: string; // Use string ID from backend
     name: string;
     apiKeyUrl?: string;
     requiresApiKey: boolean;
     enabled: boolean;
     apiKeySet: boolean;
 };
export type AllProviderStatus = ProviderInfoAndStatus[]; // It's now an array

// Helper to get the VS Code API instance
// @ts-ignore
const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;

// Function to post messages to the extension host
export const postMessage = (message: any) => { // Export function
    if (vscode) {
        vscode.postMessage(message);
    } else {
        console.log("VS Code API not available, message not sent:", message);
        // Mock responses for development
        if (message.type === 'getAvailableModels') {
            setTimeout(() => {
                window.dispatchEvent(new MessageEvent('message', {
                    data: {
                        type: 'availableModels',
                        payload: [
                            { id: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet', provider: 'ANTHROPIC', source: 'hardcoded' },
                            { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus', provider: 'ANTHROPIC', source: 'hardcoded' },
                            { id: 'models/gemini-1.5-pro-latest', label: 'Gemini 1.5 Pro', provider: 'GOOGLE', source: 'hardcoded' },
                            { id: 'models/gemini-1.5-flash-latest', label: 'Gemini 1.5 Flash', provider: 'GOOGLE', source: 'hardcoded' },
                            { id: 'openrouter/claude-3.5-sonnet', label: 'OR: Claude 3.5 Sonnet', provider: 'OPENROUTER', source: 'hardcoded' },
                            { id: 'openrouter/google/gemini-pro-1.5', label: 'OR: Gemini 1.5 Pro', provider: 'OPENROUTER', source: 'hardcoded' },
                            { id: 'deepseek-coder', label: 'DeepSeek Coder', provider: 'DEEPSEEK', source: 'hardcoded' },
                            { id: 'deepseek-chat', label: 'DeepSeek Chat', provider: 'DEEPSEEK', source: 'hardcoded' },
                        ]
                    }
                }));
            }, 300);
       } else if (message.type === 'getProviderStatus') {
            // Simulate receiving status after a delay
            setTimeout(() => {
                window.dispatchEvent(new MessageEvent('message', {
                    data: {
                        type: 'providerStatus',
                        payload: {
                            ANTHROPIC: { enabled: true, apiKeySet: true },
                            GOOGLE: { enabled: false, apiKeySet: false },
                            OPENROUTER: { enabled: true, apiKeySet: true },
                            DEEPSEEK: { enabled: true, apiKeySet: false }
                        } // Example status
                    }
                }));
            }, 500);
       } else if (message.type === 'setProviderEnabled') {
           console.log("Simulating provider enable change:", message.payload);
           // Optionally update mock state here if needed for dev outside VS Code
       }
    }
};

// Helper function to generate unique IDs
const generateUniqueId = () => `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// Helper to get provider key from model ID string
const getProviderFromModelId = (modelId: string): ApiProviderKey | null => {
    if (modelId.startsWith('models/')) return 'GOOGLE';
    if (modelId.startsWith('claude-')) return 'ANTHROPIC';
    if (modelId.startsWith('openrouter/')) return 'OPENROUTER';
    if (modelId.startsWith('deepseek-')) return 'DEEPSEEK';
    // Add more specific checks if needed
    if (modelId.includes('anthropic/')) return 'OPENROUTER'; // Handle OpenRouter specific format
    if (modelId.includes('google/')) return 'OPENROUTER';
     if (modelId.includes('mistralai/')) return 'OPENROUTER';
    // Fallback or guess based on common patterns if necessary, but might be unreliable
    return null; // Cannot determine
};


export function App() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [availableModels, setAvailableModels] = useState<ResolvedModel[]>([]); // State for models
    const [selectedProvider, setSelectedProvider] = useState<ApiProviderKey | null>(null); // State for selected provider
    const [currentModelInput, setCurrentModelInput] = useState<string>(''); // Separate state for model input field
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const currentAssistantMessageId = useRef<string | null>(null);
    // const [isSettingsVisible, setIsSettingsVisible] = useState(false); // Replaced by routing
    const [providerStatus, setProviderStatus] = useState<AllProviderStatus>([]); // Initialize as empty array
    const [location, setLocation] = useLocation(); // Hook for navigation state

     // --- Derived State ---
     const uniqueProviders = useMemo(() => {
        const providers = new Set<ApiProviderKey>();
        availableModels.forEach(model => providers.add(model.provider));
        return Array.from(providers);
    }, [availableModels]);

    const filteredModels = useMemo(() => {
        if (!selectedProvider) return [];
        return availableModels.filter(model => model.provider === selectedProvider);
    }, [availableModels, selectedProvider]);

    // --- Effects ---
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        // Restore state when the webview loads
        const savedState = vscode?.getState();
        const initialModelId = savedState?.selectedModelId;
        let restoredModel = false; // Flag to check if we restored a model

        if (initialModelId) {
            console.log("Restoring saved model ID:", initialModelId);
            setCurrentModelInput(initialModelId);
            // Determine provider from restored model ID if possible
            const restoredProvider = getProviderFromModelId(initialModelId);
            if (restoredProvider) {
                setSelectedProvider(restoredProvider);
            }
            // Inform backend about the restored model
            postMessage({ type: 'setModel', modelId: initialModelId });
            restoredModel = true;
        }

        postMessage({ type: 'webviewReady' }); // Both UIs need this
        // Request initial state from extension
        postMessage({ type: 'getAvailableModels' }); // This will potentially overwrite if no saved state
        postMessage({ type: 'getProviderStatus' });

        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            console.log("Chat UI received message:", message);

            switch (message.type) {
                // (Keep existing message handlers: addMessage, startAssistantMessage, appendMessageChunk, addToolCall, toolStatusUpdate, uuidProgressUpdate)
                 case 'addMessage': // Simple text message from assistant (e.g., errors)
                    setMessages(prev => [...prev, { id: generateUniqueId(), sender: message.sender, content: [{ type: 'text', text: message.text }], timestamp: Date.now() }]);
                    setIsStreaming(false); // Stop streaming on explicit error message
                    currentAssistantMessageId.current = null;
                    break;
                case 'startAssistantMessage': // Signal to start a new assistant message block
                     setIsStreaming(true);
                     const newMsgId = generateUniqueId();
                     currentAssistantMessageId.current = newMsgId;
                     setMessages(prev => [...prev, { id: newMsgId, sender: 'assistant', content: [], timestamp: Date.now() }]);
                     break;
                case 'appendMessageChunk': // Append text chunk to the current assistant message
                    if (currentAssistantMessageId.current) {
                        setMessages(prev => prev.map(msg => {
                            if (msg.id === currentAssistantMessageId.current) {
                                const lastContent = msg.content[msg.content.length - 1];
                                if (lastContent?.type === 'text') {
                                    return { ...msg, content: [...msg.content.slice(0, -1), { ...lastContent, text: lastContent.text + message.textDelta }] };
                                } else {
                                    return { ...msg, content: [...msg.content, { type: 'text', text: message.textDelta }] };
                                }
                            }
                            return msg;
                        }));
                    }
                    break;
                 case 'addToolCall':
                     if (currentAssistantMessageId.current && message.payload) {
                         setMessages(prev => prev.map(msg => {
                             if (msg.id === currentAssistantMessageId.current) {
                                 return { ...msg, content: [...msg.content, { type: 'tool-call', ...message.payload, status: 'pending' }] };
                             }
                             return msg;
                         }));
                     }
                     break;
                 case 'toolStatusUpdate':
                     if (message.toolCallId) {
                         setMessages(prev => prev.map(msg => {
                             const toolCallIndex = msg.content.findIndex(part => part.type === 'tool-call' && part.toolCallId === message.toolCallId);
                             if (toolCallIndex !== -1) {
                                 const updatedContent = [...msg.content];
                                 const toolCallPart = updatedContent[toolCallIndex] as ToolCallPart;
                                 updatedContent[toolCallIndex] = {
                                     ...toolCallPart,
                                     status: message.status ?? toolCallPart.status,
                                     result: message.status === 'complete' ? message.message : toolCallPart.result,
                                     progress: undefined
                                 };
                                 return { ...msg, content: updatedContent };
                             }
                             return msg;
                         }));
                         if (message.status === 'complete' || message.status === 'error') {
                             const lastMsg = messages[messages.length - 1];
                             if (lastMsg && lastMsg.id === currentAssistantMessageId.current) {
                                 const allToolsDone = lastMsg.content
                                     .filter(part => part.type === 'tool-call')
                                     .every(part => (part as ToolCallPart).status === 'complete' || (part as ToolCallPart).status === 'error');
                                 if (allToolsDone) {
                                     setIsStreaming(false);
                                     currentAssistantMessageId.current = null;
                                     console.log("All tools processed, stream considered finished.");
                                 }
                             }
                         }
                     }
                     break;
                 case 'uuidProgressUpdate':
                     if (message.payload && message.payload.toolCallId) {
                         setMessages(prev => prev.map(msg => {
                             const toolCallIndex = msg.content.findIndex(part => part.type === 'tool-call' && part.toolCallId === message.payload.toolCallId);
                             if (toolCallIndex !== -1) {
                                 const updatedContent = [...msg.content];
                                 const toolCallPart = updatedContent[toolCallIndex] as ToolCallPart;
                                 updatedContent[toolCallIndex] = {
                                     ...toolCallPart,
                                     status: 'running',
                                     progress: `(${message.payload.generated}/${message.payload.total})`
                                 };
                                 return { ...msg, content: updatedContent };
                             }
                             return msg;
                         }));
                     }
                     break;
                case 'availableModels':
                    if (Array.isArray(message.payload)) {
                        setAvailableModels(message.payload);
                        // Set initial provider and model if not already set
                        if (!selectedProvider && message.payload.length > 0) {
                            // Only set default if we didn't restore a saved model
                            if (!restoredModel && !currentModelInput && message.payload.length > 0) {
                                const firstModel = message.payload[0];
                                console.log("Setting initial model (no saved state):", firstModel.id);
                                setSelectedProvider(firstModel.provider);
                                setCurrentModelInput(firstModel.id); // Set initial model input value
                                postMessage({ type: 'setModel', modelId: firstModel.id }); // Inform backend
                                // Save the initial state
                                vscode?.setState({ selectedModelId: firstModel.id });
                            }
                        }
                    }
                    break;
                case 'providerStatus': // Handle status list from extension
                    if (Array.isArray(message.payload)) {
                        const isInitialLoad = providerStatus.length === 0; // Check if it's the first time loading status
                        setProviderStatus(message.payload); // Set the array directly
                        // If it's an update (not initial load), re-fetch models
                        if (!isInitialLoad) {
                            console.log("Provider status updated, re-fetching available models...");
                            postMessage({ type: 'getAvailableModels' });
                        }
                    }
                    break;
                case 'showSettings': // Handle command from extension to show settings page
                    setLocation('/settings');
                    break;
                case 'loadHistory': // Handle receiving history from extension
                    if (Array.isArray(message.payload)) {
                        console.log(`Loading ${message.payload.length} messages from history.`);
                        // TODO: Define a proper type for history messages if different from Message
                        setMessages(message.payload as Message[]);
                    }
                    break;
                case 'streamFinished': // Handle explicit stream end signal
                    console.log("Stream finished.");
                    setIsStreaming(false);
                    currentAssistantMessageId.current = null;
                    break;
            }
        };

        window.addEventListener('message', handleMessage);

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, [messages, selectedProvider]); // Add selectedProvider dependency

    // --- Event Handlers ---
    const handleInputChange = (e: JSX.TargetedEvent<HTMLInputElement>) => {
        setInputValue(e.currentTarget.value);
    };

    const handleSend = () => {
        if (inputValue.trim() && !isStreaming && currentModelInput) { // Ensure model is selected/entered
            const userMessage: Message = {
                id: generateUniqueId(),
                sender: 'user',
                content: [{ type: 'text', text: inputValue }],
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, userMessage]);
            // Send message with the currently selected/entered model ID
            postMessage({ type: 'sendMessage', text: inputValue, modelId: currentModelInput });
            setInputValue('');
            setIsStreaming(true);
            currentAssistantMessageId.current = null;
        } else if (!currentModelInput) {
             console.warn("Cannot send message: No model selected or entered.");
             // Optionally show a UI warning
        }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleProviderChange = (e: JSX.TargetedEvent<HTMLSelectElement>) => {
        const newProvider = e.currentTarget.value as ApiProviderKey | '';
        if (newProvider === '') {
            setSelectedProvider(null);
            setCurrentModelInput(''); // Clear model when provider is cleared
        } else {
            setSelectedProvider(newProvider);
            // Optionally set a default model for the new provider or clear input
            const defaultModel = availableModels.find(m => m.provider === newProvider);
            const newModelId = defaultModel ? defaultModel.id : '';
            setCurrentModelInput(newModelId);
            if (newModelId) {
                 postMessage({ type: 'setModel', modelId: newModelId }); // Inform backend
                 // Save state when provider changes and a default model is selected
                 vscode?.setState({ selectedModelId: newModelId });
            } else {
                 // Clear saved state if no default model is found for the provider
                 vscode?.setState({ selectedModelId: undefined });
            }
        }
    };

    const handleModelInputChange = (e: JSX.TargetedEvent<HTMLInputElement>) => {
        const newModelId = e.currentTarget.value;
        setCurrentModelInput(newModelId); // Update the input field state

        // Optional: Debounce this call if it causes performance issues
        // Only inform backend if the model ID is likely valid or complete
        // For simplicity, inform on every change for now.
         postMessage({ type: 'setModel', modelId: newModelId });
         // Save state whenever the model input changes
         vscode?.setState({ selectedModelId: newModelId });
    };
     // Update handleProviderToggle to work with the array structure
      const handleProviderToggle = useCallback((providerId: string, enabled: boolean) => {
         // Optimistically update UI state (find and update the specific provider)
         setProviderStatus(prevStatus =>
             prevStatus.map(p =>
                 p.id === providerId ? { ...p, enabled: enabled } : p
             )
         );
         // Send message to extension host to update the setting
         postMessage({
             type: 'setProviderEnabled',
             payload: { provider: providerId, enabled: enabled } // Send providerId (string)
         });
     }, []);


    // --- Rendering Helpers ---
    const renderContentPart = (part: TextMessagePart | ToolCallPart | ToolResultPart, index: number) => {
        switch (part.type) {
            case 'text':
                const htmlText = part.text.replace(/\n/g, '<br />');
                return <span key={index} dangerouslySetInnerHTML={{ __html: htmlText }}></span>;
            case 'tool-call':
                let statusText = `[${part.toolName} ${part.progress ?? ''}... ]`;
                if (part.status === 'complete') {
                    let resultSummary = JSON.stringify(part.result);
                    if (resultSummary?.length > 100) resultSummary = resultSummary.substring(0, 97) + '...';
                    statusText = `[${part.toolName} completed. Result: ${resultSummary ?? 'OK'}]`; // Added nullish coalescing
                } else if (part.status === 'error') {
                    statusText = `[${part.toolName} failed. Error: ${part.result?.error ?? 'Unknown'}]`;
                } else if (part.status === 'running') {
                     statusText = `[${part.toolName} ${part.progress ?? ''} running... ]`;
                }
                return <span key={part.toolCallId || index} class="tool-call-summary">{statusText}</span>;
            default:
                return null;
        }
    };

   // renderProviderSetting removed from App.tsx - logic moved entirely to SettingPage.tsx

   // Settings Modal is removed, replaced by SettingsPage route
    // Main application layout with routing
    return (
        <Router>
            <div class="app-layout">
                <nav class="navigation">
                    <Link href="/">Chat</Link>
                    <Link href="/settings">Settings</Link>
                </nav>
                <main class="content-area">
                    <Route path="/">
                        {/* Existing Chat UI Logic */}
                        <div class="chat-container">
                            <div class="header-controls">
                                {/* <button class="settings-button" onClick={() => setLocation('/settings')}>⚙️ Settings</button> */} {/* Replaced by nav link */}
                                <div class="model-selector">
                                    {/* Provider Dropdown */}
                                    <label htmlFor="provider-select">Provider: </label>
                                    <select
                                        id="provider-select"
                                        value={selectedProvider ?? ''}
                                        onChange={handleProviderChange}
                                    >
                                        <option value="">-- Select Provider --</option>
                                        {uniqueProviders.map(provider => (
                                            <option key={provider} value={provider}>{provider}</option>
                                        ))}
                                    </select>

                                    {/* Model Autocomplete Input */}
                                    <label htmlFor="model-input">Model: </label>
                                    <input
                                        list="models-datalist"
                                        id="model-input"
                                        name="model-input"
                                        value={currentModelInput}
                                        onInput={handleModelInputChange}
                                        placeholder={selectedProvider ? "Select or type model ID" : "Select provider first"}
                                        disabled={!selectedProvider} // Disable if no provider selected
                                    />
                                    <datalist id="models-datalist">
                                        {filteredModels.map(model => (
                                            <option key={model.id} value={model.id}>
                                                {model.label}
                                            </option>
                                        ))}
                                    </datalist>
                                </div>
                            </div>
                            <div class="messages-area">
                                {messages.map((msg) => (
                                    <div key={msg.id} class={`message ${msg.sender}`}>
                                        <div class="message-content">
                                            {msg.content.map(renderContentPart)}
                                        </div>
                                    </div>
                                ))}
                                {isStreaming && messages[messages.length - 1]?.sender === 'assistant' && (
                                    <div class="message assistant">
                                        <div class="message-content">
                                            <span>Thinking...</span> {/* Replace ProgressRing with simple text */}
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                            <div class="input-area">
                                <textarea
                                    value={inputValue}
                                    onInput={(e) => setInputValue((e.target as HTMLTextAreaElement).value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Type your message..."
                                    rows={3}
                                    disabled={isStreaming || !currentModelInput} // Also disable if no model selected
                                />
                                <button onClick={handleSend} disabled={isStreaming || !inputValue.trim() || !currentModelInput}>
                                    Send
                                </button>
                            </div>
                        </div>
                    </Route>
                    <Route path="/settings">
                        {/* Pass necessary props and handlers to SettingPage */}
                        <SettingPage
                            providerStatus={providerStatus}
                            onProviderToggle={handleProviderToggle}
                            // Add handlers for setting/deleting keys later if needed directly here
                            // For now, SettingPage handles its own input and posts messages
                        />
                    </Route>
                    {/* Default route or 404 can be added here */}
                </main>
            </div>
        </Router>
    );

/* Original return statement replaced by the Router structure above */
} // Add back the closing brace for the App function

// Type definitions are now correctly placed at the top of the file.
