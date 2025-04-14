import { render } from 'preact';
import { Suspense } from 'preact/compat';
import { Provider, useSetAtom } from 'jotai'; // Import useSetAtom
import { handleResponse as handleRequestManagerResponse } from './utils/requestManager'; // Import response handler
import {
    chatSessionsAtom,
    activeChatIdAtom,
    isStreamingAtom,
    suggestedActionsMapAtom,
    // Import other atoms needed for direct updates if necessary
} from './store/atoms';
import 'virtual:uno.css';
import '@unocss/reset/tailwind.css';
import './index.css';
import { App } from './app.tsx';
import { MessageHandlerComponent } from './components/MessageHandlerComponent'; // Import the new component

// --- Global Message Listener ---
// Note: Cannot use Jotai hooks directly here. Need a way to dispatch updates.
// Option 1: Use store.set directly (if using Jotai core store)
// Option 2: Create a dedicated dispatcher function/event emitter
// Option 3 (Simpler for now): Define setters within a temporary component inside Provider
// Let's try a simpler approach first: Pass a dispatcher function to App? No, App isn't rendered yet.
// We MUST handle the response directly here for requestManager. Other messages might need queueing.

console.log("[main.tsx] Setting up global message listener...");

window.addEventListener('message', (event: MessageEvent) => {
    const message = event.data;
    // --- DETAILED LOGGING ---
    console.log("[Global Listener Raw Event]", event);
    console.log("[Global Listener Raw Data]", message);
     if (!message || typeof message.type !== 'string') {
         console.warn("[Global Listener] Received message without a valid type:", message);
         return;
     }
    console.log("[Global Listener] Processing message:", message.type);
    // --- END DETAILED LOGGING ---

    if (message.type === 'responseData') {
        console.log("[Global Listener] Detected responseData, calling handleRequestManagerResponse...");
        try {
            handleRequestManagerResponse(message);
        } catch (e) {
            console.error("[Global Listener] Error calling handleRequestManagerResponse:", e);
        }
        console.log("[Global Listener] Returned from handleRequestManagerResponse.");
    } else {
        // How to handle other messages like 'loadChatState', 'appendMessageChunk'?
        // These need to update Jotai state, which requires the Provider context.
        // We can queue them or use a dedicated store instance if Provider isn't ready.
        // For now, log them here. They might be handled by the listener inside App later if it's still needed.
        console.log(`[Global Listener] Received non-responseData message: ${message.type}. Needs handling within Provider context.`);
        // Potential solution: Queue messages until App signals readiness?
        // Or maybe the listener inside App *is* still needed for state updates.
        // Let's keep the App's listener for now but only for state updates, not response handling.
    }
});

// --- Render App ---

render(
    <Provider>
        {/* Suspense remains necessary for async atoms within App */}
        <Suspense fallback={<div class="flex justify-center items-center h-screen">Loading App...</div>}>
            <MessageHandlerComponent /> {/* Render the message handler */}
            <App />
        </Suspense>
    </Provider>,
    document.getElementById('root')!
);
