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

    // Update local input state ONLY when the external selection changes
    useEffect(() => {
    	console.log(`[ModelSelector useEffect] Running due to prop change. selectedProviderId: ${selectedProviderId}, selectedModelId: ${selectedModelId}`);
    	// Fetch models for the *newly selected* provider if needed (or rely on existing loadable)
    	const models = modelsForSelectedProviderLoadable.state === 'hasData' ? modelsForSelectedProviderLoadable.data ?? [] : [];
    	// Find model based on both provider and model ID from props
    	const selectedModelObject = models.find(m => m.providerId === selectedProviderId && m.id === selectedModelId);
    	const newValue = selectedModelObject?.name ?? selectedModelId ?? '';
    	console.log(`[ModelSelector useEffect] Setting inputValue based on props: "${newValue}"`);
    	setInputValue(newValue);
    	// Dependency array only includes the props that should trigger a reset
    }, [selectedProviderId, selectedModelId]); // Re-run ONLY if external selection changes

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
        // Always filter within the models for the currently selected provider
        if (!modelsForSelectedProvider || modelsForSelectedProvider.length === 0) {
             return []; // No models available for the selected provider
        }

        if (!lowerInput) {
            return modelsForSelectedProvider; // If input is empty, show all models for the selected provider
        }

        // If input is not empty, filter within the selected provider's models
        return modelsForSelectedProvider.filter((model: AvailableModel) =>
            model.id.toLowerCase().includes(lowerInput) ||
            model.name.toLowerCase().includes(lowerInput)
            // Removed providerName check as we are already filtering by provider
        );
    }, [inputValue, modelsForSelectedProvider]); // Dependency only on input and the selected provider's models

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
    const providerLabel = `${labelPrefix ? labelPrefix + ' ' : ''}Provider:`;
    const modelLabel = `${labelPrefix ? labelPrefix + ' ' : ''}Model:`;
    const providerSelectId = `provider-select-${labelPrefix.toLowerCase().replace(/\s+/g, '-') || 'main'}`;
    const modelInputId = `model-input-${labelPrefix.toLowerCase().replace(/\s+/g, '-') || 'main'}`;
    const datalistId = `models-datalist-${labelPrefix.toLowerCase().replace(/\s+/g, '-') || 'main'}`;

    const providersLoading = allAvailableProvidersLoadable.state === 'loading';
    const providersError = allAvailableProvidersLoadable.state === 'hasError';
    // Input disable/loading state should only depend on the selected provider's models
    const modelsLoading = modelsForSelectedProviderLoadable.state === 'loading';
    const modelsError = modelsForSelectedProviderLoadable.state === 'hasError';

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
                onInput={handleModelInputChange} // Update local state on input
                onBlur={handleModelBlur} // Finalize on blur
                // onChange is less reliable for datalist, handle selection via onInput + blur logic
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