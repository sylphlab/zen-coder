import { useCallback } from 'preact/hooks';
import { JSX } from 'preact/jsx-runtime';
import { useStore } from '@nanostores/react'; // Import useStore
// import { requestData } from '../../utils/communication'; // Removed requestData
import { $defaultConfig } from '../../stores/chatStores'; // Import fetcher store
import { $setDefaultConfig } from '../../stores/settingsStores'; // Import mutation store
import { ModelSelector } from '../ModelSelector';
// Removed: import { useDefaultConfig } from '../../hooks/useDefaultConfig'; // Removed non-existent hook import
// Removed: import { defaultConfigAtom } from '../../store/atoms';

export function DefaultModelSettings(): JSX.Element {
    const defaultConfig = useStore($defaultConfig); // Use the fetcher store
    const { mutate: setDefaultConfigMutate, loading: isSaving } = useStore($setDefaultConfig); // Use the mutation store
    const isLoadingConfig = defaultConfig === null; // Derive loading state

    const handleDefaultChatModelChange = useCallback(async (newProviderId: string | null, newModelId: string | null) => {
        console.log(`[DefaultModelSettings] Calling mutation store to set default chat model: Provider=${newProviderId}, Model=${newModelId}`);
        try {
            await setDefaultConfigMutate({ // Use the mutate function
                config: {
                    defaultProviderId: newProviderId ?? undefined,
                    defaultModelId: newModelId ?? undefined
                }
            });
            console.log(`Default chat model update request sent.`);
            // Update will happen via $defaultConfig subscription
        } catch (error) {
             console.error(`Error setting default chat model via mutation store:`, error);
             // TODO: Display error to user
        }
    }, [setDefaultConfigMutate]); // Depend on the mutate function

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
