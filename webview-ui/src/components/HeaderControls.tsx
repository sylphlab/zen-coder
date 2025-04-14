import { FunctionalComponent } from 'preact';
import { useAtomValue } from 'jotai'; // Import Jotai hook
import { JSX } from 'preact/jsx-runtime';
// Removed: import { ApiProviderKey } from '../app';
import { AvailableModel } from '../../../src/common/types';
import { ModelSelector } from './ModelSelector';
import {
    availableProvidersAtom,
    // Removed: providerModelsMapAtom,
    // Removed: activeChatCombinedModelIdAtom,
    activeChatProviderIdAtom, // Import separate provider ID
    activeChatModelIdAtom,  // Corrected: Import activeChatModelIdAtom
    activeChatMessagesAtom
} from '../store/atoms';
// Define the extended model type expected from the hook
// type FilteredModel = AvailableModel & { modelNamePart: string }; // No longer needed here

interface HeaderControlsProps {
    // Props now only include callbacks
    // Update callback signature to match what App.tsx provides
    onModelChange: (providerId: string | null, modelId: string | null) => void;
    onSettingsClick: () => void; // Keep this
    onChatsClick: () => void;
}

export const HeaderControls: FunctionalComponent<HeaderControlsProps> = ({
    onModelChange,
    onSettingsClick,
    onChatsClick
}) => {
    // Read state from atoms
    const availableProviders = useAtomValue(availableProvidersAtom);
    // Removed: const providerModelsMap = useAtomValue(providerModelsMapAtom); // Not needed directly here
    const selectedProviderId = useAtomValue(activeChatProviderIdAtom); // Read provider ID
    const selectedModelId = useAtomValue(activeChatModelIdAtom);    // Corrected: Read model ID
    const activeChatMessages = useAtomValue(activeChatMessagesAtom);
    const hasMessages = activeChatMessages.length > 0; // Derive hasMessages
    return (
        /* Reverted layout changes, kept button grouping */
        <div class="header-controls p-2 border-b border-gray-300 dark:border-gray-700 flex justify-between items-center">
            {/* Original model selector layout */}
            {/* Replace with the new ModelSelector component */}
            <ModelSelector
                // Pass only the required props
                selectedProviderId={selectedProviderId ?? null} // Pass provider ID
                selectedModelId={selectedModelId ?? null}    // Pass model name/ID
                onModelChange={onModelChange} // Pass the callback down
                // No labelPrefix needed here
            />
            {/* Grouped action buttons (kept icons) */}
            <div class="action-buttons flex items-center space-x-2 flex-shrink-0">
                {/* Clear Chat button removed */}
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