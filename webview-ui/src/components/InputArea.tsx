import { FunctionalComponent } from 'preact';
import { useState, useRef, useEffect, useCallback } from 'preact/hooks'; // Import useCallback
import { useStore } from '@nanostores/react'; // Import useStore
import { $providerStatus, $modelsForSelectedProvider, fetchModels } from '../stores/providerStores'; // Import provider status store, models store, and fetch function
import { Button } from './ui/Button'; // Keep Button import
import { JSX } from 'preact/jsx-runtime'; // Import JSX namespace
import { AvailableModel } from '../../../src/common/types'; // Import AvailableModel type

// --- SVG Icons ---
const SendIcon: FunctionalComponent<{ className?: string }> = ({ className = "h-4 w-4" }) => (
    <svg class={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
);

const StopIcon: FunctionalComponent<{ className?: string }> = ({ className = "h-4 w-4" }) => (
    <svg class={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
    </svg>
);

const ImageIcon: FunctionalComponent<{ className?: string }> = ({ className = "h-4 w-4" }) => (
    <svg class={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
);

const ModelIcon: FunctionalComponent<{ className?: string }> = ({ className = "h-4 w-4" }) => (
    <svg class={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
);

// --- Types ---
export interface SelectedImage {
    id: string;
    data: string;
    mediaType?: string;
}

// --- Component Props ---
interface InputAreaProps {
    selectedImages?: SelectedImage[];
    fileInputRef?: preact.RefObject<HTMLInputElement>;
    textareaRef?: preact.RefObject<HTMLTextAreaElement>;
    handleKeyDown: (e: KeyboardEvent) => void;
    handleSend: () => void;
    handleImageFileChange?: (e: JSX.TargetedEvent<HTMLInputElement>) => void;
    triggerImageUpload?: () => void;
    removeSelectedImage?: (id: string) => void;
    setSelectedImages?: (images: SelectedImage[]) => void;
    handleStopGeneration?: () => void;
    selectedProviderId?: string | null;
    selectedModelId?: string | null;
    onModelChange?: (providerId: string | null, modelId: string | null) => void;
    inputValue: string;
    setInputValue: (value: string) => void;
    isStreaming?: boolean;
    className?: string;
}

export const InputArea: FunctionalComponent<InputAreaProps> = ({
    selectedImages = [],
    fileInputRef,
    textareaRef,
    handleKeyDown,
    handleSend,
    handleImageFileChange,
    triggerImageUpload,
    removeSelectedImage,
    handleStopGeneration,
    selectedProviderId,
    selectedModelId,
    onModelChange,
    inputValue,
    setInputValue,
    isStreaming = false,
    className = ''
}) => {
    // State for model dropdown
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
    const modelDropdownRef = useRef<HTMLDivElement>(null);

    // Get provider status from the store
    const providerStatusStore = useStore($providerStatus);
    const providers = (providerStatusStore !== 'loading' && providerStatusStore !== 'error' && providerStatusStore !== null)
        ? providerStatusStore.filter(p => p.enabled && p.credentialsSet) // Use correct properties: enabled and credentialsSet
        : [];

    // Get models for the selected provider from the store
    const modelsStore = useStore($modelsForSelectedProvider);
    const modelsForCurrentProvider: AvailableModel[] = modelsStore.providerId === selectedProviderId ? modelsStore.models : [];
    const isLoadingModels = modelsStore.loading && modelsStore.providerId === selectedProviderId;
    const modelsError = modelsStore.providerId === selectedProviderId ? modelsStore.error : null;

    // State to manage which view is shown in the dropdown (providers or models)
    const [dropdownView, setDropdownView] = useState<'providers' | 'models'>('providers');

    // Auto-resize textarea functionality
    const handleTextAreaChange = (e: Event) => {
        const target = e.target as HTMLTextAreaElement;
        setInputValue(target.value);
        target.style.height = 'auto';
        target.style.height = `${Math.min(target.scrollHeight, 200)}px`; // Limit max height
    };

    // Handle click outside to close model dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
                setIsModelDropdownOpen(false);
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Find current provider and model for display
    const currentProvider = providers.find(p => p.id === selectedProviderId);
    const currentModel = modelsForCurrentProvider.find(m => m.id === selectedModelId);
    const displayName = currentModel?.name ?? (currentProvider?.name ? `${currentProvider.name} / ${selectedModelId ?? 'Select Model'}` : selectedProviderId ?? 'Select Model');

    // Reset dropdown view when it opens
    useEffect(() => {
        if (isModelDropdownOpen) {
            setDropdownView('providers'); // Always start with provider list
        }
    }, [isModelDropdownOpen]);

    // Fetch models when selectedProviderId changes *if* the dropdown is intended to show models next
    // Let's fetch immediately when a provider is clicked in the dropdown for now.

    const handleProviderSelect = useCallback((providerId: string) => {
        console.log(`Provider selected: ${providerId}. Fetching models.`);
        fetchModels(providerId); // Trigger model fetch
        setDropdownView('models'); // Switch dropdown view to show models
        // Do not call onModelChange here yet, wait for model selection
    }, []);

    const handleModelSelect = useCallback((providerId: string, modelId: string) => {
        if (onModelChange) {
            onModelChange(providerId, modelId);
        }
        setIsModelDropdownOpen(false); // Close dropdown after model selection
    }, [onModelChange]);


    return (
        <div class={`input-area w-full ${className}`}>
            {/* Selected Images */}
            {selectedImages.length > 0 && (
                <div class="flex flex-wrap gap-2 mb-2 px-1">
                    {selectedImages.map(img => (
                        <div key={img.id} class="relative group">
                            <img 
                                src={img.data}
                                alt="Selected" 
                                class="h-10 w-10 object-cover rounded-md"
                            />
                            {removeSelectedImage && (
                                <button
                                    onClick={() => removeSelectedImage(img.id)}
                                    class="absolute -top-1 -right-1 rounded-full p-0.5"
                                    title="Remove image"
                                >
                                    <svg class="h-2.5 w-2.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Main Input Container - Using Flexbox */}
            {/* Added bg color to match textarea for seamless look */}
            <div class="flex items-end border border-[var(--vscode-input-border)] rounded-lg shadow-sm overflow-hidden bg-[var(--vscode-input-background)]">
                {/* Left Side: Textarea + Model Selector */}
                <div class="flex-1 flex flex-col">
                    <textarea
                        ref={textareaRef}
                        value={inputValue}
                        onChange={handleTextAreaChange}
                        onKeyDown={handleKeyDown}
                        disabled={isStreaming}
                        placeholder={isStreaming ? "AI is responding..." : "Type your message..."}
                        // Removed pr-16, adjusted pl/py slightly
                        class="w-full px-2.5 py-2 resize-none border-0 focus:outline-none min-h-[42px] max-h-[200px] text-sm bg-transparent"
                        style={{ opacity: isStreaming ? 0.7 : 1 }}
                    />
                    {/* Model Selector - Below Textarea */}
                    <div class="relative px-2.5 pb-1 pt-0.5" ref={modelDropdownRef}> {/* Added relative positioning context */}
                        <button
                            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                            class="inline-flex items-center text-[10px] opacity-70 hover:opacity-100"
                        >
                            <ModelIcon className="h-2.5 w-2.5 mr-1" />
                            <span class="truncate max-w-[120px]">{displayName}</span> {/* Increased max-width */}
                        </button>
                        
                        {isModelDropdownOpen && (
                             /* Adjusted position: absolute to this parent, ensure bg for overlap */
                             /* Used vscode-editorWidget-background for dropdown */
                            <div class="absolute bottom-full mb-1 left-0 w-48 rounded-md border border-[var(--vscode-input-border)] shadow-lg z-20 bg-[var(--vscode-editorWidget-background)]">
                                <div class="p-1 max-h-48 overflow-y-auto">
                                {dropdownView === 'providers' && (
                                    <>
                                        {providers.length === 0 && (
                                                <div class="px-2 py-1 text-xs opacity-60">No enabled providers found. Check Settings.</div>
                                            )}
                                            {providers.map((provider) => (
                                                <button
                                                    key={provider.id}
                                                    onClick={() => handleProviderSelect(provider.id)}
                                                    class={`w-full text-left px-2 py-1 text-xs rounded flex justify-between items-center ${
                                                        selectedProviderId === provider.id
                                                            ? 'opacity-100 font-medium' // Highlight selected provider
                                                            : 'opacity-80 hover:opacity-100'
                                                    }`}
                                                >
                                                    <span>{provider.name}</span>
                                                    <span class="i-carbon-chevron-right h-3 w-3 opacity-50"></span>
                                                </button>
                                            ))}
                                        </>
                                    )}
                                    {dropdownView === 'models' && (
                                        <>
                                            {/* Back button */}
                                            <button
                                                onClick={() => setDropdownView('providers')}
                                                class="w-full text-left px-2 py-1 text-xs rounded flex items-center opacity-70 hover:opacity-100 mb-1"
                                            >
                                                <span class="i-carbon-chevron-left h-3 w-3 mr-1"></span>
                                                Back to Providers
                                            </button>
                                            {/* Loading/Error/Model List */}
                                            {isLoadingModels && (
                                                <div class="px-2 py-1 text-xs opacity-60 flex items-center">
                                                    <span class="i-carbon-rotate-clockwise animate-spin h-3 w-3 mr-1"></span>
                                                    Loading models...
                                                </div>
                                            )}
                                            {modelsError && !isLoadingModels && (
                                                <div class="px-2 py-1 text-xs text-red-500">{modelsError}</div>
                                            )}
                                            {!isLoadingModels && !modelsError && modelsForCurrentProvider.length === 0 && (
                                                <div class="px-2 py-1 text-xs opacity-60">No models found for this provider.</div>
                                            )}
                                            {!isLoadingModels && !modelsError && modelsForCurrentProvider.map((model) => (
                                                <button
                                                    key={model.id}
                                                    onClick={() => handleModelSelect(selectedProviderId!, model.id)} // selectedProviderId should be set here
                                                    class={`w-full text-left px-2 py-1 text-xs rounded ${
                                                        selectedModelId === model.id
                                                            ? 'opacity-100 font-medium' // Highlight selected model
                                                            : 'opacity-80 hover:opacity-100'
                                                    }`}
                                                >
                                                    {model.name}
                                                </button>
                                            ))}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side: Action Buttons */}
                {/* Use p-1.5 for padding, self-end to align to bottom, mb-0.5 for slight offset */}
                <div class="flex items-center p-1.5 self-end mb-0.5"> {/* This div contains the buttons */}
                    {/* Image Upload Button */}
                    {!isStreaming && handleImageFileChange && triggerImageUpload && fileInputRef && (
                        <button
                                onClick={triggerImageUpload}
                                title="Add image"
                                class="flex items-center justify-center h-7 w-7 mr-1 rounded-md opacity-70 hover:opacity-100"
                                disabled={isStreaming}
                            >
                                <ImageIcon className="h-4 w-4" />
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleImageFileChange}
                                    class="hidden"
                                />
                            </button>
                        )}

                        {/* Send/Stop Button */}
                        <button
                            onClick={isStreaming ? handleStopGeneration : handleSend}
                            title={isStreaming ? "Stop generation" : "Send message"}
                            disabled={!isStreaming && inputValue.trim() === '' && selectedImages.length === 0}
                            class={`flex items-center justify-center h-7 w-7 rounded-md ${
                                isStreaming 
                                    ? 'opacity-90' 
                                    : ''
                            } ${(!isStreaming && inputValue.trim() === '' && selectedImages.length === 0) ? 'opacity-40 cursor-not-allowed' : 'opacity-70 hover:opacity-100'}`}
                        >
                            {isStreaming ? <StopIcon className="h-4 w-4" /> : <SendIcon className="h-4 w-4" />}
                        </button>
                    </div>
                </div>
            </div>
        );
}

