import { FunctionalComponent } from 'preact';
import { JSX } from 'preact/jsx-runtime';
import { AvailableModel } from '../../../src/common/types';
import { useModelSelection } from '../hooks/useModelSelection';

// Define the extended model type expected from the hook
type FilteredModel = AvailableModel & { modelNamePart: string };

interface ModelSelectorProps {
    labelPrefix?: string;
    // Replace availableModels with the new structure
    availableProviders: AvailableModel[]; // List of available providers (quick load)
    providerModelsMap: Record<string, AvailableModel[]>; // Map of providerId -> loaded models
    selectedModelId: string | null;
    onModelChange: (newModelId: string) => void;
    // Optional: If provider selection should be handled externally (like in HeaderControls)
    // externalSelectedProvider?: string | null;
    // externalHandleProviderChange?: (e: JSX.TargetedEvent<HTMLSelectElement>) => void;
}

export const ModelSelector: FunctionalComponent<ModelSelectorProps> = ({
    labelPrefix = '',
    // availableModels, // Removed
    availableProviders, // Added
    providerModelsMap, // Added
    selectedModelId,
    onModelChange,
    // externalSelectedProvider,
    // externalHandleProviderChange,
}) => {
    // Use the hook internally to manage provider/model state based on the selectedModelId
    const {
        selectedProvider,
        setSelectedProvider,
        displayModelName,
        uniqueProviders,
        filteredModels,
        handleProviderChange: internalHandleProviderChange,
    // Pass the new props structure to the hook
    } = useModelSelection({ availableProviders, providerModelsMap, activeChatModelId: selectedModelId }); // Pass selectedModelId as activeChatModelId

    // Determine which provider change handler to use
    // const effectiveHandleProviderChange = externalHandleProviderChange ?? internalHandleProviderChange;
    // const effectiveSelectedProvider = externalSelectedProvider ?? selectedProvider;
    // For now, let the hook manage the provider selection internally based on selectedModelId
    const effectiveSelectedProvider = selectedProvider;

    // Handler for provider change - updates internal hook state and selects first model
    const handleProviderSelect = (e: JSX.TargetedEvent<HTMLSelectElement>) => {
        internalHandleProviderChange(e); // Update the provider in the hook state
        const newProviderId = e.currentTarget.value;
        if (newProviderId) {
            // Use providerModelsMap to find the first model
            const modelsForProvider = providerModelsMap[newProviderId] || [];
            if (modelsForProvider.length > 0) {
                onModelChange(modelsForProvider[0].id); // Trigger change with the first model
            } else {
                // If models haven't loaded yet or none exist, maybe send a placeholder or clear?
                // Let's clear for now. The UI might show "Loading..." based on map content.
                onModelChange('');
            }
        } else {
            onModelChange(''); // Clear model if provider deselected
        }
    };

    // Handler for model input change - reconstructs ID if needed and calls onModelChange
    const handleModelInput = (e: JSX.TargetedEvent<HTMLInputElement>) => {
        const rawInputValue = e.currentTarget.value; // The value from the input field (potentially just model name)
        let finalModelId = ''; // Default to empty if no match

        // Check if the input value exactly matches a known model ID
        // Check against all loaded models across all providers first for an exact ID match
        const allLoadedModels = Object.values(providerModelsMap).flat();
        const modelFromDataList = allLoadedModels.find(m => m.id === rawInputValue);

        if (modelFromDataList) {
            finalModelId = modelFromDataList.id; // Exact match found
        } else if (selectedProvider) {
            // If not an exact ID match, and a provider is selected,
            // check if the input value matches a modelNamePart for the *currently selected provider*
            const modelsForSelectedProvider = providerModelsMap[selectedProvider] || [];
            // We need the modelNamePart logic here or rely on filteredModels from the hook
            const selectedModelByNamePart = modelsForSelectedProvider
                .map(m => ({ ...m, modelNamePart: m.id.split(':').slice(1).join(':') || m.name })) // Add modelNamePart temporarily
                .find(m => m.modelNamePart === rawInputValue);

            if (selectedModelByNamePart) {
                finalModelId = selectedModelByNamePart.id; // Match by name part found for the selected provider
            } else {
                // Input doesn't match a known model ID or name part for the selected provider.
                // Assume user is typing a model name (or potentially a full ID).
                // We need to construct the correct providerId:modelName format.
                let modelNamePartToUse = rawInputValue;
                // If the input contains ':', assume it might be a full ID or malformed.
                // Extract the part *after* the first colon as the intended model name.
                if (rawInputValue.includes(':')) {
                    modelNamePartToUse = rawInputValue.split(':').slice(1).join(':');
                }
                // Construct the final ID using the selectedProvider and the extracted/original model name part.
                // Ensure modelNamePartToUse is not empty before constructing.
                if (modelNamePartToUse) {
                    finalModelId = `${selectedProvider}:${modelNamePartToUse}`;
                } else {
                    // If model name part is empty, maybe clear the selection or use a default?
                    // For now, let's emit an empty string to signify clearing.
                    finalModelId = '';
                }
            }
        } else {
             // No provider selected, treat input as is (likely won't be valid)
             finalModelId = rawInputValue;
        }

        // Call the callback with the determined model ID
        onModelChange(finalModelId);
    };

    const providerLabel = `${labelPrefix ? labelPrefix + ' ' : ''}Provider:`;
    const modelLabel = `${labelPrefix ? labelPrefix + ' ' : ''}Model:`;
    const providerSelectId = `provider-select-${labelPrefix.toLowerCase().replace(' ', '-') || 'main'}`;
    const modelInputId = `model-input-${labelPrefix.toLowerCase().replace(' ', '-') || 'main'}`;
    const datalistId = `models-datalist-${labelPrefix.toLowerCase().replace(' ', '-') || 'main'}`;

    return (
        <div class="model-selector flex items-center space-x-2">
            <label htmlFor={providerSelectId} class="text-sm font-medium">{providerLabel}</label>
            <select
                id={providerSelectId}
                value={effectiveSelectedProvider ?? ''}
                onChange={handleProviderSelect}
                class="p-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-sm"
            >
                <option value="">-- Provider --</option>
                {/* Use the new uniqueProviders structure */}
                {uniqueProviders.map(provider => (
                    <option key={provider.id} value={provider.id}>{provider.name}</option>
                ))}
            </select>

            <label htmlFor={modelInputId} class="text-sm font-medium">{modelLabel}</label>
            <input
                list={datalistId}
                id={modelInputId}
                name={modelInputId}
                // Bind the input's displayed value to the model name part derived by the hook
                value={selectedModelId ? selectedModelId.split(':').slice(1).join(':') : ''} // Always derive from selectedModelId prop
                onInput={handleModelInput}
                placeholder={effectiveSelectedProvider ? "Select or type model" : "Select provider"}
                disabled={!effectiveSelectedProvider}
                class="p-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-sm flex-1 min-w-40"
            />
            <datalist id={datalistId}>
                {filteredModels.map(model => (
                    // Use the full ID as the value for the datalist option
                    <option key={model.id} value={model.id}>
                        {model.modelNamePart} {/* Display only the model name part */}
                    </option>
                ))}
            </datalist>
        </div>
    );
};