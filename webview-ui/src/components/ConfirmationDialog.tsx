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
        <div class="fixed inset-0 bg-[var(--vscode-editor-background)] bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onCancel}>
            {/* Chat-style confirmation dialog */}
            <div class="max-w-md w-full mx-auto px-4" onClick={(e) => e.stopPropagation()}>
                {/* ZenCoder's confirmation message */}
                <div class="flex items-start mb-6 transform translate-y-4 animate-[fadeIn_0.25s_ease-out_forwards]" style={{ opacity: 0 }}>
                    <div class="w-10 h-10 rounded-full bg-[var(--vscode-button-background)] bg-opacity-20 flex items-center justify-center flex-shrink-0 mt-1">
                        <span class="i-carbon-warning-filled h-5 w-5 text-[var(--vscode-notificationsWarningIcon)]"></span>
                    </div>
                    <div class="ml-4 bg-[var(--vscode-editorWidget-background)] rounded-lg p-4 shadow-lg max-w-[85%]">
                        <div class="flex items-center mb-2">
                            <span class="bg-[var(--vscode-notificationsWarningIcon)] bg-opacity-10 px-2 py-0.5 rounded-full text-xs font-medium text-[var(--vscode-notificationsWarningIcon)]">
                                Confirmation Needed
                            </span>
                        </div>
                        <h3 class="text-base font-medium text-[var(--vscode-foreground)] mb-2">{title}</h3>
                        <p class="text-sm text-[var(--vscode-foreground)] opacity-80 mb-4">{message}</p>
                        <div class="flex space-x-3">
                            <Button
                                variant="secondary"
                                onClick={onCancel}
                                className="bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] border-none"
                            >
                                <span class="i-carbon-close-outline h-4 w-4 mr-1.5"></span>
                                {cancelText}
                            </Button>
                            <Button
                                variant="primary"
                                onClick={onConfirm}
                                className="bg-[var(--vscode-notificationsErrorIcon)] text-white hover:bg-opacity-90"
                            >
                                <span class="i-carbon-trash-can h-4 w-4 mr-1.5"></span>
                                {confirmText}
                            </Button>
                        </div>
                    </div>
                </div>
                
                {/* Adding additional styling */}
                <style jsx>{`
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `}</style>
            </div>
        </div>
    );
};