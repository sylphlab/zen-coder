import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import './app.css'; // We'll replace this content next

// Define message structure
interface Message {
    sender: 'user' | 'assistant';
    text: string;
}

// Define available models (matching the previous HTML)
const availableModels = [
    { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { value: 'openrouter/claude-3.5-sonnet', label: 'OpenRouter: Claude 3.5 Sonnet' },
    { value: 'deepseek-coder', label: 'DeepSeek Coder' },
];

// Simple VS Code API shim for type safety
// @ts-ignore - Assume acquireVsCodeApi() exists globally
const vscode = acquireVsCodeApi();

export function App() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [userInput, setUserInput] = useState('');
    const [selectedModel, setSelectedModel] = useState(availableModels[0].value); // Default to first model
    const messageListRef = useRef<HTMLDivElement>(null);
    const lastAssistantMessageRef = useRef<HTMLDivElement>(null); // Ref for streaming

    // Scroll to bottom when messages change
    useEffect(() => {
        if (messageListRef.current) {
            messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
        }
    }, [messages]);

    // Handle messages from the extension
    const handleExtensionMessage = useCallback((event: MessageEvent) => {
        const message = event.data;
        console.log('Webview received message:', message); // Debug log

        switch (message.type) {
            case 'addMessage':
                setMessages(prev => [...prev, { sender: message.sender, text: message.text }]);
                // If it's a complete assistant message, clear the streaming ref
                if (message.sender === 'assistant') {
                    lastAssistantMessageRef.current = null;
                }
                break;
            case 'startAssistantMessage': // New type to prepare for streaming
                 setMessages(prev => [...prev, { sender: 'assistant', text: '' }]);
                 // The actual element will be assigned via ref callback below
                 break;
            case 'appendMessageChunk':
                if (lastAssistantMessageRef.current) {
                    // Directly append text content to the last message element
                    // Basic escaping for safety, though ideally handled by AI service
                    const escapedDelta = message.textDelta.replace(/</g, '<').replace(/>/g, '>');
                    lastAssistantMessageRef.current.innerHTML += escapedDelta; // Append chunk
                     if (messageListRef.current) {
                         messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
                     }
                } else {
                     console.warn("No last assistant message ref found for chunk, adding as new message.");
                     setMessages(prev => [...prev, { sender: 'assistant', text: message.textDelta }]);
                }
                break;
            // Add other message handlers if needed
        }
    }, []);

    useEffect(() => {
        window.addEventListener('message', handleExtensionMessage);
        // Inform the extension that the webview is ready
        vscode.postMessage({ type: 'webviewReady' });
        // Request initial model state? Or assume extension sends it.
        // For now, set the default model on load
        vscode.postMessage({ type: 'setModel', modelId: selectedModel });

        return () => {
            window.removeEventListener('message', handleExtensionMessage);
        };
    }, [handleExtensionMessage, selectedModel]); // Add selectedModel dependency


    const handleSendMessage = () => {
        const text = userInput.trim();
        if (text) {
            // Add user message locally
            setMessages(prev => [...prev, { sender: 'user', text }]);
            lastAssistantMessageRef.current = null; // Reset streaming ref

            // Send to extension
            vscode.postMessage({
                type: 'sendMessage',
                text: text
            });
            setUserInput(''); // Clear input
        }
    };

    const handleModelChange = (event: Event) => {
        const newModelId = (event.target as HTMLSelectElement).value;
        setSelectedModel(newModelId);
        // Notify the extension about the model change
        vscode.postMessage({
            type: 'setModel',
            modelId: newModelId
        });
         console.log('Selected model:', newModelId); // Debug log
    };

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <div id="app-container">
            <h1>AI Coder</h1>

            <div id="model-selection-area">
                <label htmlFor="model-select">Select Model:</label>
                <select id="model-select" value={selectedModel} onChange={handleModelChange}>
                    {availableModels.map(model => (
                        <option key={model.value} value={model.value}>
                            {model.label}
                        </option>
                    ))}
                </select>
            </div>

            <div id="message-list" ref={messageListRef}>
                {messages.map((msg, index) => (
                    <div
                        key={index}
                        className={`message ${msg.sender === 'user' ? 'user-message' : 'assistant-message'}`}
                        // Assign ref to the last assistant message for streaming updates
                        ref={msg.sender === 'assistant' && index === messages.length - 1 ? lastAssistantMessageRef : null}
                        // Use dangerouslySetInnerHTML for basic markdown/HTML rendering from assistant
                        // Ensure proper sanitization happens *before* sending from extension if needed
                        dangerouslySetInnerHTML={{ __html: msg.text.replace(/```([\s\S]*?)```/g, (match, code) => `<pre><code>${code.trim().replace(/</g, '<').replace(/>/g, '>')}</code></pre>`) }}
                    >
                        {/* Render simple text for user messages */}
                        {/* {msg.sender === 'user' ? msg.text : null} */}
                    </div>
                ))}
            </div>

            <div id="input-area">
                <textarea
                    id="user-input"
                    placeholder="Enter your prompt..."
                    value={userInput}
                    onInput={(e) => setUserInput((e.target as HTMLTextAreaElement).value)}
                    onKeyDown={handleKeyDown}
                />
                <button id="send-button" onClick={handleSendMessage}>Send</button>
            </div>
        </div>
    );
}
