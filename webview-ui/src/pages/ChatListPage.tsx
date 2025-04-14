import { FunctionalComponent, JSX } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import { useAtomValue, useSetAtom } from 'jotai';
import { useLocation } from 'wouter';
import { ChatSession } from '../../../src/common/types';
import { requestData } from '../utils/communication';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import {
    chatSessionsAtom,
    activeChatIdAtom,
    isChatListLoadingAtom,
    updateLocationAtom // Import atom setter
} from '../store/atoms';

// Removed ChatListPageProps interface

export const ChatListPage: FunctionalComponent = () => {
    // --- Hooks ---
    const [, setLocation] = useLocation();
    const updateLocation = useSetAtom(updateLocationAtom); // Get atom setter
    const chatSessions = useAtomValue(chatSessionsAtom);
    const activeChatId = useAtomValue(activeChatIdAtom);
    const isLoading = useAtomValue(isChatListLoadingAtom);
    const setIsLoading = useSetAtom(isChatListLoadingAtom);

    // --- State for confirmation dialog ---
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [chatToDeleteId, setChatToDeleteId] = useState<string | null>(null);

    // --- Derived State ---
    // Ensure chatSessions is treated as an array, even if null initially
    const safeChatSessions = chatSessions ?? [];
    const sortedSessions = [...safeChatSessions].sort((a, b) => b.lastModified - a.lastModified);

    // --- Event Handlers (Internal + Backend Sync) ---
    const handleSelectChat = useCallback((chatId: string) => {
        const newPath = `/chat/${chatId}`;
        console.log(`[ChatListPage] Navigating to chat: ${chatId}`);
        setLocation(newPath);
        updateLocation(newPath); // Sync backend
    }, [setLocation, updateLocation]);

    const handleCreateChat = useCallback(() => {
        console.log("[ChatListPage] Requesting new chat creation...");
        setIsLoading(true);
        requestData<{ newChatId: string }>('createChat')
            .then(response => {
                if (response?.newChatId) {
                     const newPath = `/chat/${response.newChatId}`;
                     console.log(`[ChatListPage] Navigating to newly created chat: ${response.newChatId}`);
                     setLocation(newPath);
                     updateLocation(newPath); // Sync backend
                }
            })
            .catch(error => console.error('Error creating chat:', error))
            .finally(() => setIsLoading(false));
    }, [setIsLoading, setLocation, updateLocation]);

    const handleDeleteClick = useCallback((sessionId: string) => {
        setChatToDeleteId(sessionId);
        setShowDeleteConfirm(true);
    }, []);

    const confirmDeleteChat = useCallback(() => {
        if (chatToDeleteId) {
            console.log(`[ChatListPage] Requesting delete chat: ${chatToDeleteId}`);
            setIsLoading(true);
            requestData('deleteChat', { chatId: chatToDeleteId })
                .then(() => {
                    console.log(`[ChatListPage] Chat ${chatToDeleteId} delete request sent.`);
                    // No need to navigate away here, App.tsx handles routing based on activeChatId if needed
                    // If needed, could check if chatToDeleteId === activeChatId and navigate to /chats
                })
                .catch(error => console.error(`Error deleting chat ${chatToDeleteId}:`, error))
                .finally(() => setIsLoading(false));
        }
        setShowDeleteConfirm(false);
        setChatToDeleteId(null);
    }, [chatToDeleteId, setIsLoading]);

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
                disabled={isLoading} // Disable button when loading
                class={`mb-6 w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition duration-150 ease-in-out ${isLoading ? 'opacity-60 cursor-not-allowed animate-pulse' : ''}`}
            >
                {isLoading ? 'Creating...' : 'Start New Chat'} {/* Adjusted loading text */}
            </button>
            <div class="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent"> {/* Added scrollbar styling */}
                {sortedSessions.length === 0 && !isLoading && ( // Show only if not loading
                    <p class="text-center text-gray-500 dark:text-gray-400 mt-10">No chat sessions found.</p>
                )}
                {sortedSessions.map((session) => (
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
                            disabled={isLoading} // Keep disabling when loading
                            class={`p-1.5 text-red-500 hover:text-red-700 dark:hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 rounded-full transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-100 dark:hover:bg-red-900/50'}`}
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
                    // Use safeChatSessions here as well
                    message={`Are you sure you want to delete the chat session "${safeChatSessions.find(s => s.id === chatToDeleteId)?.name || chatToDeleteId}"? This cannot be undone.`}
                    onCancel={cancelDeleteChat}
                    onConfirm={confirmDeleteChat}
                    confirmText="Delete Chat"
                />
            )}
        </div>
    );
};
