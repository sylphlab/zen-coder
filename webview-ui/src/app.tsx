import { useState, useEffect, useRef, useCallback, useMemo } from 'preact/hooks';
import { JSX } from 'preact/jsx-runtime';
import { Router, Route, Link, useLocation } from "wouter"; // Import wouter components
import ReactMarkdown from 'react-markdown'; // Import ReactMarkdown
import remarkGfm from 'remark-gfm'; // Import remark-gfm
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'; // Import SyntaxHighlighter
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Import a style (e.g., vscDarkPlus)
import './app.css';
import { SettingPage } from './pages/SettingPage'; // Import SettingPage
import { ChatPage } from './pages/ChatPage'; // Import ChatPage

// --- Define UI Message Structure (Mirroring Backend's UiMessage) ---
// Ideally, share this definition via a common types file
export interface UiTextMessagePart { type: 'text'; text: string; } // Export if needed elsewhere
export interface UiToolCallPart { type: 'tool-call'; toolCallId: string; toolName: string; args: any; status?: 'pending' | 'running' | 'complete' | 'error'; result?: any; progress?: string; } // Export if needed
export interface UiImagePart { type: 'image'; mediaType: string; data: string; } // Add image part type
export type UiMessageContentPart = UiTextMessagePart | UiToolCallPart | UiImagePart; // Export if needed, include image part
export interface Message { // Renamed from UiMessage to avoid conflict, but structure is the same
    id: string;
    sender: 'user' | 'assistant';
    content: UiMessageContentPart[];
    timestamp: number;
    thinking?: string; // Add optional thinking property
}
// --- End UI Message Structure Definition ---


// Use the shared AvailableModel type from common/types.ts
import { AvailableModel, SuggestedAction } from '../../src/common/types'; // Import SuggestedAction type
// Remove the local ResolvedModel definition

// Define ApiProviderKey here for UI use (or import if shared)
export type ApiProviderKey = 'ANTHROPIC' | 'GOOGLE' | 'OPENROUTER' | 'DEEPSEEK'; // Export type

// --- Settings Types (from settings-ui) ---
// This type should match the one defined in AiService.ts / extension.ts
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
        // Mock responses for development outside VS Code
        if (message.type === 'webviewReady') {
             setTimeout(() => {
                 window.dispatchEvent(new MessageEvent('message', {
                     data: {
                         type: 'availableModels',
                         payload: [
                             { id: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet', provider: 'ANTHROPIC', source: 'hardcoded' },
                             { id: 'models/gemini-1.5-pro-latest', label: 'Gemini 1.5 Pro', provider: 'GOOGLE', source: 'hardcoded' },
                             { id: 'openrouter/claude-3.5-sonnet', label: 'OR: Claude 3.5 Sonnet', provider: 'OPENROUTER', source: 'hardcoded' },
                             { id: 'deepseek-coder', label: 'DeepSeek Coder', provider: 'DEEPSEEK', source: 'hardcoded' },
                         ]
                     }
                 }));
                 window.dispatchEvent(new MessageEvent('message', {
                     data: {
                         type: 'providerStatus',
                         payload: [ // Send array matching ProviderInfoAndStatus[]
                             { id: 'ANTHROPIC', name: 'Anthropic', requiresApiKey: true, enabled: true, apiKeySet: true, apiKeyUrl: '...' },
                             { id: 'GOOGLE', name: 'Google', requiresApiKey: true, enabled: false, apiKeySet: false, apiKeyUrl: '...' },
                             { id: 'OPENROUTER', name: 'OpenRouter', requiresApiKey: true, enabled: true, apiKeySet: true, apiKeyUrl: '...' },
                             { id: 'DEEPSEEK', name: 'DeepSeek', requiresApiKey: true, enabled: true, apiKeySet: false, apiKeyUrl: '...' }
                         ]
                     }
                 }));
                  window.dispatchEvent(new MessageEvent('message', {
                     data: {
                         type: 'loadUiHistory', // Use the correct message type
                         payload: [] // Start with empty history for mock
                     }
                 }));
             }, 300);
        }
    }
};

// Helper function to generate unique IDs
const generateUniqueId = () => `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// Helper to get provider key from model ID string
const getProviderFromModelId = (modelId: string): ApiProviderKey | null => {
    if (!modelId) return null;
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
    // --- State Variables ---
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]); // Use imported type
    const [selectedProvider, setSelectedProvider] = useState<ApiProviderKey | null>(null);
    const [currentModelInput, setCurrentModelInput] = useState<string>('');
    const [providerStatus, setProviderStatus] = useState<AllProviderStatus>([]);
    const [location, setLocation] = useLocation(); // Hook for navigation state
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const currentAssistantMessageId = useRef<string | null>(null); // To track the ID of the message being streamed
    const [showClearConfirm, setShowClearConfirm] = useState(false); // State for custom confirmation
    const [suggestedActionsMap, setSuggestedActionsMap] = useState<Record<string, SuggestedAction[]>>({}); // State for suggested actions
    const [selectedImages, setSelectedImages] = useState<{ id: string; data: string; mediaType: string; name: string }[]>([]); // State for selected images (array)
    const fileInputRef = useRef<HTMLInputElement>(null); // Ref for file input
    // Remove the separate thinkingText state

    // --- Derived State ---
    const uniqueProviders = useMemo(() => {
        const providers = new Set<ApiProviderKey>();
        availableModels.forEach(model => providers.add(model.providerId as ApiProviderKey)); // Use providerId
        return Array.from(providers);
    }, [availableModels]);

    const filteredModels = useMemo(() => {
        if (!selectedProvider) return [];
        return availableModels.filter(model => model.providerId === selectedProvider); // Use providerId
    }, [availableModels, selectedProvider]);

    // --- Effects ---
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]); // Scroll when messages change

    useEffect(() => {
        // // Restore saved state (provider and model ID) when the webview loads
        // const savedState = vscode?.getState();
        // const initialModelId = savedState?.selectedModelId;
        // const initialProvider = savedState?.selectedProvider; // Restore provider too
        let restoredState = false; // Keep this variable, but it will remain false for now

        // if (initialProvider) {
        //     console.log("Restoring saved provider:", initialProvider);
        //     setSelectedProvider(initialProvider);
        //     if (initialModelId) {
        //         console.log("Restoring saved model ID:", initialModelId);
        //         setCurrentModelInput(initialModelId);
        //     }
        //     restoredState = true;
        // } else if (initialModelId) { // Fallback if only model ID was saved previously
        //      console.log("Restoring saved model ID (fallback):", initialModelId);
        //      setCurrentModelInput(initialModelId);
        //      const restoredProvider = getProviderFromModelId(initialModelId);
        //      if (restoredProvider) {
        //          setSelectedProvider(restoredProvider);
        //          // Save the provider now that we've derived it
        //          vscode?.setState({ ...savedState, selectedProvider: restoredProvider });
        //      }
        //      restoredState = true;
        // }

        // --- Message Handling Logic ---
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            console.log("Chat UI received message:", message.type, message.payload); // Log payload too

            switch (message.type) {
                case 'addMessage': // Simple text message from assistant (e.g., errors)
                    setMessages(prev => [...prev, { id: generateUniqueId(), sender: message.sender, content: [{ type: 'text', text: message.text }], timestamp: Date.now() }]);
                    setIsStreaming(false);
                    currentAssistantMessageId.current = null;
                    break;
                case 'startAssistantMessage': // Signal to start a new assistant message block
                     setIsStreaming(true);
                     // No need to clear separate thinkingText state anymore
                     // Use the messageId directly from the payload sent by the backend
                     if (message.messageId) {
                         const newAssistantMessageId = message.messageId;
                         currentAssistantMessageId.current = newAssistantMessageId;
                         console.log(`Set currentAssistantMessageId to: ${newAssistantMessageId}`);
                         // Add the empty message frame to the state immediately
                         setMessages(prev => [
                             ...prev,
                             {
                                 id: newAssistantMessageId,
                                 sender: 'assistant',
                                 content: [], // Start with empty content
                                 timestamp: Date.now(),
                                 // thinking: undefined // Ensure new message starts without thinking text
                             }
                         ]);
                     } else {
                         console.error("startAssistantMessage received without a messageId in payload!");
                         currentAssistantMessageId.current = null; // Reset if ID is missing
                     }
                     break;
                case 'appendMessageChunk': // Append text chunk to the current assistant message
                    if (currentAssistantMessageId.current) {
                        // Log the actual text delta received
                        console.log("Received textDelta:", JSON.stringify(message.textDelta));
                        setMessages(prevMessages => {
                            // Create a completely new array using map
                            return prevMessages.map(msg => {
                                // If this is not the message we're looking for, return it as is
                                if (msg.id !== currentAssistantMessageId.current) {
                                    return msg;
                                }

                                // If it IS the message, create a new message object
                                // Ensure content is always an array
                                const currentContent = Array.isArray(msg.content) ? msg.content : [];
                                const newContent = [...currentContent]; // Copy existing content parts

                                // Find the last part of the content array
                                const lastContentPartIndex = newContent.length - 1;
                                const lastContentPart = newContent[lastContentPartIndex];

                                // If the last part is text, append to it
                                if (lastContentPart?.type === 'text') {
                                    // Create a new text part object
                                    newContent[lastContentPartIndex] = {
                                        ...lastContentPart,
                                        text: lastContentPart.text + message.textDelta
                                    };
                                } else {
                                    // Otherwise, add a new text part
                                    newContent.push({ type: 'text', text: message.textDelta });
                                }

                                // Return a new message object with the updated content
                                return {
                                    ...msg,
                                    content: newContent
                                };
                            });
                        });
                    } else {
                         console.warn("appendMessageChunk received but no current assistant message ID is set.");
                         // Optionally handle this by adding a new message?
                    }
                    break;
                 case 'addToolCall': // Add a tool call visual placeholder
                     if (currentAssistantMessageId.current && message.payload) {
                         setMessages(prev => prev.map(msg => {
                             if (msg.id === currentAssistantMessageId.current) {
                                 // Ensure content is an array
                                 const contentArray = Array.isArray(msg.content) ? msg.content : [];
                                 return { ...msg, content: [...contentArray, { type: 'tool-call', ...message.payload, status: 'pending' }] }; // Add with pending status
                             }
                             return msg;
                         }));
                     } else {
                          console.warn("addToolCall received but no current assistant message ID or payload.");
                     }
                     break;
                 case 'toolStatusUpdate': // Update the status/result of a specific tool call
                     if (message.toolCallId) {
                         setMessages(prev => prev.map(msg => {
                             if (msg.sender === 'assistant' && Array.isArray(msg.content)) {
                                 const toolCallIndex = msg.content.findIndex(part => part.type === 'tool-call' && part.toolCallId === message.toolCallId);
                                 if (toolCallIndex !== -1) {
                                     const updatedContent = [...msg.content];
                                     const toolCallPart = updatedContent[toolCallIndex] as UiToolCallPart; // Cast needed
                                     updatedContent[toolCallIndex] = {
                                         ...toolCallPart,
                                         status: message.status ?? toolCallPart.status, // Update status
                                         result: (message.status === 'complete' || message.status === 'error') ? (message.message ?? toolCallPart.result) : toolCallPart.result, // Update result on completion/error
                                         progress: message.status === 'running' ? (message.message ?? toolCallPart.progress) : undefined // Update progress if running, clear otherwise
                                     };
                                     return { ...msg, content: updatedContent };
                                 }
                             }
                             return msg;
                         }));
                         // Note: We don't manage isStreaming based on tool updates anymore, only 'streamFinished' signal
                     }
                     break;
                // Remove uuidProgressUpdate as it's handled by generic toolStatusUpdate
                case 'availableModels':
                    if (Array.isArray(message.payload)) {
                        const models = message.payload as AvailableModel[]; // Use correct type
                        setAvailableModels(models);
                        // Set initial provider and model (always do this now since restore is disabled)
                        if (models.length > 0) {
                             const firstModel = models[0];
                             const initialProviderId = firstModel.providerId as ApiProviderKey; // Use providerId
                             console.log("Setting initial provider and model:", initialProviderId, firstModel.id);
                             setSelectedProvider(initialProviderId);
                             setCurrentModelInput(firstModel.id);
                             // Save the initial state (both provider and model)
                             // vscode?.setState({ selectedProvider: initialProviderId, selectedModelId: firstModel.id }); // Don't save state for now
                        }
                    }
                    break;
                case 'providerStatus': // Handle status list from extension
                    if (Array.isArray(message.payload)) {
                        setProviderStatus(message.payload);
                    }
                    break;
                case 'showSettings': // Handle command from extension to show settings page
                    setLocation('/settings');
                    break;
                case 'loadUiHistory': // Renamed message type - Directly use the payload
                    if (Array.isArray(message.payload)) {
                        console.log(`Loading ${message.payload.length} messages from UI history.`);
                        setMessages(message.payload as Message[]); // Assume payload matches Message[]
                        // Check if the last message is an incomplete assistant message
                        const lastMessage = message.payload[message.payload.length - 1];
                        if (lastMessage && lastMessage.sender === 'assistant') {
                            // Check if it contains only pending/running tools or seems generally incomplete
                            const isLikelyIncomplete = Array.isArray(lastMessage.content) &&
                                lastMessage.content.length > 0 &&
                                lastMessage.content.every((part: any) => part.type === 'tool-call' && (part.status === 'pending' || part.status === 'running'));
                                // Add more checks if needed (e.g., no text part)

                            if (isLikelyIncomplete) {
                                console.log("Last message seems incomplete, setting streaming true.");
                                setIsStreaming(true);
                                currentAssistantMessageId.current = lastMessage.id;
                            } else {
                                setIsStreaming(false);
                                currentAssistantMessageId.current = null;
                            }
                        } else {
                            setIsStreaming(false);
                            currentAssistantMessageId.current = null;
                        }
                    }
                    break;
                case 'streamFinished': // Handle explicit stream end signal
                    console.log("Stream finished signal received.");
                    setIsStreaming(false);
                    currentAssistantMessageId.current = null;
                    // Clear thinking text from the specific message when stream finishes
                    setMessages(prev => prev.map(msg => {
                        if (msg.id === currentAssistantMessageId.current) {
                            return { ...msg, thinking: undefined }; // Remove thinking text
                        }
                        return msg;
                    }));
                    break;
                case 'addSuggestedActions': // Handle suggested actions from backend
                    if (message.payload && message.payload.messageId && Array.isArray(message.payload.actions)) {
                        console.log(`Adding suggested actions for message ${message.payload.messageId}`, message.payload.actions);
                        setSuggestedActionsMap(prev => ({
                            ...prev,
                            [message.payload.messageId]: message.payload.actions
                        }));
                    } else {
                        console.warn("Received addSuggestedActions with invalid payload:", message.payload);
                    }
                    break;
                case 'appendThinkingChunk': // Handle thinking process chunks for the current message
                    console.log("[App.tsx] Received appendThinkingChunk:", message.textDelta);
                    if (message.textDelta && currentAssistantMessageId.current) {
                        setMessages(prev => prev.map(msg => {
                            if (msg.id === currentAssistantMessageId.current) {
                                const currentThinking = msg.thinking ?? '';
                                const newThinking = currentThinking + message.textDelta;
                                console.log(`[App.tsx] Updating thinking for message ${msg.id}:`, newThinking);
                                return { ...msg, thinking: newThinking };
                            }
                            return msg;
                        }));
                    }
                    break;
            }
        };

        window.addEventListener('message', handleMessage);

        // Request initial state when component mounts
        postMessage({ type: 'webviewReady' });

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []); // Run only on mount

    // --- Event Handlers ---
    const handleInputChange = (e: JSX.TargetedEvent<HTMLInputElement | HTMLTextAreaElement>) => { // Allow textarea
        setInputValue(e.currentTarget.value);
    };

    const handleSend = () => {
        // Allow sending if there's text OR at least one image selected
        if ((inputValue.trim() || selectedImages.length > 0) && !isStreaming && currentModelInput) {
            const contentParts: UiMessageContentPart[] = [];
            // Add all selected images
            selectedImages.forEach(img => {
                contentParts.push({ type: 'image', mediaType: img.mediaType, data: img.data });
            });
            if (inputValue.trim()) {
                contentParts.push({ type: 'text', text: inputValue });
            }

            const newUserMessage: Message = {
                id: generateUniqueId(),
                sender: 'user',
                content: contentParts, // Use combined content parts (can have multiple images + text)
                timestamp: Date.now()
            };
            // Add user message to UI immediately
            setMessages(prev => [...prev, newUserMessage]);

            // Send message with potentially mixed content (text and image)
            // Use 'content' key instead of 'text'
            postMessage({ type: 'sendMessage', content: contentParts, providerId: selectedProvider, modelId: currentModelInput });

            setInputValue(''); // Clear text input
            setSelectedImages([]); // Clear selected images array
            if (fileInputRef.current) {
                fileInputRef.current.value = ''; // Reset file input visually
            }
            setIsStreaming(true); // Set streaming immediately for responsiveness
            // No separate thinkingText state to clear
            currentAssistantMessageId.current = null; // Reset before new message stream
        } else if (!currentModelInput) {
             console.warn("Cannot send message: No model selected or entered.");
             // Optionally show a UI warning
        }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey && !isStreaming) { // Prevent sending while streaming
            e.preventDefault();
            handleSend();
        }
    };

    const handleProviderChange = (e: JSX.TargetedEvent<HTMLSelectElement>) => {
        const newProvider = e.currentTarget.value as ApiProviderKey | '';
        if (newProvider === '') {
            setSelectedProvider(null);
            setCurrentModelInput('');
            vscode?.setState({ selectedProvider: null, selectedModelId: undefined }); // Clear saved state
        } else {
            setSelectedProvider(newProvider);
            const defaultModel = availableModels.find(m => m.providerId === newProvider); // Use providerId
            const newModelId = defaultModel ? defaultModel.id : '';
            setCurrentModelInput(newModelId);
            // Save state when provider changes
            vscode?.setState({ selectedProvider: newProvider, selectedModelId: newModelId });
        }
    };

    const handleModelInputChange = (e: JSX.TargetedEvent<HTMLInputElement>) => {
        const newModelId = e.currentTarget.value;
        setCurrentModelInput(newModelId);
        // Save state whenever the model input changes
        vscode?.setState({ selectedProvider: selectedProvider, selectedModelId: newModelId }); // Save provider too
    };

    const handleProviderToggle = useCallback((providerId: string, enabled: boolean) => {
         // Optimistically update UI state
         setProviderStatus(prevStatus =>
             prevStatus.map(p =>
                 p.id === providerId ? { ...p, enabled: enabled } : p
             )
         );
         postMessage({
             type: 'setProviderEnabled',
             payload: { provider: providerId, enabled: enabled }
         });
     }, []);

     const handleClearChat = useCallback(() => {
         setShowClearConfirm(true); // Show custom confirmation instead of using confirm()
     }, []);

     const confirmClearChat = useCallback(() => {
         setMessages([]); // Clear local state immediately
         postMessage({ type: 'clearChatHistory' }); // Tell backend to clear persistent state
         console.log("Clear chat confirmed and requested.");
         setShowClearConfirm(false); // Hide confirmation
     }, []);

     const cancelClearChat = useCallback(() => {
         setShowClearConfirm(false); // Hide confirmation
     }, []);

    const handleSuggestedActionClick = useCallback((action: SuggestedAction) => {
        console.log("Suggested action clicked:", action);
        switch (action.action_type) {
            case 'send_message':
                if (typeof action.value === 'string') {
                    // Add user message to UI immediately (optional, could just send)
                    // const newUserMessage: Message = { id: generateUniqueId(), sender: 'user', content: [{ type: 'text', text: action.value }], timestamp: Date.now() };
                    // setMessages(prev => [...prev, newUserMessage]);
                    // Send message to backend
                    postMessage({ type: 'sendMessage', content: [{ type: 'text', text: action.value }], modelId: currentModelInput }); // Send as content array
                    setIsStreaming(true); // Assume assistant will respond
                    currentAssistantMessageId.current = null;
                } else {
                    console.warn("Invalid value for send_message action:", action.value);
                }
                break;
            case 'run_tool':
                if (typeof action.value === 'object' && action.value?.toolName && action.value?.args) {
                    // TODO: Need a way to trigger tool execution from frontend?
                    // This might require a new message type like 'executeToolAction'
                    // For now, maybe just log it or send a message indicating the intent
                    console.warn("run_tool action type not fully implemented yet. Payload:", action.value);
                    postMessage({ type: 'logAction', message: `User wants to run tool: ${action.value.toolName}` }); // Example log message
                } else {
                     console.warn("Invalid value for run_tool action:", action.value);
                }
                break;
            case 'fill_input':
                 if (typeof action.value === 'string') {
                     setInputValue(action.value); // Set the main input field value
                 } else {
                     console.warn("Invalid value for fill_input action:", action.value);
                 }
                break;
            default:
                console.warn("Unknown suggested action type:", action.action_type);
        }
        // Optionally clear suggestions after click?
        // setSuggestedActionsMap(prev => ({ ...prev })); // Or remove specific messageId entry
    }, [currentModelInput]); // Include dependencies

    const handleImageFileChange = (event: JSX.TargetedEvent<HTMLInputElement>) => {
        const files = event.currentTarget.files;
        if (files && files.length > 0) {
            const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
            if (imageFiles.length === 0) {
                 setSelectedImages([]); // Clear if no valid images selected
                 if (fileInputRef.current) fileInputRef.current.value = '';
                 return;
            }

            const readPromises = imageFiles.map(file => {
                return new Promise<{ id: string; data: string; mediaType: string; name: string }>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64String = (reader.result as string).split(',')[1];
                        resolve({
                            id: generateUniqueId(), // Add unique ID for key prop and removal
                            data: base64String,
                            mediaType: file.type,
                            name: file.name,
                        });
                    };
                    reader.onerror = (error) => {
                        console.error("Error reading image file:", file.name, error);
                        reject(error); // Reject promise on error
                    };
                    reader.readAsDataURL(file);
                });
            });

            Promise.all(readPromises)
                .then(newImages => {
                    setSelectedImages(prevImages => [...prevImages, ...newImages]); // Append new images
                    console.log(`Added ${newImages.length} images.`);
                })
                .catch(error => {
                    console.error("Error processing selected images:", error);
                    // Optionally show an error message to the user
                })
                .finally(() => {
                     // Reset file input visually after processing is done (success or fail)
                     if (fileInputRef.current) {
                         fileInputRef.current.value = '';
                     }
                });

        } else {
            // If no files selected (e.g., user cancelled), don't clear existing images
            // setSelectedImages([]); // Keep existing images if user cancels
            if (fileInputRef.current) {
                fileInputRef.current.value = ''; // Reset file input visually
            }
        }
    };

    const triggerImageUpload = () => {
        fileInputRef.current?.click();
    };

    // Update remove function to handle array and specific image ID
    const removeSelectedImage = (idToRemove: string) => {
        setSelectedImages(prevImages => prevImages.filter(img => img.id !== idToRemove));
        // No need to reset fileInputRef here as it's already reset after selection
    };

    // --- Rendering Helpers ---
    const renderContentPart = (part: UiMessageContentPart, index: number) => { // Use UiMessageContentPart
        switch (part.type) {
            case 'text':
                // Wrap ReactMarkdown in a div to apply prose styles
                return (
                    <div key={`text-${index}`} className="prose dark:prose-invert prose-sm max-w-none">
                         <ReactMarkdown
                             remarkPlugins={[remarkGfm]}
                             components={{
                                 code({ node, className, children, ...props }) {
                                     const match = /language-(\w+)/.exec(String(className || '')); // Ensure className is a string
                                     const language = match ? match[1] : undefined;
                                     const codeText = String(children).replace(/\n$/, ''); // Get text content

                                     return language ? (
                                         <SyntaxHighlighter
                                             style={vscDarkPlus as any} // Apply the imported style (cast to any to bypass strict type check)
                                             language={language}
                                             PreTag="div"
                                             // @ts-ignore - props might not perfectly match, but it works
                                             {...props}
                                         >
                                             {codeText}
                                         </SyntaxHighlighter>
                                     ) : (
                                         // Render inline code normally (or add custom styling)
                                         <code className={className} {...props}>
                                             {children}
                                         </code>
                                     );
                                 }
                             }}
                         >
                             {part.text}
                         </ReactMarkdown>
                    </div>
                );
            case 'image':
                 // Render image part
                 return (
                     <img
                         key={`image-${index}`}
                         src={`data:${part.mediaType};base64,${part.data}`}
                         alt="User uploaded content"
                         class="max-w-full h-auto rounded my-2" // Basic styling
                     />
                 );
            case 'tool-call':
                let statusText = `[${part.toolName} requested...]`; // Default text
                let statusClass = "bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300"; // Default style

                if (part.status === 'pending') {
                    statusText = `[${part.toolName} pending...]`;
                    statusClass = "bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-100";
                } else if (part.status === 'running') {
                     statusText = `[${part.toolName} ${part.progress ?? ''} running...]`;
                     statusClass = "bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 animate-pulse"; // Add pulse for running
                } else if (part.status === 'complete') {
                    let resultSummary = part.result !== undefined ? JSON.stringify(part.result) : 'Completed';
                    if (resultSummary?.length > 100) resultSummary = resultSummary.substring(0, 97) + '...';
                    statusText = `[${part.toolName} completed. Result: ${resultSummary}]`;
                    statusClass = "bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100";
                } else if (part.status === 'error') {
                    statusText = `[${part.toolName} failed. Error: ${part.result ?? 'Unknown'}]`;
                    statusClass = "bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-100";
                }
                // Render arguments nicely
                const argsString = JSON.stringify(part.args, null, 2); // Pretty print args

                return (
                     <div key={part.toolCallId || `tool-${index}`} class={`tool-call-summary block my-1 p-2 rounded text-xs font-mono ${statusClass}`}>
                         <div>{statusText}</div>
                         <details class="mt-1">
                             <summary class="cursor-pointer text-gray-500 dark:text-gray-400 text-xs">Arguments</summary>
                             <pre class="mt-1 text-xs whitespace-pre-wrap break-words">{argsString}</pre>
                         </details>
                     </div>
                );
            default:
                // Handle potential unknown part types gracefully
                 console.warn("Encountered unknown content part type:", (part as any)?.type);
                return null;
        }
    };

    // --- Main Render ---
    return (
        <Router>
            <div class="app-layout h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                <nav class="navigation flex items-center p-2 bg-gray-200 dark:bg-gray-800 shadow">
                    <Link href="/" class="px-3 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-700 mr-2">Chat</Link>
                    <Link href="/settings" class="px-3 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-700">Settings</Link>
                </nav>
                <main class="content-area flex-1 overflow-y-auto p-4">
                    <Route path="/">
                        <div class="chat-container flex flex-col h-full">
                            {/* Header Controls */}
                            <div class="header-controls p-2 border-b border-gray-300 dark:border-gray-700 flex justify-between items-center">
                                <div class="model-selector flex items-center space-x-2">
                                    <label htmlFor="provider-select" class="text-sm font-medium">Provider:</label>
                                    <select
                                        id="provider-select"
                                        value={selectedProvider ?? ''}
                                        onChange={handleProviderChange}
                                        class="p-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-sm"
                                    >
                                        <option value="">-- Select --</option>
                                        {/* Ensure uniqueProviders are derived correctly using providerId */}
                                        {uniqueProviders.map(providerId => (
                                            <option key={providerId} value={providerId}>{providerId}</option> // Use providerId
                                        ))}
                                    </select>

                                    <label htmlFor="model-input" class="text-sm font-medium">Model:</label>
                                    <input
                                        list="models-datalist"
                                        id="model-input"
                                        name="model-input"
                                        value={currentModelInput}
                                        onInput={handleModelInputChange}
                                        placeholder={selectedProvider ? "Select or type model ID" : "Select provider first"}
                                        disabled={!selectedProvider}
                                        class="p-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-sm flex-1 min-w-40"
                                    />
                                    <datalist id="models-datalist">
                                        {filteredModels.map(model => (
                                            // Use model.name which comes from ModelDefinition
                                            <option key={model.id} value={model.id}>
                                                {model.name} ({model.id}) {/* Use model.name for label */}
                                            </option>
                                        ))}
                                    </datalist>
                                </div>
                                {/* Clear Chat Button */}
                                <button
                                    onClick={handleClearChat}
                                    class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm disabled:opacity-50"
                                    disabled={messages.length === 0 || isStreaming} // Disable if no messages or streaming
                                >
                                    Clear Chat
                                </button>
                                {/* Custom Confirmation Dialog moved outside this div */}
                            </div>
                            {/* Messages Area */}
                            <div class="messages-area flex-1 overflow-y-auto p-4 space-y-4">
                                {messages.map((msg) => (
                                    <div key={msg.id} class={`message flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div class={`message-content p-3 rounded-lg max-w-xs md:max-w-md lg:max-w-lg ${msg.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}>
                                            {/* Render Thinking Process (if assistant and exists) */}
                                            {msg.sender === 'assistant' && msg.thinking && (
                                                <div class="thinking-process mb-2 pb-2 border-b border-gray-300 dark:border-gray-600">
                                                    <div class="prose dark:prose-invert prose-xs max-w-none text-gray-600 dark:text-gray-400 italic">
                                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                            {`Thinking:\n${msg.thinking}`}
                                                        </ReactMarkdown>
                                                    </div>
                                                </div>
                                            )}
                                            {/* Render Main Content Parts */}
                                            {Array.isArray(msg.content) ? msg.content.map(renderContentPart) : null}
                                            {/* Render Suggested Actions (if assistant and exist) */}
                                            {msg.sender === 'assistant' && suggestedActionsMap[msg.id] && (
                                                <div class="suggested-actions mt-2 pt-2 border-t border-gray-300 dark:border-gray-600 flex flex-wrap gap-2">
                                                    {suggestedActionsMap[msg.id].map((action, actionIndex) => (
                                                        <button
                                                            key={actionIndex}
                                                            onClick={() => handleSuggestedActionClick(action)}
                                                            disabled={isStreaming}
                                                            class="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {action.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {/* Remove the separate thinking indicator block */}
                                <div ref={messagesEndRef} />
                            </div>
                            {/* Input Area */}
                            <div class="input-area p-2 border-t border-gray-300 dark:border-gray-700 flex flex-col">
                                {/* Selected Images Preview Area */}
                                {selectedImages.length > 0 && (
                                    <div class="selected-images-preview mb-2 p-2 border border-dashed border-gray-400 dark:border-gray-600 rounded flex flex-wrap gap-2">
                                        {selectedImages.map((img) => (
                                            <div key={img.id} class="relative group">
                                                <img src={`data:${img.mediaType};base64,${img.data}`} alt={img.name} title={img.name} class="w-12 h-12 object-cover rounded" />
                                                <button
                                                    onClick={() => removeSelectedImage(img.id)}
                                                    class="absolute top-0 right-0 -mt-1 -mr-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                                    aria-label={`Remove ${img.name}`}
                                                >
                                                    &times;
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div class="flex items-end"> {/* Changed items-center to items-end */}
                                    {/* Hidden File Input */}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        ref={fileInputRef}
                                        onChange={handleImageFileChange}
                                        multiple // Allow multiple file selection
                                        style={{ display: 'none' }}
                                        id="image-upload-input"
                                    />
                                    {/* Image Upload Button */}
                                    <button
                                        onClick={triggerImageUpload}
                                        disabled={isStreaming || !currentModelInput} // Allow adding more images even if some are selected
                                        title="Attach Image"
                                        class="p-2 mr-2 border rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {/* Simple Paperclip Icon */}
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                        </svg>
                                    </button>
                                    {/* Text Input */}
                                    <textarea
                                        value={inputValue}
                                        onInput={(e) => { // Auto-resize logic and call original handler
                                            const target = e.currentTarget;
                                            target.style.height = 'auto'; // Reset height
                                            target.style.height = `${Math.min(target.scrollHeight, 120)}px`; // Set new height up to max
                                            handleInputChange(e); // Call original handler
                                        }}
                                        onKeyDown={handleKeyDown}
                                        placeholder={selectedImages.length > 0 ? "Add a caption or message..." : "Type your message..."} // Adjust placeholder
                                        rows={1} // Start with 1 row
                                        style={{ minHeight: '40px', maxHeight: '120px' }} // Set min/max height
                                        disabled={isStreaming || !currentModelInput}
                                        class="flex-1 p-2 border rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 resize-none mr-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                    {/* Send Button */}
                                    <button
                                        onClick={handleSend}
                                        disabled={isStreaming || (!inputValue.trim() && selectedImages.length === 0) || !currentModelInput} // Disable if no text AND no images
                                        class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed self-end" // Align button to bottom
                                    >
                                        Send
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Route>
                    <Route path="/settings">
                        <SettingPage
                            providerStatus={providerStatus}
                            onProviderToggle={handleProviderToggle}
                        />
                    </Route>
                </main>
                {/* Custom Confirmation Dialog - Moved here */}
                {showClearConfirm && (
                    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-sm mx-auto">
                            <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Confirm Clear History</h3>
                            <p class="mb-6 text-gray-700 dark:text-gray-300">Are you sure you want to clear the chat history? This cannot be undone.</p>
                            <div class="flex justify-end space-x-3">
                                <button onClick={cancelClearChat} class="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-400 dark:hover:bg-gray-500">
                                    Cancel
                                </button>
                                <button onClick={confirmClearChat} class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                                    Confirm Clear
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Router>
    );
}
