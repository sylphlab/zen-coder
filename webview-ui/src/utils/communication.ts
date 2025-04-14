// Removed imports from ../app
import { WebviewRequestType, WebviewResponseMessage, ActionRequestType } from '../../../src/common/types';

// --- VS Code API Helper ---
// @ts-ignore
const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
export const postMessage = (message: any) => {
    if (vscode) {
        vscode.postMessage(message);
    } else {
        console.log("VS Code API not available, message not sent:", message);
        // Mock responses for development (Keep mocks if useful for standalone testing)
        // if (message.type === 'webviewReady') { ... }
    }
};

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
    'updateLastLocation', 'executeToolAction', 'stopGeneration' // Added stopGeneration
];

/**
 * Sends a request to the extension host and returns a promise that resolves/rejects
 * when the corresponding response is received or times out.
 * @param requestType The type of data/action being requested.
 * @param payload Optional payload for the request.
 * @returns A promise that resolves with the response payload or rejects with an error.
 */
// Define a union type for all possible request types including actions, subscribe/unsubscribe
type RequestTypeParam = WebviewRequestType | ActionRequestType | 'subscribe' | 'unsubscribe';
export function requestData<T = any>(requestType: RequestTypeParam, payload?: any): Promise<T> {
    // Determine the message type based on the requestType
    // Determine the message type based on the requestType
    const isAction = ACTION_REQUEST_TYPES.includes(requestType);
    const messageType = (requestType === 'subscribe' || requestType === 'unsubscribe' || isAction)
        ? requestType // Use the specific type for actions and sub/unsub
        : 'requestData'; // Use 'requestData' for data fetching requests

    return new Promise((resolve, reject) => {
        const requestId = generateUniqueId();

        const timeoutId = window.setTimeout(() => {
            pendingRequests.delete(requestId);
            console.error(`Request timed out: ${requestType} (ID: ${requestId})`);
            reject(new Error(`Request timed out: ${requestType}`));
        }, REQUEST_TIMEOUT);

        pendingRequests.set(requestId, { resolve, reject, timeoutId });

        console.log(`[Communication] Sending ${messageType}: ${requestType}, ID: ${requestId}`, payload);
        postMessage({
            type: messageType, // Use 'subscribe', 'unsubscribe', or 'requestData'
            requestId, // Always include requestId for tracking response
            // Include requestType only for 'requestData' messages, otherwise it's inferred from 'type'
            requestType: messageType === 'requestData' ? requestType : undefined,
            payload
        });
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
 * Creates a subscription to a specific topic.
 * @param topic The topic to subscribe to (e.g., 'providerStatus').
 * @returns A Subscription object with a dispose method.
 */
export function listen(topic: string): Subscription {
    const subscriptionId = generateUniqueId();
    let isDisposed = false;

    console.log(`[Communication] Attempting to subscribe to topic: ${topic} (ID: ${subscriptionId})`);
    // Use requestData for subscribe, handle potential errors
    requestData('subscribe', { topic, subscriptionId })
        .then(() => {
            if (!isDisposed) { // Check if disposed before logging success
                 console.log(`[Communication] Successfully subscribed to topic: ${topic} (ID: ${subscriptionId})`);
            } else {
                 console.log(`[Communication] Subscription ${subscriptionId} was disposed before acknowledgement.`);
                 // If disposed before ack, immediately try to unsubscribe
                 requestData('unsubscribe', { subscriptionId }).catch(err => console.error(`[Communication] Error during immediate unsubscribe for ${subscriptionId}:`, err));
            }
        })
        .catch(error => {
            console.error(`[Communication] Failed to subscribe to topic: ${topic} (ID: ${subscriptionId})`, error);
            // Optionally, handle subscription errors (e.g., notify UI, retry?)
            isDisposed = true; // Mark as disposed on subscription failure
        });

    const dispose = async (): Promise<void> => {
        if (isDisposed) {
            console.warn(`[Communication] Subscription ${subscriptionId} already disposed.`);
            return;
        }
        isDisposed = true;
        console.log(`[Communication] Disposing subscription to topic: ${topic} (ID: ${subscriptionId})`);
        try {
            await requestData('unsubscribe', { subscriptionId });
            console.log(`[Communication] Successfully unsubscribed from topic: ${topic} (ID: ${subscriptionId})`);
        } catch (error) {
            console.error(`[Communication] Failed to unsubscribe from topic: ${topic} (ID: ${subscriptionId})`, error);
            // Optionally handle unsubscription errors
        }
    };

    return { dispose };
}

// Optional: Add cleanup logic if needed
// window.addEventListener('unload', () => { ... });