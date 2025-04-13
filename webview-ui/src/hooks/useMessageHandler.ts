import { useEffect, useRef } from 'preact/hooks';
import { Dispatch, SetStateAction } from 'react';
// Import necessary types from common/types.ts
import { UiMessage, SuggestedAction, UiToolCallPart, ChatSession, UiMessageContentPart } from '../../../src/common/types';
import { generateUniqueId } from '../app'; // Assuming helpers are exported

// Define an internal type for UI messages that might include transient state like 'thinking'
interface InternalUiMessage extends UiMessage {
    thinking?: string;
}

// Define the hook's return type if needed, or let TypeScript infer it
// For simplicity, we'll let it infer for now.

// Use Dispatch<SetStateAction<T>> for state setters type
export function useMessageHandler(
    // --- Updated Parameters ---
    activeChatId: string | null, // Pass the current active chat ID
    setChatSessions: Dispatch<SetStateAction<ChatSession[]>>,
    setActiveChatId: Dispatch<SetStateAction<string | null>>, // Add setter for activeChatId
    setIsStreaming: Dispatch<SetStateAction<boolean>>,
    setSuggestedActionsMap: Dispatch<SetStateAction<Record<string, SuggestedAction[]>>>,
    setLocation: (path: string, options?: { replace?: boolean }) => void
) {
    const currentAssistantMessageId = useRef<string | null>(null); // Keep track of the message being streamed

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            console.log("Chat UI received message:", message.type, message.payload); // Log payload too

            switch (message.type) {
                case 'addMessage': // Simple text message from assistant (e.g., errors) - Update to use chatSessions
                    if (activeChatId) {
                        setChatSessions(prevSessions =>
                            prevSessions.map(session =>
                                session.id === activeChatId
                                    ? { ...session, history: [...session.history, { id: generateUniqueId(), sender: message.sender, content: [{ type: 'text', text: message.text }], timestamp: Date.now() }] }
                                    : session
                            )
                        );
                    } else {
                        console.warn("Received addMessage but no active chat ID.");
                        // Optionally handle this case, e.g., add to a default/new chat?
                    }
                    setIsStreaming(false);
                    currentAssistantMessageId.current = null;
                    break;
                case 'startAssistantMessage': // Signal to start a new assistant message block
                    setIsStreaming(true);
                    if (message.messageId && activeChatId) {
                        const newAssistantMessageId = message.messageId;
                        currentAssistantMessageId.current = newAssistantMessageId;
                        console.log(`[MessageHandler] Set currentAssistantMessageId to: ${newAssistantMessageId} for active chat ${activeChatId}`);
                        setChatSessions(prevSessions =>
                            prevSessions.map(session => {
                                if (session.id === activeChatId) {
                                    // Check if message already exists (e.g., due to retry/reload)
                                    if (session.history.some(msg => msg.id === newAssistantMessageId)) {
                                        console.warn(`[MessageHandler] Message ${newAssistantMessageId} already exists in chat ${activeChatId}. Ignoring startAssistantMessage.`);
                                        return session;
                                    }
                                    return {
                                        ...session,
                                        history: [
                                            ...session.history,
                                            {
                                                id: newAssistantMessageId,
                                                sender: 'assistant',
                                                content: [], // Start with empty content
                                                timestamp: Date.now(),
                                            }
                                        ]
                                    };
                                }
                                return session;
                            })
                        );
                    } else {
                        if (!activeChatId) console.error("[MessageHandler] startAssistantMessage received but no active chat ID!");
                        if (!message.messageId) console.error("[MessageHandler] startAssistantMessage received without a messageId in payload!");
                        currentAssistantMessageId.current = null; // Reset if ID or active chat is missing
                    }
                     break;
                case 'appendMessageChunk': // Append text chunk to the current assistant message
                    if (currentAssistantMessageId.current && activeChatId) {
                        // console.log("Received textDelta:", JSON.stringify(message.textDelta)); // Too verbose
                        setChatSessions(prevSessions =>
                            prevSessions.map(session => {
                                if (session.id !== activeChatId) return session;

                                return {
                                    ...session,
                                    history: session.history.map(msg => {
                                        if (msg.id !== currentAssistantMessageId.current) return msg;

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
                                    })
                                };
                            })
                        );
                    } else {
                         console.warn("appendMessageChunk received but no current assistant message ID is set.");
                    }
                    break;
                 case 'addToolCall': // Add a tool call visual placeholder
                    if (currentAssistantMessageId.current && message.payload && activeChatId) {
                        setChatSessions(prevSessions =>
                            prevSessions.map(session => {
                                if (session.id !== activeChatId) return session;
                                return {
                                    ...session,
                                    history: session.history.map(msg => {
                                        if (msg.id === currentAssistantMessageId.current) {
                                            const contentArray = Array.isArray(msg.content) ? msg.content : [];
                                            // Avoid adding duplicate tool calls if message is reprocessed
                                            if (!contentArray.some(part => part.type === 'tool-call' && part.toolCallId === message.payload.toolCallId)) {
                                                return { ...msg, content: [...contentArray, { type: 'tool-call', ...message.payload, status: 'pending' }] };
                                            }
                                        }
                                        return msg;
                                    })
                                };
                            })
                        );
                     } else {
                          console.warn("addToolCall received but no current assistant message ID or payload.");
                     }
                     break;
                 case 'toolStatusUpdate': // Update the status/result of a specific tool call
                    if (message.toolCallId && activeChatId) {
                        setChatSessions(prevSessions =>
                            prevSessions.map(session => {
                                if (session.id !== activeChatId) return session;
                                return {
                                    ...session,
                                    history: session.history.map(msg => {
                                        if (msg.sender === 'assistant' && Array.isArray(msg.content)) {
                                            const toolCallIndex = msg.content.findIndex((part): part is UiToolCallPart => part.type === 'tool-call' && part.toolCallId === message.toolCallId);
                                            if (toolCallIndex !== -1) {
                                                const updatedContent = [...msg.content];
                                                const toolCallPart = updatedContent[toolCallIndex] as UiToolCallPart;
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
                                    })
                                };
                            })
                        );
                     }
                     break;
                case 'showSettings': // Handle command from extension to show settings page
                    setLocation('/settings');
                    break;
                // --- New Handler for loadChatState ---
                case 'loadChatState':
                    if (message.payload && Array.isArray(message.payload.chats)) {
                        console.log(`[MessageHandler] Loading ${message.payload.chats.length} chats. Setting active: ${message.payload.lastActiveChatId}`);
                        setChatSessions(message.payload.chats);
                        setActiveChatId(message.payload.lastActiveChatId);

                        // Determine streaming state based on the *loaded active* chat
                        const loadedActiveChat = message.payload.chats.find((c: ChatSession) => c.id === message.payload.lastActiveChatId);
                        if (loadedActiveChat) {
                            const lastMessage = loadedActiveChat.history[loadedActiveChat.history.length - 1];
                            if (lastMessage && lastMessage.sender === 'assistant') {
                                const isLikelyIncomplete = Array.isArray(lastMessage.content) &&
                                    lastMessage.content.length > 0 &&
                                    lastMessage.content.every((part: any) => part.type === 'tool-call' && (part.status === 'pending' || part.status === 'running'));

                                if (isLikelyIncomplete) {
                                    console.log("[MessageHandler] Last message in active chat seems incomplete, setting streaming true.");
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
                        } else {
                             // No active chat loaded or found
                             setIsStreaming(false);
                             currentAssistantMessageId.current = null;
                        }
                    } else {
                        console.warn("[MessageHandler] Received loadChatState with invalid payload:", message.payload);
                    }
                    break;
                // --- End loadChatState Handler ---
                case 'streamFinished': // Handle explicit stream end signal
                    console.log("Stream finished signal received.");
                    setIsStreaming(false);
                    const finishedMsgId = currentAssistantMessageId.current; // Capture before resetting
                    currentAssistantMessageId.current = null;
                    // Clear thinking text from the specific message when stream finishes
                    // Clear thinking text from the specific message in the active chat
                    if (finishedMsgId && activeChatId) {
                        setChatSessions(prevSessions =>
                            prevSessions.map(session => {
                                if (session.id !== activeChatId) return session;
                                return {
                                    ...session,
                                    history: session.history.map((msg: InternalUiMessage) => { // Use InternalUiMessage type here
                                        if (msg.id === finishedMsgId) {
                                            // Create a new object without the thinking property
                                            const { thinking, ...rest } = msg; // Now 'thinking' is recognized
                                            return rest as UiMessage; // Cast back to base type for storage if needed
                                        }
                                        return msg;
                                    })
                                };
                            })
                        );
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
                    if (message.textDelta && currentAssistantMessageId.current && activeChatId) {
                        setChatSessions(prevSessions =>
                            prevSessions.map(session => {
                                if (session.id !== activeChatId) return session;
                                return {
                                    ...session,
                                    history: session.history.map((msg: InternalUiMessage) => { // Use InternalUiMessage type here
                                        if (msg.id === currentAssistantMessageId.current) {
                                            const currentThinking = msg.thinking ?? ''; // Access thinking directly
                                            const newThinking = currentThinking + message.textDelta;
                                            // console.log(`[MessageHandler] Updating thinking for message ${msg.id}:`, newThinking); // Too verbose
                                            return { ...msg, thinking: newThinking };
                                        }
                                        return msg;
                                    })
                                };
                            })
                        );
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
    }, [activeChatId, setChatSessions, setActiveChatId, setIsStreaming, setSuggestedActionsMap, setLocation]); // Add activeChatId and new setters to dependencies

    // The hook itself doesn't need to return anything if it just sets up listeners
}