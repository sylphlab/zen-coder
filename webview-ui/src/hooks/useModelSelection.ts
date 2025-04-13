import { useState, useMemo, useCallback } from 'preact/hooks';
import { JSX } from 'preact/jsx-runtime';
import { ApiProviderKey } from '../app'; // Import ApiProviderKey from app
import { AvailableModel } from '../../../src/common/types'; // Import AvailableModel from common types

export function useModelSelection(
    initialModels: AvailableModel[] = [],
    activeChatModelId: string | null // Receive active chat's model ID
) {
    const [availableModels, setAvailableModels] = useState<AvailableModel[]>(initialModels);
    const [selectedProvider, setSelectedProvider] = useState<ApiProviderKey | null>(null);
    // Removed internal currentModelInput state
    // --- Derived State ---
    const uniqueProviders = useMemo(() => {
        const providers = new Set<ApiProviderKey>();
        availableModels.forEach(model => providers.add(model.providerId as ApiProviderKey));
        return Array.from(providers);
    }, [availableModels]);

    const filteredModels = useMemo(() => {
        if (!selectedProvider) return [];
        // Filter models and ensure the returned array conforms to AvailableModel[]
        // while adding the modelNamePart for potential display use.
        return availableModels
            .filter(model => model.providerId === selectedProvider)
            .map(model => ({
                ...model, // Spread the original AvailableModel properties
                // Extract model name part for display in datalist option text
                modelNamePart: model.id.split(':').slice(1).join(':') || model.name
            }));
    }, [availableModels, selectedProvider]);

    // Derived state for the displayable part of the model ID
    // Derive display name directly from the passed-in activeChatModelId
    const displayModelName = useMemo(() => {
        return activeChatModelId ? activeChatModelId.split(':').slice(1).join(':') : '';
    }, [activeChatModelId]);
    // --- Handlers ---
    // Adjusted handleProviderChange: It now only sets the provider.
    // The logic to set the default model for the chat should be handled
    // by the component calling this hook (e.g., in App.tsx via handleChatModelChange).
    const handleProviderChange = useCallback((e: JSX.TargetedEvent<HTMLSelectElement>) => {
        const newProvider = e.currentTarget.value as ApiProviderKey | '';
        setSelectedProvider(newProvider || null);
        // setCurrentModelInput(''); // Removed - App.tsx will handle setting the model via handleChatModelChange
    }, []); // No dependency needed now

    // Removed handleModelInputChange - model changes are handled by handleChatModelChange in App.tsx

    // Function to update available models (called from App component's useEffect)
    const updateAvailableModels = useCallback((models: AvailableModel[]) => {
        setAvailableModels(models);
        // Optionally, re-select provider/model if current selection becomes invalid?
        // For now, just update the list. Let App handle initial selection logic.
    }, []);


    return {
        availableModels,
        setAvailableModels: updateAvailableModels,
        selectedProvider,       // Still useful for filtering
        setSelectedProvider,    // Still useful for UI control
        // currentModelInput,   // Removed
        // setCurrentModelInput,// Removed
        displayModelName,       // Derived from prop
        uniqueProviders,
        filteredModels,
        handleProviderChange,   // Modified
        // handleModelInputChange, // Removed
    };
}