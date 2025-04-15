import { atom, onMount } from 'nanostores'; // Keep onMount for $activeChatSession
import { UiMessage, ChatSession } from '../../../src/common/types';
import { listen, requestData } from '../utils/communication';
import { router } from './router';
import { StandardStore, createStore } from './utils/createStore'; // Import createStore and StandardStore
import { GetChatSessionPayload, GetChatSessionResponse } from '../../../src/webview/handlers/GetChatSessionHandler';
import { GetChatHistoryPayload, GetChatHistoryResponse } from '../../../src/webview/handlers/GetChatHistoryHandler';

// --- Active Chat Session Store ---
// Fetches the session metadata when the route changes.
export const $activeChatSession = atom<ChatSession | null | 'loading'>('loading');

let currentChatIdForSession: string | null = null;

onMount($activeChatSession, () => {
    console.log('[ActiveChatSession] Mount: Subscribing to router changes.');
    const unbindRouter = router.subscribe(route => {
        const chatId = (route && 'params' in route && route.params && 'chatId' in route.params) ? route.params.chatId : undefined;
        console.log(`[ActiveChatSession] Router changed. Current route chatId: ${chatId}`);

        if (chatId && chatId !== currentChatIdForSession) {
            console.log(`[ActiveChatSession] Chat ID changed to ${chatId}. Fetching session data.`);
            currentChatIdForSession = chatId;
            $activeChatSession.set('loading'); // Set loading state

            requestData<GetChatSessionResponse>('getChatSession', { chatId } as GetChatSessionPayload)
                .then(response => {
                    console.log(`[ActiveChatSession] Received session data for ${chatId}:`, response.session);
                    if (currentChatIdForSession === chatId) {
                        $activeChatSession.set(response.session);
                    } else {
                         console.log(`[ActiveChatSession] Stale session response received for ${chatId}. Discarding.`);
                    }
                })
                .catch(error => {
                    console.error(`[ActiveChatSession] Error fetching session data for ${chatId}:`, error);
                    if (currentChatIdForSession === chatId) {
                        $activeChatSession.set(null); // Set to null on error
                    }
                });
        } else if (!chatId && currentChatIdForSession !== null) {
            console.log('[ActiveChatSession] Chat ID removed from route. Clearing session data.');
            currentChatIdForSession = null;
            $activeChatSession.set(null);
        } else {
             // console.log(`[ActiveChatSession] No relevant change in chatId (${chatId}).`);
        }
    });

    return () => {
        console.log('[ActiveChatSession] Unmount: Unsubscribing from router changes.');
        unbindRouter();
        currentChatIdForSession = null;
    };
});


// --- Active Chat History Store (Refactored using createStore) ---
// Fetches initial history and subscribes to updates based on the current router chatId.
type ChatHistoryUpdatePayload = { data: UiMessage[] | null }; // Assuming backend pushes this structure

export const $activeChatHistory: StandardStore<UiMessage[]> = createStore<
    UiMessage[],                  // TData: Store holds array of messages
    GetChatHistoryResponse,       // TResponse: Raw response from fetch ('getChatHistory')
    GetChatHistoryPayload,        // PPayload: Payload for fetch ({ chatId })
    ChatHistoryUpdatePayload      // UUpdateData: Type of data from pubsub 'chatHistoryUpdate/{chatId}'
>({
    key: 'activeChatHistory',
    // Fetch configuration depends on the router
    fetch: {
        requestType: 'getChatHistory',
        payload: (): GetChatHistoryPayload | null => {
            const route = router.get();
            // Safely access chatId
            const chatId = (route && 'params' in route && route.params && 'chatId' in route.params) ? route.params.chatId : undefined;
            console.log(`[$activeChatHistory fetch.payload] Calculating payload. ChatId: ${chatId}`);
            return chatId ? { chatId } : null; // Return null if no chatId, preventing fetch
        },
        transformResponse: (response) => {
             console.log(`[$activeChatHistory fetch.transformResponse] Transforming fetch response. Length: ${response.history?.length ?? 'null'}`);
            // Extract the history array from the response
            return response.history ?? null;
        }
    },
    // Subscribe configuration also depends on the router
    subscribe: {
        topic: (): string | null => {
            const route = router.get();
            // Safely access chatId
            const chatId = (route && 'params' in route && route.params && 'chatId' in route.params) ? route.params.chatId : undefined;
             console.log(`[$activeChatHistory subscribe.topic] Calculating topic. ChatId: ${chatId}`);
            return chatId ? `chatHistoryUpdate/${chatId}` : null; // Dynamic topic based on chatId
        },
        handleUpdate: (currentHistory, updateData) => {
            const newHistory = updateData?.data ?? null;
            console.log(`[$activeChatHistory subscribe.handleUpdate] Received update. New history length: ${newHistory?.length ?? 'null'}`);
            // Backend pushes the full updated history list
            return newHistory ? [...newHistory] : null; // Ensure new array reference
        }
    },
    // Store depends on the router to recalculate payload and topic
    dependsOn: [router],
    initialData: null // Explicitly null, createStore handles 'loading'
});

// Removed the old onMount implementation for $activeChatHistory
