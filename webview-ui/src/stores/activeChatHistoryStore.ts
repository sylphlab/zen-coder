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
    UiToolCallPart,
    HistoryUpdateMessageStatusDelta, // Import the new delta type
    UiTextMessagePart // Ensure this is imported
} from '../../../src/common/types'; // Adjust path as needed, added delta types
import { listen, requestData } from '../utils/communication';
import { router } from './router';
import { StandardStore, createStore } from './utils/createStore'; // Import createStore and StandardStore
import { GetChatSessionPayload, GetChatSessionResponse } from '../../../src/webview/handlers/GetChatSessionHandler';
import { GetChatHistoryPayload, GetChatHistoryResponse } from '../../../src/webview/handlers/GetChatHistoryHandler';

// Buffer for chunks arriving before their message frame
const chunkBuffer = new Map<string, string[]>();

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
            const chatId = (route && 'params' in route && route.params && 'chatId' in route.params) ? route.params.chatId : undefined;
            console.log(`[$activeChatHistory fetch.payload] Calculating payload. ChatId: ${chatId}`);
            return chatId ? { chatId } : null; // Return null if no chatId, preventing fetch
        },
        transformResponse: (response) => {
             console.log(`[$activeChatHistory fetch.transformResponse] Transforming fetch response. Length: ${response.history?.length ?? 'null'}`);
            return response.history ?? null;
        }
    },
    // Subscribe configuration also depends on the router
    subscribe: {
        topic: (): string | null => {
            const route = router.get();
            const chatId = (route && 'params' in route && route.params && 'chatId' in route.params) ? route.params.chatId : undefined;
             console.log(`[$activeChatHistory subscribe.topic] Calculating topic. ChatId: ${chatId}`);
            return chatId ? `chatHistoryUpdate/${chatId}` : null; // Dynamic topic based on chatId
        },
        handleUpdate: (currentState: UiMessage[] | null | 'loading', updateData: ChatHistoryUpdateData): UiMessage[] | null => {
            console.log(`[$activeChatHistory handleUpdate ENTRY] Received update type: ${updateData.type}. CurrentState type: ${typeof currentState}. Is array? ${Array.isArray(currentState)}. Length: ${Array.isArray(currentState) ? currentState.length : 'N/A'}`);
            console.log(`[$activeChatHistory handleUpdate] NO .get() CALL HERE. Using received currentState.`);
            const history: UiMessage[] = (currentState === 'loading' || currentState === null) ? [] : currentState;
            let newHistory = [...history]; // Start with a mutable copy

            const route = router.get();
            const currentRouteChatId = (route && 'params' in route && route.params && 'chatId' in route.params) ? route.params.chatId : 'unknown';

            switch (updateData.type) {
                case 'historySet': {
                    console.log(`[$activeChatHistory handleUpdate - historySet] Setting full history. Length: ${updateData.history?.length ?? 'null'}`);
                    let setHistoryState = updateData.history ? [...updateData.history] : [];
                    for (let i = 0; i < setHistoryState.length; i++) {
                        const msg = setHistoryState[i];
                        if (msg.role === 'assistant' && chunkBuffer.has(msg.id)) {
                            const bufferedChunks = chunkBuffer.get(msg.id)!;
                            console.log(`[handleUpdate - historySet] Found ${bufferedChunks.length} buffered chunks for initially set message ${msg.id}. Applying now.`);
                            msg.content = Array.isArray(msg.content) ? msg.content : [];
                            const textPartIndex = msg.content.findIndex(p => p.type === 'text');
                            let currentText = textPartIndex !== -1 ? (msg.content[textPartIndex] as UiTextMessagePart).text : '';
                            const combinedText = currentText + bufferedChunks.join('');
                            if (textPartIndex !== -1) {
                                (msg.content[textPartIndex] as UiTextMessagePart).text = combinedText;
                            } else {
                                msg.content.unshift({ type: 'text', text: combinedText });
                            }
                            if (msg.status === 'pending') {
                                msg.status = undefined;
                            }
                            chunkBuffer.delete(msg.id);
                        }
                         if (msg.status === 'pending' && !updateData.history.find(h => h.id === msg.id)?.status) {
                              msg.status = undefined;
                         }
                    }
                    console.log(`[$activeChatHistory handleUpdate - historySet] Returning new state after potential buffer apply:`, setHistoryState?.map(m => m.id));
                    return setHistoryState;
                }
                case 'historyAddMessage': {
                    console.log(`[$activeChatHistory|${currentRouteChatId} handleUpdate - historyAddMessage] START. Message ID: ${updateData.message.id}. TempID: ${updateData.message.tempId}. Role: ${updateData.message.role}`);
                    const incomingMessage = updateData.message;

                    // 1. Handle User Message Reconciliation
                    if (incomingMessage.role === 'user' && incomingMessage.tempId) {
                        const optimisticIndex = newHistory.findIndex(m => m.tempId === incomingMessage.tempId);
                        if (optimisticIndex !== -1) {
                            console.log(`[$activeChatHistory|${currentRouteChatId} handleUpdate - historyAddMessage] Reconciling optimistic user message (tempId: ${incomingMessage.tempId}) with final ID: ${incomingMessage.id}`);
                            const targetMessage = newHistory[optimisticIndex]; // Get reference
                            targetMessage.id = incomingMessage.id;
                            targetMessage.timestamp = incomingMessage.timestamp;
                            delete targetMessage.tempId; // Clean up tempId
                            console.log(`[$activeChatHistory|${currentRouteChatId} handleUpdate - historyAddMessage] Calculated state after RECONCILING optimistic user message:`, newHistory.map(m => ({ id: m.id, tempId: m.tempId })));
                            return newHistory;
                        } else {
                             console.warn(`[$activeChatHistory|${currentRouteChatId} handleUpdate - historyAddMessage] Received user message delta with tempId ${incomingMessage.tempId}, but no matching optimistic message found.`);
                             // Fall through to default add
                        }
                    }

                     // 2. Handle Assistant Message Reconciliation (Replacing Optimistic Pending)
                     if (incomingMessage.role === 'assistant' && newHistory.length > 0) {
                         const lastMessageIndex = newHistory.length - 1;
                         const lastMessage = newHistory[lastMessageIndex];
                         if (lastMessage.role === 'assistant' && lastMessage.status === 'pending' && lastMessage.id.startsWith('pending-assistant-')) {
                             console.log(`[$activeChatHistory|${currentRouteChatId} handleUpdate - historyAddMessage] Updating OPTIMISTIC pending message ${lastMessage.id} with real frame ID ${incomingMessage.id}`);
                             const targetMessage = newHistory[lastMessageIndex]; // Get reference

                             targetMessage.id = incomingMessage.id; // Update ID
                             targetMessage.timestamp = incomingMessage.timestamp; // Update timestamp
                             targetMessage.status = 'pending'; // Ensure status is 'pending'

                             // Apply buffered chunks immediately if they exist for the *new* ID
                             if (chunkBuffer.has(targetMessage.id)) {
                                 const bufferedChunks = chunkBuffer.get(targetMessage.id)!;
                                 console.log(`[$activeChatHistory|${currentRouteChatId} handleUpdate - historyAddMessage] Applying ${bufferedChunks.length} buffered chunks immediately to updated message ${targetMessage.id}.`);

                                 // Ensure content exists and find/update text part
                                 targetMessage.content = Array.isArray(targetMessage.content) ? targetMessage.content : [];
                                 const textPartIndex = targetMessage.content.findIndex(p => p.type === 'text');
                                 let currentText = textPartIndex !== -1 ? (targetMessage.content[textPartIndex] as UiTextMessagePart).text : '';
                                 const combinedText = currentText + bufferedChunks.join('');

                                  if (textPartIndex !== -1) {
                                     (targetMessage.content[textPartIndex] as UiTextMessagePart).text = combinedText;
                                 } else {
                                     targetMessage.content.unshift({ type: 'text', text: combinedText });
                                 }
                                 targetMessage.status = undefined; // Remove pending status as content is now added
                                 chunkBuffer.delete(targetMessage.id);
                                 console.log(`[$activeChatHistory|${currentRouteChatId} handleUpdate - historyAddMessage] Applied buffered chunks and removed pending status for ${targetMessage.id}.`);
                             } else {
                                 console.log(`[$activeChatHistory|${currentRouteChatId} handleUpdate - historyAddMessage] No buffered chunks for ${targetMessage.id}, keeping status as pending.`);
                             }
                             console.log(`[$activeChatHistory|${currentRouteChatId} handleUpdate - historyAddMessage] Calculated state after UPDATING optimistic message:`, newHistory.map(m => ({ id: m.id, status: m.status })));
                             return newHistory; // Return updated history
                         }
                     }

                    // 3. Check for duplicate ID before default add
                    const existingIndex = newHistory.findIndex(m => m.id === incomingMessage.id);
                    if (existingIndex !== -1) {
                         console.warn(`[$activeChatHistory|${currentRouteChatId} handleUpdate - historyAddMessage] Message ID ${incomingMessage.id} already exists (and not reconciled). Skipping add.`);
                         return newHistory;
                    }

                    // 4. Default Add
                    let messageToAdd = { ...incomingMessage };
                     if (messageToAdd.role === 'assistant' && chunkBuffer.has(messageToAdd.id)) {
                          const bufferedChunks = chunkBuffer.get(messageToAdd.id)!;
                          console.log(`[handleUpdate] Found ${bufferedChunks.length} buffered chunks for ${messageToAdd.id} during normal add. Applying now.`);
                          messageToAdd.content = Array.isArray(messageToAdd.content) ? messageToAdd.content : [];
                          const textPartIndex = messageToAdd.content.findIndex(p => p.type === 'text');
                          let currentText = textPartIndex !== -1 ? (messageToAdd.content[textPartIndex] as UiTextMessagePart).text : '';
                          const combinedText = currentText + bufferedChunks.join('');
                           if (textPartIndex !== -1) {
                               (messageToAdd.content[textPartIndex] as UiTextMessagePart).text = combinedText;
                           } else {
                               messageToAdd.content.unshift({ type: 'text', text: combinedText });
                           }
                          if (messageToAdd.status === 'pending') {
                               messageToAdd.status = undefined;
                          }
                          chunkBuffer.delete(messageToAdd.id);
                          }
                    newHistory.push(messageToAdd);
                    console.log(`[$activeChatHistory handleUpdate - historyAddMessage] Calculated state after ADDING message ${messageToAdd.id}:`, newHistory.map(m => ({ id: m.id, tempId: m.tempId })));
                    return newHistory;
                }
                case 'historyAppendChunk': {
                    console.log(`[$activeChatHistory|${currentRouteChatId} handleUpdate - historyAppendChunk] START. Appending chunk to message ID: ${updateData.messageId}. Chunk: "${updateData.textChunk}"`);
                    let messageIndex = newHistory.findIndex(m => m.id === updateData.messageId);

                    if (messageIndex === -1) {
                        if (!chunkBuffer.has(updateData.messageId)) {
                            chunkBuffer.set(updateData.messageId, []);
                        }
                        chunkBuffer.get(updateData.messageId)!.push(updateData.textChunk);
                        console.log(`[$activeChatHistory|${currentRouteChatId} handleUpdate - historyAppendChunk] Buffering chunk for ${updateData.messageId}. Buffer size: ${chunkBuffer.get(updateData.messageId)!.length}`);
                        return newHistory; // State unchanged yet
                    }

                    // Message exists, modify it in the copied array
                    const messageToUpdate = newHistory[messageIndex];
                    const wasPending = messageToUpdate.status === 'pending';

                    // Ensure content is an array
                    messageToUpdate.content = Array.isArray(messageToUpdate.content) ? messageToUpdate.content : [];
                    const textPartIndex = messageToUpdate.content.findIndex(p => p.type === 'text');

                    if (textPartIndex !== -1) {
                        (messageToUpdate.content[textPartIndex] as UiTextMessagePart).text += updateData.textChunk;
                    } else {
                        // Add new text part, even if chunk is empty initially
                        messageToUpdate.content.push({ type: 'text', text: updateData.textChunk });
                    }

                     // Clear pending status if it was pending (receiving *any* chunk means streaming has started)
                    if (wasPending) {
                         messageToUpdate.status = undefined;
                         console.log(`[$activeChatHistory|${currentRouteChatId} handleUpdate - historyAppendChunk] Cleared pending status for message ${messageToUpdate.id} upon receiving chunk.`);
                    }

                    return newHistory; // Return the modified array
                }
                 case 'historyUpdateMessageStatus': {
                    console.log(`[$activeChatHistory|${currentRouteChatId} handleUpdate - historyUpdateMessageStatus] START. Updating status for message ID: ${updateData.messageId} to '${updateData.status ?? 'undefined'}' from ${typeof updateData.status}`);
                    const messageIndex = newHistory.findIndex(m => m.id === updateData.messageId);
                    if (messageIndex === -1) {
                         console.warn(`[$activeChatHistory|${currentRouteChatId} handleUpdate - historyUpdateMessageStatus] Message ID ${updateData.messageId} not found. Update dropped.`);
                        return newHistory; // Return original array reference
                    }

                    const messageToUpdate = newHistory[messageIndex];
                    const currentStatus = messageToUpdate.status;
                    const newStatus = updateData.status;

                    // Create a new object for the update to ensure immutability detection
                    const updatedMessage = { ...messageToUpdate };
                    let statusChanged = false;

                    if (newStatus === undefined) {
                        // **Final Simplified Logic**: If the final status update requests undefined, ALWAYS clear the status.
                        if (currentStatus !== undefined) {
                             updatedMessage.status = undefined;
                             console.log(`[$activeChatHistory|${currentRouteChatId} handleUpdate - historyUpdateMessageStatus] Cleared final status for message ${updatedMessage.id} (was ${currentStatus}). Update from server with status=${updateData.status}`);
                             statusChanged = true;
                        } else {
                             console.log(`[$activeChatHistory|${currentRouteChatId} handleUpdate - historyUpdateMessageStatus] Status for message ${updatedMessage.id} is already undefined. No change.`);
                        }
                    } else if (currentStatus !== newStatus) { // Update if the new status is different (e.g., setting 'error')
                        updatedMessage.status = newStatus;
                         console.log(`[$activeChatHistory|${currentRouteChatId} handleUpdate - historyUpdateMessageStatus] Set status to '${newStatus}' for message ${updatedMessage.id}.`);
                         statusChanged = true;
                    }

                    // Only update the array if the status actually changed
                    if (statusChanged) {
                        newHistory[messageIndex] = updatedMessage;
                        console.log(`[$activeChatHistory|${currentRouteChatId} handleUpdate - historyUpdateMessageStatus] Final state for message ${updatedMessage.id}: status='${updatedMessage.status ?? 'undefined'}'`);
                        return newHistory; // Return the modified array
                    } else {
                         console.log(`[$activeChatHistory|${currentRouteChatId} handleUpdate - historyUpdateMessageStatus] Status for message ${messageToUpdate.id} did not change from '${currentStatus}'.`);
                         return newHistory; // Return the original array reference if no change occurred
                    }
                }

                case 'historyAddContentPart': {
                    console.log(`[$activeChatHistory handleUpdate] Adding content part to message ID: ${updateData.messageId}`);
                    const messageIndex = newHistory.findIndex(m => m.id === updateData.messageId);
                    if (messageIndex === -1) {
                        console.warn(`[handleUpdate] Message ID ${updateData.messageId} not found for addContentPart. Update dropped.`);
                        return newHistory;
                    }
                    const messageToUpdate = newHistory[messageIndex];
                    const content = Array.isArray(messageToUpdate.content) ? [...messageToUpdate.content, updateData.part] : [updateData.part];
                    messageToUpdate.content = content;
                    // Clear pending if adding a content part (implies streaming started)
                    if (messageToUpdate.status === 'pending') {
                        messageToUpdate.status = undefined;
                        console.log(`[$activeChatHistory|${currentRouteChatId} handleUpdate - historyAddContentPart] Cleared pending status for message ${messageToUpdate.id}.`);
                    }
                    console.log(`[$activeChatHistory handleUpdate - historyAddContentPart] Calculated new state.`);
                    return newHistory;
                }


                case 'historyUpdateToolCall': {
                    console.log(`[$activeChatHistory handleUpdate] Updating tool call ID: ${updateData.toolCallId} in message ID: ${updateData.messageId}`);
                    const messageIndex = newHistory.findIndex(m => m.id === updateData.messageId);
                    if (messageIndex === -1) {
                        console.warn(`[handleUpdate] Message ID ${updateData.messageId} not found for updateToolCall. Update dropped.`);
                        return newHistory;
                    }
                     const messageToUpdate = newHistory[messageIndex];
                     const content = Array.isArray(messageToUpdate.content) ? [...messageToUpdate.content] : [];
                    const toolCallIndex = content.findIndex(p => p.type === 'tool-call' && p.toolCallId === updateData.toolCallId);

                    if (toolCallIndex === -1) {
                        console.warn(`[handleUpdate] Tool call ID ${updateData.toolCallId} not found in message ID ${updateData.messageId}. Update dropped.`);
                        return newHistory;
                    }

                    const originalToolCall = content[toolCallIndex] as UiToolCallPart;
                    const updatedToolCall = {
                        ...originalToolCall,
                        status: updateData.status ?? originalToolCall.status,
                        result: updateData.result ?? originalToolCall.result,
                        progress: updateData.progress ?? originalToolCall.progress,
                    };
                    if (updatedToolCall.status === 'complete' || updatedToolCall.status === 'error') {
                         updatedToolCall.progress = undefined;
                    }
                    content[toolCallIndex] = updatedToolCall;
                    messageToUpdate.content = content;

                    const wasPending = messageToUpdate.status === 'pending';
                    if (wasPending && (updatedToolCall.status === 'complete' || updatedToolCall.status === 'error')) {
                         messageToUpdate.status = undefined;
                         console.log(`[$activeChatHistory|${currentRouteChatId} handleUpdate - historyUpdateToolCall] Cleared pending status for message ${messageToUpdate.id} upon tool call completion/error.`);
                    }
                     console.log(`[$activeChatHistory handleUpdate - historyUpdateToolCall] Calculated new state.`);
                    return newHistory;
                }

                case 'historyDeleteMessage': {
                    console.log(`[$activeChatHistory handleUpdate - historyDeleteMessage] Deleting message ID: ${updateData.messageId}`);
                    const filteredHistory = newHistory.filter(m => m.id !== updateData.messageId);
                     console.log(`[$activeChatHistory handleUpdate - historyDeleteMessage] Calculated new state.`);
                    return filteredHistory;
                }
                case 'historyClear': {
                    console.log(`[$activeChatHistory handleUpdate - historyClear] Clearing history.`);
                    return [];
                }
                default:
                    console.warn(`[$activeChatHistory handleUpdate] Received unhandled update type:`, updateData);
                    return newHistory;
            }
// --- DEBUG: Log full message state after every handleUpdate call ---
try {
  const debugHistory = Array.isArray(newHistory) ? newHistory : [];
  console.log('[DEBUG][$activeChatHistory handleUpdate END] Message state:', debugHistory.map(m => ({
    id: m.id,
    status: m.status,
    tempId: m.tempId,
    role: m.role,
    contentLength: Array.isArray(m.content) ? m.content.length : 0
  })));
} catch (e) {
  console.error('[DEBUG][$activeChatHistory handleUpdate END] Error logging message state:', e);
}
        }
    },
    dependsOn: [router],
    initialData: null
});
