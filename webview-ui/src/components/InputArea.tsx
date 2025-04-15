import { FunctionalComponent } from 'preact';
import { Ref } from 'preact';
import { JSX } from 'preact/jsx-runtime';

// Interface for selected image state (can be moved to common types)
export interface SelectedImage { // Ensure this is exported
    id: string;
    data: string;
    mediaType: string;
    name: string;
}

interface InputAreaProps {
    // State props passed down from parent (ChatView)
    inputValue: string;
    setInputValue: (value: string) => void;
    isStreaming: boolean;
    selectedImages: SelectedImage[];

    // Event handlers passed down
    handleKeyDown: (e: KeyboardEvent) => void;
    handleSend: () => void;
    handleStopGeneration: () => void;

    // Image upload hook props passed down
    setSelectedImages: (images: SelectedImage[] | ((prev: SelectedImage[]) => SelectedImage[])) => void;
    fileInputRef: Ref<HTMLInputElement>;
    triggerImageUpload: () => void;
    removeSelectedImage: (id: string) => void;
    handleImageFileChange: (event: JSX.TargetedEvent<HTMLInputElement>) => void;

    // Other props
    className?: string;
    currentModelId: string | null;
}

export const InputArea: FunctionalComponent<InputAreaProps> = ({
    // Destructure all props
    inputValue,
    setInputValue,
    isStreaming,
    selectedImages,
    handleKeyDown,
    handleSend,
    handleStopGeneration,
    setSelectedImages, // Note: This comes from the useImageUpload hook, not local state
    fileInputRef,
    triggerImageUpload,
    removeSelectedImage,
    handleImageFileChange,
    className,
    currentModelId
}) => {
    console.log(`[InputArea Render] isStreaming=${isStreaming}, inputValue=${inputValue.length}, selectedImages=${selectedImages.length}, currentModelId=${currentModelId}`); // Enhanced log

    return (
        <div class={`input-area p-2 border-t border-gray-300 dark:border-gray-700 flex flex-col ${className ?? ''}`}>
            {/* Selected Images Preview Area */}
            {selectedImages.length > 0 && (
                <div class="selected-images-preview mb-2 p-2 border border-dashed border-gray-400 dark:border-gray-600 rounded flex flex-wrap gap-2">
                    {selectedImages.map((img) => (
                        <div key={img.id} class="relative group">
                            <img src={`data:${img.mediaType};base64,${img.data}`} alt={img.name} title={img.name} class="w-12 h-12 object-cover rounded" />
                            <button
                                onClick={() => removeSelectedImage(img.id)}
                                class="absolute top-0 right-0 -mt-1 -mr-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label={`Remove ${img.name}`}
                            >
                                &times;
                            </button>
                        </div>
                    ))}
                </div>
            )}
            <div class="flex items-end">
                {/* Hidden File Input */}
                <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleImageFileChange}
                    multiple
                    style={{ display: 'none' }}
                    id="image-upload-input"
                />
                {/* Image Upload Button */}
                <button
                    onClick={triggerImageUpload}
                    disabled={isStreaming || !currentModelId} // Use prop
                    title="Attach Image"
                    class="p-2 mr-2 border rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {/* Simple Paperclip Icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                </button>
                {/* Text Input */}
                <textarea
                    value={inputValue} // Use prop
                    onInput={(e) => {
                        const newValue = e.currentTarget.value;
                        console.log(`[InputArea onInput] Event fired. New value: "${newValue}"`); // Add log
                        const target = e.currentTarget;
                        target.style.height = 'auto'; // Auto-adjust height first
                        target.style.height = `${Math.min(target.scrollHeight, 120)}px`; // Set new height (limit to 120px)
                        setInputValue(newValue); // Call parent state setter
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={selectedImages.length > 0 ? "Add a caption or message..." : "Type your message..."} // Use prop
                    rows={1}
                    style={{ minHeight: '40px', maxHeight: '120px' }}
                    disabled={isStreaming || !currentModelId} // Use prop
                    class="flex-1 p-2 border rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 resize-none mr-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {/* Send/Stop Buttons */}
                {isStreaming ? ( // Use prop
                    <button
                        onClick={handleStopGeneration}
                        class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 self-end"
                        title="Stop Generating"
                    >
                        {/* Simple Square Icon */}
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                           <path fill-rule="evenodd" d="M5 5a1 1 0 011-1h8a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1V5z" clip-rule="evenodd" />
                        </svg>
                    </button>
                ) : (
                    <button
                        onClick={handleSend}
                        disabled={(!inputValue.trim() && selectedImages.length === 0) || !currentModelId} // Use prop for inputValue & selectedImages
                        class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed self-end"
                    >
                        Send
                    </button>
                )}
            </div>
        </div>
    );
};
