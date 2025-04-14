import { map } from 'nanostores'; // Removed MapStore import
import { ChatSession, DefaultChatConfig } from '../../../src/common/types'; // Removed non-existent Payload types
import { createFetcherStore } from './utils/createFetcherStore'; // Renamed import
import { createMutationStore } from './utils/createMutationStore'; // Correct import name
import { requestData } from '../utils/communication';

/**
 * Represents the raw payload received from the backend for chat sessions.
 */
type ChatSessionsPayload = {
  sessions: ChatSession[];
};

/**
 * Atom that fetches and subscribes to the list of chat sessions.
 * It holds `ChatSession[] | null`. Null indicates the initial loading state.
 */
export const $chatSessions = createFetcherStore<ChatSession[], ChatSessionsPayload>( // Renamed variable and function call
  'chatSessionsUpdate', // Topic to listen for updates
  'getChatSessions',    // Request type for initial fetch
  {
    initialData: [], // Start with an empty array before the first fetch
    // Transform the raw { sessions: [...] } payload into just the array
    transformFetchResponse: (payload) => payload?.sessions ?? [],
  }
);

// Removed activeChatIdAtom definition and related comments.

/**
 * Atom that fetches and subscribes to the default chat configuration.
 * It holds `DefaultChatConfig | null`. Null indicates the initial loading state.
 */
export const $defaultConfig = createFetcherStore<DefaultChatConfig | null>( // Renamed variable and function call, removed Payload type
  'defaultConfigUpdate', // Topic to listen for updates
  'getDefaultConfig',    // Request type for initial fetch
  {
    initialData: null, // Start with null
    // No transformer needed as the fetch response is the correct type
  }
);

// --- Mutation Stores for Chat Sessions ---

// Store for Creating a Chat Session
type CreateChatResult = ChatSession;
export const $createChat = createMutationStore< // Export the store directly
  typeof $chatSessions, // Target Atom for optimistic updates (Renamed)
  ChatSession[],          // Target Atom's state type
  void,                   // Payload type (none for create)
  CreateChatResult        // Result type from performMutation
>({
  targetAtom: $chatSessions, // Renamed targetAtom
  performMutation: async () => {
    const newSession = await requestData<ChatSession>('createChat');
    if (!newSession) throw new Error("Create chat failed: Backend didn't return a session.");
    return newSession;
  },
  getOptimisticUpdate: (_payload: void, currentState: ChatSession[] | null) => {
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
      revertState: currentState,
      tempId: tempId
    };
  },
  // Correct signature: (result, currentState, tempId?)
  applyMutationResult: (newSession: CreateChatResult, currentState: ChatSession[] | null, tempId?: string) => {
    // This function now immediately updates the store with the final session data from the backend.
    console.log(`[$createChat applyMutationResult] Applying result for tempId ${tempId}. New session:`, newSession);
    return (currentState ?? []).map((session: ChatSession) =>
      session.id === tempId ? newSession : session
    );
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
  targetAtom: $chatSessions, // Renamed targetAtom
  performMutation: async (chatId: DeleteChatPayload) => {
    await requestData<void>('deleteChat', { chatId });
    return { deletedId: chatId };
  },
  getOptimisticUpdate: (chatId: DeleteChatPayload, currentState: ChatSession[] | null) => {
    return {
      optimisticState: (currentState ?? []).filter(session => session.id !== chatId),
      revertState: currentState
    };
  },
  applyMutationResult: (result: DeleteChatResult, currentState: ChatSession[] | null) => {
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
  targetAtom: $chatSessions,
  performMutation: async (payload: SendMessagePayload) => {
    await requestData<void>('sendMessage', payload);
  },
  getOptimisticUpdate: (payload: SendMessagePayload, currentState: ChatSession[] | null) => {
    const { chatId, content } = payload;
    const userMessage = createOptimisticUserMessage(chatId, content);
    const updatedSessions = (currentState ?? []).map(session => {
      if (session.id === chatId) {
        return {
          ...session,
          history: [...session.history, userMessage],
          lastModified: Date.now(),
        };
      }
      return session;
    });
    return {
      optimisticState: updatedSessions,
      revertState: currentState,
    };
  },
  // No applyMutationResult needed for sendMessage as updates come via stream
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
    targetAtom: $chatSessions,
    performMutation: async (payload: DeleteMessagePayload) => {
        await requestData<void>('deleteMessage', payload);
        return { chatId: payload.chatId, deletedMessageId: payload.messageId };
    },
    getOptimisticUpdate: (payload: DeleteMessagePayload, currentState: ChatSession[] | null) => {
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
            revertState: currentState,
        };
    },
    applyMutationResult: (result: DeleteMessageResult, currentState: ChatSession[] | null) => {
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
    targetAtom: $chatSessions,
    performMutation: async (payload: ClearHistoryPayload) => {
        await requestData<void>('clearChatHistory', payload);
        return { chatId: payload.chatId };
    },
    getOptimisticUpdate: (payload: ClearHistoryPayload, currentState: ChatSession[] | null) => {
        const { chatId } = payload;
        const updatedSessions = (currentState ?? []).map(session => {
            if (session.id === chatId) {
                return { ...session, history: [], lastModified: Date.now() };
            }
            return session;
        });
        return { optimisticState: updatedSessions, revertState: currentState };
    },
    applyMutationResult: (result: ClearHistoryResult, currentState: ChatSession[] | null) => {
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
    targetAtom: $chatSessions,
    performMutation: async (payload: UpdateChatConfigPayload): Promise<PerformUpdateChatConfigResult> => {
        // Backend handler returns { config: ChatConfig }
        const result = await requestData<BackendUpdateChatConfigResult>('updateChatConfig', payload);
        if (!result || !result.config) {
            throw new Error('Update chat config failed: Invalid response from backend.');
        }
        // Add chatId to the result object so applyMutationResult can use it
        return { ...result, chatId: payload.chatId };
    },
    getOptimisticUpdate: (payload: UpdateChatConfigPayload, currentState: ChatSession[] | null) => {
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
        return { optimisticState: updatedSessions, revertState: currentState };
    },
    // Correct signature: (result, currentState, tempId?) - tempId is not relevant here.
    // The 'result' now contains { config: ..., chatId: ... } because we modified it in performMutation.
    applyMutationResult: (result: PerformUpdateChatConfigResult, currentState: ChatSession[] | null, _tempId?: string) => {
         if (!result || !result.chatId || !result.config) {
             console.error("[$updateChatConfig applyMutationResult] Invalid result received from performMutation:", result);
             // If result is invalid, trust the optimistic update for now. Backend push will provide final truth.
             return currentState;
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
