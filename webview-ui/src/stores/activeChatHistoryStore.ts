import { atom, onMount, WritableAtom } from 'nanostores'; // Keep onMount for $activeChatSession
import {
    UiMessage,
    ChatSession,
    ChatHistoryUpdateData, // Import the union type for updates
    HistorySetDelta,
    HistoryAddMessageDelta,
    HistoryAppendChunkDelta,
    HistoryUpdateToolCallDelta,
    HistoryDeleteMessageDelta,
    HistoryClearDelta,
    HistoryAddContentPartDelta,
    UiMessageContentPart,
    UiToolCallPart
} from '../../../src/common/types'; // Adjust path as needed, added delta types
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
// Fetches initial history and subscribes to delta updates based on the current router chatId.
// Update data is now the delta payload union type
export const $activeChatHistory: StandardStore<UiMessage[]> = createStore<
    UiMessage[],                  // TData: Store holds array of messages
    GetChatHistoryResponse,       // TResponse: Raw response from fetch ('getChatHistory')
    GetChatHistoryPayload,        // PPayload: Payload for fetch ({ chatId })
    ChatHistoryUpdateData         // UUpdateData: Now the delta union type
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
        handleUpdate: (currentState: UiMessage[] | null, updateData: ChatHistoryUpdateData): UiMessage[] | null => { // Correct signature
            // --- Explicitly log parameter received ---
            console.log(`[$activeChatHistory handleUpdate ENTRY] Received update type: ${updateData.type}. CurrentState is array? ${Array.isArray(currentState)}. CurrentState length: ${currentState?.length ?? 'null'}`);
            // --- Ensure no .get() call is happening here ---
            console.log(`[$activeChatHistory handleUpdate] NO .get() CALL HERE. Using received currentState.`);

            const history: UiMessage[] = currentState ?? []; // Use currentState passed in

            switch (updateData.type) {
                case 'historySet':
                    console.log(`[$activeChatHistory handleUpdate] Setting full history. Length: ${updateData.history?.length ?? 'null'}`);
                    return updateData.history ? [...updateData.history] : null; // Return new state

                case 'historyAddMessage': {
                    console.log(`[$activeChatHistory handleUpdate] Adding message ID: ${updateData.message.id}`);
                    const newState = [...history, updateData.message];
                    console.log(`[$activeChatHistory handleUpdate] Calculated state after adding ${updateData.message.id}:`, newState.map(m => m.id));
                    return newState; // Return new state
                }
                case 'historyAppendChunk': {
                    console.log(`[$activeChatHistory handleUpdate] Appending chunk to message ID: ${updateData.messageId}`);
                    const messageIndex = history.findIndex(m => m.id === updateData.messageId);

                    if (messageIndex === -1) {
                        console.error(`[handleUpdate] CRITICAL: Message ID ${updateData.messageId} not found for appendChunk. Update dropped.`);
                        return history; // Return original state
                    }

                    const targetMessage = history[messageIndex];
                    const currentContent = Array.isArray(targetMessage.content) ? targetMessage.content : [];
                    const lastPart = currentContent[currentContent.length - 1];

                    // Removed the duplicate declarations below

                    let newContent: UiMessageContentPart[];
                    if (lastPart && lastPart.type === 'text') {
                        newContent = [
                            ...currentContent.slice(0, -1),
                            { ...lastPart, text: lastPart.text + updateData.textChunk }
                        ];
                    } else {
                        newContent = [...currentContent, { type: 'text', text: updateData.textChunk }];
                    }

                    const newHistory = [...history];
                    newHistory[messageIndex] = { ...targetMessage, content: newContent };
                    return newHistory; // Return new state
                }

                case 'historyAddContentPart': {
                    console.log(`[$activeChatHistory handleUpdate] Adding content part to message ID: ${updateData.messageId}`);
                    const messageIndex = history.findIndex(m => m.id === updateData.messageId);
                    if (messageIndex === -1) {
                        console.warn(`[handleUpdate] Message ID ${updateData.messageId} not found for addContentPart. Update dropped.`);
                        return history; // Return original state
                    }
                    const targetMessage = history[messageIndex];
                    const content = Array.isArray(targetMessage.content) ? [...targetMessage.content, updateData.part] : [updateData.part];

                    const newHistory = [...history];
                    newHistory[messageIndex] = { ...targetMessage, content };
                    return newHistory; // Return new state
                }


                case 'historyUpdateToolCall': {
                    console.log(`[$activeChatHistory handleUpdate] Updating tool call ID: ${updateData.toolCallId} in message ID: ${updateData.messageId}`);
                    const messageIndex = history.findIndex(m => m.id === updateData.messageId);
                    if (messageIndex === -1) {
                        console.warn(`[handleUpdate] Message ID ${updateData.messageId} not found for updateToolCall. Update dropped.`);
                        return history; // Return original state
                    }
                    const targetMessage = history[messageIndex];
                    const content = Array.isArray(targetMessage.content) ? [...targetMessage.content] : [];
                    const toolCallIndex = content.findIndex(p => p.type === 'tool-call' && p.toolCallId === updateData.toolCallId);

                    if (toolCallIndex === -1) {
                        console.warn(`[handleUpdate] Tool call ID ${updateData.toolCallId} not found in message ID ${updateData.messageId}. Update dropped.`);
                        return history; // Return original state
                    }

                    // Update the specific tool call part immutably
                    const updatedToolCall = {
                        ...(content[toolCallIndex] as UiToolCallPart), // Cast is safe due to findIndex check
                        status: updateData.status ?? (content[toolCallIndex] as UiToolCallPart).status,
                        result: updateData.result ?? (content[toolCallIndex] as UiToolCallPart).result,
                        progress: updateData.progress ?? (content[toolCallIndex] as UiToolCallPart).progress,
                    };
                    // If status is complete or error, clear progress
                    if (updatedToolCall.status === 'complete' || updatedToolCall.status === 'error') {
                         updatedToolCall.progress = undefined;
                    }

                    const newContent = [...content];
                    newContent[toolCallIndex] = updatedToolCall;

                    const newHistory = [...history];
                    newHistory[messageIndex] = { ...targetMessage, content: newContent };
                    return newHistory; // Return new state
                }

                case 'historyDeleteMessage':
                    console.log(`[$activeChatHistory handleUpdate] Deleting message ID: ${updateData.messageId}`);
                    return history.filter(m => m.id !== updateData.messageId); // Return new state

                case 'historyClear':
                    console.log(`[$activeChatHistory handleUpdate] Clearing history.`);
                    return []; // Return new state (empty array)

                default:
                    console.warn(`[$activeChatHistory handleUpdate] Received unhandled update type:`, updateData);
                    return history; // Return original state
            }
        }
    },
    // Store depends on the router to recalculate payload and topic
    dependsOn: [router],
    initialData: null // Explicitly null, createStore handles 'loading'
});

// Removed the old onMount implementation for $activeChatHistory
