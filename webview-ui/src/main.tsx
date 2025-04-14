import { render } from 'preact';
import { Suspense } from 'preact/compat';
import { Provider, getDefaultStore } from 'jotai'; // Import getDefaultStore
import { handleResponse as handleRequestManagerResponse } from './utils/requestManager'; // Import response handler
import {
    // Import ALL atoms that might be updated by messages
    chatSessionsAtom,
    activeChatIdAtom,
    isStreamingAtom,
    suggestedActionsMapAtom,
    // providerStatusAtom, // Read-only async atom
    refreshProviderStatusAtom, // Keep refresh trigger
    // allToolsStatusAtom, // Read-only async atom
    // mcpServerStatusAtom, // Read-only async atom
    isChatListLoadingAtom,
    // availableProvidersAtom, // Async
    // defaultConfigAtom, // Async
} from './store/atoms';
import {
    // Import ALL relevant payload types
    LoadChatStatePayload,
    StartAssistantMessagePayload,
    AppendMessageChunkPayload,
    UpdateSuggestedActionsPayload,
    ProviderInfoAndStatus, // Needed for pushUpdateProviderStatus payload type hint
    // AllToolsStatusPayload, // Not directly set here
    // McpConfiguredStatusPayload, // Not directly set here
    // DefaultChatConfig, // Not directly set here
    UiMessage, // Needed for appendMessageChunk logic
    UiTextMessagePart, // Needed for appendMessageChunk logic
} from '../../src/common/types';
import 'virtual:uno.css';
import '@unocss/reset/tailwind.css';
import './index.css';
import { App } from './app.tsx';
// Removed: import { MessageHandlerComponent } from './components/MessageHandlerComponent';

const store = getDefaultStore(); // Get the default Jotai store instance

console.log("[main.tsx] Setting up unified global message listener...");

window.addEventListener('message', (event: MessageEvent) => {
    const message = event.data;
    // --- Basic Type Check ---
     if (!message || typeof message.type !== 'string') {
         console.warn("[Global Listener] Received message without a valid type:", message);
         return;
     }
    console.log("[Global Listener] Processing message:", message.type);
    // --- End Basic Type Check ---

    try {
        if (message.type === 'responseData') {
            // Handle responses for requests initiated by requestData
            handleRequestManagerResponse(message);
        } else {
            // Handle all other push messages directly here by updating atoms
            switch (message.type) {
                case 'loadChatState': // Still needed if backend pushes this after create/delete chat
                    const loadPayload = message.payload as LoadChatStatePayload;
                    store.set(chatSessionsAtom, loadPayload.chats ?? []);
                    store.set(activeChatIdAtom, loadPayload.lastActiveChatId ?? null);
                    store.set(isChatListLoadingAtom, false); // Reset loading state
                    // TODO: Handle navigation based on lastLocation if needed
                    break;

                case 'startAssistantMessage':
                    const startPayload = message.payload as StartAssistantMessagePayload;
                    store.set(chatSessionsAtom, prevSessions => {
                        const sessionIndex = prevSessions.findIndex(s => s.id === startPayload.chatId);
                        if (sessionIndex === -1) return prevSessions;
                        const newSessions = [...prevSessions];
                        const sessionToUpdate = { ...newSessions[sessionIndex] }; // Clone session
                        const newHistory = [...sessionToUpdate.history]; // Clone history
                        // Add an empty assistant message frame
                        newHistory.push({
                            id: startPayload.messageId,
                            role: 'assistant',
                            content: [], // Start with empty content array
                            timestamp: Date.now() // Add timestamp
                        });
                        sessionToUpdate.history = newHistory; // Assign new history
                        sessionToUpdate.lastModified = Date.now(); // Update timestamp
                        newSessions[sessionIndex] = sessionToUpdate; // Assign new session
                        return newSessions;
                    });
                    store.set(isStreamingAtom, true);
                    break;

                case 'appendMessageChunk':
                    const appendPayload = message.payload as AppendMessageChunkPayload;
                    store.set(chatSessionsAtom, prevSessions => {
                        const sessionIndex = prevSessions.findIndex(s => s.id === appendPayload.chatId);
                        if (sessionIndex === -1) return prevSessions; // Chat not found

                        const newSessions = [...prevSessions];
                        const sessionToUpdate = { ...newSessions[sessionIndex] }; // Clone session
                        const history = [...sessionToUpdate.history]; // Clone history
                        const messageIndex = history.findIndex(m => m.id === appendPayload.messageId);

                        if (messageIndex === -1) {
                            console.warn(`[Global Listener] Message ID ${appendPayload.messageId} not found in chat ${appendPayload.chatId} for appendMessageChunk.`);
                            return prevSessions; // Message not found
                        }

                        const messageToUpdate = { ...history[messageIndex] }; // Clone message
                        // Ensure content is always an array
                        if (!Array.isArray(messageToUpdate.content)) {
                            console.warn(`[Global Listener] Message content for ${appendPayload.messageId} is not an array. Resetting.`);
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
                            const partToUpdate = { ...content[lastTextPartIndex] } as UiTextMessagePart; // Clone the part and assert type
                            if (partToUpdate.type === 'text') {
                                partToUpdate.text += appendPayload.textChunk;
                                content[lastTextPartIndex] = partToUpdate; // Replace with cloned+updated part
                            } else {
                                // Should not happen based on the check above, but as fallback:
                                content.push({ type: 'text', text: appendPayload.textChunk });
                            }
                        } else {
                            // Add new text part
                            content.push({ type: 'text', text: appendPayload.textChunk });
                        }

                        messageToUpdate.content = content; // Assign the new content array
                        history[messageIndex] = messageToUpdate; // Replace with cloned+updated message
                        sessionToUpdate.history = history; // Assign the new history array
                        sessionToUpdate.lastModified = Date.now(); // Update timestamp
                        newSessions[sessionIndex] = sessionToUpdate; // Replace with cloned+updated session

                        return newSessions;
                    });
                    break;

                case 'streamFinished':
                    store.set(isStreamingAtom, false);
                    break;

                case 'updateSuggestedActions':
                    const suggestPayload = message.payload as UpdateSuggestedActionsPayload;
                    store.set(suggestedActionsMapAtom, prevMap => ({
                        ...prevMap,
                        [suggestPayload.messageId]: suggestPayload.actions
                    }));
                    break;

                // Removed case 'pushUpdateProviderStatus' - Updates handled by Jotai atom refetch/subscription

                // Cases for updateMcpConfiguredStatus and updateAllToolsStatus are removed
                // because their corresponding atoms are async and should update via requestManager/refetch

                case 'mcpConfigReloaded':
                    console.log('[Global Listener] Received mcpConfigReloaded, triggering atom refetch.');
                    // Trigger refetch of atoms that depend on MCP config
                    // store.set(refreshMcpStatusAtom); // Implement refresh atom if needed
                    // store.set(refreshAllToolsStatusAtom); // Implement refresh atom if needed
                    break;

                // Add other message type handlers here...

                default:
                    console.log(`[Global Listener] Unhandled push message type: ${message.type}`);
                    break;
            }
        }
    } catch (error) {
        console.error(`[Global Listener] Error processing message type ${message?.type}:`, error, "Payload:", message?.payload);
    }
});

// --- Render App ---

render(
    <Provider store={store}> {/* Pass the store instance */}
        {/* Suspense remains necessary for async atoms within App */}
        <Suspense fallback={<div class="flex justify-center items-center h-screen">Loading App...</div>}>
            {/* Removed MessageHandlerComponent rendering */}
            <App />
        </Suspense>
    </Provider>,
    document.getElementById('root')!
);
