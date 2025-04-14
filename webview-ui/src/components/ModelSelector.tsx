import { FunctionalComponent } from 'preact';
import { useState, useMemo, useCallback, useEffect } from 'preact/hooks';
import { useStore } from '@nanostores/preact'; // Use preact binding
import { JSX } from 'preact/jsx-runtime';
import { AvailableModel } from '../../../src/common/types'; // Removed ProviderInfoAndStatus, not needed here
import { $providerStatus, $modelsForSelectedProvider, fetchModels } from '../stores/providerStores'; // Import stores and fetch function
// Removed Jotai atom imports

interface ModelSelectorProps {
    labelPrefix?: string;
    selectedProviderId: string | null;
    selectedModelId: string | null; // This is now just the model ID (e.g., 'claude-3-5-sonnet-latest')
    onModelChange: (providerId: string | null, modelId: string | null) => void;
}

export const ModelSelector: FunctionalComponent<ModelSelectorProps> = ({
    labelPrefix = '',
    selectedProviderId, // Use directly
    selectedModelId,    // Use directly
    onModelChange,
}) => {
    // --- State from Nanostores ---
    const allProvidersStatus = useStore($providerStatus); // Provider list for the dropdown
    const modelsState = useStore($modelsForSelectedProvider); // Models for the selected provider { loading, error, models, providerId }
    console.log('[ModelSelector Render] Provider Status:', JSON.stringify(allProvidersStatus));
    console.log('[ModelSelector Render] Models State:', JSON.stringify(modelsState));

    // --- Local State ---
    const [inputValue, setInputValue] = useState(''); // Input field value

    // Effect to fetch models when provider changes
    useEffect(() => {
        console.log(`[ModelSelector useEffect/ProviderChange] selectedProviderId changed to: ${selectedProviderId}. Triggering fetchModels.`);
        fetchModels(selectedProviderId); // Call the fetch function
    }, [selectedProviderId]); // Depend only on selectedProviderId

    // Effect to update local input state based on selected model *from the loaded models state*
    useEffect(() => {
        // Use modelsState.models which holds the fetched models for the selected provider
        const selectedModelObject = modelsState.models.find(m => m.id === selectedModelId);
        const newValue = selectedModelObject?.name ?? selectedModelId ?? ''; // Use name first, then ID

        // Only update if the calculated value differs from current input and models are loaded for the correct provider
        if (modelsState.providerId === selectedProviderId && !modelsState.loading && newValue !== inputValue) {
            console.log(`[ModelSelector useEffect/InputUpdate] Setting inputValue based on selectedModelId "${selectedModelId}" and loaded models: "${newValue}"`);
            setInputValue(newValue);
        }
        // Clear input if provider changes and models haven't loaded for the new provider yet,
        // or if the selected model is no longer valid for the current provider's models
        else if (selectedProviderId && modelsState.providerId !== selectedProviderId && inputValue) {
             console.log(`[ModelSelector useEffect/InputUpdate] Provider changed (${selectedProviderId}), clearing input.`);
             setInputValue('');
        } else if (selectedProviderId && modelsState.providerId === selectedProviderId && !modelsState.loading && !selectedModelObject && selectedModelId && inputValue) {
             console.log(`[ModelSelector useEffect/InputUpdate] Selected model "${selectedModelId}" not found in loaded models, clearing input.`);
             setInputValue(''); // Clear input if selected model doesn't exist in loaded list
        }
        // Note: Removing inputValue from the dependency array to prevent this effect
        // from running every time the user types. It should now only run when external selections change.
    }, [selectedProviderId, selectedModelId, modelsState]); // REMOVED inputValue dependency


    // --- Derived Data from Nanostore ---
    // Calculate uniqueProviders directly without useMemo to avoid potential timing issues
    let uniqueProviders: { id: string; name: string }[] = [];
    console.log("[ModelSelector] Calculating uniqueProviders directly. allProvidersStatus:", allProvidersStatus);
    if (allProvidersStatus && Array.isArray(allProvidersStatus) && allProvidersStatus.length > 0) {
        const providerMap = new Map<string, { id: string; name: string }>();
        allProvidersStatus.forEach(provider => {
            if (provider && provider.id && provider.name) {
                if (!providerMap.has(provider.id)) {
                    providerMap.set(provider.id, { id: provider.id, name: provider.name });
                }
            } else {
                 console.warn("[ModelSelector] Skipping invalid provider object in allProvidersStatus:", provider);
            }
        });
        uniqueProviders = Array.from(providerMap.values());
    } else if (!allProvidersStatus) {
         console.log("[ModelSelector] allProvidersStatus is null or undefined during direct calculation.");
    } else if (!Array.isArray(allProvidersStatus)) {
         console.error("[ModelSelector] unexpected allProvidersStatus type during direct calculation:", typeof allProvidersStatus, allProvidersStatus);
    } else {
         console.log("[ModelSelector] allProvidersStatus is an empty array during direct calculation.");
    }
    /* // Replaced with direct calculation above
    const uniqueProviders = useMemo(() => {
        console.log("[ModelSelector] Recalculating uniqueProviders. allProvidersStatus:", allProvidersStatus); // Added log
        if (!allProvidersStatus) {
            console.log("[ModelSelector] allProvidersStatus is null or undefined.");
            return [];
        }
        // Check 2: Is allProvidersStatus actually an array? (Previous bug source)
        if (!Array.isArray(allProvidersStatus)) {
             console.error("[ModelSelector] unexpected allProvidersStatus type:", typeof allProvidersStatus, allProvidersStatus);
             return [];
        }
        if (allProvidersStatus.length === 0) {
            console.log("[ModelSelector] allProvidersStatus is an empty array.");
            return [];
        }
        // Extract unique providers from the status list
        const providerMap = new Map<string, { id: string; name: string }>();
        allProvidersStatus.forEach(provider => {
            if (provider && provider.id && provider.name) { // Add check for valid provider object
                if (!providerMap.has(provider.id)) {
                    providerMap.set(provider.id, { id: provider.id, name: provider.name });
                }
            } else {
                 console.warn("[ModelSelector] Skipping invalid provider object in allProvidersStatus:", provider);
            }
        });
        return Array.from(providerMap.values());
    }, [allProvidersStatus]);
    */ // End replaced block

    // Use models directly from the dedicated models store
    const modelsForSelectedProvider = useMemo(() => {
        // Ensure models are loaded for the currently selected provider
        if (modelsState.providerId === selectedProviderId && !modelsState.loading) {
            return modelsState.models;
        }
        return []; // Return empty array if loading, error, or provider mismatch
    }, [selectedProviderId, modelsState]);


    // Filter models for datalist based on input and *loaded* models for the selected provider
    const filteredModelsForDatalist = useMemo(() => {
        const lowerInput = inputValue.toLowerCase();
        // Filter based on the models loaded into modelsState.models
        if (!selectedProviderId || modelsState.providerId !== selectedProviderId || modelsState.loading || modelsState.models.length === 0) return [];
        if (!lowerInput) return modelsState.models; // Show all models for provider if input is empty

        return modelsState.models.filter(model =>
            model.id.toLowerCase().includes(lowerInput) || // Match ID
            (model.name && model.name.toLowerCase().includes(lowerInput)) // Match name (if exists)
        );
    }, [inputValue, selectedProviderId, modelsState]); // Depend on input, selection, and models state

    // --- Event Handlers ---
    const handleProviderSelect = useCallback((e: JSX.TargetedEvent<HTMLSelectElement>) => {
        const newProviderId = e.currentTarget.value || null;
        console.log(`[ModelSelector handleProviderSelect] Selected Provider: ${newProviderId}`);
        setInputValue(''); // Clear model input
        console.log(`[ModelSelector handleProviderSelect] Calling onModelChange(${newProviderId}, null)`);
        onModelChange(newProviderId, null); // Update state with new provider, clear model
    }, [onModelChange]);

    // Update input value as user types (NEW HANDLER)
    const handleModelInputChange = useCallback((e: JSX.TargetedEvent<HTMLInputElement>) => {
        const typedValue = e.currentTarget.value;
        console.log(`[ModelSelector handleModelInputChange] User typed: "${typedValue}". Setting inputValue.`);
        setInputValue(typedValue);
        // Don't trigger onModelChange here, wait for blur or explicit selection
    }, [setInputValue]);

    // Renamed handleModelInput to handleModelInputChange above

    // Handle finalization on blur (NEW HANDLER)
    const handleModelBlur = useCallback(() => {
        const lowerInput = inputValue.toLowerCase().trim();
        let matchedModel: AvailableModel | null = null;

        console.log(`[ModelSelector handleModelBlur] Input blurred with value: "${inputValue}"`);

        // Use models from the dedicated store (modelsState.models)
        if (modelsState.providerId !== selectedProviderId || modelsState.loading) {
            console.log('[ModelSelector handleModelBlur] Models not ready or mismatched, cannot match.');
            // Optionally revert input here if needed, or just exit
             const currentSelectedModelAgain = modelsState.models.find(m => m.id === selectedModelId);
             const revertValueAgain = currentSelectedModelAgain?.name ?? selectedModelId ?? '';
             setInputValue(revertValueAgain);
            return;
        }

        // Try to find an exact match (ID or Name) within the *loaded* models for the selected provider
        matchedModel = modelsState.models.find((m: AvailableModel) =>
             m.id.toLowerCase() === lowerInput || (m.name && m.name.toLowerCase() === lowerInput)
        ) ?? null;

        if (matchedModel) {
            // Found match within current provider
            const finalProviderId = matchedModel.providerId; // Should match selectedProviderId
            const finalModelId = matchedModel.id;
            const displayValue = matchedModel.name ?? matchedModel.id;
            console.log(`[ModelSelector handleModelBlur] Found match in current provider: ${displayValue}. Provider: ${finalProviderId}, Model: ${finalModelId}`);
            setInputValue(displayValue); // Update input to reflect match
            if (finalProviderId !== selectedProviderId || finalModelId !== selectedModelId) {
                console.log(`[ModelSelector handleModelBlur] Selection changed. Calling onModelChange(${finalProviderId}, ${finalModelId})`);
                onModelChange(finalProviderId, finalModelId);
            } else {
                 console.log(`[ModelSelector handleModelBlur] Selection hasn't changed.`);
            }
        } else {
            // No match found within the loaded models for the current provider
            console.log(`[ModelSelector handleModelBlur] No exact match found for "${inputValue}" within loaded models for provider ${selectedProviderId}.`);
            // Revert input to the currently selected model's display value (or empty if none selected)
            const currentSelectedModel = modelsState.models.find(m => m.id === selectedModelId);
            const revertValue = currentSelectedModel?.name ?? selectedModelId ?? '';
            console.log(`[ModelSelector handleModelBlur] Reverting input value to: "${revertValue}"`);
            setInputValue(revertValue);

            // If the input was non-empty but didn't match, and a model *was* selected,
            // it means the user typed something invalid and we reverted. No need to call onModelChange.
            // If the input was empty, and a model *was* selected, we should clear the selection.
            if (!lowerInput && selectedModelId !== null) {
                 console.log(`[ModelSelector handleModelBlur] Input was empty, clearing model selection. Calling onModelChange(${selectedProviderId}, null)`);
                 onModelChange(selectedProviderId, null);
            }
            // If input was non-empty and didn't match, OR input was empty and nothing was selected, do nothing further.
        }
    }, [inputValue, selectedProviderId, selectedModelId, modelsState, onModelChange, setInputValue]); // Depend on modelsState now

    // Handle selection directly from datalist via onInput event (more reliable than onChange for datalist)
    // This is combined with the input change handler now.
    // const handleDataListSelect = useCallback((e: JSX.TargetedEvent<HTMLInputElement>) => { ... }); // Removed

    // --- Render ---
    const providerLabel = `${labelPrefix ? labelPrefix + ' ' : ''}Provider`; // Simplified label
    const modelLabel = `${labelPrefix ? labelPrefix + ' ' : ''}Model`; // Simplified label
    const providerSelectId = `provider-select-${labelPrefix.toLowerCase().replace(/\s+/g, '-') || 'main'}`;
    const modelInputId = `model-input-${labelPrefix.toLowerCase().replace(/\s+/g, '-') || 'main'}`;
    const datalistId = `models-datalist-${labelPrefix.toLowerCase().replace(/\s+/g, '-') || 'main'}`;

    // Loading/Error states derived from relevant stores
    const providersLoading = allProvidersStatus === null; // Check if provider list is loading
    // Model loading/error states from the dedicated store, specific to the selected provider
    const modelsLoading = modelsState.loading;
    const modelsError = modelsState.error;
    const modelFetchProviderId = modelsState.providerId;

    return (
        <div class="model-selector flex items-center space-x-2">
            <label htmlFor={providerSelectId} class="text-sm font-medium mr-1">{providerLabel}:</label>
            <select
                id={providerSelectId}
                value={selectedProviderId ?? ''} // Use selectedProviderId prop
                onChange={handleProviderSelect}
                disabled={providersLoading} // Disable only while loading providers
                class="p-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
                <option value="">-- Select Provider --</option>
                {/* Removed loading/error options, handled by disabled state */}
                {uniqueProviders.map(provider => (
                    <option key={provider.id} value={provider.id}>{provider.name}</option>
                ))}
            </select>

            <label htmlFor={modelInputId} class="text-sm font-medium ml-3 mr-1">{modelLabel}:</label>
            <input
                list={datalistId}
                id={modelInputId}
                name={modelInputId}
                value={inputValue} // Bind to local input state
                onInput={handleModelInputChange} // Update local state on input
                onBlur={handleModelBlur} // Finalize on blur
                placeholder={
                    !selectedProviderId ? "Select Provider First"
                    : modelsLoading ? "Loading Models..."
                    : modelsError ? "Error loading models"
                    : "Select or Type Model"
                }
                // Disable if no provider selected OR models are loading for the selected provider OR there was an error
                disabled={!selectedProviderId || (modelsLoading && modelFetchProviderId === selectedProviderId) || !!modelsError}
                class="p-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-sm flex-1 min-w-40 focus:ring-blue-500 focus:border-blue-500 outline-none"
                aria-invalid={!!modelsError} // Indicate error state
                title={modelsError ?? ''} // Show error message on hover
            />
            <datalist id={datalistId}>
                {/* Datalist options based on successfully filtered models */}
                {filteredModelsForDatalist.map((model) => (
                    // Value should be the model name (or ID if name isn't unique/reliable for selection)
                    // Using name seems more user-friendly for display in datalist suggestion
                    <option key={`${model.providerId}-${model.id}`} value={model.name}>
                        {/* You can add more detail here if needed, but value is key */}
                        {/* {`${model.providerName} / ${model.name}`} */}
                    </option>
                ))}
            </datalist>
        </div>
    );
};
