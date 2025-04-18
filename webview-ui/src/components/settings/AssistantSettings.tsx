import { FunctionalComponent, JSX } from 'preact';
import { useState, useMemo, useEffect } from 'preact/hooks'; // Removed useCallback, useStore
import { Button } from '../ui/Button';
import { Assistant, NewAssistant, UpdateAssistantPayload } from '../../../../src/common/types'; // Import types, added NewAssistant, UpdateAssistantPayload, removed AvailableModel, ProviderInfoAndStatus if not used
import { CustomSelect } from '../ui/CustomSelect'; // Import CustomSelect
import { $providerStatus, $modelsForSelectedProvider, fetchModels } from '../../stores/providerStores'; // Import provider/model stores for selection
import { useStore } from '@nanostores/react'; // Keep useStore for provider stores
import { useAssistantStore } from '../../stores/assistantStores'; // Import the actual Assistant store

export const AssistantSettings: FunctionalComponent = () => {
    // Use the actual Assistant store
    const { assistants, isLoading, error, actions } = useAssistantStore();
    // isCreating, isUpdating, isDeleting are effectively covered by the general isLoading state for now

    // State for the create/edit form/modal
    const [editingAssistant, setEditingAssistant] = useState<Partial<Assistant> | null>(null); // null = closed, {} = new, {id: ...} = editing
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editInstructions, setEditInstructions] = useState('');
    const [editProviderId, setEditProviderId] = useState<string | null>(null);
    const [editModelId, setEditModelId] = useState<string | null>(null);

    // Fetch provider/model data for dropdowns
    const providerStatus = useStore($providerStatus);
    const modelsStore = useStore($modelsForSelectedProvider);
    const availableProviders = useMemo(() => (Array.isArray(providerStatus) ? providerStatus.filter(p => p.enabled && p.credentialsSet) : []), [providerStatus]);
    const modelsForSelectedProvider = useMemo(() => (modelsStore.providerId === editProviderId ? modelsStore.models : []), [modelsStore, editProviderId]);
    const isLoadingModels = modelsStore.loading && modelsStore.providerId === editProviderId;

    // Effect to fetch models when provider changes in the form
    useEffect(() => {
        if (editProviderId) {
            fetchModels(editProviderId);
        }
    }, [editProviderId]);

    // Effect to fetch assistants on mount
    useEffect(() => {
        actions.fetchAssistants();
    }, [actions]); // Dependency array ensures it runs once on mount

    // Effect to populate form when editingAssistant changes
    useEffect(() => {
        if (editingAssistant && editingAssistant.id) { // Editing existing
            setEditName(editingAssistant.name || '');
            setEditDescription(editingAssistant.description || '');
            setEditInstructions(editingAssistant.instructions || ''); // Use new 'instructions' field
            setEditProviderId(editingAssistant.modelConfig?.providerId || null); // Access via modelConfig
            setEditModelId(editingAssistant.modelConfig?.modelId || null); // Access via modelConfig
        } else if (editingAssistant) { // Creating new
            setEditName('');
            setEditDescription('');
            setEditInstructions('');
            setEditProviderId(null);
            setEditModelId(null);
        }
    }, [editingAssistant]);


    const handleCreateClick = () => {
        setEditingAssistant({}); // Set to empty object for "new" mode
    };

    const handleEditClick = (assistant: Assistant) => {
        setEditingAssistant(assistant); // Set to the assistant object to edit
    };

    const handleCancelEdit = () => {
        setEditingAssistant(null); // Close form/modal
    };

    const handleSaveEdit = async () => {
        if (!editingAssistant) return;

        const assistantData = {
            name: editName.trim(),
            description: editDescription.trim() || undefined,
            instructions: editInstructions.trim() || '', // Use 'instructions', ensure it's a string
            modelConfig: { // Use nested modelConfig object
                providerId: editProviderId!, // Assume non-null based on validation below
                modelId: editModelId!, // Assume non-null based on validation below
            },
        };

        // Updated validation check for nested modelConfig properties
        if (!assistantData.name || !assistantData.modelConfig.providerId || !assistantData.modelConfig.modelId) {
            alert("Assistant Name, Provider, and Model are required."); // Simple validation
            return;
        }

        // Use a flag for save operation loading state - using store's isLoading for now
        // let saveInProgress = true; // Or manage with local state if needed
        try {
            if (editingAssistant.id) { // Update existing
                const updatePayload: UpdateAssistantPayload = { // Construct payload type
                    id: editingAssistant.id,
                    name: assistantData.name,
                    description: assistantData.description,
                    instructions: assistantData.instructions,
                    modelConfig: assistantData.modelConfig,
                };
                await actions.updateAssistant(updatePayload);
            } else { // Create new
                const createPayload: NewAssistant = { // Construct payload type
                    name: assistantData.name,
                    description: assistantData.description,
                    instructions: assistantData.instructions,
                    modelConfig: assistantData.modelConfig,
                };
                await actions.addAssistant(createPayload);
            }
            setEditingAssistant(null); // Close form on success (store refetches list)
        } catch (err) { // Catch errors from the store actions
            console.error("Error saving assistant:", err);
            alert(`Error saving assistant: ${err instanceof Error ? err.message : 'Unknown error'}`); // Show error
        } finally {
            // saveInProgress = false; // Reset loading state if managed locally
            // isLoading is reset by the store's fetch action
        }
    };

    const handleDeleteClick = async (assistant: Assistant) => {
        if (window.confirm(`Are you sure you want to delete assistant "${assistant.name}"?`)) {
            // Use a flag for delete operation loading state - using store's isLoading for now
            // let deleteInProgress = true; // Or manage with local state
            try {
                await actions.removeAssistant(assistant.id);
                // List refetches automatically on success in the store
            } catch (err) {
                console.error("Error deleting assistant:", err);
                alert(`Error deleting assistant: ${err instanceof Error ? err.message : 'Unknown error'}`);
            } finally {
                 // deleteInProgress = false; // Reset loading state if managed locally
                 // isLoading is reset by the store's fetch action
            }
        }
    };

    // Prepare options for provider/model dropdowns
    const providerOptions = useMemo(() => {
        const options: Record<string, { id: string; name: string }[]> = {
             Providers: availableProviders.map(p => ({ id: p.id, name: p.name }))
        };
        return options;
    }, [availableProviders]);

    const modelOptions = useMemo(() => {
         if (!editProviderId || modelsForSelectedProvider.length === 0) return {};
         const options: Record<string, { id: string; name: string }[]> = {
             Models: modelsForSelectedProvider.map(m => ({ id: m.id, name: m.name }))
         };
         return options;
    }, [editProviderId, modelsForSelectedProvider]);


    return (
        <section class="mb-8">
            {/* Section Header */}
            <div class="flex items-start gap-3 mb-5">
                <div class="bg-[var(--vscode-button-background)] p-2 rounded-lg">
                    <span class="i-carbon-user-avatar-filled-alt h-6 w-6 text-[var(--vscode-button-foreground)]"></span>
                </div>
                <div>
                    <h2 class="text-xl font-semibold text-[var(--vscode-foreground)]">Manage Assistants</h2>
                    <p class="text-sm text-[var(--vscode-foreground)] opacity-70">
                        Create and configure different AI assistant personalities.
                    </p>
                </div>
            </div>

            {/* Create Button */}
            <div class="mb-6">
                <Button variant="primary" onClick={handleCreateClick} disabled={!!editingAssistant}> {/* Disable while editing */}
                    <span class="i-carbon-add mr-1.5"></span>
                    Create New Assistant
                </Button>
            </div>

            {/* Assistant List */}
            <div class="space-y-4">
                {isLoading && <p class="text-[var(--vscode-foreground)]">Loading assistants...</p>} {/* Added theme text color */}
                {error && <p class="text-[var(--vscode-errorForeground)]">Error loading assistants.</p>}
                {!isLoading && !error && assistants.length === 0 && (
                    <p class="text-[var(--vscode-foreground)] opacity-70 italic">No assistants created yet.</p>
                )}
                {!isLoading && !error && assistants.map((assistant) => (
                    <div key={assistant.id} class="bg-[var(--vscode-editorWidget-background)] rounded-lg p-4 flex justify-between items-center">
                        <div>
                            <h4 class="font-medium text-[var(--vscode-foreground)]">{assistant.name}</h4>
                            <p class="text-xs text-[var(--vscode-foreground)] opacity-70 mt-1">{assistant.description || 'No description'}</p>
                            <p class="text-xxs text-[var(--vscode-foreground)] opacity-50 mt-1">Model: {assistant.modelConfig.providerId} / {assistant.modelConfig.modelId}</p>
                        </div>
                        <div class="flex gap-2 flex-shrink-0"> {/* Added flex-shrink-0 */}
                            <Button variant="secondary" size="sm" onClick={() => handleEditClick(assistant)} disabled={!!editingAssistant}>Edit</Button>
                            <Button
                                variant="secondary"
                                className="!bg-[var(--vscode-errorForeground)] !text-[var(--vscode-button-foreground)] hover:!opacity-90"
                                size="sm"
                                onClick={() => handleDeleteClick(assistant)}
                                disabled={!!editingAssistant || isLoading} // Disable while editing or any loading operation
                                loading={isLoading /* && deletingId === assistant.id */} // Use general isLoading, or add specific delete state
                            >Delete</Button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Create/Edit Form (Modal Placeholder) */}
            {editingAssistant && (
                <div class="fixed inset-0 bg-[var(--vscode-editor-background)] bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-40" onClick={handleCancelEdit}>
                    <div class="bg-[var(--vscode-sideBar-background)] p-6 rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <h3 class="text-lg font-medium mb-4 text-[var(--vscode-foreground)]">{editingAssistant.id ? 'Edit Assistant' : 'Create New Assistant'}</h3>
                        
                        {/* Removed overflow-y-auto to prevent dropdown clipping */}
                        <div class="flex-grow pr-2 space-y-4 mb-4">
                            {/* Name */}
                            <div>
                                <label for="assistant-name" class="block text-sm font-medium text-[var(--vscode-foreground)] mb-1">Name</label>
                                <input
                                    type="text"
                                    id="assistant-name"
                                    value={editName}
                                    onInput={(e) => setEditName((e.target as HTMLInputElement).value)}
                                    class="w-full p-2 rounded bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] focus:ring-1 focus:ring-[var(--vscode-focusBorder)] outline-none text-sm"
                                    placeholder="e.g., Python Expert"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label for="assistant-desc" class="block text-sm font-medium text-[var(--vscode-foreground)] mb-1">Description (Optional)</label>
                                <textarea
                                    id="assistant-desc"
                                    rows={2}
                                    value={editDescription}
                                    onInput={(e) => setEditDescription((e.target as HTMLTextAreaElement).value)}
                                    class="w-full p-2 rounded bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] focus:ring-1 focus:ring-[var(--vscode-focusBorder)] outline-none text-sm"
                                    placeholder="What does this assistant do?"
                                />
                            </div>

                            {/* Custom Instructions */}
                            <div>
                                <label for="assistant-instructions" class="block text-sm font-medium text-[var(--vscode-foreground)] mb-1">Custom Instructions (Optional)</label>
                                <textarea
                                    id="assistant-instructions"
                                    rows={5}
                                    value={editInstructions}
                                    onInput={(e) => setEditInstructions((e.target as HTMLTextAreaElement).value)}
                                    class="w-full p-2 rounded bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] focus:ring-1 focus:ring-[var(--vscode-focusBorder)] outline-none text-sm font-mono"
                                    placeholder="Guide the assistant's behavior..."
                                />
                            </div>

                            {/* Provider Selection */}
                            <div>
                                <label class="block text-sm font-medium text-[var(--vscode-foreground)] mb-1">AI Provider</label>
                                <CustomSelect
                                    groupedOptions={providerOptions}
                                    value={editProviderId}
                                    onChange={(val) => { setEditProviderId(val); setEditModelId(null); }} // Reset model on provider change
                                    placeholder="Select Provider"
                                    ariaLabel="Select AI Provider for Assistant"
                                    allowCustomValue={false}
                                    showId={false}
                                />
                            </div>

                            {/* Model Selection */}
                            <div>
                                <label class="block text-sm font-medium text-[var(--vscode-foreground)] mb-1">Model</label>
                                <CustomSelect
                                    groupedOptions={modelOptions}
                                    value={editModelId}
                                    onChange={setEditModelId}
                                    placeholder={isLoadingModels ? "Loading..." : "Select Model"}
                                    ariaLabel="Select AI Model for Assistant"
                                    allowCustomValue={false}
                                    showId={true} // Show model ID
                                    disabled={!editProviderId || isLoadingModels} // Disable if no provider or loading
                                />
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div class="flex justify-end gap-3 pt-4 border-t border-[var(--vscode-panel-border)]">
                            <Button variant="secondary" onClick={handleCancelEdit}>Cancel</Button>
                            <Button
                                variant="primary"
                                onClick={handleSaveEdit}
                                loading={isLoading} // Use general isLoading state
                                disabled={!editName || !editProviderId || !editModelId || isLoading} // Disable if required fields missing or loading
                            >
                                {editingAssistant.id ? 'Save Changes' : 'Create Assistant'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

        </section>
    );
};