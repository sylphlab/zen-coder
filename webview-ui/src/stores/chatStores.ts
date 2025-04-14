import { atom } from 'nanostores';
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

// Potential future atoms related to chat state can be added here.
// For example:
/**
 * Atom holding the ID of the currently active chat session.
 * Null means no chat is active (e.g., showing the chat list).
 */
export const activeChatIdAtom = atom<string | null>(null);

// We might need a way to update the active chat ID based on backend communication
// (e.g., when a new chat is created or selected).
// For now, components can directly use activeChatIdAtom.set() if needed,
// but a dedicated function might be better later.

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
  // Add explicit types for parameters
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
      optimisticState: [...(currentState ?? []), tempSession], // Add temp session
      revertState: currentState,                             // Revert to original state on failure
      tempId: tempId
    };
  },
  // Add explicit types for parameters
  applyMutationResult: (newSession: CreateChatResult, currentState: ChatSession[] | null, tempId?: string) => {
    // Replace the temporary session with the real one from the backend
    return (currentState ?? []).map((session: ChatSession) => // Add type for session
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
    // Check if the currently active chat is being deleted
    if (activeChatIdAtom.get() === chatId) {
        console.log("[deleteChatSessionAction] Active chat deleted, clearing activeChatIdAtom.");
        activeChatIdAtom.set(null); // Clear active chat ID if it was the one deleted
    // Optionally navigate away - router.open('/') - might be better handled in component effect
    }
    return { deletedId: chatId };
  },
  // Add explicit types for parameters
  getOptimisticUpdate: (chatId: DeleteChatPayload, currentState: ChatSession[] | null) => {
    return {
      optimisticState: (currentState ?? []).filter(session => session.id !== chatId), // Remove immediately
      revertState: currentState
    };
  },
  // Add explicit types for parameters
  applyMutationResult: (result: DeleteChatResult, currentState: ChatSession[] | null) => {
    // Ensure the session is removed (might be redundant if optimistic is reliable, but safe to include)
    return (currentState ?? []).filter((session: ChatSession) => session.id !== result.deletedId); // Add type for session
  }
});

// TODO: Add updateChatSessionAction if needed
