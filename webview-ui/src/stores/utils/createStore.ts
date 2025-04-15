import { WritableAtom, ReadableAtom, atom, onMount } from 'nanostores';
import { requestData, listen } from '../../utils/communication';

// --- Types ---

/** Optional payload function or static payload */
type PayloadInput<P> = P | (() => P | null);
/** Optional topic function or static topic */
type TopicInput = string | (() => string | null);

/** Configuration for fetching initial state */
interface FetchConfig<TResponse, TData, PPayload> {
    /** Backend request type for fetching */
    requestType: string;
    /** Payload for the fetch request (static or dynamic function) */
    payload?: PayloadInput<PPayload>;
    /** Optional function to transform the raw fetch response */
    transformResponse?: (response: TResponse) => TData | null;
}

/** Configuration for subscribing to updates */
interface SubscribeConfig<TData, UUpdateData> {
    /** Topic for updates (static or dynamic function) */
    topic: TopicInput;
    /** Function to merge incoming update data with current state */
    handleUpdate: (currentData: TData | null, updateData: UUpdateData) => TData | null;
}

/** Main configuration for createStore */
interface CreateStoreConfig<
    TData,
    TResponse = TData, // Type of raw fetch response
    PPayload = any,    // Type of fetch payload
    UUpdateData = TData // Type of update data pushed via pubsub
> {
    /** Unique key for debugging and potential future use */
    key: string;
    /** Fetch configuration (required for initial state) */
    fetch: FetchConfig<TResponse, TData, PPayload>;
    /** Optional subscribe configuration for real-time updates */
    subscribe?: SubscribeConfig<TData, UUpdateData>;
    /** Optional initial data before first fetch */
    initialData?: TData | null;
    /** Optional array of dependent Nanostores that should trigger re-evaluation */
    dependsOn?: ReadableAtom<any>[];
}

/** The created store interface, extending Nanostores atom and adding refetch */
export interface StandardStore<TData> extends WritableAtom<TData | null | 'loading' | 'error'> {
    refetch: () => Promise<void>;
}

// --- Implementation ---

/**
 * Creates a standard Nanostore atom that fetches initial data via requestData
 * and optionally subscribes to updates via listen, based on the provided configuration.
 */
export function createStore<
    TData,
    TResponse = TData,
    PPayload = any, // Use unknown for better type safety maybe? Let's stick to any for now.
    UUpdateData = TData
>(
    config: CreateStoreConfig<TData, TResponse, PPayload, UUpdateData>
): StandardStore<TData> {
    const { key, fetch: fetchConfig, subscribe: subscribeConfig, initialData = null } = config;
    // Ensure the initial value is explicitly one of the allowed types
    const initialStoreValue: TData | null | 'loading' | 'error' = initialData !== null ? initialData : 'loading';
    const store = atom<TData | null | 'loading' | 'error'>(initialStoreValue);


    let unsubscribeFromTopic: (() => Promise<void>) | null = null;
    let currentTopic: string | null = null;
    let currentPayloadKey: string | null = null; // Key to track if fetch parameters changed

    const getPayload = (): PPayload | null => {
        const payloadConfig = fetchConfig.payload; // Store in variable for type narrowing
        if (!payloadConfig) return {} as PPayload; // Default to empty object if no payload config

        // Use explicit type check for function before calling
        if (typeof payloadConfig === 'function') {
            // We need to assert it's the function type expected, not just any function
            const payloadFunc = payloadConfig as () => PPayload | null;
            return payloadFunc();
        }
        // If not a function, it's the static payload value
        return payloadConfig;
    };

    const getTopic = (): string | null => {
        if (!subscribeConfig?.topic) return null;
        return typeof subscribeConfig.topic === 'function' ? subscribeConfig.topic() : subscribeConfig.topic;
    };

    const fetchDataAndSubscribe = async (isRefetch = false) => {
        const payload = getPayload();
        const topic = getTopic();
        const payloadKey = JSON.stringify(payload);

        // Only proceed if payload/topic changed OR it's a manual refetch
        if (payloadKey === currentPayloadKey && topic === currentTopic && !isRefetch) {
            // console.log(`[Store ${key}] Context unchanged. Skipping fetch/subscribe.`);
            return;
        }

        console.log(`[Store ${key}] Context changed or refetch triggered. PayloadKey: ${payloadKey}, Topic: ${topic}`);
        currentPayloadKey = payloadKey; // Update tracker

        // 1. Unsubscribe from previous topic if it's changing or exists
        if (topic !== currentTopic && unsubscribeFromTopic) {
            console.log(`[Store ${key}] Topic changed. Unsubscribing from old topic: ${currentTopic}`);
            await unsubscribeFromTopic().catch(e => console.error(`[Store ${key}] Unsubscribe error`, e));
            unsubscribeFromTopic = null;
        }
        currentTopic = topic; // Update tracker

        // 2. Fetch initial/refreshed data (if payload is valid)
        if (payload !== null) {
            store.set('loading'); // Set loading state
            try {
                console.log(`[Store ${key}] Fetching state (${fetchConfig.requestType})... Payload:`, payload);
                const response = await requestData<TResponse>(fetchConfig.requestType, payload);
                console.log(`[Store ${key}] Fetch response received.`);
                 const transformedData = fetchConfig.transformResponse
                     ? fetchConfig.transformResponse(response)
                     : (response as unknown as TData | null); // Assume compatible if no transform

                 // Only update if the payload key hasn't changed again during fetch
                 if (currentPayloadKey === payloadKey) {
                    store.set(transformedData ?? null);
                    console.log(`[Store ${key}] State updated after fetch.`);
                 } else {
                    console.log(`[Store ${key}] Stale fetch response received for key ${payloadKey}. Discarding.`);
                 }

            } catch (error) {
                console.error(`[Store ${key}] Error fetching state (${fetchConfig.requestType}):`, error);
                // Only update if the payload key hasn't changed again during fetch
                if (currentPayloadKey === payloadKey) {
                    store.set('error'); // Set error state
                }
            }
        } else {
            console.log(`[Store ${key}] Payload is null, skipping fetch.`);
            store.set(null); // Set to null if payload invalidates fetch
        }

        // 3. Subscribe to updates (if topic is valid and subscription doesn't already exist for this topic)
        if (topic !== null && !unsubscribeFromTopic) {
            try {
                console.log(`[Store ${key}] Subscribing to updates topic: ${topic}`);
                unsubscribeFromTopic = listen(topic, (updateData: UUpdateData) => {
                    // Ensure we are still mounted and subscribed to the correct topic
                    if (currentTopic === topic && subscribeConfig) {
                        console.log(`[Store ${key}] Received update on topic ${topic}.`);
                        const currentStoreValue = store.get();
                        const currentState = (currentStoreValue === 'loading' || currentStoreValue === 'error')
                            ? null
                            : currentStoreValue;
                        // Use handleUpdate to merge the new data
                        store.set(subscribeConfig.handleUpdate(currentState, updateData));
                    } else {
                        console.log(`[Store ${key}] Received update for stale/unsubscribed topic ${topic}. Discarding.`);
                    }
                });
            } catch (error) {
                console.error(`[Store ${key}] Error subscribing to topic ${topic}:`, error);
                // Perhaps set store to error state? For now, relies on fetch state.
            }
        }
    };

    // Add refetch method to the store object
    (store as StandardStore<TData>).refetch = () => {
        console.log(`[Store ${key}] Manual refetch triggered.`);
        return fetchDataAndSubscribe(true); // Pass true to indicate manual refetch
    };

    // Use onMount to trigger the initial fetch/subscribe and setup dependency listeners
    onMount(store, () => {
        console.log(`[Store ${key}] Mounted.`);
        // Perform the initial fetch and subscription
        fetchDataAndSubscribe();

        // Subscribe to dependencies if provided
        const dependencyUnsubscribers: (() => void)[] = []; // Use () => void for unsubscribe type
        if (config.dependsOn && Array.isArray(config.dependsOn)) {
            config.dependsOn.forEach((dependencyStore, index) => {
                console.log(`[Store ${key}] Subscribing to dependency ${index}...`);
                const unsubscribe = dependencyStore.subscribe(() => {
                    // When a dependency changes, re-run the fetch/subscribe logic
                    console.log(`[Store ${key}] Dependency ${index} changed. Triggering re-evaluation.`);
                    fetchDataAndSubscribe();
                });
                dependencyUnsubscribers.push(unsubscribe);
            });
        }

        // Cleanup function
        return () => {
            console.log(`[Store ${key}] Unmounted. Cleaning up subscriptions.`);

            // Unsubscribe from topic
            unsubscribeFromTopic?.().catch(e => console.error(`[Store ${key}] Error unsubscribing from topic ${currentTopic} on unmount:`, e));
            unsubscribeFromTopic = null;
            currentTopic = null;

            // Unsubscribe from dependencies
            dependencyUnsubscribers.forEach((unsubscribe, index) => {
                console.log(`[Store ${key}] Unsubscribing from dependency ${index}.`);
                unsubscribe();
            });

            // Reset trackers
            currentPayloadKey = null; // Reset trackers
        };
    });

    return store as StandardStore<TData>;
}

// Example Usage (Conceptual)
/*
import { router } from './router'; // Assuming router store exists

interface ChatSession { id: string; name: string; lastActivity: number; }
interface ChatSessionUpdate { type: 'add' | 'remove' | 'update'; session: Partial<ChatSession> & { id: string }; }

const $chatSessions = createStore<ChatSession[], ChatSession[], {}, ChatSessionUpdate>({
    key: 'chatSessions',
    fetch: {
        requestType: 'getChatSessions',
        // payload: () => ({ filter: someFilter.get() }) // Example dynamic payload
    },
    subscribe: {
        topic: () => 'chatSessionsUpdate', // Example static topic
        handleUpdate: (currentList, update) => {
            const list = currentList ? [...currentList] : [];
            const index = list.findIndex(s => s.id === update.session.id);
            if (update.type === 'add' || (update.type === 'update' && index === -1)) {
                list.push(update.session as ChatSession); // Add or update if not found
            } else if (update.type === 'update' && index !== -1) {
                list[index] = { ...list[index], ...update.session }; // Merge update
            } else if (update.type === 'remove' && index !== -1) {
                list.splice(index, 1); // Remove
            }
            // Sort example
            list.sort((a, b) => b.lastActivity - a.lastActivity);
            return list;
        }
    },
    initialData: []
});

// Example for data dependent on route param
interface ChatHistory { messages: any[] }
interface HistoryUpdate { messages: any[] } // Assuming full state push for now

const $activeChatHistory = createStore<ChatHistory, ChatHistory, { chatId: string }, HistoryUpdate>({
    key: 'activeChatHistory',
    fetch: {
        requestType: 'getChatHistory',
        payload: () => {
            const chatId = router.get()?.params?.chatId; // Get dynamic chatId
            return chatId ? { chatId, limit: 50 } : null; // Return null if no chatId
        }
    },
    subscribe: {
        topic: () => {
            const chatId = router.get()?.params?.chatId;
            return chatId ? `chatHistoryUpdate/${chatId}` : null; // Dynamic topic
        },
        handleUpdate: (currentHistory, update) => {
            // Replace with the full update for now
            return update ? { ...update } : null;
        }
    }
    // No initial data, starts as 'loading'
});

// Need to trigger re-evaluation when router changes for $activeChatHistory
// This part is tricky with the current onMount structure, may need adjustment
// or a helper that listens to dependent stores.
*/
