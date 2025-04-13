import { FunctionalComponent } from 'preact';
import { useState, useCallback } from 'preact/hooks'; // Import useState and useCallback
import { ChatSession } from '../../../src/common/types'; // Import common type
import { ConfirmationDialog } from '../components/ConfirmationDialog'; // Import the dialog component
interface ChatListPageProps {
    chatSessions: ChatSession[];
    activeChatId: string | null;
    onSelectChat: (chatId: string) => void;
    onCreateChat: () => void;
    onDeleteChat: (chatId: string) => void;
    isLoading: boolean; // Add isLoading prop
    // Add navigation function if needed, e.g., back to chat view
    // onNavigate: (path: string) => void;
}

export const ChatListPage: FunctionalComponent<ChatListPageProps> = ({
    chatSessions,
    activeChatId,
    onSelectChat,
    onCreateChat,
    onDeleteChat,
    isLoading, // Destructure isLoading
}) => {

    // State for confirmation dialog
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [chatToDeleteId, setChatToDeleteId] = useState<string | null>(null);

    // Sort chats by last modified date (newest first)
    const sortedSessions = [...chatSessions].sort((a, b) => b.lastModified - a.lastModified);

    // Handlers for confirmation dialog
    const handleDeleteClick = useCallback((sessionId: string) => {
        setChatToDeleteId(sessionId);
        setShowDeleteConfirm(true);
    }, []);

    const confirmDeleteChat = useCallback(() => {
        if (chatToDeleteId) {
            onDeleteChat(chatToDeleteId);
        }
        setShowDeleteConfirm(false);
        setChatToDeleteId(null);
    }, [chatToDeleteId, onDeleteChat]);

    const cancelDeleteChat = useCallback(() => {
        setShowDeleteConfirm(false);
        setChatToDeleteId(null);
    }, []);
    return (
        <div class="p-4 flex flex-col h-full bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100"> {/* Match app background */}
            <h1 class="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-gray-200">Chat Sessions</h1> {/* Larger title, centered */}
            <button
                onClick={onCreateChat}
                disabled={isLoading} // Disable button when loading
                class={`mb-6 w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition duration-150 ease-in-out ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
                {isLoading ? 'Processing...' : 'Start New Chat'} {/* Slightly more descriptive */}
            </button>
            <div class="flex-1 overflow-y-auto space-y-3 pr-2"> {/* Add padding-right for scrollbar */}
                {sortedSessions.length === 0 && !isLoading && ( // Show only if not loading
                    <p class="text-center text-gray-500 dark:text-gray-400 mt-10">No chat sessions yet. Start one!</p>
                )}
                {sortedSessions.map((session) => (
                    <div
                        key={session.id}
                        class={`flex items-center justify-between p-3 rounded-lg shadow-sm cursor-pointer transition-all duration-150 ease-in-out ${
                            session.id === activeChatId
                                ? 'bg-blue-200 dark:bg-blue-800 ring-2 ring-blue-500 scale-105' // More prominent active state
                                : 'bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 hover:shadow-md'
                        }`}
                        onClick={() => onSelectChat(session.id)}
                    >
                        <div class="flex-1 overflow-hidden mr-2">
                            <p class="font-semibold text-gray-800 dark:text-gray-100 truncate" title={session.name}> {/* Bolder title */}
                                {session.name || `Chat ${session.id.substring(0, 6)}`}
                            </p>
                            <p class="text-xs text-gray-600 dark:text-gray-400 mt-0.5"> {/* Slightly darker text */}
                                {new Date(session.lastModified).toLocaleString()}
                            </p>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation(); // Prevent triggering onSelectChat
                                handleDeleteClick(session.id); // Trigger confirmation dialog
                            }}
                            disabled={isLoading} // Disable button when loading
                            class={`p-1.5 text-red-500 hover:text-red-700 dark:hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 rounded-full transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} // Slightly larger padding, better focus
                            aria-label={`Delete chat ${session.name}`}
                            title={`Delete chat ${session.name}`}
                        >
                            {/* Simple X icon for delete */}
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"> {/* Slightly larger icon */}
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                ))}
            </div>
            {/* Confirmation Dialog - Moved inside the main div */}
            <ConfirmationDialog
                show={showDeleteConfirm}
                title="Confirm Delete Chat"
                message={`Are you sure you want to delete the chat session "${chatSessions.find(s => s.id === chatToDeleteId)?.name || 'this chat'}"? This cannot be undone.`}
                onCancel={cancelDeleteChat}
                onConfirm={confirmDeleteChat}
                confirmText="Delete Chat"
            />
        </div> // This is the correct closing tag for the main div started on line 49
    );
};