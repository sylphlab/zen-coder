import { useState, useEffect, useCallback } from 'preact/hooks'; // Added useCallback
import { useStore } from '@nanostores/react'; // Import useStore
import { JSX } from 'preact/jsx-runtime';
// import { requestData } from '../../utils/communication'; // Removed requestData
import {
    $customInstructions,
    $setGlobalCustomInstructions,
    $setProjectCustomInstructions,
    $openOrCreateProjectInstructionsFile
} from '../../stores/settingsStores'; // Import Nanostore stores
// Removed: import { customInstructionsAtom } from '../../store/atoms';

export function CustomInstructionsSettings(): JSX.Element {
    // --- State from Nanostores ---
    const customInstructionsData = useStore($customInstructions); // Use the fetcher store
    const { mutate: saveGlobalMutate, loading: isSavingGlobal } = useStore($setGlobalCustomInstructions);
    const { mutate: saveProjectMutate, loading: isSavingProject } = useStore($setProjectCustomInstructions);
    const { mutate: openFileMutate, loading: isOpeningFile } = useStore($openOrCreateProjectInstructionsFile);

    const isLoading = customInstructionsData === null; // Derive loading state from fetcher store

    // --- Local State for Inputs ---
    const [globalInstructions, setGlobalInstructions] = useState<string>('');
    const [projectInstructions, setProjectInstructions] = useState<string>('');
    // Removed projectInstructionsPath state, will derive from customInstructionsData

    // Effect to update local state when store data loads/changes
    useEffect(() => {
        if (customInstructionsData) { // Check if data is loaded
            const newGlobal = customInstructionsData.global ?? '';
            const newProject = customInstructionsData.project ?? '';

            if (newGlobal !== globalInstructions) setGlobalInstructions(newGlobal);
            if (newProject !== projectInstructions) setProjectInstructions(newProject);
            // No need to set projectInstructionsPath locally
        }
    }, [customInstructionsData]); // Rerun only when store data changes

    const handleGlobalInstructionsChange = (e: Event) => {
        setGlobalInstructions((e.target as HTMLTextAreaElement).value);
    };

    const handleProjectInstructionsChange = (e: Event) => {
        setProjectInstructions((e.target as HTMLTextAreaElement).value);
    };

    const handleSaveGlobalInstructions = useCallback(async () => {
        console.log('Saving global custom instructions via mutation store...');
        try {
            await saveGlobalMutate({ instructions: globalInstructions });
            console.log('Global instructions save request sent.');
            // Update relies on backend push via $customInstructions store
        } catch (error) {
            console.error('Error saving global instructions:', error);
            // TODO: Display error to user
        }
    }, [globalInstructions, saveGlobalMutate]);

    const handleSaveProjectInstructions = useCallback(async () => {
        console.log('Saving project custom instructions via mutation store...');
        try {
            await saveProjectMutate({ instructions: projectInstructions });
            console.log('Project instructions save request sent.');
            // Update relies on backend push via $customInstructions store
        } catch (error) {
            console.error('Error saving project instructions:', error);
            // TODO: Display error to user
        }
    }, [projectInstructions, saveProjectMutate]);

    const handleOpenProjectInstructionsFile = useCallback(async () => {
        console.log('Requesting to open project custom instructions file via mutation store...');
        try {
            await openFileMutate();
            console.log('Open/Create project file request sent.');
        } catch (error) {
            console.error('Error opening project instructions file:', error);
            // TODO: Display error to user
        }
    }, [openFileMutate]);

    return (
        <section class="mb-8">
            <h3 class="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Custom Instructions</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Provide instructions to guide the AI's behavior and responses. Global instructions apply to all projects, while project instructions are specific to the current workspace and are appended after global ones. Use Markdown format.
            </p>

            {/* Global Instructions */}
            <div class="mb-6">
                <label for="global-instructions" class="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Global Instructions (VS Code Setting)</label>
                {isLoading && <p class="text-sm text-gray-500">Loading instructions...</p>}
                {/* TODO: Add error display based on mutation store errors if needed */}
                <textarea
                    id="global-instructions"
                    rows={8}
                    class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-mono"
                    value={globalInstructions}
                    onInput={handleGlobalInstructionsChange}
                    placeholder="Enter global instructions here..."
                    aria-label="Global Custom Instructions"
                    disabled={isLoading || isSavingGlobal} // Disable if loading or saving
                />
                <button
                    onClick={handleSaveGlobalInstructions}
                    class={`mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 ${isSavingGlobal ? 'animate-pulse' : ''}`}
                    disabled={isLoading || isSavingGlobal} // Disable if loading or saving
                >
                    {isSavingGlobal ? 'Saving...' : 'Save Global Instructions'}
                </button>
            </div>

            {/* Project Instructions */}
            <div>
                <label for="project-instructions" class="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Project Instructions</label>
                {customInstructionsData?.projectPath ? ( // Use data from store
                   <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">Editing: <code>{customInstructionsData.projectPath}</code></p>
                ) : (
                   <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">No project file found. Saving will create <code>.zen/custom_instructions.md</code>.</p>
                )}
                <textarea
                    id="project-instructions"
                    rows={12}
                    class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-mono"
                    value={projectInstructions}
                    onInput={handleProjectInstructionsChange}
                    placeholder="Enter project-specific instructions here..."
                    aria-label="Project Custom Instructions"
                    disabled={isLoading || isSavingProject} // Disable if loading or saving
                />
                 <div class="mt-2 flex space-x-2">
                     <button
                         onClick={handleSaveProjectInstructions}
                         class={`px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 ${isSavingProject ? 'animate-pulse' : ''}`}
                         disabled={isLoading || isSavingProject} // Disable if loading or saving
                     >
                         {isSavingProject ? 'Saving...' : 'Save Project Instructions'}
                     </button>
                     <button
                         onClick={handleOpenProjectInstructionsFile}
                         class={`px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 ${isOpeningFile ? 'animate-pulse' : ''}`}
                         disabled={isOpeningFile} // Disable while opening
                     >
                         Open/Create Project File
                     </button>
                 </div>
            </div>
        </section>
    );
}
