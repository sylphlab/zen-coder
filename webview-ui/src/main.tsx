import { render } from 'preact';
import { Suspense } from 'preact/compat';
import { Provider, getDefaultStore } from 'jotai'; // Import getDefaultStore
import { handleResponse as handleCommunicationResponse } from './utils/communication'; // Removed notifySubscribers import
// Removed atom imports as main.tsx should not handle state directly
// import { ... } from './store/atoms';
// Removed type imports related to specific atom data
// import { ... } from '../../src/common/types';
import 'virtual:uno.css';
import '@unocss/reset/tailwind.css';
import './index.css';
import { App } from './app.tsx';

const store = getDefaultStore(); // Get the default Jotai store instance

console.log("[main.tsx] Initializing application...");

// Add a global listener to handle ALL messages from the extension host
// This listener ONLY acts as a demuxer/dispatcher to communication.ts
window.addEventListener('message', (event: MessageEvent) => {
    const message = event.data;

    // Basic Type Check
     if (!message || typeof message.type !== 'string') {
         console.warn("[Message Demux] Received message without a valid type:", message);
         return;
     }
    // console.log("[Message Demux] Processing message:", message.type); // Optional debug log

    try {
        if (message.type === 'responseData') {
            // Handle responses for requests initiated by requestData
            // Pass the whole message for response handling (includes requestId, payload, error)
            handleCommunicationResponse(message);
        } else if (message.type === 'pushUpdate') {
            // Handle push messages - NO LONGER HANDLED HERE
            // The 'listen' function in communication.ts now adds individual listeners
            // for each subscription, which handle their own 'pushUpdate' messages.
            // console.warn(`[Message Demux] Received pushUpdate, but it should be handled by atom listeners. Topic: ${message.payload?.topic}`);
        } else {
            // Log other unhandled message types at this transport layer
            console.warn(`[Message Demux] Unhandled message type: ${message.type}`);
        }
    } catch (error) {
        console.error(`[Message Demux] Error processing message type ${message?.type}:`, error, "Payload:", message?.payload);
    }
});

// --- Render App ---

render(
    <Provider store={store}> {/* Pass the store instance */}
        {/* Suspense remains necessary for async atoms within App */}
        <Suspense fallback={<div class="flex justify-center items-center h-screen">Loading App...</div>}>
            <App />
        </Suspense>
    </Provider>,
    document.getElementById('root')!
);
