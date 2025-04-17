import { FunctionalComponent } from 'preact';
import { useState, useMemo, useCallback, useEffect, useRef } from 'preact/hooks'; // Import useRef
import { useStore } from '@nanostores/preact'; // Use preact binding
import { JSX } from 'preact/jsx-runtime';
import { AvailableModel } from '../../../src/common/types';
import { $providerStatus, $modelsForSelectedProvider, fetchModels } from '../stores/providerStores';
import { CustomSelect } from './ui/CustomSelect'; // Updated import path

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

    // Effect to sync selectedModelId prop with local inputValue state
    useEffect(() => {
        console.log(`[ModelSelector useEffect/SyncInput] selectedModelId prop changed to: "${selectedModelId}". Updating inputValue.`);
        // Only update if the prop is different from the current input value to avoid unnecessary updates/loops
        if (selectedModelId !== inputValue) {
             setInputValue(selectedModelId ?? '');
        }
        // Dependency array includes selectedModelId to trigger on prop change
        // Also include inputValue to potentially handle external resets, though primarily driven by selectedModelId
    }, [selectedModelId]);
 
    // Removed imperative useEffect for select update
 
    // --- Derived Data ---
    let uniqueProviders: { id: string; name: string }[] = [];
    if (Array.isArray(allProvidersStatus)) {
        const providerMap = new Map<string, { id: string; name: string }>();
        // Filter providers based on status before adding to the map
        allProvidersStatus
            // Use credentialsSet instead of apiKeySet
            .filter(provider => provider && provider.enabled && (provider.credentialsSet || !provider.requiresApiKey))
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

    // Prepare grouped options for CustomSelect (only one group for the selected provider)
    const groupedModelOptions = useMemo(() => {
        if (!selectedProviderId || modelsState.providerId !== selectedProviderId || modelsState.loading || modelsState.models.length === 0) {
            return {};
        }
        const providerName = uniqueProviders.find(p => p.id === selectedProviderId)?.name || selectedProviderId;
        // Map AvailableModel to Option format { id, name }
        const options = modelsForSelectedProvider.map(m => ({ id: m.id, name: m.name || m.id }));
        return { [providerName]: options };
    }, [selectedProviderId, modelsState, modelsForSelectedProvider, uniqueProviders]);

    // Prepare grouped options for Provider CustomSelect, ensuring correct type even when empty
    const groupedProviderOptions = useMemo((): Record<string, { id: string; name: string }[]> => { // Add return type annotation to useMemo callback
        if (!Array.isArray(allProvidersStatus) || uniqueProviders.length === 0) {
            return {}; // Return an empty object if no providers
        }
        // Use a generic group label and ensure the value is always an array
        const options = uniqueProviders.map(p => ({ id: p.id, name: p.name }));
        return { "AI Providers": options };
    }, [allProvidersStatus, uniqueProviders]);


    // --- Event Handlers ---
    // Updated handler for Provider CustomSelect change
    const handleProviderSelectChange = useCallback((newProviderId: string | null) => {
        console.log(`[ModelSelector handleProviderSelectChange] Provider changed to: "${newProviderId}"`);
        setInputValue(''); // Clear model input when provider changes
        if (newProviderId !== selectedProviderId) {
             console.log(`[ModelSelector handleProviderSelectChange] Calling onModelChange with Provider: ${newProviderId}, Model: null`);
            onModelChange(newProviderId, null); // Deselect model when provider changes
        } else {
             console.log(`[ModelSelector handleProviderSelectChange] Provider selection unchanged.`);
        }
    }, [selectedProviderId, onModelChange]);


    // Handler for Model CustomSelect change
    const handleModelSelectChange = useCallback((newModelId: string | null) => {
        console.log(`[ModelSelector handleModelSelectChange] CustomSelect changed to: "${newModelId}"`);
        // Provider ID doesn't change here, only the model ID
        if (selectedProviderId && newModelId !== selectedModelId) {
             console.log(`[ModelSelector handleModelSelectChange] Calling onModelChange with Provider: ${selectedProviderId}, Model: ${newModelId}`);
            onModelChange(selectedProviderId, newModelId);
        } else if (!newModelId && selectedModelId) {
             console.log(`[ModelSelector handleModelSelectChange] Model deselected. Calling onModelChange with Provider: ${selectedProviderId}, Model: null`);
             onModelChange(selectedProviderId, null);
        } else {
             console.log(`[ModelSelector handleModelSelectChange] No change detected or provider not selected.`);
        }
        // Input value is managed internally by CustomSelect based on its 'value' prop now
    }, [selectedProviderId, selectedModelId, onModelChange]);


    // --- Render ---
    const providerLabel = `${labelPrefix ? labelPrefix + ' ' : ''}Provider`;
    const modelLabel = `${labelPrefix ? labelPrefix + ' ' : ''}Model`;
    const providerSelectId = `provider-select-${labelPrefix.toLowerCase().replace(/\s+/g, '-') || 'main'}`;
    const modelInputId = `model-input-${labelPrefix.toLowerCase().replace(/\s+/g, '-') || 'main'}`;
    // Removed datalistId

    const providersLoading = allProvidersStatus === 'loading' || allProvidersStatus === null;
    const providersError = allProvidersStatus === 'error';
    const modelsLoading = modelsState.loading;
    const modelsError = modelsState.error;
    const modelFetchProviderId = modelsState.providerId;

    return (
        // Use gap for consistent spacing, align items center
        <div class="model-selector flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-2">
                <label htmlFor={providerSelectId} class="text-sm font-medium text-[var(--vscode-foreground)] min-w-[70px]">{providerLabel}:</label>
                <div class="flex-grow min-w-[200px]">
                    <CustomSelect
                        ariaLabel={providerLabel}
                        groupedOptions={groupedProviderOptions}
                        value={selectedProviderId}
                        onChange={handleProviderSelectChange}
                        placeholder={
                            providersLoading ? "Loading..."
                            : providersError ? "Error"
                            : "-- Select Provider --"
                        }
                        disabled={providersLoading || providersError || uniqueProviders.length === 0}
                        allowCustomValue={false}
                        showId={false}
                    />
                </div>
            </div>

            <div className="flex items-center gap-2">
                <label htmlFor={modelInputId} class="text-sm font-medium text-[var(--vscode-foreground)] min-w-[70px]">{modelLabel}:</label>
                <div class="flex-grow min-w-[200px]">
                    <CustomSelect
                        ariaLabel={modelLabel}
                        groupedOptions={groupedModelOptions}
                        value={selectedModelId}
                        onChange={handleModelSelectChange}
                        placeholder={
                            !selectedProviderId ? "Select Provider First"
                            : modelsLoading ? "Loading Models..."
                            : modelsError ? "Error loading models"
                            : "Select or Type Model"
                        }
                        disabled={!selectedProviderId || !!modelsError || modelsLoading}
                        allowCustomValue={true}
                    />
                </div>
            </div>

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
