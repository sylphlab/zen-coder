import { FunctionalComponent } from 'preact';
import { useCallback } from 'preact/hooks';
import { useLocation } from 'wouter';
import { useAtomValue, useSetAtom } from 'jotai'; // Added useSetAtom
import { JSX } from 'preact/jsx-runtime';
import { AvailableModel } from '../../../src/common/types';
import { ModelSelector } from './ModelSelector';
import {
    availableProvidersAtom,
    activeChatProviderIdAtom,
    activeChatModelIdAtom,
    activeChatMessagesAtom,
    updateLocationAtom // Import atom setter
} from '../store/atoms';

interface HeaderControlsProps {
    // Callbacks for navigation removed
    onModelChange: (providerId: string | null, modelId: string | null) => void;
}

export const HeaderControls: FunctionalComponent<HeaderControlsProps> = ({
    onModelChange
}) => {
    // --- Hooks ---
    const [, setLocation] = useLocation();
    const updateLocation = useSetAtom(updateLocationAtom); // Get atom setter

    // --- Atoms ---
    const availableProviders = useAtomValue(availableProvidersAtom);
    const selectedProviderId = useAtomValue(activeChatProviderIdAtom);
    const selectedModelId = useAtomValue(activeChatModelIdAtom);
    const activeChatMessages = useAtomValue(activeChatMessagesAtom);
    const hasMessages = activeChatMessages.length > 0;

    // --- Event Handlers (Internal Navigation + Backend Sync) ---
    const handleSettingsClick = useCallback(() => {
        const newPath = '/settings';
        setLocation(newPath);
        updateLocation(newPath); // Sync backend
    }, [setLocation, updateLocation]);

    const handleChatsClick = useCallback(() => {
        const newPath = '/'; // Navigate to root (ChatListPage)
        setLocation(newPath);
        updateLocation(newPath); // Sync backend
    }, [setLocation, updateLocation]);

    return (
        <div class="header-controls p-2 border-b border-gray-300 dark:border-gray-700 flex justify-between items-center">
            {/* Model Selector */}
            <ModelSelector
                selectedProviderId={selectedProviderId ?? null}
                selectedModelId={selectedModelId ?? null}
                onModelChange={onModelChange}
            />
            {/* Action Buttons */}
            <div class="action-buttons flex items-center space-x-2 flex-shrink-0">
                {/* Chats List Button */}
                <button
                    onClick={handleChatsClick} // Use internal handler
                    class="p-1.5 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                    title="View Chats"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
                {/* Settings Button */}
                <button
                    onClick={handleSettingsClick} // Use internal handler
                    class="p-1.5 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                    title="Settings"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
        </div>
    );
};
