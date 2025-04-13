import { FunctionalComponent } from 'preact';
import { useState, useMemo, useCallback, useEffect } from 'preact/hooks';
import { useAtomValue, atom } from 'jotai';
import { loadable } from 'jotai/utils';
import { JSX } from 'preact/jsx-runtime';
import { AvailableModel } from '../../../src/common/types';
import { availableProvidersAtom, modelsForProviderAtomFamily } from '../store/atoms';

// Props now accept separate provider and model IDs
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
    // --- State and Atom Values ---
    const allAvailableProvidersLoadable = useAtomValue(loadable(availableProvidersAtom));

    // Get models for the currently selected provider (async)
    const modelsForSelectedProviderLoadable = useAtomValue(loadable(modelsForProviderAtomFamily(selectedProviderId)));

    // Local state for the input field's value (model ID/name part)
    const [inputValue, setInputValue] = useState('');

    // Update local input state when the external selectedModelId changes
    useEffect(() => {
        // Find the model object corresponding to selectedModelId to display its name or ID
        const models = modelsForSelectedProviderLoadable.state === 'hasData' ? modelsForSelectedProviderLoadable.data ?? [] : [];
        const selectedModelObject = models.find(m => m.id === selectedModelId);
        // Display the model's name if available, otherwise the ID, or empty if nothing selected
        setInputValue(selectedModelObject?.name ?? selectedModelId ?? '');
    }, [selectedModelId, modelsForSelectedProviderLoadable.state]); // Re-run if model ID or loaded models change

    // --- Async Atom for All Models (for filtering suggestions) ---
    const allModelsAtom = useMemo(() => atom(async (get) => {
        const providersLoadable = get(loadable(availableProvidersAtom));
        if (providersLoadable.state !== 'hasData' || !providersLoadable.data) return [];
        const ids = providersLoadable.data.map(p => p.providerId);
        const promises = ids.map(id => get(modelsForProviderAtomFamily(id)));
        const results = await Promise.all(promises);
        return results.flat();
    }), []);
    const allModelsLoadable = useAtomValue(loadable(allModelsAtom));

    // --- Derived Data for UI ---
    const uniqueProviders = useMemo(() => {
        if (allAvailableProvidersLoadable.state !== 'hasData' || !allAvailableProvidersLoadable.data) return [];
        const providerMap = new Map<string, { id: string; name: string }>();
        allAvailableProvidersLoadable.data.forEach(provider => {
            if (!providerMap.has(provider.providerId)) {
                providerMap.set(provider.providerId, { id: provider.providerId, name: provider.providerName });
            }
        });
        return Array.from(providerMap.values());
    }, [allAvailableProvidersLoadable]);

    const modelsForSelectedProvider = modelsForSelectedProviderLoadable.state === 'hasData'
        ? modelsForSelectedProviderLoadable.data ?? []
        : [];

    const allLoadedModels = allModelsLoadable.state === 'hasData'
        ? allModelsLoadable.data ?? []
        : [];

    // Filter models based on the input value for suggestions datalist
    const filteredModelsForDatalist = useMemo(() => {
        const lowerInput = inputValue.toLowerCase();
        if (!lowerInput) return modelsForSelectedProvider; // Show current provider's models if input empty

        // Filter across all loaded models by ID, name, or provider name
        return allLoadedModels.filter((model: AvailableModel) =>
            model.id.toLowerCase().includes(lowerInput) ||
            model.name.toLowerCase().includes(lowerInput) ||
            model.providerName.toLowerCase().includes(lowerInput)
        );
    }, [inputValue, modelsForSelectedProvider, allLoadedModels]);

    // --- Event Handlers ---
    const handleProviderSelect = useCallback((e: JSX.TargetedEvent<HTMLSelectElement>) => {
        const newProviderId = e.currentTarget.value || null;
        setInputValue(''); // Clear model input
        onModelChange(newProviderId, null); // Update state with new provider, clear model
    }, [onModelChange]);

    const handleModelInput = useCallback((e: JSX.TargetedEvent<HTMLInputElement>) => {
        setInputValue(e.currentTarget.value);
        // Don't call onModelChange on input, wait for blur or selection from datalist
    }, []);

    // Handle selection from datalist or blur
    const handleModelFinalize = useCallback(() => {
         const lowerInput = inputValue.toLowerCase();
         let finalModel: AvailableModel | null = null;

         // Try finding exact match by ID or Name from the filtered list first
         finalModel = filteredModelsForDatalist.find((m: AvailableModel) =>
             m.id.toLowerCase() === lowerInput || m.name.toLowerCase() === lowerInput
         ) ?? null;

         // If no exact match in filtered list, check all loaded models (covers cases where user types full ID not shown in filtered list)
         if (!finalModel) {
             finalModel = allLoadedModels.find((m: AvailableModel) => m.id.toLowerCase() === lowerInput) ?? null;
         }
         if (!finalModel) {
             finalModel = allLoadedModels.find((m: AvailableModel) => m.name.toLowerCase() === lowerInput) ?? null;
         }

         // Determine the final IDs
         const finalProviderId = finalModel ? finalModel.providerId : selectedProviderId; // Keep current provider if model invalid
         const finalModelId = finalModel ? finalModel.id : null;

         // Update input display to reflect the actual selected model name/ID or clear
         setInputValue(finalModel?.name ?? finalModel?.id ?? '');

         // Call the callback only if the selection changed
         if (finalProviderId !== selectedProviderId || finalModelId !== selectedModelId) {
             console.log(`Finalizing model selection: Provider=${finalProviderId}, Model=${finalModelId}`);
             onModelChange(finalProviderId, finalModelId);
         }
     }, [inputValue, selectedProviderId, selectedModelId, allLoadedModels, filteredModelsForDatalist, onModelChange]); // Added filteredModelsForDatalist

    // --- Render ---
    const providerLabel = `${labelPrefix ? labelPrefix + ' ' : ''}Provider:`;
    const modelLabel = `${labelPrefix ? labelPrefix + ' ' : ''}Model:`;
    const providerSelectId = `provider-select-${labelPrefix.toLowerCase().replace(/\s+/g, '-') || 'main'}`;
    const modelInputId = `model-input-${labelPrefix.toLowerCase().replace(/\s+/g, '-') || 'main'}`;
    const datalistId = `models-datalist-${labelPrefix.toLowerCase().replace(/\s+/g, '-') || 'main'}`;

    const providersLoading = allAvailableProvidersLoadable.state === 'loading';
    const providersError = allAvailableProvidersLoadable.state === 'hasError';
    const modelsLoading = modelsForSelectedProviderLoadable.state === 'loading' || allModelsLoadable.state === 'loading';
    const modelsError = modelsForSelectedProviderLoadable.state === 'hasError' || allModelsLoadable.state === 'hasError';

    return (
        <div class="model-selector flex items-center space-x-2">
            <label htmlFor={providerSelectId} class="text-sm font-medium">{providerLabel}</label>
            <select
                id={providerSelectId}
                value={selectedProviderId ?? ''} // Use selectedProviderId prop
                onChange={handleProviderSelect}
                disabled={providersLoading || providersError}
                class="p-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-sm"
            >
                <option value="">-- Provider --</option>
                {providersLoading && <option value="" disabled>Loading...</option>}
                {providersError && <option value="" disabled>Error</option>}
                {uniqueProviders.map(provider => (
                    <option key={provider.id} value={provider.id}>{provider.name}</option>
                ))}
            </select>

            <label htmlFor={modelInputId} class="text-sm font-medium">{modelLabel}</label>
            <input
                list={datalistId}
                id={modelInputId}
                name={modelInputId}
                value={inputValue} // Bind to local input state
                onInput={handleModelInput}
                onBlur={handleModelFinalize} // Use combined finalize handler
                onChange={handleModelFinalize} // Also finalize if user selects from datalist via keyboard/click
                placeholder={!selectedProviderId ? "Select provider" : (modelsLoading ? "Loading models..." : "Select or type model")}
                disabled={!selectedProviderId || modelsLoading || modelsError}
                class="p-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-sm flex-1 min-w-40"
            />
            <datalist id={datalistId}>
                {modelsLoading && <option value="Loading models..."></option>}
                {modelsError && <option value="Error loading models"></option>}
                {filteredModelsForDatalist.map((model: AvailableModel) => (
                    // Use the model ID as the value for autocompletion
                    <option key={model.id} value={model.id}>
                        {/* Display provider/name for clarity */}
                        {`${model.providerName} / ${model.name}`}
                    </option>
                ))}
            </datalist>
        </div>
    );
};