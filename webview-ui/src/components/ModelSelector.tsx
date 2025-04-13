import { FunctionalComponent } from 'preact';
import { JSX } from 'preact/jsx-runtime';
import { AvailableModel } from '../../../src/common/types';
import { useModelSelection } from '../hooks/useModelSelection';

// Define the extended model type expected from the hook
type FilteredModel = AvailableModel & { modelNamePart: string };

interface ModelSelectorProps {
    labelPrefix?: string; // Optional prefix for labels (e.g., "Default Chat")
    availableModels: AvailableModel[];
    selectedModelId: string | null; // The full providerId:modelName
    onModelChange: (newModelId: string) => void; // Callback when the effective model ID changes
    // Optional: If provider selection should be handled externally (like in HeaderControls)
    // externalSelectedProvider?: string | null;
    // externalHandleProviderChange?: (e: JSX.TargetedEvent<HTMLSelectElement>) => void;
}

export const ModelSelector: FunctionalComponent<ModelSelectorProps> = ({
    labelPrefix = '',
    availableModels,
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
    } = useModelSelection(availableModels, selectedModelId);

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
            const firstModel = availableModels.find(m => m.providerId === newProviderId);
            if (firstModel) {
                onModelChange(firstModel.id); // Trigger change with the first model of the new provider
            } else {
                onModelChange(''); // Clear model if none available for the provider
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
        const modelFromDataList = availableModels.find(m => m.id === rawInputValue);

        if (modelFromDataList) {
            finalModelId = modelFromDataList.id; // Exact match found
        } else if (selectedProvider) {
            // If not an exact ID match, and a provider is selected,
            // check if the input value matches a modelNamePart for the current provider
            const selectedModelByNamePart = filteredModels.find(m => m.modelNamePart === rawInputValue && m.providerId === selectedProvider);
            if (selectedModelByNamePart) {
                finalModelId = selectedModelByNamePart.id; // Match by name part found
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
                {uniqueProviders.map(providerId => (
                    <option key={providerId} value={providerId}>{providerId}</option>
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