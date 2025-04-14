// webview-ui/src/store/atoms.ts
import { atom } from 'jotai';
import { atomFamily, loadable } from 'jotai/utils'; // Import atomFamily and loadable
import {
    ChatSession,
    ProviderInfoAndStatus,
    AvailableModel,
    SuggestedAction,
    UiMessage,
    UiImagePart,
    AllToolsStatusInfo, // Changed from AllToolsStatusPayload
    McpConfiguredStatusPayload, // Keep this, it was re-added to types.ts
    DefaultChatConfig, // Add comma here
    UiMessageContentPart,
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
import { requestData } from '../utils/requestManager'; // Import the request function

// --- Core State Atoms ---
export const chatSessionsAtom = atom<ChatSession[]>([]);
export const activeChatIdAtom = atom<string | null>(null);
// --- Async Atoms for Initial/Fetched Data ---

// Atom to trigger provider status refresh
const providerStatusRefreshAtom = atom(0);

// Async atom to fetch provider status, depends on refresh atom
export const providerStatusAtom = atom(async (get) => { // Add get argument
    get(providerStatusRefreshAtom); // Read the refresh atom to establish dependency
    console.log("[Jotai Async] Fetching provider status (triggered by refresh)...");
    const status = await requestData<ProviderInfoAndStatus[]>('getProviderStatus');
    console.log("[Jotai Async] Received provider status:", status);
    return status ?? []; // Return empty array on null/undefined response
});

// Expose a way to trigger the refresh from components/handlers
export const refreshProviderStatusAtom = atom(
    null, // Read function is null
    (get, set) => { // Write function
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
    if (providersLoadable.state !== 'hasData' || !providersLoadable.data) return [];
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

// Async atom to fetch the default configuration
export const defaultConfigAtom = atom(async () => {
    console.log("[Jotai Async] Fetching default config...");
    const config = await requestData<DefaultChatConfig>('getDefaultConfig');
    console.log("[Jotai Async] Received default config:", config);
    return config ?? {}; // Return empty object on null/undefined response
});

// Async atom to fetch the status of all tools (standard + MCP)
export const allToolsStatusAtom = atom(async () => {
    console.log("[Jotai Async] Fetching all tools status...");
    const status = await requestData<AllToolsStatusInfo>('getAllToolsStatus'); // Changed type
    console.log("[Jotai Async] Received all tools status:", status);
    return status ?? {}; // Return empty object on null/undefined response
});

// Async atom to fetch the configured status of MCP servers
export const mcpServerStatusAtom = atom(async () => {
    console.log("[Jotai Async] Fetching MCP server configured status...");
    const status = await requestData<McpConfiguredStatusPayload>('getMcpConfiguredStatus');
    console.log("[Jotai Async] Received MCP server configured status:", status);
    return status ?? {}; // Return empty object on null/undefined response
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
    const sessions = get(chatSessionsAtom);
    const activeId = get(activeChatIdAtom);
    if (!activeId) return null;
    return sessions.find(session => session.id === activeId) ?? null;
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

// Atom to hold the current webview location (can be synced with wouter)
// For now, just a basic atom. Integration with wouter can be done later.
export const webviewLocationAtom = atom<string>('/');