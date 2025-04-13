// webview-ui/src/store/atoms.ts
import { atom } from 'jotai';
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
import { postMessage } from '../app'; // Import postMessage from app.tsx

// --- Core State Atoms ---
export const chatSessionsAtom = atom<ChatSession[]>([]);
export const activeChatIdAtom = atom<string | null>(null);
export const providerStatusAtom = atom<ProviderInfoAndStatus[]>([]);
export const availableProvidersAtom = atom<AvailableModel[]>([]); // Initial list of providers (id, label, providerId)
export const providerModelsMapAtom = atom<Record<string, AvailableModel[]>>({}); // Models loaded per provider { [providerId]: AvailableModel[] }
export const isStreamingAtom = atom<boolean>(false);
export const inputValueAtom = atom<string>('');
export const selectedImagesAtom = atom<SelectedImage[]>([]); // Use the UI type
export const defaultConfigAtom = atom<DefaultChatConfig>({}); // Atom for default config
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

// Derived atom for the config of the active chat
// TODO: Enhance later to merge with default config from settings if useDefaults is true
export const activeChatConfigAtom = atom((get) => {
    const activeChat = get(activeChatAtom);
    return activeChat ? activeChat.config : { useDefaults: true }; // Provide a default config object
});

// Derived atoms for active chat's provider and model ID/Name
export const activeChatProviderIdAtom = atom<string | null>((get) => {
    const config = get(activeChatConfigAtom);
    // TODO: Add logic for default provider ID from settings
    return config?.providerId ?? null;
});

export const activeChatModelNameAtom = atom<string | null>((get) => {
    const config = get(activeChatConfigAtom);
    // TODO: Add logic for default model name from settings
    return config?.modelName ?? null;
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

// --- Atoms for Triggering Backend Actions ---

// Write-only atom to signal the webview is ready and trigger initial data load
export const triggerWebviewReadyAtom = atom(null, (_get, set) => {
    console.log("[Jotai] Triggering webviewReady");
    postMessage({ type: 'webviewReady' });
});

// Write-only atom to trigger fetching models for a specific provider
export const triggerFetchModelsForProviderAtom = atom(null, (_get, set, providerId: string) => {
    console.log(`[Jotai] Triggering getAvailableModels for ${providerId}`);
    postMessage({ type: 'getAvailableModels', payload: { providerId } });
});

// Atom to hold the current webview location (can be synced with wouter)
// For now, just a basic atom. Integration with wouter can be done later.
export const webviewLocationAtom = atom<string>('/');