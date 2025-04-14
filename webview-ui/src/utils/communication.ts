import { WebviewResponseMessage, WebviewRequestMessage } from '../../../src/common/types';

// --- VS Code API Helper ---
// @ts-ignore
const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;

// --- Helper Functions ---
const generateUniqueId = () => `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// --- Module State (Closure) ---
interface PendingRequest {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timeoutId: number;
}
const pendingRequests = new Map<string, PendingRequest>();
const activeSubscriptions = new Map<string, { topic: string; callback: (data: any) => void }>();
let isListenerInitialized = false;
const REQUEST_TIMEOUT = 15000; // 15 seconds

// --- Core Functions ---

/**
 * Handles incoming messages from the extension host.
 */
const handleIncomingMessage = (event: MessageEvent): void => {
    const message = event.data as WebviewResponseMessage;

    if (!message || typeof message.type !== 'string') {
        console.warn("[Communication FP Listener] Received message without valid type:", message);
        return;
    }

    if (message.type === 'responseData') {
        handleResponse(message);
    } else if (message.type === 'pushUpdate') {
        notifySubscribers(message.payload?.topic, message.payload?.data);
    } else {
        console.warn(`[Communication FP Listener] Unhandled message type: ${message.type}`);
    }
};

/**
 * Handles incoming response messages.
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
 * Notifies subscribers for a given topic.
 */
const notifySubscribers = (topic?: string, data?: any): void => {
     if (!topic) return;
     console.log(`[Communication FP] Notifying subscribers for topic: ${topic}`);
     activeSubscriptions.forEach((sub) => {
         if (sub.topic === topic) {
             try {
                 sub.callback(data);
             } catch (error) {
                 console.error(`[Communication FP] Error in subscription callback for topic ${topic}:`, error);
             }
         }
     });
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
 * Cleans up the global message listener.
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
    activeSubscriptions.clear();
    console.log("[Communication FP] Global message listener cleaned up.");
}

/**
 * Sends a request to the extension host.
 */
export function requestData<T = any>(requestType: string, payload?: any): Promise<T> {
    // Ensure listener is initialized lazily if not already
    if (!isListenerInitialized) {
         console.warn("[Communication FP] requestData called before initializeListener. Initializing lazily.");
         initializeListener();
    }

    return new Promise((resolve, reject) => {
        const requestId = generateUniqueId();

        const timeoutId = window.setTimeout(() => {
            pendingRequests.delete(requestId);
            console.error(`Request timed out: ${requestType} (ID: ${requestId})`);
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
            console.warn("VS Code API not available, simulating rejection for:", messageToSend);
            pendingRequests.delete(requestId);
            clearTimeout(timeoutId);
            reject(new Error("VS Code API not available"));
        }
    });
}

/**
 * Creates a subscription to a topic pushed from the backend.
 * Returns a dispose function to unsubscribe.
 */
export function listen(topic: string, callback: (data: any) => void): () => Promise<void> {
     // Ensure listener is initialized lazily
    if (!isListenerInitialized) {
         console.warn("[Communication FP] listen called before initializeListener. Initializing lazily.");
         initializeListener();
    }

    const subscriptionId = generateUniqueId();
    activeSubscriptions.set(subscriptionId, { topic, callback });
    console.log(`[Communication FP] Added internal subscription for topic: ${topic} (ID: ${subscriptionId})`);

    let isSubscribedToServer = false;
    let isDisposedLocally = false;

    console.log(`[Communication FP] Requesting backend subscription for topic: ${topic} (ID: ${subscriptionId})`);
    requestData('subscribe', { topic, subscriptionId })
        .then(() => {
            if (!isDisposedLocally) {
                isSubscribedToServer = true;
                console.log(`[Communication FP] Backend subscription successful for topic: ${topic} (ID: ${subscriptionId})`);
            } else {
                console.log(`[Communication FP] Subscription ${subscriptionId} was disposed locally before backend ack.`);
                requestData('unsubscribe', { subscriptionId }).catch(err => console.warn(`[Communication FP] Error during immediate backend unsubscribe for ${subscriptionId}:`, err));
            }
        })
        .catch(error => {
            console.error(`[Communication FP] Backend subscription failed for topic: ${topic} (ID: ${subscriptionId})`, error);
            isDisposedLocally = true;
            activeSubscriptions.delete(subscriptionId);
        });

    const dispose = async (): Promise<void> => {
        if (isDisposedLocally) {
            console.warn(`[Communication FP] Subscription ${subscriptionId} already disposed locally.`);
            return;
        }
        isDisposedLocally = true;
        console.log(`[Communication FP] Disposing local subscription for topic: ${topic} (ID: ${subscriptionId})`);
        activeSubscriptions.delete(subscriptionId);

        if (isSubscribedToServer) {
            console.log(`[Communication FP] Requesting backend unsubscription for topic: ${topic} (ID: ${subscriptionId})`);
            try {
                await requestData('unsubscribe', { subscriptionId });
                console.log(`[Communication FP] Backend unsubscription successful for topic: ${topic} (ID: ${subscriptionId})`);
            } catch (error) {
                console.warn(`[Communication FP] Backend unsubscription failed for ${subscriptionId}. Error:`, error);
            }
        } else {
            console.log(`[Communication FP] Skipping backend unsubscription for ${subscriptionId} as initial subscription likely failed or was disposed early.`);
        }
    };

    return dispose;
}

// --- Location Specific Communication Functions ---

/**
 * Fetches the initial location from the backend.
 * Returns the fetched location string or '/' on error/null.
 */
export async function fetchInitialLocationFP(): Promise<string> {
    console.log("[Communication FP] Fetching initial location...");
    try {
        // Use requestData from this module
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
 * Persists the given location to the backend (fire-and-forget).
 */
export function persistLocationFP(locationToPersist: string): void {
    console.log(`[Communication FP] Persisting location: ${locationToPersist}`);
    // Use requestData from this module
    requestData('updateLastLocation', { location: locationToPersist })
        .catch((e: unknown) => console.error("[Communication FP] Failed to update backend location:", e));
}
