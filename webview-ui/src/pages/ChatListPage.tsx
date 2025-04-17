import { FunctionalComponent, JSX } from 'preact';
import { useState, useCallback, useMemo } from 'preact/hooks'; // Add useMemo back
import { useStore } from '@nanostores/react'; // Keep useStore
import { ChatSession } from '../../../src/common/types';
import { router } from '../stores/router';
// Import mutation stores ONLY
import {
    $chatSessions,
    $createChat,
    $deleteChat
} from '../stores/chatStores'; // Ensure activeChatIdAtom is NOT imported
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import { Button } from '../components/ui/Button';

export const ChatListPage: FunctionalComponent = () => {
    // --- Nanostores ---
    const chatSessions = useStore($chatSessions); // Can be ChatSession[] | null | 'loading' | 'error'
    const isSessionsLoading = chatSessions === 'loading';
    const sessionsError = chatSessions === 'error';

    // --- State from Mutation Stores ---
    const { mutate: createMutate, loading: createLoading, error: createError } = useStore($createChat);
    const { mutate: deleteMutate, loading: deleteLoading, error: deleteError } = useStore($deleteChat);

    // Combine loading states for UI feedback
    const isActionLoading = createLoading || deleteLoading;

    // --- State for confirmation dialog ---
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [chatToDeleteId, setChatToDeleteId] = useState<string | null>(null);

    // --- Derived State ---
    // Calculate sortedSessions only when chatSessions is an array
    const sortedSessions = useMemo(() => {
        if (Array.isArray(chatSessions)) {
            return [...chatSessions].sort((a, b) => b.lastModified - a.lastModified);
        }
        return []; // Return empty array for loading, error, or null states
    }, [chatSessions]);


    // --- Event Handlers ---
    const handleSelectChat = useCallback((chatId: string) => {
        const newPath = `/chat/${chatId}`;
        console.log(`[ChatListPage] Navigating to chat ${chatId}.`);
        router.open(newPath);
    }, []); // router dependency not needed

    const handleCreateChat = useCallback(async () => {
        console.log("[ChatListPage] Calling createMutate...");
        try {
            const newSession = await createMutate();
            console.log("[ChatListPage] createMutate returned:", newSession); // <-- Add log here
            if (newSession && newSession.id) { // Add check for newSession.id
                router.open(`/chat/${newSession.id}`);
            }
        } catch (error) {
            console.error("Failed to create chat:", error);
            // TODO: Show error message
        }
    }, [createMutate]);

    const handleDeleteClick = useCallback((sessionId: string) => {
        setChatToDeleteId(sessionId);
        setShowDeleteConfirm(true);
    }, []);

    const confirmDeleteChat = useCallback(async () => {
        if (!chatToDeleteId) return;

        const idToDelete = chatToDeleteId;
        setShowDeleteConfirm(false);
        setChatToDeleteId(null);
        console.log(`[ChatListPage] Calling deleteMutate for ${idToDelete}`);

        try {
            await deleteMutate({ chatId: idToDelete }); // Pass payload object
            console.log(`[ChatListPage] Delete mutation for ${idToDelete} completed.`);
        } catch (error) {
            console.error(`Error deleting chat ${idToDelete}:`, error);
            // TODO: Show error message
        }
    }, [chatToDeleteId, deleteMutate]);

    const cancelDeleteChat = useCallback(() => {
        setShowDeleteConfirm(false);
        setChatToDeleteId(null);
    }, []);

    // --- Render ---
    return (
        <div class="p-4 flex flex-col h-full bg-transparent text-gray-900 dark:text-gray-100">
            <div class="sticky top-0 z-10 bg-transparent shadow-md rounded-lg p-4 mb-4 flex flex-col items-center">
            <h1 class="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-gray-200">Chat Sessions</h1>
                <Button
                    onClick={handleCreateChat}
                    loading={isActionLoading || isSessionsLoading || sessionsError} // Show loading state
                    disabled={isActionLoading || isSessionsLoading || sessionsError} // Disable if loading or error
                    class={`mb-6 w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition duration-150 ease-in-out ${isActionLoading ? 'opacity-60 cursor-not-allowed animate-pulse' : ''} ${(isSessionsLoading || sessionsError) ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    Start New Chat
                </Button>
            </div>
            <div class="flex-1 space-y-3 pr-2 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                {isSessionsLoading && (
                     <p class="text-center text-gray-500 dark:text-gray-400 mt-10">Loading chats...</p>
                )}
                 {sessionsError && (
                     <p class="text-center text-red-500 dark:text-red-400 mt-10">Error loading chat sessions.</p>
                 )}
                {!isSessionsLoading && !sessionsError && sortedSessions.length === 0 && (
                    <p class="text-center text-gray-500 dark:text-gray-400 mt-10">No chat sessions found.</p>
                )}
                {/* Render list only if not loading, no error, AND chatSessions is confirmed as an array */}
                {!isSessionsLoading && !sessionsError && Array.isArray(chatSessions) && sortedSessions.map((session: ChatSession) => (
                    <div
                        key={session?.id || `invalid-${Math.random()}`} // Use fallback key if id is missing
                        class={`flex items-center justify-between p-3 rounded-lg shadow-sm cursor-pointer transition-all duration-150 ease-in-out border border-transparent bg-transparent hover:bg-[var(--vscode-list-hoverBackground)] hover:shadow-md`}
                        onClick={() => handleSelectChat(session.id)}
                    >
                        <div class="flex-1 overflow-hidden mr-2">
                            {/* More robust display logic */}
                            <p class="font-medium text-gray-800 dark:text-gray-100 truncate" title={session?.name || 'Unnamed Chat'}>
                                {session?.name || `Chat ${typeof session?.id === 'string' ? session.id.substring(0, 8) : '???' }...`}
                            </p>
                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {typeof session?.lastModified === 'number' ? new Date(session.lastModified).toLocaleString() : 'Invalid Date'}
                            </p>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                // Only allow delete if session.id is valid
                                if (session?.id) {
                                    handleDeleteClick(session.id);
                                }
                            }}
                            disabled={isActionLoading || !session?.id} // Disable if no valid id
                            class={`p-1.5 text-red-500 hover:text-red-700 dark:hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 rounded-full transition-colors ${(isActionLoading || !session?.id) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-100/20 dark:hover:bg-red-900/20'}`}
                            aria-label={`Delete chat ${session?.name || session?.id || 'invalid session'}`}
                            title={`Delete chat ${session?.name || session?.id || 'invalid session'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                ))}
            </div>
            {chatToDeleteId && (
                <ConfirmationDialog
                    show={showDeleteConfirm}
                    title="Confirm Delete Chat"
                    // Safer check for session name in message
                    message={`Are you sure you want to delete the chat session "${(Array.isArray(chatSessions) && chatSessions.find(s => s.id === chatToDeleteId)?.name) || chatToDeleteId}"? This cannot be undone.`}
                    onCancel={cancelDeleteChat}
                    onConfirm={confirmDeleteChat}
                    confirmText="Delete Chat"
                />
            )}
        </div>
    );
};
