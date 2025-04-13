import { useState, useMemo, useCallback } from 'preact/hooks';
import { JSX } from 'preact/jsx-runtime';
import { ApiProviderKey } from '../app'; // Import ApiProviderKey from app
import { AvailableModel } from '../../../src/common/types'; // Import AvailableModel from common types

export function useModelSelection(initialModels: AvailableModel[] = []) {
    const [availableModels, setAvailableModels] = useState<AvailableModel[]>(initialModels);
    const [selectedProvider, setSelectedProvider] = useState<ApiProviderKey | null>(null);
    const [currentModelInput, setCurrentModelInput] = useState<string>('');

    // --- Derived State ---
    const uniqueProviders = useMemo(() => {
        const providers = new Set<ApiProviderKey>();
        availableModels.forEach(model => providers.add(model.providerId as ApiProviderKey));
        return Array.from(providers);
    }, [availableModels]);

    const filteredModels = useMemo(() => {
        if (!selectedProvider) return [];
        return availableModels.filter(model => model.providerId === selectedProvider);
    }, [availableModels, selectedProvider]);

    // --- Handlers ---
    const handleProviderChange = useCallback((e: JSX.TargetedEvent<HTMLSelectElement>) => {
        const newProvider = e.currentTarget.value as ApiProviderKey | '';
        if (newProvider === '') {
            setSelectedProvider(null);
            setCurrentModelInput('');
        } else {
            setSelectedProvider(newProvider);
            // Find the first model for the newly selected provider
            const defaultModel = availableModels.find(m => m.providerId === newProvider);
            const newModelId = defaultModel ? defaultModel.id : '';
            setCurrentModelInput(newModelId);
        }
    }, [availableModels]); // Dependency: availableModels

    const handleModelInputChange = useCallback((e: JSX.TargetedEvent<HTMLInputElement>) => {
        setCurrentModelInput(e.currentTarget.value);
    }, []);

    // Function to update available models (called from App component's useEffect)
    const updateAvailableModels = useCallback((models: AvailableModel[]) => {
        setAvailableModels(models);
        // Optionally, re-select provider/model if current selection becomes invalid?
        // For now, just update the list. Let App handle initial selection logic.
    }, []);


    return {
        availableModels,
        setAvailableModels: updateAvailableModels, // Expose setter
        selectedProvider,
        setSelectedProvider, // Expose setter if needed externally
        currentModelInput,
        setCurrentModelInput, // Expose setter if needed externally
        uniqueProviders,
        filteredModels,
        handleProviderChange,
        handleModelInputChange,
    };
}