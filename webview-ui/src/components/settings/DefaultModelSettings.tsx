import { useCallback, useMemo } from 'preact/hooks'; // Added useMemo
import { JSX } from 'preact/jsx-runtime';
import { useStore } from '@nanostores/react';
import { $defaultConfig } from '../../stores/chatStores';
import { $setDefaultConfig } from '../../stores/settingsStores';
import { CustomSelect } from '../ui/CustomSelect'; // Import CustomSelect
import { Assistant } from '../../../../src/common/types'; // Import Assistant type

// Renamed component
export function DefaultAssistantSettings(): JSX.Element {
    const defaultConfig = useStore($defaultConfig);
    const { mutate: setDefaultConfigMutate } = useStore($setDefaultConfig);
    const isLoadingConfig = defaultConfig === 'loading' || defaultConfig === null; // Updated loading check

    // TODO: Replace placeholder with Assistant store logic
    const assistants = useMemo(() => {
        console.log("TODO: Fetch assistants from store");
        const exampleData: Assistant[] = [
            { id: 'default-1', name: 'Default Assistant', description: 'General purpose assistant', modelProviderId: 'placeholder-provider', modelId: 'placeholder-model', createdAt: 0, lastModified: 0 },
            { id: 'coder-py', name: 'Python Coder', description: 'Helps with Python code', modelProviderId: 'placeholder-provider', modelId: 'placeholder-model', createdAt: 0, lastModified: 0 },
            { id: 'refactor-pro', name: 'Refactor Pro', description: 'Focuses on refactoring', modelProviderId: 'placeholder-provider', modelId: 'placeholder-model', createdAt: 0, lastModified: 0 },
        ];
        return exampleData;
    }, []);
    const isLoadingAssistants = false; // Placeholder

    // Renamed handler and updated logic
    const handleDefaultAssistantChange = useCallback(async (newAssistantId: string | null) => {
        console.log(`[DefaultAssistantSettings] Calling mutation store to set default assistant: ID=${newAssistantId}`);
        try {
            await setDefaultConfigMutate({
                defaultAssistantId: newAssistantId ?? undefined // Set to undefined if null (meaning no default)
            });
            console.log(`Default assistant update request sent.`);
        } catch (error) {
             console.error(`Error setting default assistant via mutation store:`, error);
             // TODO: Display error to user
        }
    }, [setDefaultConfigMutate]);

    return (
        <section class="mb-8">
            {/* Updated title and description */}
            <h3 class="text-xl font-semibold mb-4 text-[var(--vscode-foreground)] flex items-center gap-2">
                <span class="i-carbon-user-avatar h-5 w-5 text-[var(--vscode-button-background)]"></span>
                Default Assistant
            </h3>
            <p class="text-sm text-[var(--vscode-foreground)] opacity-70 mb-4">
                Select the default Assistant to be used for new chat sessions or when a chat is set to use defaults.
            </p>
            <div class="space-y-4">
                {/* Removed border, shadow-sm */}
                <div class="p-4 rounded-lg bg-[var(--vscode-editorWidget-background)]">
                    {(isLoadingConfig || isLoadingAssistants) && ( // Check both loading states
                        <div class="flex items-center gap-2 text-sm text-[var(--vscode-foreground)] opacity-60">
                            <span class="i-carbon-rotate-clockwise animate-spin h-4 w-4"></span>
                            <p>Loading configuration...</p>
                        </div>
                    )}
                    {/* Render CustomSelect when not loading */}
                    {!isLoadingConfig && !isLoadingAssistants && defaultConfig && typeof defaultConfig === 'object' && (
                        <CustomSelect
                            // Prepare options for CustomSelect: Add a "None" option
                            groupedOptions={{
                                '': [{ id: '', name: '-- None --' }], // Group for "None"
                                'Assistants': assistants.map(a => ({ id: a.id, name: a.name })) // Group for actual assistants
                            }}
                            value={defaultConfig.defaultAssistantId ?? ''} // Use empty string for "None"
                            onChange={(value) => handleDefaultAssistantChange(value || null)} // Pass null if empty string selected
                            placeholder="Select Default Assistant"
                            ariaLabel="Default Assistant Selector"
                            allowCustomValue={false} // Don't allow custom values here
                            showId={false} // Don't show ID in dropdown
                        />
                    )}
                    {/* Handle case where config is loaded but null/empty */}
                    {!isLoadingConfig && !isLoadingAssistants && (!defaultConfig || typeof defaultConfig !== 'object') && (
                        <p class="text-sm text-[var(--vscode-foreground)] opacity-60">Default configuration not loaded.</p>
                    )}
                </div>
                {/* TODO: Add selectors for defaultImageModelId and defaultOptimizeModelId later */}
            </div>
        </section>
    );
}
