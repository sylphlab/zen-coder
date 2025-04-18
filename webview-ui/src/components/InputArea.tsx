import { FunctionalComponent } from 'preact';
import { useState, useRef, useEffect, useCallback, useMemo } from 'preact/hooks'; // Ensure useMemo is imported
import { useStore } from '@nanostores/react';
// Removed provider/model store imports
import { Button } from './ui/Button';
import { JSX } from 'preact/jsx-runtime';
import { Assistant } from '../../../src/common/types'; // Import Assistant type

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
    selectedAssistantId?: string | null; // Changed
    onAssistantChange?: (assistantId: string | null) => void; // Changed
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
    selectedAssistantId, // Changed
    onAssistantChange, // Changed
    inputValue,
    setInputValue,
    isStreaming = false,
    className = ''
}) => {
    // State for dropdown
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [dropdownFilter, setDropdownFilter] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // TODO: Replace placeholder with Assistant store logic
    const assistants = useMemo(() => {
        console.log("TODO: Fetch assistants from store");
        // Example data structure matching Assistant type
        const exampleData: Assistant[] = [
            { id: 'default-1', name: 'Default Assistant', description: 'General purpose assistant', modelProviderId: 'placeholder-provider', modelId: 'placeholder-model', createdAt: 0, lastModified: 0 },
            { id: 'coder-py', name: 'Python Coder', description: 'Helps with Python code', modelProviderId: 'placeholder-provider', modelId: 'placeholder-model', createdAt: 0, lastModified: 0 },
            { id: 'refactor-pro', name: 'Refactor Pro', description: 'Focuses on refactoring', modelProviderId: 'placeholder-provider', modelId: 'placeholder-model', createdAt: 0, lastModified: 0 },
        ];
        return exampleData;
    }, []);
    const isLoadingAssistants = false; // Placeholder
    const assistantsError = null; // Placeholder

    // Auto-resize textarea functionality
    const handleTextAreaChange = (e: Event) => {
        const target = e.target as HTMLTextAreaElement;
        setInputValue(target.value);
        target.style.height = 'auto';
        target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
    };

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Find current assistant for display
    const currentAssistant = assistants.find((a: Assistant) => a.id === selectedAssistantId);
    const displayName = currentAssistant?.name ?? 'Select Assistant';

    // Clear filter when dropdown opens
    useEffect(() => {
        if (isDropdownOpen) {
            setDropdownFilter('');
        }
    }, [isDropdownOpen]);

    // Handler for selecting an Assistant
    const handleAssistantSelect = useCallback((assistantId: string | null) => {
        if (onAssistantChange) {
            onAssistantChange(assistantId);
        }
        setIsDropdownOpen(false);
        setDropdownFilter('');
    }, [onAssistantChange]);


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
                                class="h-10 w-10 rounded-md"
                            />
                            {removeSelectedImage && (
                                <button
                                    onClick={() => removeSelectedImage(img.id)}
                                    class="absolute -top-1 -right-1 rounded-full p-0.5 bg-[var(--vscode-editorWidget-background)] text-[var(--vscode-foreground)] opacity-70 hover:opacity-100"
                                    title="Remove image"
                                >
                                    <span class="i-carbon-close h-2.5 w-2.5 block"></span>
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Main Input Container */}
            <div class="flex items-end overflow-hidden bg-[var(--vscode-input-background)]">
                {/* Left Side: Textarea + Assistant Selector */}
                <div class="flex-1 flex flex-col">
                    <textarea
                        ref={textareaRef}
                        value={inputValue}
                        onChange={handleTextAreaChange}
                        onKeyDown={handleKeyDown}
                        disabled={isStreaming}
                        placeholder={isStreaming ? "AI is responding..." : "Type your message..."}
                        class="w-full px-2.5 py-2 resize-none border-0 focus:outline-none min-h-[42px] max-h-[200px] text-base bg-transparent text-[var(--vscode-input-foreground)]"
                        style={{ opacity: isStreaming ? 0.7 : 1 }}
                    />
                    {/* Assistant Selector */}
                    <div class="relative px-2.5 pb-1 pt-0.5" ref={dropdownRef}>
                        <button
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            class="inline-flex items-center text-[10px] opacity-90 hover:opacity-100 text-[var(--vscode-input-foreground)]"
                        >
                            <span class="i-carbon-user-avatar h-3 w-3 mr-1 opacity-80"></span>
                            <span class="truncate max-w-[120px]">{displayName}</span>
                        </button>

                        {isDropdownOpen && (
                            <div class="absolute bottom-full mb-1 left-0 w-48 rounded-md border border-[var(--vscode-input-border)] z-20 bg-[var(--vscode-editorWidget-background)] flex flex-col">
                                {/* Filter Input */}
                                <div class="p-1 border-b border-[var(--vscode-input-border)]">
                                    <input
                                        type="text"
                                        placeholder="Filter..."
                                        value={dropdownFilter}
                                        onInput={(e) => setDropdownFilter((e.target as HTMLInputElement).value)}
                                        class="w-full px-2 py-1 text-xs bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)] rounded"
                                    />
                                </div>
                                {/* Assistant List */}
                                <div class="p-1 max-h-40 overflow-y-auto">
                                    {isLoadingAssistants && (
                                        <div class="px-2 py-1 text-xs opacity-60 flex items-center">
                                            <span class="i-carbon-rotate-clockwise animate-spin h-3 w-3 mr-1"></span>
                                            Loading assistants...
                                        </div>
                                    )}
                                    {assistantsError && !isLoadingAssistants && (
                                        <div class="px-2 py-1 text-xs text-[var(--vscode-errorForeground)]">{assistantsError}</div>
                                    )}
                                    {!isLoadingAssistants && !assistantsError && assistants.length === 0 && (
                                        <div class="px-2 py-1 text-xs opacity-60">No assistants found. Create one in Settings.</div>
                                    )}
                                    {/* Filter Assistants */}
                                    {!isLoadingAssistants && !assistantsError && assistants
                                        .filter((a: Assistant) => a.name.toLowerCase().includes(dropdownFilter.toLowerCase()) || a.id.toLowerCase().includes(dropdownFilter.toLowerCase()))
                                        .map((assistant: Assistant) => (
                                        <button
                                            key={assistant.id}
                                            onClick={() => handleAssistantSelect(assistant.id)}
                                            class={`w-full text-left px-2 py-1 text-xs rounded text-[var(--vscode-foreground)] ${
                                                selectedAssistantId === assistant.id
                                                    ? 'opacity-100 font-medium bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
                                                    : 'opacity-80 hover:opacity-100 hover:bg-[var(--vscode-list-hoverBackground)]'
                                            }`}
                                            title={assistant.description}
                                        >
                                            {assistant.name}
                                        </button>
                                    ))}
                                    {/* Show message if filter yields no results */}
                                    {!isLoadingAssistants && !assistantsError && assistants.filter((a: Assistant) => a.name.toLowerCase().includes(dropdownFilter.toLowerCase()) || a.id.toLowerCase().includes(dropdownFilter.toLowerCase())).length === 0 && (
                                        <div class="px-2 py-1 text-xs opacity-60 italic">No matching assistants found.</div>
                                    )}
                                    {/* Option to use default */}
                                     <button
                                        key="use-default"
                                        onClick={() => handleAssistantSelect(null)}
                                        class={`w-full text-left px-2 py-1 text-xs rounded text-[var(--vscode-foreground)] ${
                                            selectedAssistantId === null
                                                ? 'opacity-100 font-medium bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
                                                : 'opacity-80 hover:opacity-100 hover:bg-[var(--vscode-list-hoverBackground)]'
                                        }`}
                                        title="Use the default assistant configured in settings"
                                    >
                                        Use Default Assistant
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side: Action Buttons */}
                <div class="flex items-center p-1.5 self-end mb-0.5">
                    {/* Image Upload Button */}
                    {!isStreaming && handleImageFileChange && triggerImageUpload && fileInputRef && (
                        <button
                                onClick={triggerImageUpload}
                                title="Add image"
                                class="flex items-center justify-center h-7 w-7 mr-1 rounded-md opacity-90 hover:opacity-100 text-[var(--vscode-foreground)]"
                                disabled={isStreaming}
                            >
                                <span class="i-carbon-image h-4 w-4"></span>
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
                        } ${(!isStreaming && inputValue.trim() === '' && selectedImages.length === 0) ? 'opacity-40 cursor-not-allowed' : 'opacity-90 hover:opacity-100 text-[var(--vscode-foreground)]'}`}
                    >
                        {isStreaming ? <span class="i-carbon-stop-filled-alt h-4 w-4"></span> : <span class="i-carbon-send-alt h-4 w-4"></span>}
                    </button>
                </div>
            </div>
        </div>
    );
};
