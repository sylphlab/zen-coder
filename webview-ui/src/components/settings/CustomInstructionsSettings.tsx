import { useState, useEffect, useCallback } from 'preact/hooks';
import { useStore } from '@nanostores/react';
import { JSX } from 'preact/jsx-runtime';
import { Button } from '../ui/Button'; // Import the Button component
import {
    $customInstructions,
    $setGlobalCustomInstructions,
    $setProjectCustomInstructions,
    $openOrCreateProjectInstructionsFile
} from '../../stores/settingsStores';

export function CustomInstructionsSettings(): JSX.Element {
    // --- State from Nanostores ---
    const customInstructionsData = useStore($customInstructions);
    const { mutate: saveGlobalMutate, loading: isSavingGlobal } = useStore($setGlobalCustomInstructions);
    const { mutate: saveProjectMutate, loading: isSavingProject } = useStore($setProjectCustomInstructions);
    const { mutate: openFileMutate, loading: isOpeningFile } = useStore($openOrCreateProjectInstructionsFile);

    // Check for initial null or explicit 'loading' state
    const isLoading = customInstructionsData === null || customInstructionsData === 'loading';
    const loadError = customInstructionsData === 'error';

    // --- Local State for Inputs ---
    const [globalInstructions, setGlobalInstructions] = useState<string>('');
    const [projectInstructions, setProjectInstructions] = useState<string>('');

     // Effect to log saving state changes (optional, keep for debugging if needed)
     useEffect(() => {
         console.log('[CustomInstructionsSettings] isSavingGlobal state changed:', isSavingGlobal);
         console.log('[CustomInstructionsSettings] isSavingProject state changed:', isSavingProject);
     }, [isSavingGlobal, isSavingProject]);

     // Effect to update local state when store data loads/changes
     useEffect(() => {
         try {
             if (customInstructionsData && typeof customInstructionsData === 'object') {
                 const newGlobal = customInstructionsData.global ?? '';
                 const newProject = customInstructionsData.project ?? '';
                 if (newGlobal !== globalInstructions) {
                     setGlobalInstructions(newGlobal);
                 }
                 if (newProject !== projectInstructions) {
                     setProjectInstructions(newProject);
                 }
             }
         } catch (err) {
             console.error("[CustomInstructionsSettings] Error in useEffect handling customInstructionsData:", err);
         }
    }, [customInstructionsData]); // Depend only on the store data

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
        } catch (error) {
            console.error('Error saving global instructions:', error);
        }
    }, [globalInstructions, saveGlobalMutate]);

    const handleSaveProjectInstructions = useCallback(async () => {
        console.log('Saving project custom instructions via mutation store...');
        try {
            await saveProjectMutate({ instructions: projectInstructions });
            console.log('Project instructions save request sent.');
        } catch (error) {
            console.error('Error saving project instructions:', error);
        }
    }, [projectInstructions, saveProjectMutate]);

    const handleOpenProjectInstructionsFile = useCallback(async () => {
        console.log('Requesting to open project custom instructions file via mutation store...');
        try {
            await openFileMutate();
            console.log('Open/Create project file request sent.');
        } catch (error) {
            console.error('Error opening project instructions file:', error);
        }
    }, [openFileMutate]);

    return (
        <section class="mb-8">
            <h3 class="text-xl font-semibold mb-4 text-[var(--vscode-foreground)] flex items-center gap-2">
                <span class="i-carbon-document h-5 w-5 text-[var(--vscode-button-background)]"></span>
                Custom Instructions
            </h3>
            <p class="text-sm text-[var(--vscode-foreground)] opacity-70 mb-4">
                Provide instructions to guide the AI's behavior and responses. Global instructions apply to all projects, while project instructions are specific to the current workspace and are appended after global ones. Use Markdown format.
            </p>

            {/* Global Instructions */}
            <div class="mb-6">
                <label for="global-instructions" class="block text-lg font-medium text-[var(--vscode-foreground)] mb-2">Global Instructions (VS Code Setting)</label>
                {/* Remove explicit loading message, rely only on disabled state */}
                {loadError && (
                    <div class="flex items-center gap-2 text-sm text-[var(--vscode-errorForeground)] italic mb-2">
                        <span class="i-carbon-warning-alt h-4 w-4"></span>
                        <p>Error loading instructions.</p>
                    </div>
                )}
                <textarea
                    id="global-instructions"
                    rows={8}
                    class="w-full p-2 border border-[var(--vscode-input-border)] rounded bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] focus:border-[var(--vscode-focusBorder)] outline-none text-sm font-mono"
                    value={globalInstructions}
                    onInput={handleGlobalInstructionsChange}
                    placeholder="Enter global instructions here..."
                    aria-label="Global Custom Instructions"
                    disabled={isLoading || isSavingGlobal}
                />
                {/* Use Button component for Save Global */}
                <Button
                    variant="primary"
                    size="md"
                    onClick={handleSaveGlobalInstructions}
                    className="mt-2"
                    disabled={isLoading || isSavingGlobal}
                    loading={isSavingGlobal}
                >
                    <span class="i-carbon-save h-4 w-4 mr-1.5"></span>
                    Save Global Instructions
                </Button>
            </div>

            {/* Project Instructions */}
            <div>
                <label for="project-instructions" class="block text-lg font-medium text-[var(--vscode-foreground)] mb-2">Project Instructions</label>
                {/* Only show path/message when data is loaded and not error */}
                {!isLoading && !loadError && customInstructionsData && typeof customInstructionsData === 'object' && (
                    customInstructionsData.projectPath ? (
                        <p class="text-xs text-[var(--vscode-foreground)] opacity-60 mb-2">Editing: <code>{customInstructionsData.projectPath}</code></p>
                    ) : (
                        <p class="text-xs text-[var(--vscode-foreground)] opacity-60 mb-2">No project file found. Saving will create <code>.zen/custom_instructions.md</code>.</p>
                    )
                )}
                <textarea
                    id="project-instructions"
                    rows={12}
                    class="w-full p-2 border border-[var(--vscode-input-border)] rounded bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] focus:border-[var(--vscode-focusBorder)] outline-none text-sm font-mono"
                    value={projectInstructions}
                    onInput={handleProjectInstructionsChange}
                    placeholder="Enter project-specific instructions here..."
                    aria-label="Project Custom Instructions"
                    disabled={isLoading || isSavingProject}
                />
                <div class="mt-2 flex space-x-2">
                    <Button
                        variant="primary"
                        size="md"
                        onClick={handleSaveProjectInstructions}
                        disabled={isLoading || isSavingProject}
                        loading={isSavingProject}
                    >
                        <span class="i-carbon-save h-4 w-4 mr-1.5"></span>
                        Save Project Instructions
                    </Button>
                    <Button
                        variant="secondary"
                        size="md"
                        onClick={handleOpenProjectInstructionsFile}
                        disabled={isOpeningFile}
                        loading={isOpeningFile}
                    >
                        Open/Create Project File
                    </Button>
                </div>
            </div>
        </section>
    );
}
