import { useState, useMemo, useCallback, useEffect } from 'preact/hooks';
import { JSX } from 'preact/jsx-runtime';
import { ApiProviderKey } from '../app'; // Import ApiProviderKey from app
import { AvailableModel } from '../../../src/common/types'; // Import AvailableModel from common types

// Define props for the hook
interface UseModelSelectionProps {
    availableProviders: AvailableModel[]; // List of available providers (quick load)
    providerModelsMap: Record<string, AvailableModel[]>; // Map of providerId -> loaded models
    activeChatModelId: string | null; // Currently selected model ID for the active chat
}

export function useModelSelection({
    availableProviders,
    providerModelsMap,
    activeChatModelId
}: UseModelSelectionProps) {
    // State managed by the hook: only the currently selected provider filter
    const [selectedProvider, setSelectedProvider] = useState<ApiProviderKey | null>(null);

    // --- Derived State ---

    // Derive unique providers from the availableProviders prop
    const uniqueProviders = useMemo(() => {
        // Assuming availableProviders contains provider info (even with placeholder model IDs)
        const providers = new Map<string, { id: string; name: string }>();
        availableProviders.forEach(providerInfo => {
            if (!providers.has(providerInfo.providerId)) {
                providers.set(providerInfo.providerId, { id: providerInfo.providerId, name: providerInfo.providerName });
            }
        });
        // Sort providers alphabetically by name
        return Array.from(providers.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [availableProviders]);

    // Derive the list of models to display based on the selected provider filter
    const filteredModels = useMemo(() => {
        if (!selectedProvider) return [];
        // Get models from the map for the selected provider
        const models = providerModelsMap[selectedProvider] || [];
        // Add the modelNamePart for display
        return models.map(model => ({
            ...model,
            modelNamePart: model.id.split(':').slice(1).join(':') || model.name
        }));
    }, [providerModelsMap, selectedProvider]);

    // Derive the displayable part of the active model ID (remains the same)
    const displayModelName = useMemo(() => {
        return activeChatModelId ? activeChatModelId.split(':').slice(1).join(':') : '';
    }, [activeChatModelId]);

    // Effect to set the initial selectedProvider based on the activeChatModelId
    useEffect(() => {
        if (activeChatModelId && activeChatModelId.includes(':')) {
            const providerId = activeChatModelId.split(':')[0] as ApiProviderKey;
            // Check if this provider is actually available before setting it
            if (uniqueProviders.some(p => p.id === providerId)) {
                 setSelectedProvider(providerId);
            } else {
                 // If the active chat's provider isn't available, clear the selection
                 setSelectedProvider(null);
            }
        } else {
            setSelectedProvider(null); // Clear selection if no active model ID
        }
        // Re-run when the active chat model changes OR when the list of available providers changes
    }, [activeChatModelId, uniqueProviders]);


    // --- Handlers ---

    // Handler to update the selected provider filter
    const handleProviderChange = useCallback((e: JSX.TargetedEvent<HTMLSelectElement>) => {
        const newProvider = e.currentTarget.value as ApiProviderKey | '';
        setSelectedProvider(newProvider || null);
        // The component using this hook (App.tsx) is responsible for
        // deciding which model to select when the provider changes (e.g., the first one).
    }, []);


    return {
        // availableModels, // Removed - Data comes from props now
        // setAvailableModels, // Removed
        selectedProvider,       // State managed by the hook
        setSelectedProvider,    // Setter for the state
        displayModelName,       // Derived from prop
        uniqueProviders,        // Derived from prop
        filteredModels,         // Derived from prop and state
        handleProviderChange,   // Handler managed by the hook
    };
}