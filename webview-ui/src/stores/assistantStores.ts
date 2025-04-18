// webview-ui/src/stores/assistantStores.ts
import { create } from 'zustand';
import { Assistant, NewAssistant, UpdateAssistantPayload, CreateAssistantResponse, UpdateAssistantResponse, DeleteAssistantResponse } from '../../../src/common/types'; // Adjust path if needed
import { requestData } from '../utils/communication'; // Use exported requestData function

// Define specific response types expected by requestData calls
// Note: requestData<T> resolves with the 'payload' part of the response message
type ListAssistantsPayload = { assistants: Assistant[] };
type CreateAssistantPayload = { assistant: Assistant };
type UpdateAssistantPayloadResponse = { assistant: Assistant }; // Renamed to avoid conflict
type DeleteAssistantPayload = {}; // No specific payload needed on success


interface AssistantState {
    assistants: Assistant[];
    assistantMap: Record<string, Assistant>;
    currentAssistantId: string | null;
    isLoading: boolean;
    error: string | null;
    // No pendingRequests map needed here, handled by requestData
    actions: {
        fetchAssistants: () => Promise<void>; // Make async for consistency
        addAssistant: (payload: NewAssistant) => Promise<Assistant | null>;
        updateAssistant: (payload: UpdateAssistantPayload) => Promise<Assistant | null>;
        removeAssistant: (id: string) => Promise<boolean>;
        selectAssistant: (id: string | null) => void;
        // _handleAssistantResponse is removed, logic integrated or handled by requestData promises
    };
}


export const useAssistantStore = create<AssistantState>((set, get) => ({
    assistants: [],
    assistantMap: {},
    currentAssistantId: null,
    isLoading: false,
    error: null,
    actions: {
        // Helper function logic integrated directly using set() below

        fetchAssistants: async () => {
            if (get().isLoading) return;
            set({ isLoading: true, error: null }); // Use set directly
            try {
                // Use requestData to fetch the list
                const responsePayload = await requestData<ListAssistantsPayload>('assistants/list');
                // Update state using the integrated helper logic via set
                const assistants = responsePayload.assistants || [];
                const assistantMap = assistants.reduce((acc, assistant) => {
                    acc[assistant.id] = assistant;
                    return acc;
                }, {} as Record<string, Assistant>);
                const currentId = get().currentAssistantId;
                const newCurrentId = currentId && assistantMap[currentId] ? currentId : null;
                set({
                    assistants: assistants.sort((a, b) => a.name.localeCompare(b.name)),
                    assistantMap,
                    currentAssistantId: newCurrentId,
                    isLoading: false,
                    error: null
                });
            } catch (error: any) {
                console.error("Error fetching assistants:", error);
                set({ error: error.message || 'Failed to load assistants.', isLoading: false }); // Use set directly
            }
        },

        addAssistant: async (payload: NewAssistant): Promise<Assistant | null> => {
             if (get().isLoading) return null;
             set({ isLoading: true, error: null });
             try {
                 // Use requestData for creation
                 const responsePayload = await requestData<CreateAssistantPayload>('assistants/create', payload);
                 console.log("[assistantStore] addAssistant requestData successful:", responsePayload); // Log success
                 // Refetch list on success to ensure consistency
                 get().actions.fetchAssistants(); // Trigger refetch but don't await it here
                 console.log("[assistantStore] addAssistant refetch triggered."); // Log after triggering refetch
                 return responsePayload.assistant ?? null; // Keep return for now, maybe needed later
             } catch (error: any) {
                 console.error("Error creating assistant:", error);
                 set({ error: error.message || 'Error creating assistant.', isLoading: false });
                 return null;
             }
             // isLoading will be reset by fetchAssistants or the catch block
        },

        updateAssistant: async (payload: UpdateAssistantPayload): Promise<Assistant | null> => {
            if (get().isLoading) return null;
            set({ isLoading: true, error: null });
             try {
                 const responsePayload = await requestData<UpdateAssistantPayloadResponse>('assistants/update', payload);
                 // Refetch list on success
                 await get().actions.fetchAssistants();
                 return responsePayload.assistant ?? null;
             } catch (error: any) {
                 console.error("Error updating assistant:", error);
                 set({ error: error.message || 'Error updating assistant.', isLoading: false });
                 return null;
             }
        },

        removeAssistant: async (id: string): Promise<boolean> => {
            if (get().isLoading) return false;
            set({ isLoading: true, error: null });
             try {
                 await requestData<DeleteAssistantPayload>('assistants/delete', { id });
                 // Refetch list on success
                 await get().actions.fetchAssistants();
                 return true;
             } catch (error: any) {
                 console.error("Error deleting assistant:", error);
                 set({ error: error.message || 'Error deleting assistant.', isLoading: false });
                 return false;
             }
        },

        selectAssistant: (id: string | null) => set({ currentAssistantId: id }),

        // _handleAssistantResponse is removed as requestData handles responses via Promises.
        // Push notifications would need a separate mechanism (e.g., using 'listen' from communication.ts)
        // if real-time updates beyond request-response are needed.

    },
}));

// Listener setup remains similar, but it no longer needs to handle responses for requestData.
// It would only handle 'pushUpdate' messages if those were used for assistants.
// For now, we can simplify or remove it if only request-response is used.
// Let's keep a simplified version for potential future push updates.
export function setupAssistantStoreListener() {
    // The 'listen' function from communication.ts should be used for push updates.
    // This setup is now less relevant if only requestData is used.
    // Consider removing this if no push updates are planned for assistants.

    // Example if push updates were needed:
    // const dispose = listen('assistantUpdates', (data) => {
    //    console.log("Received assistant push update:", data);
    //    // Update store based on push data
    //    // Potentially call fetchAssistants() or merge data
    // });
    // return dispose; // Return the cleanup function from listen

    console.log("Assistant store listener setup (currently no-op, use requestData promises).");
    return () => {
        console.log("Assistant store listener cleanup (currently no-op).");
    }; // Return an empty cleanup function
}


// Initial fetch can be called after listener setup
// Example:
// setupAssistantStoreListener();
// useAssistantStore.getState().actions.fetchAssistants();