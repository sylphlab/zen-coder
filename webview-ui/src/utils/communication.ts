import { WebviewResponseMessage, WebviewRequestMessage } from '../../../src/common/types';
import { $sendMessage } from '../stores/chatStores'; // Import mutation store

// --- VS Code API Helper ---
// @ts-ignore
const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;

// --- Helper Functions ---
export const generateUniqueId = () => `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// --- Module State (Closure) ---
interface PendingRequest {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timeoutId: number;
}
const pendingRequests = new Map<string, PendingRequest>();
// Store callbacks directly under the topic key
const topicCallbacks = new Map<string, Set<(data: any) => void>>();
let isListenerInitialized = false;
const REQUEST_TIMEOUT = 15000; // 15 seconds

// --- Core Functions ---

/**
 * Handles incoming messages from the extension host.
 */
const handleIncomingMessage = (event: MessageEvent): void => {
    const message = event.data as WebviewResponseMessage; // Assume response type for now

    if (!message || typeof message.type !== 'string') {
        console.warn("[Communication FP Listener] Received message without valid type:", message);
        return;
    }

    if (message.type === 'responseData') {
        handleResponse(message);
    } else if (message.type === 'pushUpdate') {
        notifySubscribers(message.payload?.topic, message.payload?.data);
    } else if (message.type === 'startAssistantMessage') {
        // Loading state is handled automatically by createMutationStore for $sendMessage
        console.log(`[Communication FP Listener] Received startAssistantMessage for chat ${message.payload?.chatId}, message ${message.payload?.messageId}. Loading state handled by mutation store.`);
    } else {
        console.warn(`[Communication FP Listener] Unhandled message type: ${message.type}`);
    }
};

/**
 * Handles incoming response messages for requests sent via requestData.
 */
const handleResponse = (message: WebviewResponseMessage): void => {
    if (!message.requestId) return;

    const { requestId, payload, error } = message;
    const pending = pendingRequests.get(requestId);

    if (pending) {
        console.log(`[Communication FP] Received response for ID: ${requestId}`, error ? { error } : { payload });
        clearTimeout(pending.timeoutId);
        pendingRequests.delete(requestId);

        if (error) {
            pending.reject(new Error(error));
        } else {
            pending.resolve(payload);
        }
    } else {
        console.warn(`[Communication FP] Received response for unknown/timed out request ID: ${requestId}`);
    }
};

/**
 * Notifies subscribers for a given topic when a pushUpdate message is received.
 */
 const notifySubscribers = (topic?: string, data?: any): void => {
     if (!topic) {
         console.warn("[Communication FP] notifySubscribers called without a topic.");
         return;
     }
     console.log(`[Communication FP] Notifying subscribers for topic: "${topic}"`);
     const callbacks = topicCallbacks.get(topic); // Get Set of callbacks
     if (callbacks && callbacks.size > 0) {
         console.log(`[Communication FP] Found ${callbacks.size} callbacks for topic "${topic}". Executing...`);
         // Create a copy before iterating
         const callbacksToExecute = Array.from(callbacks);
         callbacksToExecute.forEach((callback) => {
             try {
                 console.log(`[Communication FP]   Executing callback for topic "${topic}"...`);
                 callback(data); // Execute callback with just data
             } catch (error) {
                 console.error(`[Communication FP]   Error in subscription callback for topic "${topic}":`, error);
             }
         });
     } else {
         console.warn(`[Communication FP] No active subscription callbacks found for topic: "${topic}"`);
     }
 };


// --- Exported API ---

/**
 * Initializes the global message listener. Should only be called once.
 */
export function initializeListener(): void {
    if (isListenerInitialized) {
        console.warn("[Communication FP] initializeListener called more than once.");
        return;
    }
    isListenerInitialized = true;
    console.log("[Communication FP] Initializing global message listener.");
    window.addEventListener('message', handleIncomingMessage);
    console.log("[Communication FP] Global message listener initialized.");
}

/**
 * Cleans up the global message listener. (Simplified)
 */
export function cleanupListener(): void {
    if (!isListenerInitialized) {
        return;
    }
    console.log("[Communication FP] Cleaning up global message listener.");
    window.removeEventListener('message', handleIncomingMessage);
    isListenerInitialized = false;
    pendingRequests.forEach((req, id) => {
        clearTimeout(req.timeoutId);
        req.reject(new Error(`Communication listener cleaned up while request ${id} was pending.`));
    });
    pendingRequests.clear();
    topicCallbacks.clear(); // Clear topicCallbacks
    console.log("[Communication FP] Global message listener cleaned up.");
}

/**
 * Sends a request to the extension host expecting a response (responseData).
 */
export function requestData<T = any>(requestType: string, payload?: any): Promise<T> {
    if (!isListenerInitialized) {
         console.warn("[Communication FP] requestData called before initializeListener. Initializing lazily.");
         initializeListener();
    }

    return new Promise((resolve, reject) => {
        const requestId = generateUniqueId();

        const timeoutId = window.setTimeout(() => {
            pendingRequests.delete(requestId);
            console.error(`[Communication FP] Request timed out: ${requestType} (ID: ${requestId})`);
            reject(new Error(`Request timed out: ${requestType}`));
        }, REQUEST_TIMEOUT);

        pendingRequests.set(requestId, { resolve, reject, timeoutId });

        const messageToSend: WebviewRequestMessage = {
            type: 'requestData',
            requestId,
            requestType,
            payload
        };

        console.log(`[Communication FP] Sending requestData: ${requestType}, ID: ${requestId}`, payload);
        if (vscode) {
            vscode.postMessage(messageToSend);
        } else {
            console.warn("[Communication FP] VS Code API not available, simulating rejection for:", messageToSend);
            pendingRequests.delete(requestId);
            clearTimeout(timeoutId);
            reject(new Error("VS Code API not available"));
        }
    });
}

/**
 * Creates a subscription to a topic pushed from the backend.
 * Uses requestData to send 'subscribe' and 'unsubscribe' requests.
 * Returns a function to unsubscribe.
 */
export function listen(topic: string, callback: (data: any) => void): () => Promise<void> {
    // Ensure listener is initialized lazily
    if (!isListenerInitialized) {
         console.warn("[Communication FP] listen called before initializeListener. Initializing lazily.");
         initializeListener();
    }

    const currentCallbacks = topicCallbacks.get(topic);
    const isFirstListener = !currentCallbacks || currentCallbacks.size === 0;

    // Add callback to the Set for the topic
    if (!currentCallbacks) {
        topicCallbacks.set(topic, new Set([callback]));
    } else {
        currentCallbacks.add(callback);
    }
    console.log(`[Communication FP] Added listener callback for topic: "${topic}". New Count: ${topicCallbacks.get(topic)!.size}`);

    // If first listener for this topic, request subscription from backend
    if (isFirstListener) {
        console.log(`[Communication FP] First listener for topic "${topic}". Requesting backend subscription.`);
        requestData('subscribe', { topic })
            .then(() => {
                console.log(`[Communication FP] Backend subscription successful for topic: ${topic}`);
            })
            .catch(error => {
                console.error(`[Communication FP] Backend subscription failed for topic: ${topic}`, error);
                const currentSet = topicCallbacks.get(topic);
                if (currentSet && currentSet.size === 0) {
                     topicCallbacks.delete(topic);
                }
            });
    }

    let isDisposed = false; // Flag to prevent multiple unsubscribes

    // Return an async dispose function
    const dispose = async (): Promise<void> => {
        if (isDisposed) {
            console.warn(`[Communication FP] Listener for topic "${topic}" already disposed.`);
            return;
        }
        isDisposed = true;
        console.log(`[Communication FP] Disposing listener callback for topic: "${topic}"`);

        const callbacks = topicCallbacks.get(topic);
        if (callbacks) {
            callbacks.delete(callback); // Delete the specific callback
            console.log(`[Communication FP] Removed listener callback for topic: "${topic}". Remaining: ${callbacks.size}`);

            // If last callback removed, unsubscribe from backend
            if (callbacks.size === 0) {
                topicCallbacks.delete(topic); // Remove the Set from the map
                console.log(`[Communication FP] Last listener removed for topic "${topic}". Requesting backend unsubscription.`);
                try {
                    await requestData('unsubscribe', { topic }); // Send only topic
                    console.log(`[Communication FP] Backend unsubscription successful for topic: ${topic}`);
                } catch (error) {
                    console.warn(`[Communication FP] Backend unsubscription failed for topic ${topic}. Error:`, error);
                }
            }
        }
    }; // End of dispose function

    return dispose;
}


// --- Location Specific Communication Functions --- (Keep using requestData)

/**
 * Fetches the initial location from the backend.
 * Returns the fetched location string or '/' on error/null.
 */
export async function fetchInitialLocationFP(): Promise<string> {
    console.log("[Communication FP] Fetching initial location...");
    try {
        const res = await requestData<{ location: string | null }>('getLastLocation');
        const backendLocation = res?.location || '/';
        console.log(`[Communication FP] Initial location fetched: ${backendLocation}`);
        return backendLocation;
    } catch (e: unknown) {
        console.error("[Communication FP] Error fetching initial location:", e);
        return '/'; // Fallback on error
    }
}

/**
 * Persists the given location to the backend (fire-and-forget, but uses requestData for potential backend logging/ack).
 */
export function persistLocationFP(locationToPersist: string): void {
    console.log(`[Communication FP] Persisting location: ${locationToPersist}`);
    requestData('updateLastLocation', { location: locationToPersist })
        .catch((e: unknown) => console.error("[Communication FP] Failed to update backend location:", e));
}
