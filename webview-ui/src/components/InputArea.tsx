import { FunctionalComponent } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { Button } from './ui/Button';

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

const CloseIcon: FunctionalComponent<{ className?: string }> = ({ className = "h-4 w-4" }) => (
    <svg class={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
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

// Type definitions for model-related data
interface ProviderInfo {
    id: string;
    name: string;
    models: ModelInfo[];
}

interface ModelInfo {
    id: string;
    name: string;
}

// --- Component Props ---
interface InputAreaProps {
    selectedImages?: SelectedImage[];
    fileInputRef?: preact.RefObject<HTMLInputElement>;
    textareaRef?: preact.RefObject<HTMLTextAreaElement>;
    handleKeyDown: (e: KeyboardEvent) => void;
    handleSend: () => void;
    handleImageFileChange?: (e: Event | JSX.TargetedEvent<HTMLInputElement>) => void;
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
    
    // Mock provider data since we don't have access to the actual provider store
    const [providers, setProviders] = useState<ProviderInfo[]>([
        {
            id: 'openai',
            name: 'OpenAI',
            models: [
                { id: 'gpt-4o', name: 'GPT-4o' },
                { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
                { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
            ]
        },
        {
            id: 'anthropic',
            name: 'Anthropic',
            models: [
                { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet' },
                { id: 'claude-3-opus', name: 'Claude 3 Opus' },
                { id: 'claude-3-haiku', name: 'Claude 3 Haiku' }
            ]
        }
    ]);

    // Auto-resize textarea functionality
    const handleTextAreaChange = (e: Event) => {
        const target = e.target as HTMLTextAreaElement;
        setInputValue(target.value);
        target.style.height = 'auto';
        target.style.height = `${target.scrollHeight}px`;
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
    const currentModel = currentProvider?.models?.find(m => m.id === selectedModelId);
    const displayName = currentModel?.name || selectedModelId || (currentProvider?.name || selectedProviderId);

    return (
        <div class={`input-area ${className}`}>
            {/* Selected Images Preview */}
            {selectedImages.length > 0 && (
                <div class="selected-images flex flex-wrap gap-2 mb-3">
                    {selectedImages.map(img => (
                        <div key={img.id} class="relative group">
                            <img 
                                src={img.data}
                                alt="Selected" 
                                class="h-14 w-14 object-cover rounded-lg border border-black/10 dark:border-white/10"
                            />
                            {removeSelectedImage && (
                                <button
                                    onClick={() => removeSelectedImage(img.id)}
                                    class="absolute top-0.5 right-0.5 bg-black/50 hover:bg-black/70 text-white rounded-full p-0.5 
                                           opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                    title="Remove image"
                                >
                                    <CloseIcon className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Main Input Container */}
            <div class="relative flex w-full items-start">
                {/* Model Selector Button */}
                <div class="relative" ref={modelDropdownRef}>
                    <Button
                        onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                        variant="ghost"
                        size="sm"
                        className="mr-1 px-2 text-xs flex items-center text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 self-end mb-1"
                        aria-label="Select model"
                        title="Select model"
                    >
                        <ModelIcon className="h-3.5 w-3.5 mr-1.5" />
                        <span class="truncate max-w-[80px]">{displayName}</span>
                    </Button>
                    
                    {/* Models Dropdown */}
                    {isModelDropdownOpen && (
                        <div class="absolute bottom-full mb-1 left-0 w-64 max-h-64 overflow-y-auto bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-black/10 dark:border-white/10 z-20"
                             style={{ animation: 'fadeIn 0.15s ease-out forwards' }}>
                            <div class="p-2 max-h-64 overflow-y-auto">
                                {providers.map((provider) => (
                                    <div key={provider.id} class="mb-2">
                                        <div class="text-xs font-medium px-2 py-1 text-black/60 dark:text-white/60">
                                            {provider.name}
                                        </div>
                                        {provider.models?.map((model) => (
                                            <button
                                                key={model.id}
                                                class={`w-full text-left px-3 py-1.5 text-xs rounded-md flex items-center justify-between
                                                      ${selectedProviderId === provider.id && selectedModelId === model.id
                                                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300'
                                                        : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                                                onClick={() => {
                                                    if (onModelChange) onModelChange(provider.id, model.id);
                                                    setIsModelDropdownOpen(false);
                                                }}
                                            >
                                                <span class="truncate">{model.name}</span>
                                                {selectedProviderId === provider.id && selectedModelId === model.id && (
                                                    <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Main Textarea */}
                <div class="relative flex-1">
                    <textarea
                        ref={textareaRef}
                        value={inputValue}
                        onChange={handleTextAreaChange}
                        onKeyDown={handleKeyDown}
                        disabled={isStreaming}
                        placeholder={isStreaming ? "AI is responding..." : "Type your message..."}
                        class="w-full p-3 pr-16 rounded-xl resize-none border border-black/10 dark:border-white/10 bg-white dark:bg-gray-800 
                               placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-400 
                               dark:focus:ring-indigo-600 min-h-[44px] max-h-36 text-sm transition-colors duration-200 ease-out"
                        style={{
                            opacity: isStreaming ? 0.7 : 1,
                            paddingRight: '3.5rem',
                        }}
                    />

                    {/* Action Buttons */}
                    <div class="absolute right-2 bottom-1.5 flex items-center space-x-1">
                        {/* Image Upload Button */}
                        {!isStreaming && handleImageFileChange && triggerImageUpload && fileInputRef && (
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={triggerImageUpload}
                                title="Add image"
                                className="text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-black/5 dark:hover:bg-white/5 h-8 w-8 rounded-lg"
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
                            </Button>
                        )}

                        {/* Send/Stop Button */}
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={isStreaming ? handleStopGeneration : handleSend}
                            title={isStreaming ? "Stop generation" : "Send message"}
                            className={`${isStreaming 
                                ? 'text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30' 
                                : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'
                            } h-8 w-8 rounded-lg`}
                        >
                            {isStreaming ? <StopIcon className="h-4 w-4" /> : <SendIcon className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
            </div>
            
            {/* Animation styles */}
            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};
