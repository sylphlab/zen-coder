import { useEffect, useRef } from 'preact/hooks';
import { Dispatch, SetStateAction } from 'react'; // Try importing types from react
import { Message, SuggestedAction, UiToolCallPart } from '../app'; // Assuming types are exported from app.tsx or a common types file
import { generateUniqueId, postMessage } from '../app'; // Assuming helpers are exported

// Define the hook's return type if needed, or let TypeScript infer it
// For simplicity, we'll let it infer for now.

// Use Dispatch<SetStateAction<T>> for state setters type
export function useMessageHandler(
    setMessages: Dispatch<SetStateAction<Message[]>>,
    setIsStreaming: Dispatch<SetStateAction<boolean>>,
    setSuggestedActionsMap: Dispatch<SetStateAction<Record<string, SuggestedAction[]>>>,
    setLocation: (path: string, options?: { replace?: boolean }) => void // Type from wouter might be more specific
) {
    const currentAssistantMessageId = useRef<string | null>(null); // Keep track of the message being streamed

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            console.log("Chat UI received message:", message.type, message.payload); // Log payload too

            switch (message.type) {
                case 'addMessage': // Simple text message from assistant (e.g., errors)
                    setMessages((prev: Message[]) => [...prev, { id: generateUniqueId(), sender: message.sender, content: [{ type: 'text', text: message.text }], timestamp: Date.now() }]);
                    setIsStreaming(false);
                    currentAssistantMessageId.current = null;
                    break;
                case 'startAssistantMessage': // Signal to start a new assistant message block
                     setIsStreaming(true);
                     if (message.messageId) {
                         const newAssistantMessageId = message.messageId;
                         currentAssistantMessageId.current = newAssistantMessageId;
                         console.log(`Set currentAssistantMessageId to: ${newAssistantMessageId}`);
                         setMessages((prev: Message[]) => [
                             ...prev,
                             {
                                 id: newAssistantMessageId,
                                 sender: 'assistant',
                                 content: [], // Start with empty content
                                 timestamp: Date.now(),
                             }
                         ]);
                     } else {
                         console.error("startAssistantMessage received without a messageId in payload!");
                         currentAssistantMessageId.current = null; // Reset if ID is missing
                     }
                     break;
                case 'appendMessageChunk': // Append text chunk to the current assistant message
                    if (currentAssistantMessageId.current) {
                        console.log("Received textDelta:", JSON.stringify(message.textDelta));
                        setMessages((prevMessages: Message[]) => {
                            return prevMessages.map((msg: Message) => {
                                if (msg.id !== currentAssistantMessageId.current) {
                                    return msg;
                                }
                                const currentContent = Array.isArray(msg.content) ? msg.content : [];
                                const newContent = [...currentContent];
                                const lastContentPartIndex = newContent.length - 1;
                                const lastContentPart = newContent[lastContentPartIndex];
                                if (lastContentPart?.type === 'text') {
                                    newContent[lastContentPartIndex] = {
                                        ...lastContentPart,
                                        text: lastContentPart.text + message.textDelta
                                    };
                                } else {
                                    newContent.push({ type: 'text', text: message.textDelta });
                                }
                                return { ...msg, content: newContent };
                            });
                        });
                    } else {
                         console.warn("appendMessageChunk received but no current assistant message ID is set.");
                    }
                    break;
                 case 'addToolCall': // Add a tool call visual placeholder
                     if (currentAssistantMessageId.current && message.payload) {
                         setMessages((prev: Message[]) => prev.map((msg: Message) => {
                             if (msg.id === currentAssistantMessageId.current) {
                                 const contentArray = Array.isArray(msg.content) ? msg.content : [];
                                 return { ...msg, content: [...contentArray, { type: 'tool-call', ...message.payload, status: 'pending' }] };
                             }
                             return msg;
                         }));
                     } else {
                          console.warn("addToolCall received but no current assistant message ID or payload.");
                     }
                     break;
                 case 'toolStatusUpdate': // Update the status/result of a specific tool call
                     if (message.toolCallId) {
                         setMessages((prev: Message[]) => prev.map((msg: Message) => {
                             if (msg.sender === 'assistant' && Array.isArray(msg.content)) {
                                 // Add type assertion for part in findIndex
                                 const toolCallIndex = msg.content.findIndex((part): part is UiToolCallPart => part.type === 'tool-call' && part.toolCallId === message.toolCallId);
                                 if (toolCallIndex !== -1) {
                                     const updatedContent = [...msg.content];
                                     const toolCallPart = updatedContent[toolCallIndex] as UiToolCallPart; // Use specific type
                                     updatedContent[toolCallIndex] = {
                                         ...toolCallPart,
                                         status: message.status ?? toolCallPart.status,
                                         result: (message.status === 'complete' || message.status === 'error') ? (message.message ?? toolCallPart.result) : toolCallPart.result,
                                         progress: message.status === 'running' ? (message.message ?? toolCallPart.progress) : undefined
                                     };
                                     return { ...msg, content: updatedContent };
                                 }
                             }
                             return msg;
                         }));
                     }
                     break;
                case 'showSettings': // Handle command from extension to show settings page
                    setLocation('/settings');
                    break;
                case 'loadUiHistory': // Renamed message type - Directly use the payload
                    if (Array.isArray(message.payload)) {
                        console.log(`Loading ${message.payload.length} messages from UI history.`);
                        setMessages(message.payload as Message[]); // Assume payload matches Message[]
                        const lastMessage = message.payload[message.payload.length - 1];
                        if (lastMessage && lastMessage.sender === 'assistant') {
                            const isLikelyIncomplete = Array.isArray(lastMessage.content) &&
                                lastMessage.content.length > 0 &&
                                lastMessage.content.every((part: any) => part.type === 'tool-call' && (part.status === 'pending' || part.status === 'running'));
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
                    const finishedMsgId = currentAssistantMessageId.current; // Capture before resetting
                    currentAssistantMessageId.current = null;
                    // Clear thinking text from the specific message when stream finishes
                    if (finishedMsgId) {
                        setMessages((prev: Message[]) => prev.map((msg: Message) => {
                            if (msg.id === finishedMsgId) {
                                return { ...msg, thinking: undefined }; // Remove thinking text
                            }
                            return msg;
                        }));
                    }
                    break;
                case 'addSuggestedActions': // Handle suggested actions from backend
                    if (message.payload && message.payload.messageId && Array.isArray(message.payload.actions)) {
                        console.log(`Adding suggested actions for message ${message.payload.messageId}`, message.payload.actions);
                        setSuggestedActionsMap((prev: Record<string, SuggestedAction[]>) => ({
                            ...prev,
                            [message.payload.messageId]: message.payload.actions
                        }));
                    } else {
                        console.warn("Received addSuggestedActions with invalid payload:", message.payload);
                    }
                    break;
                case 'appendThinkingChunk': // Handle thinking process chunks for the current message
                    console.log("[useMessageHandler] Received appendThinkingChunk:", message.textDelta);
                    if (message.textDelta && currentAssistantMessageId.current) {
                        setMessages((prev: Message[]) => prev.map((msg: Message) => {
                            if (msg.id === currentAssistantMessageId.current) {
                                const currentThinking = msg.thinking ?? '';
                                const newThinking = currentThinking + message.textDelta;
                                console.log(`[useMessageHandler] Updating thinking for message ${msg.id}:`, newThinking);
                                return { ...msg, thinking: newThinking };
                            }
                            return msg;
                        }));
                    }
                    break;
                // Note: 'availableModels' and 'providerStatus' are handled directly in App component's useEffect
                // 'updateMcpServers' is also handled directly in App component
            }
        };

        window.addEventListener('message', handleMessage);

        // Request initial state when component mounts (moved outside hook, called in App)
        // postMessage({ type: 'webviewReady' });

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, [setMessages, setIsStreaming, setSuggestedActionsMap, setLocation]); // Dependencies for the hook

    // The hook itself doesn't need to return anything if it just sets up listeners
}