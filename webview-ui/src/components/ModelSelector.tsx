import { FunctionalComponent } from 'preact';
import { useState, useMemo, useCallback, useEffect, useRef } from 'preact/hooks'; // Import useRef
import { useStore } from '@nanostores/preact'; // Use preact binding
import { JSX } from 'preact/jsx-runtime';
import { AvailableModel } from '../../../src/common/types';
import { $providerStatus, $modelsForSelectedProvider, fetchModels } from '../stores/providerStores';

interface ModelSelectorProps {
    labelPrefix?: string;
    selectedProviderId: string | null;
    selectedModelId: string | null;
    onModelChange: (providerId: string | null, modelId: string | null) => void;
}

export const ModelSelector: FunctionalComponent<ModelSelectorProps> = ({
    labelPrefix = '',
    selectedProviderId,
    selectedModelId,
    onModelChange,
}) => {
    // Log the received props on render
    console.log(`[ModelSelector Render START] selectedProviderId: ${selectedProviderId}, selectedModelId: ${selectedModelId}`);

    // --- State from Nanostores ---
    const allProvidersStatus = useStore($providerStatus);
    const modelsState = useStore($modelsForSelectedProvider);
    console.log('[ModelSelector Render] Provider Status:', JSON.stringify(allProvidersStatus));
    console.log('[ModelSelector Render] Models State:', JSON.stringify(modelsState));

    // --- Local State ---
    const [inputValue, setInputValue] = useState('');
    // Removed selectRef

    // Effect to fetch models when provider changes
    useEffect(() => {
        console.log(`[ModelSelector useEffect/ProviderChange] selectedProviderId changed to: ${selectedProviderId}. Triggering fetchModels.`);
        fetchModels(selectedProviderId);
    }, [selectedProviderId]);

    // Effect to update local input state based on selected model
    useEffect(() => {
        const selectedModelObject = modelsState.models.find(m => m.id === selectedModelId);
        const newValue = selectedModelObject?.name ?? selectedModelId ?? '';
        if (modelsState.providerId === selectedProviderId && !modelsState.loading && newValue !== inputValue) {
            setInputValue(newValue);
        } else if (selectedProviderId && modelsState.providerId !== selectedProviderId && inputValue) {
            setInputValue('');
        } else if (selectedProviderId && modelsState.providerId === selectedProviderId && !modelsState.loading && !selectedModelObject && selectedModelId && inputValue) {
            setInputValue('');
        }
    }, [selectedProviderId, selectedModelId, modelsState]);

    // Removed imperative useEffect for select update

    // --- Derived Data ---
    let uniqueProviders: { id: string; name: string }[] = [];
    if (Array.isArray(allProvidersStatus)) {
        const providerMap = new Map<string, { id: string; name: string }>();
        // Filter providers based on status before adding to the map
        allProvidersStatus
            .filter(provider => provider && provider.enabled && (provider.apiKeySet || !provider.requiresApiKey))
            .forEach(provider => {
                // Add only ready providers, ensuring uniqueness by ID
                if (!providerMap.has(provider.id)) {
                    providerMap.set(provider.id, { id: provider.id, name: provider.name });
                }
            });
        uniqueProviders = Array.from(providerMap.values());
        // Sort the filtered list
        uniqueProviders.sort((a, b) => a.name.localeCompare(b.name));
    }

    const modelsForSelectedProvider = useMemo(() => {
        const storeProviderId = modelsState.providerId;
        const propProviderId = selectedProviderId;
        const isLoading = modelsState.loading;
        const conditionMet = storeProviderId === propProviderId && !isLoading;
        console.log(`[ModelSelector useMemo/modelsForSelectedProvider] StoreProvider: ${storeProviderId}, PropProvider: ${propProviderId}, Loading: ${isLoading}, ConditionMet: ${conditionMet}`);
        if (conditionMet) {
            console.log(`[ModelSelector useMemo/modelsForSelectedProvider] Returning ${modelsState.models.length} models from store.`);
            return modelsState.models;
        }
        console.log(`[ModelSelector useMemo/modelsForSelectedProvider] Returning empty array.`);
        return [];
    }, [selectedProviderId, modelsState]);

    const filteredModelsForDatalist = useMemo(() => {
        const lowerInput = inputValue.toLowerCase();
        if (!selectedProviderId || modelsState.providerId !== selectedProviderId || modelsState.loading || modelsState.models.length === 0) return [];
        if (!lowerInput) return modelsState.models;
        return modelsState.models.filter(model => model.id.toLowerCase().includes(lowerInput) || (model.name && model.name.toLowerCase().includes(lowerInput)));
    }, [inputValue, selectedProviderId, modelsState]);

    // --- Event Handlers ---
    const handleProviderSelect = useCallback((e: JSX.TargetedEvent<HTMLSelectElement>) => {
        const newProviderId = e.currentTarget.value || null;
        setInputValue('');
        onModelChange(newProviderId, null);
    }, [onModelChange]);

    const handleModelInputChange = useCallback((e: JSX.TargetedEvent<HTMLInputElement>) => {
        setInputValue(e.currentTarget.value);
    }, [setInputValue]);

    const handleModelBlur = useCallback(() => {
        console.log(`[ModelSelector handleModelBlur] Input value on blur: "${inputValue}"`);
        const lowerInput = inputValue.toLowerCase().trim();
        let matchedModel: AvailableModel | null = null;

        // Check if models are loaded for the correct provider
        if (modelsState.providerId !== selectedProviderId || modelsState.loading) {
             console.log(`[ModelSelector handleModelBlur] Models not ready or wrong provider. StoreProvider: ${modelsState.providerId}, PropProvider: ${selectedProviderId}, Loading: ${modelsState.loading}. Reverting input.`);
             const currentSelectedModelAgain = modelsState.models.find(m => m.id === selectedModelId);
             const revertValueAgain = currentSelectedModelAgain?.name ?? selectedModelId ?? '';
             console.log(`[ModelSelector handleModelBlur] Reverting input to: "${revertValueAgain}"`);
             setInputValue(revertValueAgain);
            return;
        }

        console.log(`[ModelSelector handleModelBlur] Trying to match input "${lowerInput}" against ${modelsState.models.length} models.`);
        // Try to find an exact match (case-insensitive) for ID or Name
        matchedModel = modelsState.models.find(m => m.id.toLowerCase() === lowerInput || (m.name && m.name.toLowerCase() === lowerInput)) ?? null;

        if (matchedModel) {
            console.log(`[ModelSelector handleModelBlur] Found match: ID=${matchedModel.id}, Name=${matchedModel.name}`);
            const finalProviderId = matchedModel.providerId;
            const finalModelId = matchedModel.id;
            const displayValue = matchedModel.name ?? matchedModel.id;
            console.log(`[ModelSelector handleModelBlur] Setting input value to displayValue: "${displayValue}"`);
            setInputValue(displayValue);
            if (finalProviderId !== selectedProviderId || finalModelId !== selectedModelId) {
                console.log(`[ModelSelector handleModelBlur] Model changed. Calling onModelChange with Provider: ${finalProviderId}, Model: ${finalModelId}`);
                onModelChange(finalProviderId, finalModelId);
            } else {
                 console.log(`[ModelSelector handleModelBlur] Matched model is the same as current selection. No change needed.`);
            }
        } else {
            console.log(`[ModelSelector handleModelBlur] No exact match found for "${lowerInput}".`);
            const currentSelectedModel = modelsState.models.find(m => m.id === selectedModelId);
            const revertValue = currentSelectedModel?.name ?? selectedModelId ?? '';
            console.log(`[ModelSelector handleModelBlur] Reverting input value to current selection: "${revertValue}"`);
            setInputValue(revertValue);
            // If user cleared the input, deselect the model
            if (!lowerInput && selectedModelId !== null) {
                 console.log(`[ModelSelector handleModelBlur] Input was cleared. Calling onModelChange to deselect model.`);
                 onModelChange(selectedProviderId, null);
            }
        }
    }, [inputValue, selectedProviderId, selectedModelId, modelsState, onModelChange, setInputValue]);

    // --- Render ---
    const providerLabel = `${labelPrefix ? labelPrefix + ' ' : ''}Provider`;
    const modelLabel = `${labelPrefix ? labelPrefix + ' ' : ''}Model`;
    const providerSelectId = `provider-select-${labelPrefix.toLowerCase().replace(/\s+/g, '-') || 'main'}`;
    const modelInputId = `model-input-${labelPrefix.toLowerCase().replace(/\s+/g, '-') || 'main'}`;
    const datalistId = `models-datalist-${labelPrefix.toLowerCase().replace(/\s+/g, '-') || 'main'}`;

    const providersLoading = allProvidersStatus === 'loading' || allProvidersStatus === null;
    const providersError = allProvidersStatus === 'error';
    const modelsLoading = modelsState.loading;
    const modelsError = modelsState.error;
    const modelFetchProviderId = modelsState.providerId;

    return (
        // Use gap for consistent spacing, align items center
        <div class="model-selector flex items-center gap-2">
            <label htmlFor={providerSelectId} class="text-sm font-medium flex-shrink-0">{providerLabel}:</label>
            <select
                // Removed ref
                id={providerSelectId}
                value={selectedProviderId ?? ''} // Control the select value directly
                onChange={handleProviderSelect}
                // Removed defaultValue
                disabled={providersLoading || providersError}
                class="p-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
                <option value="">-- Select Provider --</option>
                {providersLoading && <option disabled>Loading...</option>}
                {providersError && <option disabled>Error loading</option>}
                {!providersLoading && !providersError && Array.isArray(allProvidersStatus) && uniqueProviders.length > 0 && uniqueProviders.map(provider => (
                    <option key={provider.id} value={provider.id}>{provider.name}</option>
                ))}
                {!providersLoading && !providersError && uniqueProviders.length === 0 && <option disabled>No providers found</option>}
            </select>

            {/* Adjusted margin */}
            <label htmlFor={modelInputId} class="text-sm font-medium flex-shrink-0 ml-2">{modelLabel}:</label>
            <input
                list={datalistId}
                id={modelInputId}
                name={modelInputId}
                value={inputValue}
                onInput={handleModelInputChange}
                onBlur={handleModelBlur}
                placeholder={
                    !selectedProviderId ? "Select Provider First"
                    : modelsLoading ? "Loading Models..."
                    : modelsError ? "Error loading models"
                    : "Select or Type Model"
                }
                // Removed modelsLoading from disabled condition
                disabled={!selectedProviderId || !!modelsError}
                // Added flex-grow to allow input to expand
                class="p-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-sm flex-grow min-w-40 focus:ring-blue-500 focus:border-blue-500 outline-none"
                aria-invalid={!!modelsError}
                title={modelsError ?? (modelsLoading ? 'Loading models...' : '')} // Show loading in title
            />
            <datalist id={datalistId}>
                {filteredModelsForDatalist.map((model) => (
                    // Use model.id as the value for consistency with internal logic
                    // Use model.id as key assuming it's unique for the provider
                    // Display model.name (or id as fallback) between the tags for the user
                    <option key={model.id} value={model.id}>{model.name ?? model.id}</option>
                ))}
            </datalist>

            {/* Error Indicator - Adjusted margin */}
            {modelsError && (
                <div class="text-red-500 flex-shrink-0" title={modelsError}>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                </div>
            )}
        </div>
    );
};
