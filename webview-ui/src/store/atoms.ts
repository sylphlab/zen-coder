// webview-ui/src/store/atoms.ts
import { atom } from 'jotai';
import { atomWithDefault, atomFamily, loadable } from 'jotai/utils'; // Consolidated imports
import {
    ChatSession,
    ProviderInfoAndStatus,
    AvailableModel,
    SuggestedAction,
    UiMessage,
    AllToolsStatusInfo, // Changed from AllToolsStatusPayload
    McpConfiguredStatusPayload, // Keep this, it was re-added to types.ts
    DefaultChatConfig,
    ChatConfig, // Import ChatConfig
    // Removed CustomInstructionsPayload import
} from '../../../src/common/types'; // Corrected relative path

// Define the type expected by UI components based on errors
// This might need adjustment if the actual type differs
type SelectedImage = {
    id: string;
    name: string;
    mediaType: string;
    data: string; // base64 data
};
// Removed: import { postMessage } from '../app';
import { requestData, listen } from '../utils/communication'; // Import from new communication file

// --- Core State Atoms ---
// Atom to hold the list of chat sessions. Updated via listeners elsewhere (e.g., main.tsx or a dedicated handler).
export const chatSessionsAtom = atom<ChatSession[] | null>(null); // Simple atom, initialized to null
// Removed the onMount logic - fetching/subscription handled by useChatSessions hook.

export const activeChatIdAtom = atom<string | null>(null); // Keep for initial redirect, set by initial getChatSessions response
// --- Async Atoms for Initial/Fetched Data ---

// Atom to trigger provider status refresh
const providerStatusRefreshAtom = atom(0);

// Atom to hold the status of all providers with subscription management
export const providerStatusAtom = atomWithDefault<ProviderInfoAndStatus[] | null>(() => null);
providerStatusAtom.onMount = (set) => {
    console.log('[providerStatusAtom] onMount: Subscribing and fetching initial data...');
    // Subscribe using the abstraction, providing a callback to update the atom
    const subscription = listen('providerStatus', (data: ProviderInfoAndStatus[] | null) => {
        console.log('[providerStatusAtom] Received update via listen callback.');
        set(data);
    });
    // Initial fetch
    requestData<{ payload: ProviderInfoAndStatus[] }>('getProviderStatus')
        .then(response => set(response.payload))
        .catch(err => {
            console.error("Error fetching initial provider status:", err);
            set(null); // Set to null or empty array on error
        });

    // Return the dispose function for onUnmount
    return () => {
        console.log('[providerStatusAtom] onUnmount: Disposing subscription.');
        subscription().catch(err => console.error("[providerStatusAtom] Error disposing subscription:", err)); // Call async dispose
    };
};

// Expose a way to trigger the refresh from components/handlers
export const refreshProviderStatusAtom = atom(
    null, // Read function is null
    (_get, set) => { // Write function
        set(providerStatusRefreshAtom, c => c + 1); // Increment the refresh counter
    }
);

// Async atom to fetch the initial list of available providers (used to populate selectors)
export const availableProvidersAtom = atom(async () => {
    console.log("[Jotai Async] Fetching available providers list...");
    const providers = await requestData<AvailableModel[]>('getAvailableProviders');
    console.log("[Jotai Async] Received available providers list:", providers);
    return providers ?? [];
});

// --- Async Atom for All Models (for filtering suggestions) ---
export const allModelsAtom = atom(async (get) => { // Export the atom directly
    // Original logic restored:
    const providersLoadable = get(loadable(availableProvidersAtom));
    if (providersLoadable.state !== 'hasData' || !providersLoadable.data) {return [];}
    const ids = providersLoadable.data.map(p => p.providerId);
    // Important: Use the loadable state of the family atom
    const modelPromises = ids.map(id => get(loadable(modelsForProviderAtomFamily(id))));

    // Wait for all model fetches to settle (either hasData or hasError)
    // This might require a helper if Jotai doesn't expose Promise status directly in loadable easily
    // For now, let's assume `get` on a loadable might suspend until settled,
    // or we might need to adjust how ModelSelector uses allModelsLoadable.
    // Let's try awaiting the direct atom value, which should suspend.
    const promises = ids.map(id => get(modelsForProviderAtomFamily(id))); // Get the promise
    const results = await Promise.all(promises); // Await the promises
    return results.flat();
});
// Remove useAtomValue call here, it belongs in components

// Async atomFamily to fetch models for a specific provider on demand
export const modelsForProviderAtomFamily = atomFamily((providerId: string | null | undefined) =>
    atom(async () => {
        if (!providerId) {
            console.log("[Jotai Async] Skipping model fetch: No providerId");
            return []; // Return empty array if no providerId
        }
        console.log(`[Jotai Async] Fetching models for provider: ${providerId}`);
        try {
            const models = await requestData<AvailableModel[]>('getModelsForProvider', { providerId });
            console.log(`[Jotai Async] Received models for ${providerId}:`, models);
            return models ?? [];
        } catch (error) {
            console.error(`[Jotai Async] Error fetching models for ${providerId}:`, error);
            return []; // Return empty array on error
        }
    }),
    (a, b) => a === b // Simple equality check for providerId primitive
);

// Removed: Simple providerModelsMapAtom - replaced by atomFamily

// --- Default Config Atoms ---
const defaultConfigRefreshAtom = atom(0);
// Atom to hold the default configuration with subscription management
export const defaultConfigAtom = atomWithDefault<DefaultChatConfig | null>(() => null);
defaultConfigAtom.onMount = (set) => {
    console.log('[defaultConfigAtom] onMount: Subscribing and fetching initial data...');
    const subscription = listen('defaultConfig', (data: DefaultChatConfig | null) => {
        console.log('[defaultConfigAtom] Received update via listen callback.');
        set(data);
    });
    // Initial fetch
    requestData<{ payload: DefaultChatConfig }>('getDefaultConfig')
        .then(response => set(response.payload))
        .catch(err => {
            console.error("Error fetching initial default config:", err);
            set(null);
        });

    return () => {
        console.log('[defaultConfigAtom] onUnmount: Disposing subscription.');
        subscription().catch(err => console.error("[defaultConfigAtom] Error disposing subscription:", err)); // Call async dispose
    };
};
export const refreshDefaultConfigAtom = atom(null, (_get, set) => {
    set(defaultConfigRefreshAtom, c => c + 1);
});

// --- All Tools Status Atoms ---
const allToolsStatusRefreshAtom = atom(0);
// Atom to hold the status of all tools (standard and MCP) with subscription management
export const allToolsStatusAtom = atomWithDefault<AllToolsStatusInfo | null>(() => null);
allToolsStatusAtom.onMount = (set) => {
    console.log('[allToolsStatusAtom] onMount: Subscribing and fetching initial data...');
    // Note: Topic name is 'allToolsStatus' in pushUpdate, but 'toolStatus' in listen? Let's assume 'allToolsStatus' is correct.
    const subscription = listen('allToolsStatus', (data: AllToolsStatusInfo | null) => {
        console.log('[allToolsStatusAtom] Received update via listen callback.');
        set(data);
    });
    // Initial fetch
    requestData<{ payload: AllToolsStatusInfo }>('getAllToolsStatus')
        .then(response => set(response.payload))
        .catch(err => {
            console.error("Error fetching initial tool status:", err);
            set(null);
        });

    return () => {
        console.log('[allToolsStatusAtom] onUnmount: Disposing subscription.');
        subscription().catch(err => console.error("[allToolsStatusAtom] Error disposing subscription:", err)); // Call async dispose
    };
};
export const refreshAllToolsStatusAtom = atom(null, (_get, set) => {
    set(allToolsStatusRefreshAtom, c => c + 1);
});

// --- MCP Server Status Atoms ---
const mcpServerStatusRefreshAtom = atom(0);
// Atom to hold the configured status of MCP servers with subscription management
export const mcpServerStatusAtom = atomWithDefault<McpConfiguredStatusPayload | null>(() => null);
mcpServerStatusAtom.onMount = (set) => {
    console.log('[mcpServerStatusAtom] onMount: Subscribing and fetching initial data...');
    const subscription = listen('mcpStatus', (data: McpConfiguredStatusPayload | null) => {
        console.log('[mcpServerStatusAtom] Received update via listen callback.');
        set(data);
    });
    // Initial fetch
    requestData<{ payload: McpConfiguredStatusPayload }>('getMcpStatus')
        .then(response => set(response.payload))
        .catch(err => {
            console.error("Error fetching initial MCP status:", err);
            set(null);
        });

    return () => {
        console.log('[mcpServerStatusAtom] onUnmount: Disposing subscription.');
        subscription().catch(err => console.error("[mcpServerStatusAtom] Error disposing subscription:", err)); // Call async dispose
    };
};
export const refreshMcpServerStatusAtom = atom(null, (_get, set) => {
    set(mcpServerStatusRefreshAtom, c => c + 1);
});
// --- Custom Instructions Atoms ---
// Define the payload type inline based on src/common/types.ts
type CustomInstructionsPayloadType = { global?: string; project?: string; projectPath?: string | null };

const customInstructionsRefreshAtom = atom(0);
// Atom to hold custom instructions (global and project) with subscription management
export const customInstructionsAtom = atomWithDefault<{ global: string; project: string | null; projectPath: string | null } | null>(() => null);
customInstructionsAtom.onMount = (set) => {
    console.log('[customInstructionsAtom] onMount: Subscribing and fetching initial data...');
    const subscription = listen('customInstructions', (data: { global: string; project: string | null; projectPath: string | null } | null) => {
        console.log('[customInstructionsAtom] Received update via listen callback.');
        set(data);
    });
    // Initial fetch
    requestData<{ payload: { global: string; project: string | null; projectPath: string | null } }>('getCustomInstructions')
        .then(response => set(response.payload))
        .catch(err => {
            console.error("Error fetching initial custom instructions:", err);
            set(null);
        });

    return () => {
        console.log('[customInstructionsAtom] onUnmount: Disposing subscription.');
        subscription.dispose();
    };
};
export const refreshCustomInstructionsAtom = atom(null, (_get, set) => {
    set(customInstructionsRefreshAtom, c => c + 1);
});



// --- Core State Atoms (User Input / UI State) ---
export const isStreamingAtom = atom<boolean>(false);
export const inputValueAtom = atom<string>('');
export const selectedImagesAtom = atom<SelectedImage[]>([]); // Use the UI type
// Removed: Simple defaultConfigAtom - replaced by async version above
export const suggestedActionsMapAtom = atom<Record<string, SuggestedAction[]>>({}); // { [messageId]: SuggestedAction[] }
export const isChatListLoadingAtom = atom<boolean>(false); // Atom for chat list loading state

// --- Derived State Atoms ---

// Derived atom for the currently active chat session
export const activeChatAtom = atom<ChatSession | null>((get) => {
    const sessions = get(chatSessionsAtom); // Can be null initially
    const activeId = get(activeChatIdAtom);
    if (!sessions || !activeId) { // Check if sessions is null or activeId is null
        return null;
    }
    return sessions?.find(session => session.id === activeId) ?? null; // Add optional chaining
});

// Derived atom for the messages of the active chat
export const activeChatMessagesAtom = atom<UiMessage[]>((get) => {
    const activeChat = get(activeChatAtom);
    return activeChat ? activeChat.history : [];
});

// Derived atom for the effective config of the active chat, merging defaults if necessary
export const activeChatEffectiveConfigAtom = atom((get): ChatSession['config'] => {
    const activeChat = get(activeChatAtom);
    const defaultsLoadable = get(loadable(defaultConfigAtom)); // Get loadable default config

    // Define a base default structure in case defaults atom is empty initially
    const baseDefaults: ChatSession['config'] = {
        useDefaults: true,
        providerId: undefined,
        modelId: undefined, // Use modelId
        // Add other defaultable config fields here if any in the future
    };

    // Handle loading/error states for defaults
    let defaults: Partial<DefaultChatConfig> = {};
    if (defaultsLoadable.state === 'hasData') {
        defaults = defaultsLoadable.data ?? {};
    } else if (defaultsLoadable.state === 'loading') {
        // While defaults are loading, we might return baseDefaults or indicate loading?
        // Let's return baseDefaults for now, UI should handle loading via Suspense.
        console.log("[activeChatEffectiveConfigAtom] Defaults are loading...");
    } else if (defaultsLoadable.state === 'hasError') {
        console.error("[activeChatEffectiveConfigAtom] Error loading defaults:", defaultsLoadable.error);
        // Fallback to baseDefaults on error
    }

    const effectiveDefaults = { ...baseDefaults, ...defaults };


    if (!activeChat) {
        // No active chat, return the effective defaults
        return effectiveDefaults;
    }

    const chatConfig = activeChat.config;

    if (chatConfig.useDefaults) {
        // Merge defaults with chat-specific overrides (chat overrides defaults)
        // Ensure providerId/modelName from chatConfig take precedence ONLY if they exist
        // Otherwise, fall back to defaults.
        return {
            ...effectiveDefaults, // Start with defaults
            ...chatConfig,        // Overlay chat config (including useDefaults: true)
            providerId: chatConfig.providerId ?? effectiveDefaults.providerId, // Chat ID > Default ID
            modelId: chatConfig.modelId ?? effectiveDefaults.modelId,   // Chat ID > Default ID
        };
    } else {
        // Use only the chat-specific config, ensuring all fields are present
        return {
             useDefaults: false,
             providerId: chatConfig.providerId, // Use chat's value or undefined
             modelId: chatConfig.modelId,   // Use chat's value or undefined
             // Add other config fields here if any
        };
    }
});

// Derived atoms for active chat's provider and model ID/Name
// Derived atoms for active chat's effective provider and model ID/Name
export const activeChatProviderIdAtom = atom<string | undefined>((get) => {
    // Use the effective config atom which includes merged defaults
    const effectiveConfig = get(activeChatEffectiveConfigAtom);
    return effectiveConfig.providerId; // Return providerId or undefined
});

// Corrected: Rename to activeChatModelIdAtom and read modelId
export const activeChatModelIdAtom = atom<string | undefined>((get) => {
    // Use the effective config atom which includes merged defaults
    const effectiveConfig = get(activeChatEffectiveConfigAtom);
    return effectiveConfig.modelId; // Return modelId or undefined
});

// Derived atom for the combined model ID string (e.g., "ANTHROPIC:claude-3-opus-20240229")
export const activeChatCombinedModelIdAtom = atom<string | null>((get) => {
    const providerId = get(activeChatProviderIdAtom);
    const modelId = get(activeChatModelIdAtom); // Use activeChatModelIdAtom
    if (providerId && modelId) { // Check modelId
        return `${providerId}:${modelId}`; // Combine with modelId
    }
    return null;
});

// --- Atoms for Triggering Backend Actions (Keep if needed for non-request actions) ---

// Removed: triggerWebviewReadyAtom (initial data fetched by async atoms)
// Removed: triggerFetchModelsForProviderAtom (models fetched by atomFamily)

// --- Location Atom ---
// Atom to manage the webview's location state, syncing with backend persistence
export const locationAtom = atomWithDefault<string | null>(() => null); // Initialize with null

locationAtom.onMount = (set) => {
    console.log('[locationAtom] onMount: Fetching initial location...');
    // Initial fetch for last known location
    requestData<{ location: string | null }>('getLastLocation') // Expect string or null
        .then(response => {
            console.log('[locationAtom] Received initial location:', response.location);
            // Set the initial state, default to '/chats' if nothing is stored
            set(response.location || '/chats');
        })
        .catch(err => {
            console.error("Error fetching initial location:", err);
            set('/chats'); // Fallback to '/chats' on error
        });
    // No ongoing subscription needed for location itself, changes are driven by UI router
    // Return an empty dispose function
    return () => {};
};

// Atom to trigger backend update when location changes (called from App.tsx useEffect)
export const updateLocationAtom = atom(
    null, // Read function is null
    async (get, set, newLocation: string) => { // Write function takes newLocation
        // Update the local atom state immediately (optional, depends on UX)
        // set(locationAtom, newLocation);
        console.log(`[updateLocationAtom] Requesting backend update for location: ${newLocation}`);
        try {
            await requestData('updateLastLocation', { location: newLocation });
            console.log(`[updateLocationAtom] Backend location updated successfully.`);
            // Optionally re-set the local state after confirmation, or rely on initial fetch next time
            // set(locationAtom, newLocation);
        } catch (error) {
            console.error(`[updateLocationAtom] Error updating backend location:`, error);
            // Handle error, maybe revert local state if it was set optimistically
        }
    }
);

// Removed old webviewLocationAtom

// --- Chat Session Atom Family ---
// Manages the state of a single chat session, including its history and config
export const chatSessionAtomFamily = atomFamily((chatId: string | null | undefined) => {
    const chatAtom = atomWithDefault<ChatSession | null>((get) => {
        if (!chatId) return null;
        // Try to get initial state from the main sessions list
        const sessions = get(chatSessionsAtom);
        return sessions?.find(s => s.id === chatId) ?? null;
    });

    // Add onMount to the individual atom created by the family
    chatAtom.onMount = (setAtom) => {
        if (!chatId) return () => {}; // No ID, nothing to mount/listen to

        console.log(`[chatSessionAtomFamily(${chatId})] onMount: Subscribing...`);

        // Subscribe to updates for this specific chat session
        const topic = `chatSessionUpdate/${chatId}`;
        const subscription = listen(topic, (data: ChatSession | null) => {
            console.log(`[chatSessionAtomFamily(${chatId})] Received update via listen callback.`);
            setAtom(data); // Update with the new session data
        });

        // Initial fetch for this specific chat? Maybe not needed if chatSessionsAtom provides it.
        // If chatSessionsAtom is null initially, we might need a fetch here.
        // requestData<{ session: ChatSession }>(`getChatSession`, { chatId }) // Example API
    //     .then(response => setAtom(response.session))
    //     .catch(err => console.error(`Error fetching initial chat session ${chatId}:`, err));

    // Return the dispose function for onUnmount
    return () => {
        console.log(`[chatSessionAtomFamily(${chatId})] onUnmount: Disposing subscription.`);
        subscription.dispose();
    };
    }; // End of onMount

    return chatAtom; // Return the configured atom
}); // End of atomFamily

// --- Effective Chat Config Atom Family ---
// Calculates the effective configuration for a chat, merging defaults if needed
export const effectiveChatConfigAtomFamily = atomFamily((chatId: string | null | undefined) =>
    atom((get): ChatConfig => {
        const chatSession = get(chatSessionAtomFamily(chatId));
        const defaultsLoadable = get(loadable(defaultConfigAtom));

        // Define a base default structure
        const baseDefaults: ChatConfig = {
            useDefaults: true,
            providerId: undefined,
            modelId: undefined,
            // Add other defaultable config fields here
        };

        let defaults: Partial<DefaultChatConfig> = {};
        if (defaultsLoadable.state === 'hasData') {
            defaults = defaultsLoadable.data ?? {};
        } else if (defaultsLoadable.state === 'hasError') {
            console.error("[effectiveChatConfigAtomFamily] Error loading defaults:", defaultsLoadable.error);
        }

        const effectiveDefaults = { ...baseDefaults, ...defaults };

        if (!chatSession) {
            // No specific chat session found (or ID is null), return defaults
            return effectiveDefaults;
        }

        const chatConfig = chatSession.config;

        if (chatConfig.useDefaults) {
            // Merge defaults with chat-specific overrides
            return {
                ...effectiveDefaults,
                ...chatConfig,
                providerId: chatConfig.providerId ?? effectiveDefaults.providerId,
                modelId: chatConfig.modelId ?? effectiveDefaults.modelId,
            };
        } else {
            // Use only the chat-specific config
            return {
                 useDefaults: false,
                 providerId: chatConfig.providerId,
                 modelId: chatConfig.modelId,
                 // Add other config fields here if any
            };
        }
    })
);
