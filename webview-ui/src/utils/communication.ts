// Removed imports from ../app
import { WebviewResponseMessage, ActionRequestType, WebviewRequestMessage } from '../../../src/common/types'; // Removed WebviewRequestType

// --- VS Code API Helper ---
// @ts-ignore
const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
// Removed old postMessage function. All FE -> BE communication MUST use requestData.
// const postMessage = ... (removed)

// --- Helper Functions ---
export const generateUniqueId = () => `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// --- Request/Response Logic ---

interface PendingRequest {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timeoutId: number;
    // Removed requestType as it's not needed in the simplified handleResponse
}

const pendingRequests = new Map<string, PendingRequest>();
const REQUEST_TIMEOUT = 15000; // 15 seconds timeout

// Array of known action request types (mirroring ActionRequestType in common/types.ts)
const ACTION_REQUEST_TYPES: string[] = [
    'setApiKey', 'deleteApiKey', 'setProviderEnabled', 'setDefaultConfig',
    'setGlobalCustomInstructions', 'setProjectCustomInstructions', 'openOrCreateProjectInstructionsFile',
    'setToolAuthorization', 'retryMcpConnection', 'setActiveChat', 'createChat',
    'deleteChat', 'updateChatConfig', 'clearChatHistory', 'deleteMessage',
    'updateLastLocation', 'executeToolAction', 'stopGeneration', 'sendMessage' // Added sendMessage
];

/**
 * Sends a request to the extension host and returns a promise that resolves/rejects
 * when the corresponding response is received or times out.
 * @param requestType The type of data/action being requested.
 * @param payload Optional payload for the request.
 * @returns A promise that resolves with the response payload or rejects with an error.
 */
// Define a union type for all possible request types including actions, subscribe/unsubscribe
// Define a union type for all possible request types (data fetching, actions, pub/sub management)
// Define a union type for all possible request types (actions, pub/sub management)
// Data fetching types are now just strings passed as requestType in WebviewRequestMessage
type RequestTypeParam = ActionRequestType | 'subscribe' | 'unsubscribe' | string; // Use string for data fetching types

export function requestData<T = any>(requestType: RequestTypeParam, payload?: any): Promise<T> {
    // ALL messages sent to backend are now of type 'requestData'
    const messageType = 'requestData';

    return new Promise((resolve, reject) => {
        const requestId = generateUniqueId();

        const timeoutId = window.setTimeout(() => {
            pendingRequests.delete(requestId);
            console.error(`Request timed out: ${requestType} (ID: ${requestId})`);
            reject(new Error(`Request timed out: ${requestType}`));
        }, REQUEST_TIMEOUT);

        pendingRequests.set(requestId, { resolve, reject, timeoutId });

        const messageToSend: WebviewRequestMessage = {
            type: messageType, // Always 'requestData'
            requestId,
            requestType: requestType, // The actual operation type
            payload
        };

        console.log(`[Communication] Sending requestData: ${requestType}, ID: ${requestId}`, payload);
        if (vscode) {
            vscode.postMessage(messageToSend);
        } else {
            console.log("VS Code API not available, message not sent:", messageToSend);
            // Mock responses or reject promise for development outside VS Code
            // For now, let it timeout or reject immediately
            pendingRequests.delete(requestId);
            clearTimeout(timeoutId);
            reject(new Error("VS Code API not available"));
        }
    });
}

/**
 * Handles incoming response messages from the extension host.
 * Finds the corresponding pending request and resolves/rejects its promise.
 * @param message The response message received from the extension.
 */
export function handleResponse(message: WebviewResponseMessage): void {
    // Responses can be 'responseData' (for requestData) or potentially specific ack types for subscribe/unsubscribe
    if (!message.requestId) {
        return; // Ignore messages without a request ID
    }

    const { requestId, payload, error, type } = message;
    const pending = pendingRequests.get(requestId);

    if (pending) {
        console.log(`[Communication] Received response for ID: ${requestId} (Type: ${type})`, error ? { error } : { payload });
        clearTimeout(pending.timeoutId);
        pendingRequests.delete(requestId);

        if (error) {
            pending.reject(new Error(error));
        } else {
            // Resolve the original promise with the payload
            pending.resolve(payload);
        }
    } else {
        console.warn(`[Communication] Received response for unknown or timed out request ID: ${requestId}. Type: ${type}, Error: ${error ?? 'No error provided'}. Payload:`, payload);
    }
}

// --- Pub/Sub Abstraction ---

interface Subscription {
    dispose: () => Promise<void>; // Make dispose async as it calls requestData
}

/**
 * Creates a subscription to a specific topic and sets up a listener for 'pushUpdate' messages.
 * @param topic The topic to subscribe to (e.g., 'providerStatus').
 * @param callback The function to call when a 'pushUpdate' for this topic is received.
 * @returns A Subscription object with a dispose method.
 */
export function listen(topic: string, callback: (data: any) => void): Subscription {
    const subscriptionId = generateUniqueId();
    let isDisposed = false;

    // Internal listener for 'pushUpdate' messages
    const messageListener = (event: MessageEvent) => {
        const message = event.data;
        if (message?.type === 'pushUpdate' && message.payload?.topic === topic && !isDisposed) {
            console.log(`[Listen - ${topic}] Received pushUpdate:`, message.payload.data);
            try {
                callback(message.payload.data);
            } catch (error) {
                console.error(`[Listen - ${topic}] Error in callback:`, error);
            }
        }
    };

    window.addEventListener('message', messageListener);
    console.log(`[Communication] Added listener for topic: ${topic}`);

    console.log(`[Communication] Attempting to subscribe to topic: ${topic} (ID: ${subscriptionId})`);
    // Use requestData for subscribe, handle potential errors
    requestData('subscribe', { topic, subscriptionId })
        .then(() => {
            if (!isDisposed) {
                 console.log(`[Communication] Successfully subscribed to topic: ${topic} (ID: ${subscriptionId})`);
            } else {
                 console.log(`[Communication] Subscription ${subscriptionId} was disposed before acknowledgement.`);
                 // If disposed before ack, immediately try to unsubscribe
                 requestData('unsubscribe', { subscriptionId }).catch(err => console.error(`[Communication] Error during immediate unsubscribe for ${subscriptionId}:`, err));
                 window.removeEventListener('message', messageListener); // Clean up listener if disposed early
            }
        })
        .catch(error => {
            console.error(`[Communication] Failed to subscribe to topic: ${topic} (ID: ${subscriptionId})`, error);
            isDisposed = true; // Mark as disposed on subscription failure
            window.removeEventListener('message', messageListener); // Clean up listener on failure
        });

    const dispose = async (): Promise<void> => {
        if (isDisposed) {
            console.warn(`[Communication] Subscription ${subscriptionId} already disposed.`);
            return;
        }
        isDisposed = true;
        console.log(`[Communication] Disposing subscription and listener for topic: ${topic} (ID: ${subscriptionId})`);
        window.removeEventListener('message', messageListener); // Remove the specific listener
        try {
            await requestData('unsubscribe', { subscriptionId });
            console.log(`[Communication] Successfully unsubscribed from topic: ${topic} (ID: ${subscriptionId})`);
        } catch (error) {
            // Log as warning instead of error, as backend might have already cleaned up or never received the subscribe
            console.warn(`[Communication] Failed to unsubscribe from topic: ${topic} (ID: ${subscriptionId}). This might be expected if the subscription was never fully established or already cleaned up. Error:`, error);
        }
    };

    return { dispose };
}

// Optional: Add cleanup logic if needed
// window.addEventListener('unload', () => { ... });