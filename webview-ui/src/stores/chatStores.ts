import { atom, WritableAtom } from 'nanostores'; // Import WritableAtom
import {
    ChatSession,
    DefaultChatConfig,
    ChatSessionsUpdateData, // Import the union type for updates
    SessionSetDelta,
    SessionAddDelta,
    SessionDeleteDelta,
    SessionUpdateDelta
} from '../../../src/common/types'; // Import Delta types
// Import the new createStore utility
import { createStore, StandardStore } from './utils/createStore';
import { createMutationStore } from './utils/createMutationStore';
import { requestData } from '../utils/communication';
// Import response type for fetch config
import { GetChatSessionsResponse } from '../../../src/webview/handlers/GetChatSessionsHandler';
// Import response type for defaultConfig
import { GetDefaultConfigResponse } from '../../../src/webview/handlers/GetDefaultConfigHandler';
// Import streaming status types
import { STREAMING_STATUS_TOPIC, StreamingStatusPayload } from '../../../src/common/types';


/**
 * Represents the raw payload received from the backend for chat sessions.
 */
type ChatSessionsPayload = {
  sessions: ChatSession[];
};

/**
 * Atom created using the new standard `createStore` utility.
 * It holds `ChatSession[] | null | 'loading' | 'error'`.
 */
// Update data is now the delta payload union type
export const $chatSessions: StandardStore<ChatSession[]> = createStore<
    ChatSession[],           // TData: The data type we want in the store
    GetChatSessionsResponse, // TResponse: The raw response type from the fetch request
    {},                      // PPayload: Payload for fetch (none needed for getChatSessions)
    ChatSessionsUpdateData   // UUpdateData: Now the delta union type
>({
    key: 'chatSessions',
    fetch: {
        requestType: 'getChatSessions',
        // transformResponse to extract the array from the { sessions: [...] } object
        transformResponse: (response) => response?.sessions ?? null,
    },
    subscribe: {
        topic: () => 'chatSessionsUpdate', // Static topic for session list updates
        handleUpdate: (currentState: ChatSession[] | null, updateData: ChatSessionsUpdateData): ChatSession[] | null => { // Correct signature
            console.log(`[$chatSessions handleUpdate] Received update. Type: ${updateData.type}`);
            console.log(`[$chatSessions handleUpdate] Received current state. Length: ${currentState?.length ?? 'null'}`);
            const sessions = currentState ?? []; // Use currentState
            let newSessions: ChatSession[];

            switch (updateData.type) {
                case 'sessionSet':
                    console.log(`[$chatSessions handleUpdate] Setting full list. Length: ${updateData.sessions?.length ?? 'null'}`);
                    newSessions = updateData.sessions ? [...updateData.sessions] : [];
                    break;
                case 'sessionAdd':
                    console.log(`[$chatSessions handleUpdate] Adding session ID: ${updateData.session.id}`);
                    // Avoid adding duplicates
                    newSessions = sessions.filter(s => s.id !== updateData.session.id);
                    newSessions.push(updateData.session);
                    break;
                case 'sessionDelete':
                    console.log(`[$chatSessions handleUpdate] Deleting session ID: ${updateData.sessionId}`);
                    newSessions = sessions.filter(s => s.id !== updateData.sessionId);
                    break;
                case 'sessionUpdate': {
                    console.log(`[$chatSessions handleUpdate] Updating session ID: ${updateData.sessionId}`);
                    const index = sessions.findIndex(s => s.id === updateData.sessionId);
                    if (index !== -1) {
                        const updatedSession = {
                            ...sessions[index],
                            ...(updateData.name !== undefined && { name: updateData.name }),
                            ...(updateData.config !== undefined && { config: updateData.config }),
                            ...(updateData.lastModified !== undefined && { lastModified: updateData.lastModified }),
                        };
                        newSessions = [...sessions];
                        newSessions[index] = updatedSession;
                    } else {
                        console.warn(`[$chatSessions handleUpdate] Session ID ${updateData.sessionId} not found for update.`);
                        newSessions = sessions; // Keep original list
                    }
                    break;
                }
                default:
                     console.warn(`[$chatSessions handleUpdate] Received unhandled update type:`, updateData);
                    newSessions = sessions; // Keep original list
            }

            // Always sort and return the new state
            return newSessions.sort((a, b) => b.lastModified - a.lastModified);
        },
    },
    initialData: [], // Start with an empty array
});

/**
 * Atom created using the new standard `createStore` utility for default config.
 * It holds `DefaultChatConfig | null | 'loading' | 'error'`.
 */
// Define the type for the update data pushed via pubsub
type DefaultConfigUpdate = DefaultChatConfig;

export const $defaultConfig: StandardStore<DefaultChatConfig> = createStore<
    DefaultChatConfig,          // TData
    GetDefaultConfigResponse, // TResponse
    {},                       // PPayload (no payload)
    DefaultConfigUpdate       // UUpdateData
>({
    key: 'defaultConfig',
    fetch: {
        requestType: 'getDefaultConfig',
        // The response is directly the DefaultChatConfig or null
        transformResponse: (response) => response ?? null, // Handle potential null response
    },
    subscribe: {
        topic: () => 'defaultConfigUpdate', // Static topic
        // Assume backend pushes the complete new DefaultChatConfig object
        handleUpdate: (_currentState: DefaultChatConfig | null, updateData: DefaultConfigUpdate): DefaultChatConfig | null => { // Correct signature
            console.log('[$defaultConfig handleUpdate] Received updateData:', updateData);
            const result = updateData ?? null;
            console.log('[$defaultConfig handleUpdate] Returning:', result);
            return result; // Return new state
        },
    },
    // No initial data, starts as 'loading'
});

/**
 * Atom created using the new standard `createStore` utility for streaming status.
 * It holds `boolean` indicating if the AI response is currently streaming.
 */
// Define the type for the update data pushed via pubsub
type StreamingStatusUpdate = StreamingStatusPayload; // Use the imported type

export const $isStreamingResponse: StandardStore<boolean> = createStore<
    boolean,                  // TData: boolean
    undefined,                // TResponse: No fetch request needed
    undefined,                // PPayload: No fetch payload
    StreamingStatusUpdate     // UUpdateData: { streaming: boolean }
>({
    key: 'isStreamingResponse',
    // Add a minimal fetch config to satisfy the type, even though it's not actively used for initial data.
    fetch: {
        requestType: 'internal_unused_streaming_status', // Dummy type
        transformResponse: () => false, // Return a default value matching TData
    },
    subscribe: {
         topic: () => STREAMING_STATUS_TOPIC, // Use the imported topic constant
         // Assume backend pushes { streaming: boolean }
         handleUpdate: (_currentState: boolean | null, updateData: StreamingStatusUpdate): boolean => { // Correct signature, ensure boolean return
             console.log('[$isStreamingResponse handleUpdate] Received updateData:', updateData);
             // Ensure we always return a boolean, even if updateData is unexpected or nullish
             const result = typeof updateData?.streaming === 'boolean' ? updateData.streaming : false;
             console.log('[$isStreamingResponse handleUpdate] Returning:', result);
             return result; // Return boolean state
        },
    },
    initialData: false, // Start with streaming as false
});


// --- Mutation Stores for Chat Sessions ---

// Store for Creating a Chat Session
type CreateChatResult = ChatSession;
export const $createChat = createMutationStore< // Export the store directly
  typeof $chatSessions, // Target Atom for optimistic updates (Renamed)
  ChatSession[],          // Target Atom's state type
  void,                   // Payload type (none for create)
  CreateChatResult        // Result type from performMutation
>({
  targetAtom: $chatSessions, // Use the new store instance
  performMutation: async () => {
    // Backend 'createChat' handler should return the created ChatSession
    const newSession = await requestData<ChatSession>('createChat');
    if (!newSession) throw new Error("Create chat failed: Backend didn't return a session.");
    return newSession;
  },
  // Update currentDataState type and handle 'loading'/'error'
  getOptimisticUpdate: (_payload: void, currentDataState: ChatSession[] | null | 'loading' | 'error') => {
    const currentState = (currentDataState === 'loading' || currentDataState === 'error') ? null : currentDataState;
    const tempId = `temp_${Date.now()}`;
    const tempSession: ChatSession = {
      id: tempId,
      name: 'New Chat...',
      createdAt: Date.now(),
      lastModified: Date.now(),
      config: { useDefaults: true },
      history: [],
    };
    return {
      optimisticState: [...(currentState ?? []), tempSession],
      revertState: currentDataState, // Revert to original state ('loading', 'error', null, or array)
      tempId: tempId
    };
  },
  // Update currentDataState type and handle 'loading'/'error'
  applyMutationResult: (newSession: CreateChatResult, currentDataState: ChatSession[] | null | 'loading' | 'error', tempId?: string) => {
    console.log(`[$createChat applyMutationResult] Applying result for tempId ${tempId}. New session:`, newSession);
    const currentState = (currentDataState === 'loading' || currentDataState === 'error') ? null : currentDataState;
    // Add the new session, replacing the temp one if it exists
    const list = (currentState ?? []).filter(s => s.id !== tempId);
    list.push(newSession);
    list.sort((a, b) => b.lastModified - a.lastModified); // Keep sorted
    return list;
  }
});


// Store for Deleting a Chat Session
type DeleteChatPayload = string;
type DeleteChatResult = { deletedId: string };
export const $deleteChat = createMutationStore< // Export the store directly
  typeof $chatSessions, // Renamed target type
  ChatSession[],
  DeleteChatPayload,
  DeleteChatResult
>({
  targetAtom: $chatSessions, // Use the new store instance
  performMutation: async (chatId: DeleteChatPayload) => {
    await requestData<void>('deleteChat', { chatId });
    return { deletedId: chatId };
  },
  // Update currentDataState type and handle 'loading'/'error'
  getOptimisticUpdate: (chatId: DeleteChatPayload, currentDataState: ChatSession[] | null | 'loading' | 'error') => {
    const currentState = (currentDataState === 'loading' || currentDataState === 'error') ? null : currentDataState;
    return {
      optimisticState: (currentState ?? []).filter(session => session.id !== chatId),
      revertState: currentDataState // Revert to original state
    };
  },
  // Update currentDataState type and handle 'loading'/'error'
  applyMutationResult: (result: DeleteChatResult, currentDataState: ChatSession[] | null | 'loading' | 'error') => {
     const currentState = (currentDataState === 'loading' || currentDataState === 'error') ? null : currentDataState;
     return (currentState ?? []).filter((session: ChatSession) => session.id !== result.deletedId);
  }
});

// TODO: Add updateChatSessionAction if needed

// NOTE: Need to re-import these types after the store definitions
// because the previous import statement was removed by mistake in an earlier step
import { UiMessage, UiMessageContentPart, ChatConfig } from '../../../src/common/types';

// --- Mutation Stores for Chat Messages ---

// Send Message
type SendMessagePayload = {
    chatId: string;
    content: UiMessageContentPart[];
    providerId?: string;
    modelId?: string;
};
type SendMessageResult = void;

const createOptimisticUserMessage = (chatId: string, content: UiMessageContentPart[]): UiMessage => ({
    id: `temp_user_${Date.now()}`,
    role: 'user',
    content: content,
    timestamp: Date.now(),
});

export const $sendMessage = createMutationStore<
  typeof $chatSessions,
  ChatSession[],
  SendMessagePayload,
  SendMessageResult
>({
  // $sendMessage doesn't directly modify $chatSessions list,
  // but it might update the history within *a* session.
  // Since history updates are handled by $activeChatHistory now,
  // we might not need a targetAtom here, or need a different strategy.
  // For now, let's remove the optimistic update on $chatSessions for send.
  // targetAtom: $chatSessions, // Temporarily remove targetAtom
  targetAtom: undefined, // Explicitly undefined
  performMutation: async (payload: SendMessagePayload) => {
    await requestData<void>('sendMessage', payload);
  }
  // Removed getOptimisticUpdate and applyMutationResult for $sendMessage
  // as history updates are handled by $activeChatHistory's subscription.
});



// Delete Message
type DeleteMessagePayload = { chatId: string; messageId: string };
type DeleteMessageResult = { chatId: string; deletedMessageId: string };
export const $deleteMessage = createMutationStore<
    typeof $chatSessions,
    ChatSession[],
    DeleteMessagePayload,
    DeleteMessageResult
>({
    targetAtom: $chatSessions, // Keep target for potential UI updates? Or rely on history push? Let's keep for now.
    performMutation: async (payload: DeleteMessagePayload) => {
        await requestData<void>('deleteMessage', payload);
        return { chatId: payload.chatId, deletedMessageId: payload.messageId };
    },
    // Update currentDataState type and handle 'loading'/'error'
    getOptimisticUpdate: (payload: DeleteMessagePayload, currentDataState: ChatSession[] | null | 'loading' | 'error') => {
        const currentState = (currentDataState === 'loading' || currentDataState === 'error') ? null : currentDataState;
        const { chatId, messageId } = payload;
        const updatedSessions = (currentState ?? []).map(session => {
            if (session.id === chatId) {
                return {
                    ...session,
                    history: session.history.filter(msg => msg.id !== messageId),
                    lastModified: Date.now(),
                };
            }
            return session;
        });
        return {
            optimisticState: updatedSessions,
            revertState: currentDataState, // Revert to original state
        };
    },
    // Update currentDataState type and handle 'loading'/'error'
    applyMutationResult: (result: DeleteMessageResult, currentDataState: ChatSession[] | null | 'loading' | 'error') => {
         const currentState = (currentDataState === 'loading' || currentDataState === 'error') ? null : currentDataState;
         // This confirms the deletion, the optimistic update should already be correct
         return (currentState ?? []).map(session => {
             if (session.id === result.chatId) {
                  return {
                    ...session,
                    history: session.history.filter(msg => msg.id !== result.deletedMessageId)
                 };
            }
            return session;
        });
    }
});

// Clear Chat History
type ClearHistoryPayload = { chatId: string };
type ClearHistoryResult = { chatId: string };
export const $clearChatHistory = createMutationStore<
    typeof $chatSessions,
    ChatSession[],
    ClearHistoryPayload,
    ClearHistoryResult
>({
    targetAtom: $chatSessions, // Keep target for potential UI updates? Or rely on history push? Let's keep for now.
    performMutation: async (payload: ClearHistoryPayload) => {
        await requestData<void>('clearChatHistory', payload);
        return { chatId: payload.chatId };
    },
    // Update currentDataState type and handle 'loading'/'error'
    getOptimisticUpdate: (payload: ClearHistoryPayload, currentDataState: ChatSession[] | null | 'loading' | 'error') => {
        const currentState = (currentDataState === 'loading' || currentDataState === 'error') ? null : currentDataState;
        const { chatId } = payload;
        const updatedSessions = (currentState ?? []).map(session => {
            if (session.id === chatId) {
                return { ...session, history: [], lastModified: Date.now() };
            }
            return session;
        });
        return { optimisticState: updatedSessions, revertState: currentDataState }; // Revert to original state
    },
    // Update currentDataState type and handle 'loading'/'error'
    applyMutationResult: (result: ClearHistoryResult, currentDataState: ChatSession[] | null | 'loading' | 'error') => {
         const currentState = (currentDataState === 'loading' || currentDataState === 'error') ? null : currentDataState;
         // Confirms the clear, optimistic update is likely correct
         return (currentState ?? []).map(session => {
             if (session.id === result.chatId) {
                  return { ...session, history: [] };
            }
            return session;
        });
    }
});

// Execute Tool Action
type ExecuteToolActionPayload = { toolName: string; args: any };
type ExecuteToolActionResult = any;
export const $executeToolAction = createMutationStore<
    undefined, any, ExecuteToolActionPayload, ExecuteToolActionResult
>({
    performMutation: async (payload: ExecuteToolActionPayload) => {
        return await requestData<ExecuteToolActionResult>('executeToolAction', payload);
    },
    // No optimistic update needed
});

// Stop Generation
type StopGenerationResult = void;
export const $stopGeneration = createMutationStore<
    undefined, any, void, StopGenerationResult
>({
    performMutation: async () => {
        await requestData<void>('stopGeneration');
    },
    // No optimistic update needed
});

// Update Chat Config
type UpdateChatConfigPayload = { chatId: string; config: Partial<ChatConfig> };
// The backend handler returns { config: ChatConfig }
type BackendUpdateChatConfigResult = { config: ChatConfig };
// We need chatId in applyMutationResult, so we modify the result type from performMutation
type PerformUpdateChatConfigResult = BackendUpdateChatConfigResult & { chatId: string };

export const $updateChatConfig = createMutationStore<
    typeof $chatSessions,           // Target Atom
    ChatSession[],                  // Target Atom's state type
    UpdateChatConfigPayload,        // Type passed to mutate function
    PerformUpdateChatConfigResult   // Type returned by performMutation (includes chatId)
>({
    targetAtom: $chatSessions, // Use the new store instance
    performMutation: async (payload: UpdateChatConfigPayload): Promise<PerformUpdateChatConfigResult> => {
        // Backend handler returns { config: ChatConfig }
        const result = await requestData<BackendUpdateChatConfigResult>('updateChatConfig', payload);
        if (!result || !result.config) {
            throw new Error('Update chat config failed: Invalid response from backend.');
        }
        // Add chatId to the result object so applyMutationResult can use it
        return { ...result, chatId: payload.chatId };
    },
    // Update currentDataState type and handle 'loading'/'error'
    getOptimisticUpdate: (payload: UpdateChatConfigPayload, currentDataState: ChatSession[] | null | 'loading' | 'error') => {
        const currentState = (currentDataState === 'loading' || currentDataState === 'error') ? null : currentDataState;
        const { chatId, config: configUpdate } = payload;
        const updatedSessions = (currentState ?? []).map(session => {
            if (session.id === chatId) {
                return {
                    ...session,
                    config: { ...session.config, ...configUpdate }, // Apply optimistic update
                    lastModified: Date.now(),
                };
            }
            return session;
        });
        return { optimisticState: updatedSessions, revertState: currentDataState }; // Revert to original state
    },
    // Correct signature: (result, currentDataState, tempId?) - tempId is not relevant here.
    // Update currentDataState type and handle 'loading'/'error'
    applyMutationResult: (result: PerformUpdateChatConfigResult, currentDataState: ChatSession[] | null | 'loading' | 'error', _tempId?: string) => {
         const currentState = (currentDataState === 'loading' || currentDataState === 'error') ? null : currentDataState;
         if (!result || !result.chatId || !result.config) {
             console.error("[$updateChatConfig applyMutationResult] Invalid result received from performMutation:", result);
             // If result is invalid, maybe revert? Or keep optimistic? Let's keep optimistic for now.
             return currentState; // Return the state as it was (potentially optimistic)
         }
         console.log(`[$updateChatConfig applyMutationResult] Applying result for chat ${result.chatId}. New config:`, result.config);
         return (currentState ?? []).map(session => {
             if (session.id === result.chatId) {
                  // Update the config using the confirmed data from the backend result
                  return { ...session, config: result.config, lastModified: Date.now() }; // Update lastModified too
             }
             return session;
         });
    }
});
