import { FunctionalComponent, JSX } from 'preact';
import { useState, useCallback } from 'preact/hooks';
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

export const ChatListPage: FunctionalComponent = () => {
    // --- Nanostores ---
    const chatSessions = useStore($chatSessions);
    // Removed activeChatId usage
    const isSessionsLoading = chatSessions === null;

    // --- State from Mutation Stores ---
    const { mutate: createMutate, loading: createLoading, error: createError } = useStore($createChat);
    const { mutate: deleteMutate, loading: deleteLoading, error: deleteError } = useStore($deleteChat);

    // Combine loading states for UI feedback
    const isActionLoading = createLoading || deleteLoading;

    // --- State for confirmation dialog ---
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [chatToDeleteId, setChatToDeleteId] = useState<string | null>(null);

    // --- Derived State ---
    const safeChatSessions: ChatSession[] = chatSessions ?? [];
    const sortedSessions = [...safeChatSessions].sort((a, b) => b.lastModified - a.lastModified);

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
            if (newSession) {
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
            await deleteMutate(idToDelete);
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
        <div class="p-4 flex flex-col h-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            <h1 class="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-gray-200">Chat Sessions</h1>
            <button
                onClick={handleCreateChat}
                disabled={isActionLoading || isSessionsLoading}
                class={`mb-6 w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition duration-150 ease-in-out ${isActionLoading ? 'opacity-60 cursor-not-allowed animate-pulse' : ''} ${isSessionsLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
                {isActionLoading ? 'Creating...' : (isSessionsLoading ? 'Loading Chats...' : 'Start New Chat')}
            </button>
            <div class="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                {isSessionsLoading && (
                     <p class="text-center text-gray-500 dark:text-gray-400 mt-10">Loading chats...</p>
                )}
                {!isSessionsLoading && sortedSessions.length === 0 && (
                    <p class="text-center text-gray-500 dark:text-gray-400 mt-10">No chat sessions found.</p>
                )}
                {!isSessionsLoading && sortedSessions.map((session: ChatSession) => (
                    <div
                        key={session.id}
                        // Removed activeChatId check for styling
                        class={`flex items-center justify-between p-3 rounded-lg shadow-sm cursor-pointer transition-all duration-150 ease-in-out border border-transparent bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 hover:shadow-md`}
                        onClick={() => handleSelectChat(session.id)}
                    >
                        <div class="flex-1 overflow-hidden mr-2">
                            <p class="font-medium text-gray-800 dark:text-gray-100 truncate" title={session.name}>
                                {session.name || `Chat ${session.id.substring(0, 8)}...`}
                            </p>
                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {new Date(session.lastModified).toLocaleString()}
                            </p>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(session.id);
                            }}
                            disabled={isActionLoading}
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
            {chatToDeleteId && (
                <ConfirmationDialog
                    show={showDeleteConfirm}
                    title="Confirm Delete Chat"
                    message={`Are you sure you want to delete the chat session "${safeChatSessions.find((s: ChatSession) => s.id === chatToDeleteId)?.name || chatToDeleteId}"? This cannot be undone.`}
                    onCancel={cancelDeleteChat}
                    onConfirm={confirmDeleteChat}
                    confirmText="Delete Chat"
                />
            )}
        </div>
    );
};
