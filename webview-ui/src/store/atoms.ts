// webview-ui/src/store/atoms.ts
import { atom } from 'jotai';
import { atomFamily } from 'jotai/utils'; // Import atomFamily
import {
    ChatSession,
    ProviderInfoAndStatus,
    AvailableModel,
    SuggestedAction,
    UiMessage,
    UiImagePart,
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

// Async atom to fetch provider status
export const providerStatusAtom = atom(async () => {
    console.log("[Jotai Async] Fetching provider status...");
    const status = await requestData<ProviderInfoAndStatus[]>('getProviderStatus');
    console.log("[Jotai Async] Received provider status:", status);
    return status ?? []; // Return empty array on null/undefined response
});

// Async atom to fetch the initial list of available providers (used to populate selectors)
export const availableProvidersAtom = atom(async () => {
    console.log("[Jotai Async] Fetching available providers list...");
    const providers = await requestData<AvailableModel[]>('getAvailableProviders');
    console.log("[Jotai Async] Received available providers list:", providers);
    return providers ?? [];
});

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

// --- Core State Atoms (User Input / UI State) ---
export const isStreamingAtom = atom<boolean>(false);
export const inputValueAtom = atom<string>('');
export const selectedImagesAtom = atom<SelectedImage[]>([]); // Use the UI type
// Removed: Simple defaultConfigAtom - replaced by async version above
export const suggestedActionsMapAtom = atom<Record<string, SuggestedAction[]>>({}); // { [messageId]: SuggestedAction[] }

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
    const defaults = get(defaultConfigAtom); // Get default config

    // Define a base default structure in case defaults atom is empty initially
    const baseDefaults: ChatSession['config'] = {
        useDefaults: true,
        providerId: undefined,
        modelName: undefined,
        // Add other defaultable config fields here if any in the future
    };

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
            modelName: chatConfig.modelName ?? effectiveDefaults.modelName,   // Chat Name > Default Name
        };
    } else {
        // Use only the chat-specific config, ensuring all fields are present
        return {
             useDefaults: false,
             providerId: chatConfig.providerId, // Use chat's value or undefined
             modelName: chatConfig.modelName,   // Use chat's value or undefined
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

export const activeChatModelNameAtom = atom<string | undefined>((get) => {
    // Use the effective config atom which includes merged defaults
    const effectiveConfig = get(activeChatEffectiveConfigAtom);
    return effectiveConfig.modelName; // Return modelName or undefined
});

// Derived atom for the combined model ID string (e.g., "ANTHROPIC:claude-3-opus-20240229")
export const activeChatCombinedModelIdAtom = atom<string | null>((get) => {
    const providerId = get(activeChatProviderIdAtom);
    const modelName = get(activeChatModelNameAtom);
    if (providerId && modelName) {
        return `${providerId}:${modelName}`;
    }
    return null;
});

// --- Atoms for Triggering Backend Actions (Keep if needed for non-request actions) ---

// Removed: triggerWebviewReadyAtom (initial data fetched by async atoms)
// Removed: triggerFetchModelsForProviderAtom (models fetched by atomFamily)

// Atom to hold the current webview location (can be synced with wouter)
// For now, just a basic atom. Integration with wouter can be done later.
export const webviewLocationAtom = atom<string>('/');