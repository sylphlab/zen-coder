import { FunctionalComponent } from 'preact';
import { Button } from './ui/Button'; // Import the Button component

interface ConfirmationDialogProps {
    show: boolean;
    title: string;
    message: string;
    onCancel: () => void;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
}

export const ConfirmationDialog: FunctionalComponent<ConfirmationDialogProps> = ({
    show,
    title,
    message,
    onCancel,
    onConfirm,
    confirmText = "Confirm",
    cancelText = "Cancel"
}) => {
    if (!show) {
        return null;
    }

    return (
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onCancel}>
            <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-sm mx-auto" onClick={(e) => e.stopPropagation()}>
                <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">{title}</h3>
                <p class="mb-6 text-gray-700 dark:text-gray-300">{message}</p>
                <div class="flex justify-end space-x-3">
                    {/* Use Button component for Cancel */}
                    <Button variant="secondary" onClick={onCancel}>
                        {cancelText}
                    </Button>
                    {/* Use Button component for Confirm, potentially with a destructive variant */}
                    <Button variant="primary" onClick={onConfirm} className="bg-red-600 hover:bg-red-700"> {/* Override primary for destructive */}
                        {confirmText}
                    </Button>
                </div>
            </div>
        </div>
    );
};