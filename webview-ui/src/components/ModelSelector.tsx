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
    const selectRef = useRef<HTMLSelectElement>(null); // Re-add ref for imperative update

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

    // Effect to imperatively set select value when the prop changes
    useEffect(() => {
        const targetValue = selectedProviderId ?? '';
        const currentValue = selectRef.current?.value;
        console.log(`[ModelSelector useEffect/ImperativeUpdate] Running Effect. Prop selectedProviderId: "${selectedProviderId}". Target value: "${targetValue}". Current DOM value: "${currentValue}"`);
        if (selectRef.current && targetValue !== currentValue) {
            console.log(`[ModelSelector useEffect/ImperativeUpdate] DOM value mismatch. Attempting to set select value to: "${targetValue}"`);
            selectRef.current.value = targetValue;
            // Verify immediately after setting
            const newValue = selectRef.current?.value;
            console.log(`[ModelSelector useEffect/ImperativeUpdate] Value AFTER setting: "${newValue}". ${newValue === targetValue ? 'SUCCESS' : 'FAILURE (DOM value did not update)'}`);
        } else if (selectRef.current) {
             console.log(`[ModelSelector useEffect/ImperativeUpdate] No mismatch or ref not ready. Current DOM value: "${currentValue}". Target value: "${targetValue}"`);
        } else {
            console.log(`[ModelSelector useEffect/ImperativeUpdate] Ref not ready.`);
        }
    }, [selectedProviderId]); // Run only when selectedProviderId prop changes

    // --- Derived Data ---
    let uniqueProviders: { id: string; name: string }[] = [];
    if (Array.isArray(allProvidersStatus)) {
        const providerMap = new Map<string, { id: string; name: string }>();
        allProvidersStatus.forEach(provider => {
            if (provider && typeof provider.id === 'string' && typeof provider.name === 'string' && !providerMap.has(provider.id)) {
                providerMap.set(provider.id, { id: provider.id, name: provider.name });
            }
        });
        uniqueProviders = Array.from(providerMap.values());
    }

    const modelsForSelectedProvider = useMemo(() => {
        if (modelsState.providerId === selectedProviderId && !modelsState.loading) {
            return modelsState.models;
        }
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
        const lowerInput = inputValue.toLowerCase().trim();
        let matchedModel: AvailableModel | null = null;
        if (modelsState.providerId !== selectedProviderId || modelsState.loading) {
             const currentSelectedModelAgain = modelsState.models.find(m => m.id === selectedModelId);
             const revertValueAgain = currentSelectedModelAgain?.name ?? selectedModelId ?? '';
             setInputValue(revertValueAgain);
            return;
        }
        matchedModel = modelsState.models.find(m => m.id.toLowerCase() === lowerInput || (m.name && m.name.toLowerCase() === lowerInput)) ?? null;
        if (matchedModel) {
            const finalProviderId = matchedModel.providerId;
            const finalModelId = matchedModel.id;
            const displayValue = matchedModel.name ?? matchedModel.id;
            setInputValue(displayValue);
            if (finalProviderId !== selectedProviderId || finalModelId !== selectedModelId) {
                onModelChange(finalProviderId, finalModelId);
            }
        } else {
            const currentSelectedModel = modelsState.models.find(m => m.id === selectedModelId);
            const revertValue = currentSelectedModel?.name ?? selectedModelId ?? '';
            setInputValue(revertValue);
            if (!lowerInput && selectedModelId !== null) {
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
        <div class="model-selector flex items-center space-x-2">
            <label htmlFor={providerSelectId} class="text-sm font-medium mr-1">{providerLabel}:</label>
            <select
                ref={selectRef} // Add ref back
                id={providerSelectId}
                // Removed value prop to make it uncontrolled visually
                // The useEffect hook above now handles setting the value imperatively
                onChange={handleProviderSelect}
                defaultValue={selectedProviderId ?? ''} // Set initial value non-reactively
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

            <label htmlFor={modelInputId} class="text-sm font-medium ml-3 mr-1">{modelLabel}:</label>
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
                disabled={!selectedProviderId || (modelsLoading && modelFetchProviderId === selectedProviderId) || !!modelsError}
                class="p-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-sm flex-1 min-w-40 focus:ring-blue-500 focus:border-blue-500 outline-none"
                aria-invalid={!!modelsError}
                title={modelsError ?? ''}
            />
            <datalist id={datalistId}>
                {filteredModelsForDatalist.map((model) => (
                    <option key={`${model.providerId}-${model.id}`} value={model.name}></option>
                ))}
            </datalist>
        </div>
    );
};
