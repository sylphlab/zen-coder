import { useEffect } from 'preact/hooks';
import { useSetAtom } from 'jotai';
import { useLocation } from "wouter"; // Import useLocation
import {
    chatSessionsAtom,
    activeChatIdAtom,
    isStreamingAtom,
    suggestedActionsMapAtom,
    allToolsStatusAtom,
    mcpServerStatusAtom,
    // providerStatusAtom, // Remove import of the read-only atom
    refreshProviderStatusAtom, // Import the refresh trigger atom
    isChatListLoadingAtom, // Import the chat list loading atom
    // Import other atoms that need updating via messages
    // Example: globalInstructionsAtom, projectInstructionsAtom (if they become atoms)
} from '../store/atoms';
import {
    ChatSession,
    SuggestedAction,
    UiMessage,
    AllToolsStatusPayload,
    McpConfiguredStatusPayload,
    LoadChatStatePayload,
    AppendMessageChunkPayload,
    StartAssistantMessagePayload,
    UpdateSuggestedActionsPayload,
    ProviderInfoAndStatus, // Import ProviderInfoAndStatus type
    // Import other payload types if needed
} from '../../../src/common/types';

export function MessageHandlerComponent() {
    const setChatSessions = useSetAtom(chatSessionsAtom);
    const setActiveChatId = useSetAtom(activeChatIdAtom);
    const setIsStreaming = useSetAtom(isStreamingAtom);
    const setSuggestedActionsMap = useSetAtom(suggestedActionsMapAtom);
    // Remove setters for read-only async atoms - they update via refetch/push
    // const setAllToolsStatus = useSetAtom(allToolsStatusAtom);
    // const setMcpServerStatus = useSetAtom(mcpServerStatusAtom);
    // const setProviderStatus = useSetAtom(providerStatusAtom); // Remove setter for read-only atom
    const refreshProviderStatus = useSetAtom(refreshProviderStatusAtom); // Add setter for the refresh trigger
    const setIsChatListLoading = useSetAtom(isChatListLoadingAtom); // Add setter for chat list loading
    const [, setLocation] = useLocation(); // Get setLocation from wouter
    // Add setters for other atoms here

    useEffect(() => {
        console.log("[MessageHandlerComponent] Setting up message listener...");

        const handleMessage = (event: MessageEvent) => {
            const message = event.data;

            // Ignore responseData messages, handled globally in main.tsx
            if (message.type === 'responseData') {
                return;
            }

            console.log("[MessageHandlerComponent] Processing message:", message.type, message.payload);

            try {
                switch (message.type) {
                    case 'loadChatState':
                        const loadPayload = message.payload as LoadChatStatePayload;
                        setChatSessions(loadPayload.chats ?? []);
                        setActiveChatId(loadPayload.lastActiveChatId ?? null);
                        setIsChatListLoading(false); // Reset loading state
                        // Navigate to last location or default
                        const targetLocation = loadPayload.lastLocation ?? (loadPayload.lastActiveChatId ? '/index.html' : '/chats');
                        console.log(`[MessageHandlerComponent] Navigating to last location: ${targetLocation}`);
                        setLocation(targetLocation);
                        break;

                    case 'startAssistantMessage':
                        const startPayload = message.payload as StartAssistantMessagePayload;
                        setChatSessions(prevSessions => {
                            const sessionIndex = prevSessions.findIndex(s => s.id === startPayload.chatId);
                            if (sessionIndex === -1) return prevSessions;
                            const newSessions = [...prevSessions];
                            const newHistory = [...newSessions[sessionIndex].history];
                            // Add an empty assistant message frame
                            newHistory.push({
                                id: startPayload.messageId,
                                role: 'assistant', // Ensure role is set
                                content: [], // Start with empty content array
                                timestamp: Date.now() // Add timestamp
                            });
                            newSessions[sessionIndex] = { ...newSessions[sessionIndex], history: newHistory };
                            return newSessions;
                        });
                        setIsStreaming(true);
                        break;

                    case 'appendMessageChunk':
                        const appendPayload = message.payload as AppendMessageChunkPayload;
                        setChatSessions(prevSessions => {
                            const sessionIndex = prevSessions.findIndex(s => s.id === appendPayload.chatId);
                            if (sessionIndex === -1) return prevSessions; // Chat not found

                            const newSessions = [...prevSessions];
                            const sessionToUpdate = { ...newSessions[sessionIndex] };
                            const history = [...sessionToUpdate.history];
                            const messageIndex = history.findIndex(m => m.id === appendPayload.messageId);

                            if (messageIndex === -1) {
                                console.warn(`[MessageHandlerComponent] Message ID ${appendPayload.messageId} not found in chat ${appendPayload.chatId} for appendMessageChunk.`);
                                return prevSessions; // Message not found
                            }

                            const messageToUpdate = { ...history[messageIndex] };

                            // Ensure content is always an array
                            if (!Array.isArray(messageToUpdate.content)) {
                                console.warn(`[MessageHandlerComponent] Message content for ${appendPayload.messageId} is not an array. Resetting.`);
                                messageToUpdate.content = [];
                            }

                            let content = [...messageToUpdate.content]; // Clone content array

                            // Find the last text part or create one if none exists/last part isn't text
                            let lastTextPartIndex = -1;
                            if (content.length > 0 && content[content.length - 1].type === 'text') {
                                lastTextPartIndex = content.length - 1;
                            }

                            if (lastTextPartIndex !== -1) {
                                // Append to existing text part, ensuring it's a text part
                                const partToUpdate = content[lastTextPartIndex];
                                if (partToUpdate.type === 'text') {
                                    const updatedPart = { ...partToUpdate }; // Clone the part
                                    updatedPart.text += appendPayload.textChunk;
                                    content[lastTextPartIndex] = updatedPart; // Replace with cloned+updated part
                                } else {
                                    // Last part wasn't text, add new text part
                                    content.push({ type: 'text', text: appendPayload.textChunk });
                                }
                            } else {
                                // Add new text part
                                content.push({ type: 'text', text: appendPayload.textChunk });
                            }

                            messageToUpdate.content = content; // Assign the new content array
                            history[messageIndex] = messageToUpdate; // Replace with cloned+updated message
                            sessionToUpdate.history = history; // Assign the new history array
                            newSessions[sessionIndex] = sessionToUpdate; // Replace with cloned+updated session

                            return newSessions;
                        });
                        break;

                    case 'streamFinished':
                        setIsStreaming(false);
                        // Optionally reconcile final message state here if needed,
                        // though backend might handle final history update separately.
                        break;

                    case 'updateSuggestedActions':
                        const suggestPayload = message.payload as UpdateSuggestedActionsPayload;
                        setSuggestedActionsMap(prevMap => ({
                            ...prevMap,
                            [suggestPayload.messageId]: suggestPayload.actions
                        }));
                        break;

                    case 'updateAllToolsStatus':
                        // No longer set atom directly here
                        // setAllToolsStatus(message.payload as AllToolsStatusPayload);
                        console.log("[MessageHandlerComponent] Received updateAllToolsStatus (atom updates via refetch/push)");
                        break;

                    case 'updateMcpConfiguredStatus':
                        // No longer set atom directly here
                        // setMcpServerStatus(message.payload as McpConfiguredStatusPayload);
                        console.log("[MessageHandlerComponent] Received updateMcpConfiguredStatus (atom updates via refetch/push)");
                        break;

                    case 'pushUpdateProviderStatus':
                        console.log("[MessageHandlerComponent] Received pushUpdateProviderStatus, triggering refresh.");
                        refreshProviderStatus(); // Trigger the refresh atom
                        break;

                    // Add cases for other messages that update Jotai state
                    // case 'updateCustomInstructions':
                    //     // Update custom instruction atoms if they exist
                    //     break;

                    default:
                        // console.log(`[MessageHandlerComponent] Unhandled message type: ${message.type}`);
                        break;
                }
            } catch (error) {
                 console.error(`[MessageHandlerComponent] Error processing message type ${message.type}:`, error, "Payload:", message.payload);
            }
        };

        window.addEventListener('message', handleMessage);

        // Cleanup listener on unmount
        return () => {
            console.log("[MessageHandlerComponent] Removing message listener.");
            window.removeEventListener('message', handleMessage);
        };
    }, [setChatSessions, setActiveChatId, setIsStreaming, setSuggestedActionsMap, refreshProviderStatus, setIsChatListLoading, setLocation]); // Add setLocation to dependencies

    // This component doesn't render anything itself
    return null;
}