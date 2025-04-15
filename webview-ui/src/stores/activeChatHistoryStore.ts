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
    HistoryUpdateMessageStatusDelta // Import the new delta type
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
        // Correct the currentState type to match the modified createStore signature
        handleUpdate: (currentState: UiMessage[] | null | 'loading', updateData: ChatHistoryUpdateData): UiMessage[] | null => {
            // --- Explicitly log parameter received ---
             // Note: createStore actually passes null if the state is 'loading' or 'error'
            console.log(`[$activeChatHistory handleUpdate ENTRY] Received update type: ${updateData.type}. CurrentState type: ${typeof currentState}. Is array? ${Array.isArray(currentState)}. Length: ${Array.isArray(currentState) ? currentState.length : 'N/A'}`);
             // --- Ensure no .get() call is happening here ---
            console.log(`[$activeChatHistory handleUpdate] NO .get() CALL HERE. Using received currentState.`);

            // Explicitly handle 'loading' state passed from createStore (which actually passes null for loading/error)
            // Initialize history as empty array if currentState is null or loading
            const history: UiMessage[] = (currentState === 'loading' || currentState === null) ? [] : currentState;


            switch (updateData.type) {
                case 'historySet': { // Added block scope
                    console.log(`[$activeChatHistory handleUpdate - historySet] Setting full history. Length: ${updateData.history?.length ?? 'null'}`);
                    let setHistoryState = updateData.history ? [...updateData.history] : []; // Ensure array even if null
                    // Check buffer for any messages added while history was loading/null
                    for (let i = 0; i < setHistoryState.length; i++) {
                        const msg = setHistoryState[i];
                        // Check both role and buffer for assistant messages
                        if (msg.role === 'assistant' && chunkBuffer.has(msg.id)) {
                            const bufferedChunks = chunkBuffer.get(msg.id)!;
                            console.log(`[handleUpdate - historySet] Found ${bufferedChunks.length} buffered chunks for initially set message ${msg.id}. Applying now.`);
                            msg.content = Array.isArray(msg.content) ? msg.content : [];
                            let currentText = '';
                            if (msg.content.length > 0 && msg.content[0].type === 'text') {
                                currentText = msg.content[0].text;
                            }
                            const combinedText = currentText + bufferedChunks.join('');
                            if (msg.content.length > 0 && msg.content[0].type === 'text') {
                                msg.content[0].text = combinedText;
                            } else {
                                msg.content = [{ type: 'text', text: combinedText }, ...msg.content.filter(p => p.type !== 'text')];
                            }
                             // Clear pending status if chunks were applied
                            if (msg.status === 'pending') {
                                delete msg.status;
                            }
                            chunkBuffer.delete(msg.id);
                        }
                         // Clear any lingering pending status if history is set (unless explicitly set by backend)
                         if (msg.status === 'pending' && !updateData.history.find(h => h.id === msg.id)?.status) {
                              delete msg.status;
                         }
                    }
                    console.log(`[$activeChatHistory handleUpdate - historySet] Returning new state after potential buffer apply:`, setHistoryState?.map(m => m.id));
                    return setHistoryState; // Return new state (guaranteed array)
                }
                case 'historyAddMessage': {
                     // Use chatId from outer scope for logging
                    const route = router.get();
                    const chatId = (route && 'params' in route && route.params && 'chatId' in route.params) ? route.params.chatId : 'unknown';
                    console.log(`[$activeChatHistory|${chatId} handleUpdate - historyAddMessage] START. Adding message ID: ${updateData.message.id}. Message Role: ${updateData.message.role}`); // Added chatId
                    const incomingMessage = updateData.message;
                    const newHistory = [...history]; // Create mutable copy

                    const existingIndex = newHistory.findIndex(m => m.id === incomingMessage.id);
                    if (existingIndex !== -1) {
                        // If it's the Assistant frame arriving and the existing one is 'pending', replace it.
                        if (incomingMessage.role === 'assistant' && newHistory[existingIndex].status === 'pending') {
                            console.log(`[$activeChatHistory|${chatId} handleUpdate - historyAddMessage] Replacing existing pending message ${newHistory[existingIndex].id} with real frame ${incomingMessage.id}`); // Added chatId and context
                            let messageToAdd = { ...incomingMessage }; // Copy backend message
                            // Apply buffered chunks using the *new* real ID
                            if (chunkBuffer.has(messageToAdd.id)) {
                                const bufferedChunks = chunkBuffer.get(messageToAdd.id)!;
                                console.log(`[$activeChatHistory|${chatId} handleUpdate - historyAddMessage] Found ${bufferedChunks.length} buffered chunks for ${messageToAdd.id}. Applying to replaced frame.`); // Added chatId
                                messageToAdd.content = Array.isArray(messageToAdd.content) ? messageToAdd.content : [];
                                let currentText = '';
                                if (messageToAdd.content.length > 0 && messageToAdd.content[0].type === 'text') {
                                    currentText = messageToAdd.content[0].text;
                                }
                                const combinedText = currentText + bufferedChunks.join('');
                                if (messageToAdd.content.length > 0 && messageToAdd.content[0].type === 'text') {
                                    messageToAdd.content = [{ ...messageToAdd.content[0], text: combinedText }, ...messageToAdd.content.slice(1)];
                                } else {
                                    messageToAdd.content = [{ type: 'text', text: combinedText }, ...messageToAdd.content.filter(p => p.type !== 'text')];
                                }
                                // Clear pending status since we applied chunks or got the real frame
                                delete messageToAdd.status; // Pending status removed as we have the real frame + chunks
                                chunkBuffer.delete(messageToAdd.id);
                            }
                            // Replace the existing pending message with the real one
                            newHistory[existingIndex] = messageToAdd;
                            console.log(`[$activeChatHistory|${chatId} handleUpdate - historyAddMessage] Calculated state after REPLACING existing pending message:`, newHistory.map(m => m.id)); // Added chatId
                            return newHistory;
                        } else {
                             console.warn(`[$activeChatHistory|${chatId} handleUpdate - historyAddMessage] Message ID ${incomingMessage.id} already exists and is not a replaceable pending message. Skipping add.`); // Added chatId
                            return newHistory; // Return current state
                        }
                    }

                    // Check if this message is replacing an OPTIMISTIC 'pending' message (added by handleSend)
                     // Check if this message is replacing an OPTIMISTIC 'pending' message (added by handleSend)
                     if (incomingMessage.role === 'assistant' && newHistory.length > 0) {
                         const lastMessage = newHistory[newHistory.length - 1];
                         // Check if the last message is an assistant message marked as 'pending' (the optimistic one)
                         if (lastMessage.role === 'assistant' && lastMessage.status === 'pending' && lastMessage.id.startsWith('pending-assistant-')) {
                             console.log(`[$activeChatHistory|${chatId} handleUpdate - historyAddMessage] Replacing OPTIMISTIC pending message ${lastMessage.id} with real frame ${incomingMessage.id}`); // Added chatId and context
                             let messageToAdd = { ...incomingMessage }; // Copy backend message

                             // Apply buffered chunks using the *new* real ID
                             if (chunkBuffer.has(messageToAdd.id)) {
                                 const bufferedChunks = chunkBuffer.get(messageToAdd.id)!;
                                 console.log(`[$activeChatHistory|${chatId} handleUpdate - historyAddMessage] Found ${bufferedChunks.length} buffered chunks for ${messageToAdd.id}. Applying to OPTIMISTIC replaced frame.`); // Added chatId
                                 messageToAdd.content = Array.isArray(messageToAdd.content) ? messageToAdd.content : [];
                                 let currentText = '';
                                 if (messageToAdd.content.length > 0 && messageToAdd.content[0].type === 'text') {
                                     currentText = messageToAdd.content[0].text;
                                 }
                                 const combinedText = currentText + bufferedChunks.join('');
                                 if (messageToAdd.content.length > 0 && messageToAdd.content[0].type === 'text') {
                                     messageToAdd.content = [{ ...messageToAdd.content[0], text: combinedText }, ...messageToAdd.content.slice(1)];
                                 } else {
                                     messageToAdd.content = [{ type: 'text', text: combinedText }, ...messageToAdd.content.filter(p => p.type !== 'text')];
                                 }
                                 // Clear pending status since we applied chunks or got the real frame
                                delete messageToAdd.status; // Pending status removed as we have the real frame + chunks
                                 chunkBuffer.delete(messageToAdd.id);
                             }
                             // Replace the last element (the pending one) with the real one
                             newHistory[newHistory.length - 1] = messageToAdd;
                             console.log(`[$activeChatHistory|${chatId} handleUpdate - historyAddMessage] Calculated state after REPLACING OPTIMISTIC pending message:`, newHistory.map(m => m.id)); // Added chatId
                             return newHistory;
                         }
                     }

                    // Default add (User message or Assistant frame not replacing pending)
                    let messageToAdd = { ...incomingMessage }; // Make a copy
                     // Apply buffer just in case (e.g., if historySet missed it)
                     if (messageToAdd.role === 'assistant' && chunkBuffer.has(messageToAdd.id)) {
                          const bufferedChunks = chunkBuffer.get(messageToAdd.id)!;
                          console.log(`[handleUpdate] Found ${bufferedChunks.length} buffered chunks for ${messageToAdd.id} during normal add. Applying now.`);
                          messageToAdd.content = Array.isArray(messageToAdd.content) ? messageToAdd.content : [];
                          let currentText = '';
                          if (messageToAdd.content.length > 0 && messageToAdd.content[0].type === 'text') {
                              currentText = messageToAdd.content[0].text;
                          }
                          const combinedText = currentText + bufferedChunks.join('');
                          if (messageToAdd.content.length > 0 && messageToAdd.content[0].type === 'text') {
                               messageToAdd.content = [{ ...messageToAdd.content[0], text: combinedText }, ...messageToAdd.content.slice(1)];
                          } else {
                              messageToAdd.content = [{ type: 'text', text: combinedText }, ...messageToAdd.content.filter(p => p.type !== 'text')];
                          }
                           // Clear pending status if chunks were applied
                          if (messageToAdd.status === 'pending') {
                               delete messageToAdd.status;
                          }
                          chunkBuffer.delete(messageToAdd.id);
                     }

                    const finalState = [...newHistory, messageToAdd];
                    console.log(`[$activeChatHistory handleUpdate - historyAddMessage] Calculated state after ADDING message ${messageToAdd.id}:`, finalState.map(m => m.id));
                    return finalState;
                }
                case 'historyAppendChunk': {
                    // Use chatId from outer scope for logging
                    const route = router.get();
                    const chatId = (route && 'params' in route && route.params && 'chatId' in route.params) ? route.params.chatId : 'unknown';
                    console.log(`[$activeChatHistory|${chatId} handleUpdate - historyAppendChunk] START. Appending chunk to message ID: ${updateData.messageId}. Chunk: "${updateData.textChunk}"`); // Added chatId
                    let messageIndex = history.findIndex(m => m.id === updateData.messageId);

                    if (messageIndex === -1) {
                        // Message frame hasn't arrived yet OR doesn't exist, buffer the chunk
                        if (!chunkBuffer.has(updateData.messageId)) {
                            chunkBuffer.set(updateData.messageId, []);
                        }
                        chunkBuffer.get(updateData.messageId)!.push(updateData.textChunk);
                        console.log(`[$activeChatHistory|${chatId} handleUpdate - historyAppendChunk] Buffering chunk for ${updateData.messageId}. Buffer size: ${chunkBuffer.get(updateData.messageId)!.length}`); // Added chatId
                        return history; // Return original state, chunk is buffered
                    }

                    // Message exists, append chunk directly
                    const targetMessage = history[messageIndex];
                    const newHistory = [...history]; // Create mutable copy

                    // Ensure content is an array before processing
                    const currentContent = Array.isArray(targetMessage.content) ? targetMessage.content : [];
                    const lastPart = currentContent[currentContent.length - 1];

                    let newContent: UiMessageContentPart[];
                    if (lastPart && lastPart.type === 'text') {
                        newContent = [
                            ...currentContent.slice(0, -1),
                            { ...lastPart, text: lastPart.text + updateData.textChunk }
                        ];
                    } else {
                        newContent = [...currentContent, { type: 'text', text: updateData.textChunk }];
                    }

                    // Update the message, clearing 'pending' status on first non-empty chunk
                    const updatedMessage = {
                         ...targetMessage,
                         content: newContent,
                     // Clear pending status if it was pending and we got a non-empty chunk
                     status: targetMessage.status === 'pending' && updateData.textChunk.trim() !== '' ? undefined : targetMessage.status
                };
                 if (updatedMessage.status === undefined && targetMessage.status === 'pending') {
                     console.log(`[$activeChatHistory|${chatId} handleUpdate - historyAppendChunk] Cleared pending status for message ${updatedMessage.id} upon receiving first chunk.`); // Added log
                 }

                newHistory[messageIndex] = updatedMessage;
                return newHistory; // Return new state
                }
                 case 'historyUpdateMessageStatus': { // Handle the new delta type
                     // Use chatId from outer scope for logging
                    const route = router.get();
                    const chatId = (route && 'params' in route && route.params && 'chatId' in route.params) ? route.params.chatId : 'unknown';
                    console.log(`[$activeChatHistory|${chatId} handleUpdate - historyUpdateMessageStatus] START. Updating status for message ID: ${updateData.messageId} to '${updateData.status ?? 'undefined'}'`); // Added chatId
                    const messageIndex = history.findIndex(m => m.id === updateData.messageId);
                    if (messageIndex === -1) {
                         // It's possible the message (especially an optimistic pending one) was removed due to an error before this status update arrived.
                         console.warn(`[$activeChatHistory|${chatId} handleUpdate - historyUpdateMessageStatus] Message ID ${updateData.messageId} not found. Update dropped.`); // Added chatId
                        return history; // Return original state
                    }
                    const newHistory = [...history];
                    const updatedMessage = { ...newHistory[messageIndex] };

                    if (updateData.status) {
                        updatedMessage.status = updateData.status;
                    } else {
                        // Remove status if undefined in payload (e.g., stream finished successfully)
                        delete updatedMessage.status;
                    }
                    newHistory[messageIndex] = updatedMessage;
                    console.log(`[$activeChatHistory|${chatId} handleUpdate - historyUpdateMessageStatus] Calculated new state for message ${updatedMessage.id}: status='${updatedMessage.status ?? 'undefined'}'`); // Added chatId and more detail
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
                     // Ensure content is an array before adding
                    const content = Array.isArray(targetMessage.content) ? [...targetMessage.content, updateData.part] : [updateData.part];

                    const newHistory = [...history];
                    newHistory[messageIndex] = { ...targetMessage, content };
                     // Clear pending status if it was pending and we added a real content part (like a tool call)
                    if (newHistory[messageIndex].status === 'pending') {
                        delete newHistory[messageIndex].status;
                    }
                    console.log(`[$activeChatHistory handleUpdate - historyAddContentPart] Calculated new state.`);
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
                     // Ensure content is an array before searching
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
                    // Also clear message 'pending' status if a tool call finishes
                     const messageStatus = (updatedToolCall.status === 'complete' || updatedToolCall.status === 'error') && targetMessage.status === 'pending'
                        ? undefined
                        : targetMessage.status;

                    newHistory[messageIndex] = { ...targetMessage, content: newContent, status: messageStatus };
                     console.log(`[$activeChatHistory handleUpdate - historyUpdateToolCall] Calculated new state.`);
                    return newHistory; // Return new state
                }

                case 'historyDeleteMessage': {
                    console.log(`[$activeChatHistory handleUpdate - historyDeleteMessage] Deleting message ID: ${updateData.messageId}`);
                    const newState = history.filter(m => m.id !== updateData.messageId);
                     console.log(`[$activeChatHistory handleUpdate - historyDeleteMessage] Calculated new state.`);
                    return newState; // Return new state
                }
                case 'historyClear': {
                    console.log(`[$activeChatHistory handleUpdate - historyClear] Clearing history.`);
                    return []; // Return new state (empty array)
                }
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
