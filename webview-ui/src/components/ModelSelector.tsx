import { FunctionalComponent } from 'preact';
import { useState, useMemo, useCallback, useEffect } from 'preact/hooks';
import { useStore } from '@nanostores/react'; // Import useStore
import { JSX } from 'preact/jsx-runtime';
import { AvailableModel, ProviderInfoAndStatus } from '../../../src/common/types'; // Added ProviderInfoAndStatus
import { $providerStatus } from '../stores/providerStores'; // Import Nanostore provider status store
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
    const allProvidersStatus = useStore($providerStatus); // Use the Nanostore for provider status

    // --- Local State ---
    const [inputValue, setInputValue] = useState(''); // Input field value

    // Effect to update local input state when external selection changes or provider data loads
    useEffect(() => {
        const providerData = allProvidersStatus?.find(p => p.id === selectedProviderId);
        const models = providerData?.models ?? [];
        const selectedModelObject = models.find(m => m.id === selectedModelId);
        const newValue = selectedModelObject?.name ?? selectedModelId ?? '';
        // Only update if the calculated value differs from current input, avoids loops
        if (newValue !== inputValue) {
            console.log(`[ModelSelector useEffect] Setting inputValue based on props/data: "${newValue}"`);
            setInputValue(newValue);
        }
    }, [selectedProviderId, selectedModelId, allProvidersStatus, inputValue]); // Re-run if props, provider data, or local input changes


    // --- Derived Data from Nanostore ---
    const uniqueProviders = useMemo(() => {
        if (!allProvidersStatus) return [];
        // Extract unique providers from the status list
        const providerMap = new Map<string, { id: string; name: string }>();
        allProvidersStatus.forEach(provider => {
            if (!providerMap.has(provider.id)) {
                providerMap.set(provider.id, { id: provider.id, name: provider.name });
            }
        });
        return Array.from(providerMap.values());
    }, [allProvidersStatus]);

    const modelsForSelectedProvider = useMemo(() => {
        if (!selectedProviderId || !allProvidersStatus) return [];
        const providerData = allProvidersStatus.find(p => p.id === selectedProviderId);
        // Adapt to the structure from ProviderInfoAndStatus
        return providerData?.models.map(m => ({
            id: m.id,
            name: m.name,
            providerId: providerData.id, // Add providerId
            providerName: providerData.name // Add providerName
        } as AvailableModel)) ?? [];
    }, [selectedProviderId, allProvidersStatus]);


    // Filter models for datalist based on input and selected provider's models
    const filteredModelsForDatalist = useMemo(() => {
        const lowerInput = inputValue.toLowerCase();
        if (!selectedProviderId || modelsForSelectedProvider.length === 0) return [];
        if (!lowerInput) return modelsForSelectedProvider; // Show all models for provider if input is empty

        return modelsForSelectedProvider.filter(model =>
            model.id.toLowerCase().includes(lowerInput) ||
            model.name.toLowerCase().includes(lowerInput)
        );
    }, [inputValue, modelsForSelectedProvider, selectedProviderId]);

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

        // Try to find an exact match (ID or Name) within the currently selected provider's models first
        matchedModel = modelsForSelectedProvider.find((m: AvailableModel) =>
            m.id.toLowerCase() === lowerInput || m.name.toLowerCase() === lowerInput
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
            // No match found within the current provider
            console.log(`[ModelSelector handleModelBlur] No exact match found for "${inputValue}" within provider ${selectedProviderId}.`);
            // Revert input to the currently selected model's display value (or empty if none selected)
            const currentSelectedModel = modelsForSelectedProvider.find(m => m.id === selectedModelId);
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
    }, [inputValue, selectedProviderId, selectedModelId, modelsForSelectedProvider, onModelChange, setInputValue]);

    // Handle selection directly from datalist via onInput event (more reliable than onChange for datalist)
    // This is combined with the input change handler now.
    // const handleDataListSelect = useCallback((e: JSX.TargetedEvent<HTMLInputElement>) => { ... }); // Removed

    // --- Render ---
    const providerLabel = `${labelPrefix ? labelPrefix + ' ' : ''}Provider`; // Simplified label
    const modelLabel = `${labelPrefix ? labelPrefix + ' ' : ''}Model`; // Simplified label
    const providerSelectId = `provider-select-${labelPrefix.toLowerCase().replace(/\s+/g, '-') || 'main'}`;
    const modelInputId = `model-input-${labelPrefix.toLowerCase().replace(/\s+/g, '-') || 'main'}`;
    const datalistId = `models-datalist-${labelPrefix.toLowerCase().replace(/\s+/g, '-') || 'main'}`;

    // Loading/Error states derived from the single Nanostore
    const providersLoading = allProvidersStatus === null;
    // Can't easily distinguish provider fetch error vs model fetch error with current store structure
    // Assume error if loading is done and data is still null or empty? Or add error state to store?
    // For now, simplify: disable if loading.
    const modelsLoading = providersLoading; // If providers haven't loaded, models haven't either
    const modelsError = !providersLoading && !allProvidersStatus; // Basic error check

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
                // Use onInput and onBlur as before
                placeholder={!selectedProviderId ? "Select Provider First" : (modelsLoading ? "Loading..." : "Select or Type Model")}
                disabled={!selectedProviderId || modelsLoading} // Disable if no provider or loading
                class="p-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-sm flex-1 min-w-40 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <datalist id={datalistId}>
                {/* Datalist options based on filtered models */}
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
