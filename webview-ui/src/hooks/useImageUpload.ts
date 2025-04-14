import { useState, useRef, useCallback } from 'preact/hooks';
import { JSX } from 'preact/jsx-runtime';
import { generateUniqueId } from '../utils/communication'; // Import helper from communication
import { SelectedImage } from '../components/InputArea'; // Import SelectedImage from InputArea component

/**
 * Reads an image file and returns its base64 representation along with metadata.
 */
function readImageFile(file: File): Promise<SelectedImage> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = (reader.result as string)?.split(',')[1];
            if (base64String) {
                resolve({
                    id: generateUniqueId(),
                    data: base64String,
                    mediaType: file.type,
                    name: file.name,
                });
            } else {
                reject(new Error(`Failed to read file ${file.name} as base64.`));
            }
        };
        reader.onerror = (error) => {
            console.error("Error reading image file:", file.name, error);
            reject(error);
        };
        reader.readAsDataURL(file);
    });
}

export function useImageUpload() {
    const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageFileChange = useCallback((event: JSX.TargetedEvent<HTMLInputElement>) => {
        const files = event.currentTarget.files;
        const currentFileInput = fileInputRef.current; // Capture ref

        if (files && files.length > 0) {
            const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
            if (imageFiles.length === 0) {
                 setSelectedImages([]); // Clear if no valid images selected
                 if (currentFileInput) currentFileInput.value = '';
                 return;
            }

            const readPromises = imageFiles.map(readImageFile); // Use helper

            Promise.all(readPromises)
                .then(newImages => {
                    setSelectedImages(prevImages => [...prevImages, ...newImages]); // Append new images
                    console.log(`Added ${newImages.length} images.`);
                })
                .catch(error => {
                    console.error("Error processing selected images:", error);
                    // Optionally show an error message to the user
                })
                .finally(() => {
                     // Reset file input visually after processing is done
                     if (currentFileInput) {
                         currentFileInput.value = '';
                     }
                });

        } else {
            // If no files selected (e.g., user cancelled)
            if (currentFileInput) {
                currentFileInput.value = ''; // Reset file input visually
            }
        }
    }, []); // No dependencies needed as setSelectedImages is stable

    const triggerImageUpload = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const removeSelectedImage = useCallback((idToRemove: string) => {
        setSelectedImages(prevImages => prevImages.filter(img => img.id !== idToRemove));
    }, []);

    const clearSelectedImages = useCallback(() => {
         setSelectedImages([]);
         if (fileInputRef.current) {
             fileInputRef.current.value = '';
         }
    }, []);


    return {
        selectedImages,
        setSelectedImages, // Expose setter if needed externally (e.g., for handleSend clearing)
        fileInputRef,
        handleImageFileChange,
        triggerImageUpload,
        removeSelectedImage,
        clearSelectedImages // Expose clear function
    };
}