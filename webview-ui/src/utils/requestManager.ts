import { postMessage, generateUniqueId } from '../app'; // Assuming generateUniqueId is exported from app
import { WebviewRequestType, WebviewResponseMessage, LoadChatStatePayload, ProviderInfoAndStatus, AvailableModel, AllToolsStatusInfo, McpConfiguredStatusPayload } from '../../../src/common/types'; // Changed AllToolsStatusPayload to AllToolsStatusInfo
import { getDefaultStore } from 'jotai';
import {
    chatSessionsAtom,
    activeChatIdAtom,
    availableProvidersAtom,
    providerStatusAtom,
    allToolsStatusAtom,
    mcpServerStatusAtom,
    // Import other relevant atoms if needed
} from '../store/atoms';

interface PendingRequest {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timeoutId: number;
    requestType: WebviewRequestType; // Store the request type
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

        pendingRequests.set(requestId, { resolve, reject, timeoutId, requestType }); // Store requestType

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
const store = getDefaultStore(); // Get the default Jotai store instance

export function handleResponse(message: WebviewResponseMessage): void {
    if (message.type !== 'responseData' || !message.requestId) {
        return; // Ignore messages that are not valid responses
    }

    const { requestId, payload, error } = message; // Keep payload as any for now
    const pending = pendingRequests.get(requestId);

    if (pending) {
        console.log(`[RequestManager] Received response for ID: ${requestId}`, error ? { error } : { payload });
        clearTimeout(pending.timeoutId); // Clear the timeout
        pendingRequests.delete(requestId); // Remove from pending map

        if (error) {
            pending.reject(new Error(error));
        } else {
            // Resolve the original promise - Atom updates are handled elsewhere (main.tsx)
            pending.resolve(payload);
        }
    } else {
        // Log detailed info when ID is not found
        console.warn(`[RequestManager] Received response for unknown or timed out request ID: ${requestId}. Error: ${error ?? 'No error provided'}. Payload:`, payload);
        console.warn(`[RequestManager] Current pending requests map size: ${pendingRequests.size}`);
        // Optionally log all pending keys for debugging (can be verbose)
        // console.warn(`[RequestManager] Pending request IDs:`, Array.from(pendingRequests.keys()));
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