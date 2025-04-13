import { postMessage, generateUniqueId } from '../app'; // Assuming generateUniqueId is exported from app
import { WebviewRequestType, WebviewResponseMessage } from '../../../src/common/types';

interface PendingRequest {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timeoutId: number; // Use NodeJS.Timeout if in Node env, number for browser
}

const pendingRequests = new Map<string, PendingRequest>();
const REQUEST_TIMEOUT = 15000; // 15 seconds timeout

/**
 * Sends a request to the extension host and returns a promise that resolves/rejects
 * when the corresponding response is received or times out.
 * @param requestType The type of data being requested.
 * @param payload Optional payload for the request.
 * @returns A promise that resolves with the response payload or rejects with an error.
 */
export function requestData<T = any>(requestType: WebviewRequestType, payload?: any): Promise<T> {
    return new Promise((resolve, reject) => {
        const requestId = generateUniqueId();

        const timeoutId = window.setTimeout(() => { // Use window.setTimeout for browser environment
            pendingRequests.delete(requestId);
            console.error(`Request timed out: ${requestType} (ID: ${requestId})`);
            reject(new Error(`Request timed out: ${requestType}`));
        }, REQUEST_TIMEOUT);

        pendingRequests.set(requestId, { resolve, reject, timeoutId });

        console.log(`[RequestManager] Sending request: ${requestType}, ID: ${requestId}`, payload);
        postMessage({
            type: 'requestData',
            requestId,
            requestType,
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
    if (message.type !== 'responseData' || !message.requestId) {
        return; // Ignore messages that are not valid responses
    }

    const { requestId, payload, error } = message;
    const pending = pendingRequests.get(requestId);

    if (pending) {
        console.log(`[RequestManager] Received response for ID: ${requestId}`, error ? { error } : { payload });
        clearTimeout(pending.timeoutId); // Clear the timeout
        pendingRequests.delete(requestId); // Remove from pending map

        if (error) {
            pending.reject(new Error(error));
        } else {
            pending.resolve(payload);
        }
    } else {
        console.warn(`[RequestManager] Received response for unknown or timed out request ID: ${requestId}`);
    }
}

// Optional: Add cleanup logic if needed, e.g., reject all pending on webview unload
// window.addEventListener('unload', () => {
//     pendingRequests.forEach((req, id) => {
//         clearTimeout(req.timeoutId);
//         req.reject(new Error('Webview unloaded before response received.'));
//     });
//     pendingRequests.clear();
// });