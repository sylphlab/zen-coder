import { atom, WritableAtom } from 'nanostores'; // Import WritableAtom
import {
    ChatSession,
    DefaultChatConfig,
    ChatSessionsUpdateData, // Import the union type for updates
    SessionSetDelta,
    SessionAddDelta,
    SessionDeleteDelta,
    SessionUpdateDelta,
    STREAMING_STATUS_TOPIC, // Import topic constant
    StreamingStatusPayload, // Import payload type
    SUGGESTED_ACTIONS_TOPIC_PREFIX, // Import suggested actions topic prefix
    SuggestedActionsPayload, // Import suggested actions payload type
    SuggestedAction, // Import SuggestedAction type
    UiMessage, // Import UiMessage for mutations
    UiMessageContentPart, // Import UiMessageContentPart for mutations
    ChatConfig // Import ChatConfig for mutations
} from '../../../src/common/types'; // Import Delta types & SuggestedAction types
// Import the new createStore utility
import { createStore, StandardStore } from './utils/createStore';
import { createMutationStore } from './utils/createMutationStore';
import { requestData } from '../utils/communication';
// Import response type for fetch config
import { GetChatSessionsResponse } from '../../../src/webview/handlers/GetChatSessionsHandler';
// Import response type for defaultConfig
import { GetDefaultConfigResponse } from '../../../src/webview/handlers/GetDefaultConfigHandler';
import { router } from './router'; // Import router for dependency

/**
 * Represents the structure for storing suggested actions in the frontend store.
 * Maps messageId to an array of SuggestedAction objects.
 */
export type SuggestedActionsMap = Record<string, SuggestedAction[]>;


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
export const $chatSessions: StandardStore<ChatSession[]> = createStore<
    ChatSession[],           // TData: The data type we want in the store
    GetChatSessionsResponse, // TResponse: The raw response type from the fetch request
    {},                      // PPayload: Payload for fetch (none needed for getChatSessions)
    ChatSessionsUpdateData   // UUpdateData: Now the delta union type
>({
    key: 'chatSessions',
    fetch: {
        requestType: 'getChatSessions',
        transformResponse: (response) => response?.sessions ?? null,
    },
    subscribe: {
        topic: () => 'chatSessionsUpdate', // Static topic for session list updates
        handleUpdate: (currentState: ChatSession[] | null, updateData: ChatSessionsUpdateData): ChatSession[] | null => {
            console.log(`[$chatSessions handleUpdate] Received update. Type: ${updateData.type}`);
            const sessions = currentState ?? [];
            let newSessions: ChatSession[];

            switch (updateData.type) {
                case 'sessionSet':
                    newSessions = updateData.sessions ? [...updateData.sessions] : [];
                    break;
                case 'sessionAdd':
                    console.log(`[$chatSessions handleUpdate] Adding session ID: ${updateData.session.id}`);
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
                        newSessions = sessions;
                    }
                    break;
                }
                default:
                     console.warn(`[$chatSessions handleUpdate] Received unhandled update type:`, updateData);
                    newSessions = sessions;
            }
            return newSessions.sort((a, b) => b.lastModified - a.lastModified);
        },
    },
    initialData: [],
});

/**
 * Atom created using the new standard `createStore` utility for default config.
 * It holds `DefaultChatConfig | null | 'loading' | 'error'`.
 */
type DefaultConfigUpdate = DefaultChatConfig;

export const $defaultConfig: StandardStore<DefaultChatConfig> = createStore<
    DefaultChatConfig,
    GetDefaultConfigResponse,
    {},
    DefaultConfigUpdate
>({
    key: 'defaultConfig',
    fetch: {
        requestType: 'getDefaultConfig',
        transformResponse: (response) => response ?? null,
    },
    subscribe: {
        topic: () => 'defaultConfigUpdate',
        handleUpdate: (_currentState: DefaultChatConfig | null, updateData: DefaultConfigUpdate): DefaultChatConfig | null => {
            const result = updateData ?? null;
            return result;
        },
    },
});

/**
 * Atom created using the new standard `createStore` utility for streaming status.
 * It holds `boolean` indicating if the AI response is currently streaming.
 */
type StreamingStatusUpdate = StreamingStatusPayload;

export const $isStreamingResponse: StandardStore<boolean> = createStore<
    boolean,
    undefined,
    undefined,
    StreamingStatusUpdate
>({
    key: 'isStreamingResponse',
    fetch: { // Minimal fetch config to satisfy type
        requestType: 'internal_unused_streaming_status',
        transformResponse: () => false,
    },
    subscribe: {
         topic: () => STREAMING_STATUS_TOPIC,
         handleUpdate: (_currentState: boolean | null, updateData: StreamingStatusUpdate): boolean => {
             const result = typeof updateData?.streaming === 'boolean' ? updateData.streaming : false;
             return result;
        },
    },
    initialData: false,
});

/**
 * Atom created using the new standard `createStore` utility for suggested actions.
 * Holds a map of messageId -> SuggestedAction[] for the current chat.
 * Clears when the chat route changes.
 */
export const $suggestedActions: StandardStore<SuggestedActionsMap> = createStore<
    SuggestedActionsMap,
    undefined, // No initial fetch response needed
    undefined, // No payload for fetch
    SuggestedActionsPayload
>({
    key: 'suggestedActions',
    // Add minimal fetch config to satisfy type, even though it won't be used
    fetch: {
        requestType: 'internal_unused_suggested_actions', // Dummy type
        transformResponse: () => ({}), // Return empty map as default TData
    },
    subscribe: {
        topic: (): string | null => {
            const route = router.get();
            const chatId = (route && 'params' in route && route.params && 'chatId' in route.params) ? route.params.chatId : undefined;
            return chatId ? `${SUGGESTED_ACTIONS_TOPIC_PREFIX}${chatId}` : null;
        },
        handleUpdate: (currentState: SuggestedActionsMap | null, updateData: SuggestedActionsPayload): SuggestedActionsMap | null => {
            console.log(`[$suggestedActions handleUpdate] Received update. Type: ${updateData.type}`);
            const currentMap = currentState ?? {};

            if (updateData.type === 'setActions') {
                 const newMap = { ...currentMap };
                 newMap[updateData.messageId] = updateData.actions;
                 console.log(`[$suggestedActions handleUpdate] Set actions for message ${updateData.messageId}. Count: ${updateData.actions.length}`);
                 return newMap;
            } else if (updateData.type === 'clearAllActions') {
                 console.log(`[$suggestedActions handleUpdate] Clearing all actions for chat ${updateData.chatId}.`);
                 return {};
            }

            console.warn(`[$suggestedActions handleUpdate] Received unhandled update type:`, updateData);
            return currentState;
        },
    },
    dependsOn: [router],
    initialData: {},
});


// --- Mutation Stores for Chat Sessions ---

type CreateChatResult = ChatSession;
export const $createChat = createMutationStore<
  typeof $chatSessions,
  ChatSession[],
  void,
  CreateChatResult
>({
  targetAtom: $chatSessions,
  performMutation: async () => {
    const newSession = await requestData<ChatSession>('createChat');
    if (!newSession) throw new Error("Create chat failed: Backend didn't return a session.");
    return newSession;
  },
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
      optimisticState: [...(currentState ?? []), tempSession].sort((a, b) => b.lastModified - a.lastModified),
      revertState: currentDataState,
      tempId: tempId
    };
  },
  applyMutationResult: (newSession: CreateChatResult, currentDataState: ChatSession[] | null | 'loading' | 'error', tempId?: string) => {
    const currentState = (currentDataState === 'loading' || currentDataState === 'error') ? null : currentDataState;
    const list = (currentState ?? []).filter(s => s.id !== tempId);
    list.push(newSession);
    list.sort((a, b) => b.lastModified - a.lastModified);
    return list;
  }
});

type DeleteChatPayload = string;
type DeleteChatResult = { deletedId: string };
export const $deleteChat = createMutationStore<
  typeof $chatSessions,
  ChatSession[],
  DeleteChatPayload,
  DeleteChatResult
>({
  targetAtom: $chatSessions,
  performMutation: async (chatId: DeleteChatPayload) => {
    await requestData<void>('deleteChat', { chatId });
    return { deletedId: chatId };
  },
  getOptimisticUpdate: (chatId: DeleteChatPayload, currentDataState: ChatSession[] | null | 'loading' | 'error') => {
    const currentState = (currentDataState === 'loading' || currentDataState === 'error') ? null : currentDataState;
    return {
      optimisticState: (currentState ?? []).filter(session => session.id !== chatId),
      revertState: currentDataState
    };
  },
  applyMutationResult: (result: DeleteChatResult, currentDataState: ChatSession[] | null | 'loading' | 'error') => {
     const currentState = (currentDataState === 'loading' || currentDataState === 'error') ? null : currentDataState;
     return (currentState ?? []).filter((session: ChatSession) => session.id !== result.deletedId);
  }
});

// --- Mutation Stores for Chat Messages ---

type SendMessagePayload = {
    chatId: string;
    content: UiMessageContentPart[];
    providerId?: string;
    modelId?: string;
};
type SendMessageResult = void;

export const $sendMessage = createMutationStore<
  undefined,
  any,
  SendMessagePayload,
  SendMessageResult
>({
  targetAtom: undefined,
  performMutation: async (payload: SendMessagePayload) => {
    await requestData<void>('sendMessage', payload);
  }
});

type DeleteMessagePayload = { chatId: string; messageId: string };
type DeleteMessageResult = { chatId: string; deletedMessageId: string };
export const $deleteMessage = createMutationStore<
    undefined,
    any,
    DeleteMessagePayload,
    DeleteMessageResult
>({
    targetAtom: undefined,
    performMutation: async (payload: DeleteMessagePayload) => {
        await requestData<void>('deleteMessage', payload);
        return { chatId: payload.chatId, deletedMessageId: payload.messageId };
    },
});

type ClearHistoryPayload = { chatId: string };
type ClearHistoryResult = { chatId: string };
export const $clearChatHistory = createMutationStore<
    undefined,
    any,
    ClearHistoryPayload,
    ClearHistoryResult
>({
    targetAtom: undefined,
    performMutation: async (payload: ClearHistoryPayload) => {
        await requestData<void>('clearChatHistory', payload);
        return { chatId: payload.chatId };
    },
});

type ExecuteToolActionPayload = { toolName: string; args: any };
type ExecuteToolActionResult = any;
export const $executeToolAction = createMutationStore<
    undefined, any, ExecuteToolActionPayload, ExecuteToolActionResult
>({
    targetAtom: undefined,
    performMutation: async (payload: ExecuteToolActionPayload) => {
        return await requestData<ExecuteToolActionResult>('executeToolAction', payload);
    },
});

type StopGenerationResult = void;
export const $stopGeneration = createMutationStore<
    undefined, any, void, StopGenerationResult
>({
    targetAtom: undefined,
    performMutation: async () => {
        await requestData<void>('stopGeneration');
    },
});

type UpdateChatConfigPayload = { chatId: string; config: Partial<ChatConfig> };
type BackendUpdateChatConfigResult = { config: ChatConfig };
type PerformUpdateChatConfigResult = BackendUpdateChatConfigResult & { chatId: string };

export const $updateChatConfig = createMutationStore<
    typeof $chatSessions,
    ChatSession[],
    UpdateChatConfigPayload,
    PerformUpdateChatConfigResult
>({
    targetAtom: $chatSessions,
    performMutation: async (payload: UpdateChatConfigPayload): Promise<PerformUpdateChatConfigResult> => {
        const result = await requestData<BackendUpdateChatConfigResult>('updateChatConfig', payload);
        if (!result || !result.config) {
            throw new Error('Update chat config failed: Invalid response from backend.');
        }
        return { ...result, chatId: payload.chatId };
    },
    getOptimisticUpdate: (payload: UpdateChatConfigPayload, currentDataState: ChatSession[] | null | 'loading' | 'error') => {
        const currentState = (currentDataState === 'loading' || currentDataState === 'error') ? null : currentDataState;
        const { chatId, config: configUpdate } = payload;
        const updatedSessions = (currentState ?? []).map(session => {
            if (session.id === chatId) {
                return {
                    ...session,
                    config: { ...session.config, ...configUpdate },
                    lastModified: Date.now(),
                };
            }
            return session;
        });
        return { optimisticState: updatedSessions.sort((a, b) => b.lastModified - a.lastModified), revertState: currentDataState };
    },
    applyMutationResult: (result: PerformUpdateChatConfigResult, currentDataState: ChatSession[] | null | 'loading' | 'error', _tempId?: string) => {
         const currentState = (currentDataState === 'loading' || currentDataState === 'error') ? null : currentDataState;
         if (!result || !result.chatId || !result.config) {
             console.error("[$updateChatConfig applyMutationResult] Invalid result received from performMutation:", result);
             return currentState;
         }
         const updatedList = (currentState ?? []).map(session => {
             if (session.id === result.chatId) {
                  return { ...session, config: result.config, lastModified: Date.now() };
             }
             return session;
         });
         return updatedList.sort((a,b) => b.lastModified - a.lastModified);
    }
});
