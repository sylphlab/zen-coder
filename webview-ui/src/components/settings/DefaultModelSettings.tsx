import { useCallback } from 'preact/hooks';
// Removed: import { useAtomValue } from 'jotai';
// Removed: import { loadable } from 'jotai/utils';
import { JSX } from 'preact/jsx-runtime';
import { requestData } from '../../utils/communication'; // Import requestData
import { ModelSelector } from '../ModelSelector';
import { useDefaultConfig } from '../../hooks/useDefaultConfig'; // Import the new hook
// Removed: import { defaultConfigAtom } from '../../store/atoms';

export function DefaultModelSettings(): JSX.Element {
    const defaultConfig = useDefaultConfig(); // Use the refactored hook
    const isLoadingConfig = defaultConfig === null; // Derive loading state

    const handleDefaultChatModelChange = useCallback((newProviderId: string | null, newModelId: string | null) => {
        console.log(`[DefaultModelSettings] Setting default chat model via requestData: Provider=${newProviderId}, Model=${newModelId}`);
        requestData('setDefaultConfig', { // Use requestData
            config: {
                defaultProviderId: newProviderId ?? undefined,
                defaultModelId: newModelId ?? undefined
            }
        })
        .then(() => console.log(`Default chat model updated.`))
        .catch(error => console.error(`Error setting default chat model:`, error));
    }, []);
    // Removed subscription useEffect

    return (
        <section class="mb-8">
            <h3 class="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Default Models</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Select the default AI models to be used for new chat sessions or when a chat is set to use defaults.
            </p>
            <div class="space-y-4">
                <div class="p-4 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
                    {isLoadingConfig && <p class="text-sm text-gray-500">Loading default config...</p>}
                    {/* Render only when not loading and config exists */}
                    {!isLoadingConfig && defaultConfig && (
                        <ModelSelector
                            labelPrefix="Default Chat"
                            selectedProviderId={defaultConfig.defaultProviderId ?? null}
                            selectedModelId={defaultConfig.defaultModelId ?? null}
                            onModelChange={handleDefaultChatModelChange}
                        />
                    )}
                    {/* Handle case where config is loaded but null/empty (optional) */}
                    {!isLoadingConfig && !defaultConfig && (
                        <p class="text-sm text-gray-500">No default configuration set.</p>
                    )}
                </div>
                {/* TODO: Add selectors for defaultImageModelId and defaultOptimizeModelId later */}
            </div>
        </section>
    );
}
