import { atom, WritableAtom, onMount } from 'nanostores'; // Import WritableAtom and onMount
import {
    ChatSession,
    DefaultChatConfig,
    // Removed ChatSessionsUpdateData and specific delta types
    STREAMING_STATUS_TOPIC, // Import topic constant
    StreamingStatusPayload, // Import payload type
    SUGGESTED_ACTIONS_TOPIC_PREFIX, // Import suggested actions topic prefix
    SuggestedActionsPayload, // Import suggested actions payload type
    SuggestedAction, // Import SuggestedAction type
    UiMessage, // Import UiMessage for mutations
    UiMessageContentPart, // Import UiMessageContentPart for mutations
    ChatConfig // Import ChatConfig for mutations
    // Removed Operation import from common/types
} from '../../../src/common/types'; // Import Delta types & SuggestedAction types
// Import the new createStore utility
import { createStore, StandardStore } from './utils/createStore';
import { Operation } from 'fast-json-patch'; // Import Operation directly
import { createMutationStore } from './utils/createMutationStore';
import { requestData, listen } from '../utils/communication'; // Import listen
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
    Operation[]              // UUpdateData: Expecting JSON Patch array
>({
    key: 'chatSessions',
    fetch: {
        requestType: 'getChatSessions',
        transformResponse: (response) => response?.sessions ?? [], // Return empty array if null
    },
    subscribe: {
        topic: 'chatSessionsUpdate', // Static topic for session list updates
        // handleUpdate is now handled internally by createStore for JSON patches
    },
    initialData: [], // Start with empty array
});

/**
 * Atom created using the new standard `createStore` utility for default config.
 * It holds `DefaultChatConfig | null | 'loading' | 'error'`.
 */
type DefaultConfigUpdate = Operation[]; // Expecting JSON Patch

export const $defaultConfig: StandardStore<DefaultChatConfig> = createStore<
    DefaultChatConfig,
    GetDefaultConfigResponse,
    {},
    DefaultConfigUpdate // Expecting JSON Patch
>({
    key: 'defaultConfig',
    fetch: {
        requestType: 'getDefaultConfig',
        transformResponse: (response) => response ?? null,
    },
    subscribe: {
        topic: 'defaultConfigUpdate',
        // handleUpdate is now handled internally by createStore for JSON patches
    },
    // initialData: undefined, // Let it start as 'loading'
});

/**
 * Atom created using the new standard `createStore` utility for streaming status.
 * It holds `boolean` indicating if the AI response is currently streaming.
 */
type StreamingStatusUpdate = StreamingStatusPayload;

export const $isStreamingResponse: StandardStore<boolean> = createStore<
    boolean,
    undefined, // No fetch needed
    undefined, // No fetch payload
    StreamingStatusUpdate
>({
    key: 'isStreamingResponse',
    fetch: { // Minimal fetch config to satisfy type
        requestType: 'internal_unused_streaming_status',
        transformResponse: () => false, // Initial state is false
    },
    subscribe: {
         topic: STREAMING_STATUS_TOPIC, // Use constant
         // Still needs custom handleUpdate as backend pushes full boolean, not patch
         // Correct currentState type to include 'loading' and 'error'
         handleUpdate: (currentState: boolean | null | 'loading' | 'error', updateData: StreamingStatusUpdate): boolean => {
             // If current state is loading/error, default to false before applying update
             const prevState = (currentState === 'loading' || currentState === 'error' || currentState === null) ? false : currentState;
             const result = typeof updateData?.streaming === 'boolean' ? updateData.streaming : prevState;
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
    SuggestedActionsPayload // Still expect full payload
>({
    key: 'suggestedActions',
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
        // Still needs custom handleUpdate as backend pushes full payload/clear instruction
        // Correct currentState type to include 'loading' and 'error'
        handleUpdate: (currentState: SuggestedActionsMap | null | 'loading' | 'error', updateData: SuggestedActionsPayload): SuggestedActionsMap | null => {
            console.log(`[$suggestedActions handleUpdate] Received update. Type: ${updateData.type}`);
            // If current state is loading/error, start from empty map
            const currentMap = (currentState === 'loading' || currentState === 'error' || currentState === null) ? {} : currentState;

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
            return currentMap; // Return currentMap instead of potentially null currentState
        },
    },
    dependsOn: [router],
    initialData: {},
});


// --- Mutation Stores for Chat Sessions ---

type CreateChatResult = ChatSession;
export const $createChat = createMutationStore<
  StandardStore<ChatSession[]>, // Use StandardStore type
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
  // Removed getOptimisticUpdate and applyMutationResult - rely on backend patch
});

type DeleteChatPayload = { chatId: string }; // Corrected payload type
type DeleteChatResult = { deletedId: string };
export const $deleteChat = createMutationStore<
  StandardStore<ChatSession[]>, // Use StandardStore type
  ChatSession[],
  DeleteChatPayload,
  DeleteChatResult
>({
  targetAtom: $chatSessions,
  performMutation: async (payload: DeleteChatPayload) => { // Use correct payload type
    await requestData<void>('deleteChat', payload); // Pass payload directly
    return { deletedId: payload.chatId };
  },
  // Removed getOptimisticUpdate and applyMutationResult - rely on backend patch
});

// --- Mutation Stores for Chat Messages ---

export type SendMessagePayload = { // Export the type
    chatId: string;
    content: UiMessageContentPart[];
    providerId?: string;
    modelId?: string;
    tempId: string; // Added tempId
};
type SendMessageResult = void;

export const $sendMessage = createMutationStore<
  StandardStore<UiMessage[]>, // Target history store
  UiMessage[],
  SendMessagePayload,
  SendMessageResult
>({
  targetAtom: undefined, // Let ChatView handle optimistic state via options
  performMutation: async (payload: SendMessagePayload) => {
    await requestData<void>('sendMessage', payload);
  }
  // Optimistic update handled by passing state to mutate options in ChatView
});

type DeleteMessagePayload = { chatId: string; messageId: string };
type DeleteMessageResult = { chatId: string; deletedMessageId: string };
export const $deleteMessage = createMutationStore<
    StandardStore<UiMessage[]>, // Target history store
    UiMessage[],
    DeleteMessagePayload,
    DeleteMessageResult
>({
    targetAtom: undefined, // Let backend patch handle update
    performMutation: async (payload: DeleteMessagePayload) => {
        await requestData<void>('deleteMessage', payload);
        return { chatId: payload.chatId, deletedMessageId: payload.messageId };
    },
});

type ClearHistoryPayload = { chatId: string };
type ClearHistoryResult = { chatId: string };
export const $clearChatHistory = createMutationStore<
    StandardStore<UiMessage[]>, // Target history store
    UiMessage[],
    ClearHistoryPayload,
    ClearHistoryResult
>({
    targetAtom: undefined, // Let backend patch handle update (likely replace with empty array)
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
    targetAtom: undefined, // No direct store update needed
    performMutation: async (payload: ExecuteToolActionPayload) => {
        return await requestData<ExecuteToolActionResult>('executeToolAction', payload);
    },
});

type StopGenerationResult = void;
export const $stopGeneration = createMutationStore<
    undefined, any, void, StopGenerationResult
>({
    targetAtom: undefined, // No direct store update needed
    performMutation: async () => {
        await requestData<void>('stopGeneration');
    },
});

type UpdateChatConfigPayload = { chatId: string; config: Partial<ChatConfig> };
// Backend now pushes patch for chatSessionsUpdate, so result isn't strictly needed for state update
type UpdateChatConfigResult = void;

export const $updateChatConfig = createMutationStore<
    StandardStore<ChatSession[]>, // Target sessions store
    ChatSession[],
    UpdateChatConfigPayload,
    UpdateChatConfigResult
>({
    targetAtom: $chatSessions, // Keep target for potential optimistic patch
    performMutation: async (payload: UpdateChatConfigPayload): Promise<UpdateChatConfigResult> => {
        await requestData<void>('updateChatConfig', payload);
        // Rely on backend pushing patch via chatSessionsUpdate topic
    },
    // Removed getOptimisticUpdate and applyMutationResult
});
