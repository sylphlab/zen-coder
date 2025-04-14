import { render } from 'preact';
import { Suspense } from 'preact/compat';
import { Provider, getDefaultStore } from 'jotai'; // Import getDefaultStore
import { handleResponse as handleCommunicationResponse } from './utils/communication'; // Re-import handleResponse
import {
    // Import ALL atoms that might be updated by messages
    chatSessionsAtom,
    isStreamingAtom,
    providerStatusAtom, // Import the actual atom
    allToolsStatusAtom, // Import the actual atom
    mcpServerStatusAtom, // Import the actual atom
    defaultConfigAtom, // Import the actual atom
    customInstructionsAtom, // Import the actual atom
} from './store/atoms';
import {
    ProviderInfoAndStatus,
    ChatSession, // Add ChatSession import
    AllToolsStatusInfo,
    McpConfiguredStatusPayload,
    DefaultChatConfig,
} from '../../src/common/types'; // Corrected relative path
import 'virtual:uno.css';
import '@unocss/reset/tailwind.css';
import './index.css';
import { App } from './app.tsx';
// Removed: import { MessageHandlerComponent } from './components/MessageHandlerComponent';

const store = getDefaultStore(); // Get the default Jotai store instance

console.log("[main.tsx] Initializing application...");

// Add a global listener to handle ALL messages from the extension host
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
            handleCommunicationResponse(message); // Use the handler from communication.ts
        } else {
            // Handle push messages (primarily Pub/Sub updates)
            switch (message.type) {
                case 'pushUpdate':
                    const updatePayload = message.payload as { topic: string; data: any };
                    console.log(`[Global Listener] Received pushUpdate for topic: ${updatePayload.topic}`);
                    switch (updatePayload.topic) {
                        case 'providerStatus':
                            console.log('[Global Listener] Setting providerStatusAtom directly.');
                            store.set(providerStatusAtom, updatePayload.data as ProviderInfoAndStatus[] | null);
                            break;
                        case 'mcpStatus':
                            console.log('[Global Listener] Setting mcpServerStatusAtom directly.');
                            store.set(mcpServerStatusAtom, updatePayload.data as McpConfiguredStatusPayload | null);
                            break;
                        case 'allToolsStatus':
                            console.log('[Global Listener] Setting allToolsStatusAtom directly.');
                            store.set(allToolsStatusAtom, updatePayload.data as AllToolsStatusInfo | null);
                            break;
                        case 'defaultConfig':
                            console.log('[Global Listener] Setting defaultConfigAtom directly.');
                            store.set(defaultConfigAtom, updatePayload.data as DefaultChatConfig | null);
                            break;
                        case 'customInstructions':
                            console.log('[Global Listener] Setting customInstructionsAtom directly.');
                            store.set(customInstructionsAtom, updatePayload.data as { global: string; project: string | null; projectPath: string | null } | null);
                            break;
                        case 'chatUpdate': // Handles updates to a specific chat session (e.g., history changes from streaming)
                            console.log('[Global Listener] Setting chatSessionsAtom via chatUpdate.');
                            const updatedSession = updatePayload.data as ChatSession;
                            if (updatedSession?.id) {
                                store.set(chatSessionsAtom, prevSessions => {
                                    const index = prevSessions.findIndex(s => s.id === updatedSession.id);
                                    if (index !== -1) {
                                        const newSessions = [...prevSessions];
                                        newSessions[index] = updatedSession;
                                        return newSessions;
                                    }
                                    console.warn(`[Global Listener] Received chatUpdate for unknown session ID: ${updatedSession.id}`);
                                    return prevSessions;
                                });
                            } else {
                                console.warn('[Global Listener] Received chatUpdate without valid session data.');
                            }
                            break;
                         case 'streamingStatusUpdate': // Handles streaming status updates
                             console.log('[Global Listener] Setting isStreamingAtom directly.');
                             store.set(isStreamingAtom, !!updatePayload.data); // Assuming data is boolean
                             break;
                        // Add future Pub/Sub topics here (e.g., 'chatListUpdated')
                        default:
                            console.warn(`[Global Listener] Unhandled pushUpdate topic: ${updatePayload.topic}`);
                    }
                    break;

                // Removed specific streaming/state handlers:
                // loadChatState, startAssistantMessage, appendMessageChunk, streamFinished, updateSuggestedActions, mcpConfigReloaded
                // These should now be handled by backend logic pushing 'chatUpdate' or 'streamingStatusUpdate' via 'pushUpdate'.

                default:
                    // Log other unhandled message types
                    console.warn(`[Global Listener] Unhandled push message type: ${message.type}`);
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
