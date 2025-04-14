import { FunctionalComponent, JSX } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import { useStore } from '@nanostores/react'; // Keep useStore
import { ChatSession } from '../../../src/common/types';
import { router } from '../stores/router';
// Import atoms AND the mutation stores
import {
    $chatSessions, // Renamed import
    activeChatIdAtom,
    $createChat, // Correctly import the mutation store
    $deleteChat  // Correctly import the mutation store
} from '../stores/chatStores';
// Remove direct requestData import if no longer needed directly
// import { requestData } from '../utils/communication';
import { ConfirmationDialog } from '../components/ConfirmationDialog';

// Removed ChatListPageProps interface
export const ChatListPage: FunctionalComponent = () => {
    // --- Nanostores ---
    const chatSessions = useStore($chatSessions); // Use renamed atom
    const activeChatId = useStore(activeChatIdAtom);
    const isSessionsLoading = chatSessions === null;

    // --- State from Mutation Stores ---
    // Use useStore on the mutation stores to get { mutate, loading, error }
    const { mutate: createMutate, loading: createLoading, error: createError } = useStore($createChat);
    const { mutate: deleteMutate, loading: deleteLoading, error: deleteError } = useStore($deleteChat);

    // Combine loading states for UI feedback
    const isActionLoading = createLoading || deleteLoading;

    // --- State for confirmation dialog ---
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [chatToDeleteId, setChatToDeleteId] = useState<string | null>(null);

    // --- Derived State ---
    // Ensure chatSessions is treated as an array, even if null initially
    const safeChatSessions: ChatSession[] = chatSessions ?? []; // Use the destructured chatSessions
    const sortedSessions = [...safeChatSessions].sort((a, b) => b.lastModified - a.lastModified);

    // --- Event Handlers ---
    const handleSelectChat = useCallback((chatId: string) => {
        const newPath = `/chat/${chatId}`;
        console.log(`[ChatListPage] Setting active chat ${chatId} and navigating.`);
        // Set active chat using the atom's set method
        activeChatIdAtom.set(chatId); // Use atom.set()
        // Navigate using the router
        router.open(newPath);
    }, []); // No dependencies needed

    // Use the mutate function obtained from useStore($createChat)
    const handleCreateChat = useCallback(async () => {
        console.log("[ChatListPage] Calling createMutate...");
        // Loading state is handled by the store via useStore
        try {
            const newSession = await createMutate(); // Use the destructured mutate function
            if (newSession) {
                // Navigate after successful mutation
                router.open(`/chat/${newSession.id}`);
            }
        } catch (error) {
            console.error("Failed to create chat:", error); // Error is also in createError from useStore($createChat)
            // TODO: Show error message to user (e.g., using a toast notification based on createError)
        }
        // No finally block needed
    }, [createMutate]); // Depend on the specific mutate function

    const handleDeleteClick = useCallback((sessionId: string) => {
        setChatToDeleteId(sessionId);
        setShowDeleteConfirm(true);
    }, []);

    // Use the mutate function obtained from useStore($deleteChat)
    const confirmDeleteChat = useCallback(async () => {
        if (!chatToDeleteId) return;

        const idToDelete = chatToDeleteId;
        setShowDeleteConfirm(false);
        setChatToDeleteId(null);
        // Loading state handled by the store via useStore
        console.log(`[ChatListPage] Calling deleteMutate for ${idToDelete}`);

        try {
            await deleteMutate(idToDelete); // Use the destructured mutate function
            console.log(`[ChatListPage] Delete mutation for ${idToDelete} completed.`);
            // Active chat ID clearing and optimistic removal are handled within the store/action definition
        } catch (error) {
            console.error(`Error deleting chat ${idToDelete}:`, error); // Error is also in deleteError from useStore($deleteChat)
            // Rollback is handled by the store.
            // TODO: Show error message to user
        }
        // No finally block needed
    }, [chatToDeleteId, deleteMutate]); // Depend on the specific mutate function

    const cancelDeleteChat = useCallback(() => {
        setShowDeleteConfirm(false);
        setChatToDeleteId(null);
    }, []);

    // --- Render ---
    return (
        <div class="p-4 flex flex-col h-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"> {/* Slightly darker dark background */}
            <h1 class="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-gray-200">Chat Sessions</h1> {/* Larger title, centered */}
            <button
                onClick={handleCreateChat} // Use internal handler
                disabled={isActionLoading || isSessionsLoading} // Disable button when performing action or sessions are loading
                class={`mb-6 w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition duration-150 ease-in-out ${isActionLoading ? 'opacity-60 cursor-not-allowed animate-pulse' : ''} ${isSessionsLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
                {isActionLoading ? 'Creating...' : (isSessionsLoading ? 'Loading Chats...' : 'Start New Chat')} {/* Adjusted loading text */}
            </button>
            <div class="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent"> {/* Added scrollbar styling */}
                {isSessionsLoading && ( // Show loading indicator while sessions are loading
                     <p class="text-center text-gray-500 dark:text-gray-400 mt-10">Loading chats...</p>
                )}
                {!isSessionsLoading && sortedSessions.length === 0 && ( // Show only if not loading and no sessions
                    <p class="text-center text-gray-500 dark:text-gray-400 mt-10">No chat sessions found.</p>
                )}
                {!isSessionsLoading && sortedSessions.map((session: ChatSession) => ( // Add explicit type for session
                    <div
                        key={session.id}
                        class={`flex items-center justify-between p-3 rounded-lg shadow-sm cursor-pointer transition-all duration-150 ease-in-out border border-transparent ${ // Added border
                            session.id === activeChatId
                                ? 'bg-blue-100 dark:bg-blue-900 border-blue-500 dark:border-blue-700 shadow-lg' // Adjusted active state colors and shadow
                                : 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 hover:shadow-md'
                        }`}
                        onClick={() => handleSelectChat(session.id)} // Use internal handler
                    >
                        <div class="flex-1 overflow-hidden mr-2">
                            <p class="font-medium text-gray-800 dark:text-gray-100 truncate" title={session.name}> {/* Changed font-semibold to font-medium */}
                                {session.name || `Chat ${session.id.substring(0, 8)}...`} {/* Adjusted fallback name */}
                            </p>
                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5"> {/* Adjusted text color */}
                                {new Date(session.lastModified).toLocaleString()}
                            </p>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation(); // Prevent triggering onSelectChat
                                handleDeleteClick(session.id); // Trigger confirmation dialog
                            }}
                            disabled={isActionLoading} // Disable only when an action is in progress
                            class={`p-1.5 text-red-500 hover:text-red-700 dark:hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 rounded-full transition-colors ${isActionLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-100 dark:hover:bg-red-900/50'}`}
                            aria-label={`Delete chat ${session.name || session.id}`}
                            title={`Delete chat ${session.name || session.id}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                ))}
            </div>
            {/* Confirmation Dialog - Moved inside the main div */}
            {chatToDeleteId && ( // Conditionally render dialog
                <ConfirmationDialog
                    show={showDeleteConfirm}
                    title="Confirm Delete Chat"
                    message={`Are you sure you want to delete the chat session "${safeChatSessions.find((s: ChatSession) => s.id === chatToDeleteId)?.name || chatToDeleteId}"? This cannot be undone.`} // Add type for s
                    onCancel={cancelDeleteChat}
                    onConfirm={confirmDeleteChat}
                    confirmText="Delete Chat"
                />
            )}
        </div>
    );
};
