import { FunctionalComponent } from 'preact';
import { JSX } from 'preact/jsx-runtime';
import { ApiProviderKey } from '../app'; // Import ApiProviderKey from app
import { AvailableModel } from '../../../src/common/types'; // Import AvailableModel from common types

interface HeaderControlsProps {
    uniqueProviders: ApiProviderKey[];
    selectedProvider: ApiProviderKey | null;
    handleProviderChange: (e: JSX.TargetedEvent<HTMLSelectElement>) => void;
    currentModelInput: string;
    handleModelInputChange: (e: JSX.TargetedEvent<HTMLInputElement>) => void;
    filteredModels: AvailableModel[];
    handleClearChat: () => void;
    isStreaming: boolean;
    hasMessages: boolean; // Pass boolean instead of full messages array
}

export const HeaderControls: FunctionalComponent<HeaderControlsProps> = ({
    uniqueProviders,
    selectedProvider,
    handleProviderChange,
    currentModelInput,
    handleModelInputChange,
    filteredModels,
    handleClearChat,
    isStreaming,
    hasMessages
}) => {
    return (
        <div class="header-controls p-2 border-b border-gray-300 dark:border-gray-700 flex justify-between items-center">
            <div class="model-selector flex items-center space-x-2">
                <label htmlFor="provider-select" class="text-sm font-medium">Provider:</label>
                <select
                    id="provider-select"
                    value={selectedProvider ?? ''}
                    onChange={handleProviderChange}
                    class="p-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-sm"
                >
                    <option value="">-- Select --</option>
                    {uniqueProviders.map(providerId => (
                        <option key={providerId} value={providerId}>{providerId}</option>
                    ))}
                </select>

                <label htmlFor="model-input" class="text-sm font-medium">Model:</label>
                <input
                    list="models-datalist"
                    id="model-input"
                    name="model-input"
                    value={currentModelInput}
                    onInput={handleModelInputChange}
                    placeholder={selectedProvider ? "Select or type model ID" : "Select provider first"}
                    disabled={!selectedProvider}
                    class="p-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-sm flex-1 min-w-40"
                />
                <datalist id="models-datalist">
                    {filteredModels.map(model => (
                        <option key={model.id} value={model.id}>
                            {model.name} ({model.id})
                        </option>
                    ))}
                </datalist>
            </div>
            <button
                onClick={handleClearChat}
                class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm disabled:opacity-50"
                disabled={!hasMessages || isStreaming} // Use hasMessages prop
            >
                Clear Chat
            </button>
        </div>
    );
};