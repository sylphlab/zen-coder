import { FunctionalComponent } from 'preact';
import { JSX } from 'preact/jsx-runtime';
import { ApiProviderKey } from '../app'; // Import ApiProviderKey from app
import { AvailableModel } from '../../../src/common/types'; // Import AvailableModel from common types

// Define the extended model type expected from the hook
type FilteredModel = AvailableModel & { modelNamePart: string };

interface HeaderControlsProps {
    uniqueProviders: ApiProviderKey[];
    selectedProvider: ApiProviderKey | null;
    handleProviderChange: (e: JSX.TargetedEvent<HTMLSelectElement>) => void;
    currentModelInput: string; // The effective model ID being used for the chat
    displayModelName: string; // Just the model name part for display
    // handleModelInputChange: (e: JSX.TargetedEvent<HTMLInputElement>) => void; // Replaced by handleChatModelChange
    handleChatModelChange: (newModelId: string) => void; // Callback to update chat config
    filteredModels: FilteredModel[]; // Use the extended type
    handleClearChat: () => void;
    isStreaming: boolean;
    hasMessages: boolean;
    onSettingsClick: () => void;
    onChatsClick: () => void;
}

export const HeaderControls: FunctionalComponent<HeaderControlsProps> = ({
    uniqueProviders,
    selectedProvider,
    handleProviderChange,
    currentModelInput,
    displayModelName,
    handleChatModelChange,
    filteredModels,
    handleClearChat,
    isStreaming,
    hasMessages,
    onSettingsClick,
    onChatsClick
}) => {
    return (
        /* Reverted layout changes, kept button grouping */
        <div class="header-controls p-2 border-b border-gray-300 dark:border-gray-700 flex justify-between items-center">
            {/* Original model selector layout */}
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
                    // Bind the input's displayed value to the model name part
                    value={displayModelName}
                    // When input changes (e.g., selecting from datalist), update the chat's specific model config
                    onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => {
                        const inputValue = e.currentTarget.value;
                        let fullModelId = inputValue;
                        // If the input value doesn't contain ':' and a provider is selected,
                        // assume the user typed the model name part and reconstruct the full ID.
                        if (!inputValue.includes(':') && selectedProvider) {
                            fullModelId = `${selectedProvider}:${inputValue}`;
                        }
                        // Always call the callback with the (potentially reconstructed) full ID
                        handleChatModelChange(fullModelId);
                    }}
                    placeholder={selectedProvider ? "Select or type model name" : "Select provider first"}
                    disabled={!selectedProvider}
                    class="p-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-sm flex-1 min-w-40"
                />
                <datalist id="models-datalist">
                    {filteredModels.map(model => (
                        <option key={model.id} value={model.id}>
                            {model.modelNamePart}
                        </option>
                    ))}
                </datalist>
            </div>
            {/* Grouped action buttons (kept icons) */}
            <div class="action-buttons flex items-center space-x-2 flex-shrink-0">
                <button
                    onClick={handleClearChat}
                    class="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400 disabled:opacity-50 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
                    disabled={!hasMessages || isStreaming}
                    title="Clear Chat History"
                >
                     {/* Trash Icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                </button>
                {/* Chats List Button */}
                <button
                    onClick={onChatsClick}
                    class="p-1.5 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                    title="View Chats"
                >
                    {/* Simple List Icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
                {/* Settings Button */}
                <button
                    onClick={onSettingsClick} // Use the handler
                    class="p-1.5 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                    title="Settings"
                >
                    {/* Gear Icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
        </div>
    );
};