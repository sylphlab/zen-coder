import { useState, useEffect } from 'preact/hooks';
import { useAtomValue } from 'jotai';
import { loadable } from 'jotai/utils';
import { JSX } from 'preact/jsx-runtime';
import { postMessage } from '../../app';
import { customInstructionsAtom } from '../../store/atoms';

export function CustomInstructionsSettings(): JSX.Element {
    const customInstructionsLoadable = useAtomValue(loadable(customInstructionsAtom));
    const [globalInstructions, setGlobalInstructions] = useState<string>('');
    const [projectInstructions, setProjectInstructions] = useState<string>('');
    // Removed isSubscribedRef - This comment is now redundant
    const [projectInstructionsPath, setProjectInstructionsPath] = useState<string | null>(null);

    // Effect to update local state when atom loads/changes
    useEffect(() => {
        if (customInstructionsLoadable.state === 'hasData' && customInstructionsLoadable.data) {
            const newData = customInstructionsLoadable.data;
            const newGlobal = newData.global ?? '';
            const newProject = newData.project ?? '';
            const newPath = newData.projectPath ?? null;

            if (newGlobal !== globalInstructions) setGlobalInstructions(newGlobal);
            if (newProject !== projectInstructions) setProjectInstructions(newProject);
            if (newPath !== projectInstructionsPath) setProjectInstructionsPath(newPath);
        }
    }, [customInstructionsLoadable]); // Depend on the loadable object

    // Removed subscription useEffect

    const handleGlobalInstructionsChange = (e: Event) => {
        setGlobalInstructions((e.target as HTMLTextAreaElement).value);
    };

    const handleProjectInstructionsChange = (e: Event) => {
        setProjectInstructions((e.target as HTMLTextAreaElement).value);
    };

    const handleSaveGlobalInstructions = () => {
        console.log('Saving global custom instructions...');
        postMessage({ type: 'setGlobalCustomInstructions', payload: { instructions: globalInstructions } });
    };

    const handleSaveProjectInstructions = () => {
        console.log('Saving project custom instructions...');
        postMessage({ type: 'setProjectCustomInstructions', payload: { instructions: projectInstructions } });
    };

    const handleOpenProjectInstructionsFile = () => {
        console.log('Requesting to open project custom instructions file...');
        postMessage({ type: 'openOrCreateProjectInstructionsFile' });
    };

    return (
        <section class="mb-8">
            <h3 class="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Custom Instructions</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Provide instructions to guide the AI's behavior and responses. Global instructions apply to all projects, while project instructions are specific to the current workspace and are appended after global ones. Use Markdown format.
            </p>

            {/* Global Instructions */}
            <div class="mb-6">
                <label for="global-instructions" class="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Global Instructions (VS Code Setting)</label>
                {/* No need for null check here as the useEffect handles it */}
                {customInstructionsLoadable.state === 'loading' && <p class="text-sm text-gray-500">Loading instructions...</p>}
                {customInstructionsLoadable.state === 'hasError' && <p class="text-sm text-red-500">Error loading instructions.</p>}
                <textarea
                    id="global-instructions"
                    rows={8}
                    class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-mono"
                    value={globalInstructions}
                    onInput={handleGlobalInstructionsChange}
                    placeholder="Enter global instructions here..."
                    aria-label="Global Custom Instructions"
                    disabled={customInstructionsLoadable.state !== 'hasData'}
                />
                <button
                    onClick={handleSaveGlobalInstructions}
                    class="mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                    disabled={customInstructionsLoadable.state !== 'hasData'}
                >
                    Save Global Instructions
                </button>
            </div>

            {/* Project Instructions */}
            <div>
                <label for="project-instructions" class="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Project Instructions</label>
                {projectInstructionsPath ? (
                   <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">Editing: <code>{projectInstructionsPath}</code></p>
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
                    disabled={customInstructionsLoadable.state !== 'hasData'}
                />
                 <div class="mt-2 flex space-x-2">
                     <button
                         onClick={handleSaveProjectInstructions}
                         class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                         disabled={customInstructionsLoadable.state !== 'hasData'}
                     >
                         Save Project Instructions
                     </button>
                     <button
                         onClick={handleOpenProjectInstructionsFile}
                         class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                     >
                         Open/Create Project File
                     </button>
                 </div>
            </div>
        </section>
    );
}