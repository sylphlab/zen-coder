import { FunctionalComponent, JSX } from 'preact';
import { useState, useCallback, useMemo } from 'preact/hooks'; // Add useMemo back
import { useStore } from '@nanostores/react'; // Keep useStore
import { ChatSession } from '../../../src/common/types';
import { router } from '../stores/router'; // Restore router import
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
        router.open(newPath); // Restore router navigation
    }, []); // router dependency not needed

    const handleCreateChat = useCallback(async () => {
        console.log("[ChatListPage] Calling createMutate...");
        try {
            const newSession = await createMutate();
            console.log("[ChatListPage] createMutate returned:", newSession); // <-- Add log here
            if (newSession && newSession.id) { // Add check for newSession.id
                router.open(`/chat/${newSession.id}`); // Restore router navigation
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
        <div class="h-full flex flex-col">
            {/* Welcome header - more friendly and personal */}
            <div class="bg-[var(--vscode-editor-background)] flex flex-col">
                {/* Greeting and profile section */}
                <div class="px-4 pt-5 pb-4 flex items-center">
                    <div class="w-12 h-12 rounded-full bg-[var(--vscode-button-background)] bg-opacity-10 flex items-center justify-center mr-3">
                        <span class="i-carbon-chat-bot h-6 w-6 text-[var(--vscode-button-background)]"></span>
                    </div>
                    <div class="flex-1">
                        <h1 class="text-lg font-medium text-[var(--vscode-foreground)]">ZenCoder Chat</h1>
                        <p class="text-xs text-[var(--vscode-foreground)] opacity-70">Let's write some amazing code together</p>
                    </div>
                    <button
                        onClick={() => router.open('/settings')}
                        class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--vscode-button-hoverBackground)] transition-colors"
                        title="Settings"
                    >
                        <span class="i-carbon-settings-adjust h-5 w-5 text-[var(--vscode-foreground)] opacity-70"></span>
                    </button>
                </div>
            </div>
            
            {/* Main content with conversation style */}
            <div class="flex-1 overflow-y-auto px-4 pt-4 pb-12">
                {/* New conversation button - prominently displayed */}
                <div class="mb-6">
                    <Button
                        onClick={handleCreateChat}
                        loading={isActionLoading || isSessionsLoading || sessionsError}
                        disabled={isActionLoading || isSessionsLoading || sessionsError}
                        className="w-full bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] py-2.5 flex items-center justify-center gap-2 rounded-lg hover:bg-[var(--vscode-button-hoverBackground)] transition-colors"
                    >
                        <span class="i-carbon-chat h-4 w-4"></span>
                        New Conversation
                    </Button>
                </div>
                
                {/* Recently active heading - when chats exist */}
                {!isSessionsLoading && !sessionsError && Array.isArray(chatSessions) && sortedSessions.length > 0 && (
                    <div class="mb-4 px-2">
                        <h2 class="text-sm font-medium text-[var(--vscode-foreground)] opacity-90">Recent Conversations</h2>
                    </div>
                )}
                {/* Loading state - Made like a conversation bubble */}
                {isSessionsLoading && (
                    <div class="max-w-md mx-auto mt-6 p-4">
                        <div class="flex items-start gap-3">
                            <div class="w-8 h-8 rounded-full bg-[var(--vscode-button-background)] bg-opacity-20 flex items-center justify-center flex-shrink-0">
                                <span class="i-carbon-chat-bot h-4 w-4 text-[var(--vscode-button-background)] animate-pulse"></span>
                            </div>
                            <div class="bg-[var(--vscode-editorWidget-background)] rounded-lg p-4 shadow-sm flex flex-col items-center">
                                <div class="w-8 h-8 animate-spin mb-2">
                                    <span class="i-carbon-progress-bar h-8 w-8 text-[var(--vscode-progressBar-background)]"></span>
                                </div>
                                <p class="text-sm text-[var(--vscode-foreground)]">Finding your conversations...</p>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Error state - Conversational style */}
                {sessionsError && (
                    <div class="max-w-md mx-auto mt-6 p-4">
                        <div class="flex items-start gap-3">
                            <div class="w-8 h-8 rounded-full bg-[var(--vscode-errorForeground)] bg-opacity-20 flex items-center justify-center flex-shrink-0">
                                <span class="i-carbon-face-dizzy h-4 w-4 text-[var(--vscode-errorForeground)]"></span>
                            </div>
                            <div class="bg-[var(--vscode-inputValidation-errorBackground)] rounded-lg p-4 shadow-sm">
                                <p class="text-sm text-[var(--vscode-inputValidation-errorForeground)] mb-3">
                                    I'm having trouble finding your conversations right now. Sorry about that!
                                </p>
                                <Button
                                    onClick={() => window.location.reload()}
                                    className="bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] text-xs py-1.5 px-3"
                                >
                                    <span class="i-carbon-reset h-3.5 w-3.5 mr-1"></span>
                                    Try again
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Empty state - Conversational design */}
                {!isSessionsLoading && !sessionsError && sortedSessions.length === 0 && (
                    <div class="max-w-md mx-auto mt-8 p-4">
                        <div class="flex items-start gap-3">
                            <div class="w-10 h-10 rounded-full bg-[var(--vscode-button-background)] bg-opacity-20 flex items-center justify-center flex-shrink-0 mt-1">
                                <span class="i-carbon-chat-bot h-5 w-5 text-[var(--vscode-button-background)]"></span>
                            </div>
                            <div class="bg-[var(--vscode-editorWidget-background)] rounded-lg p-4 shadow-sm">
                                <p class="text-sm text-[var(--vscode-foreground)] mb-3">
                                    Hi there! I'm your coding assistant. Let's start a conversation about your code!
                                </p>
                                <p class="text-xs text-[var(--vscode-foreground)] opacity-70 mb-4">
                                    I can help with debugging, optimizing code, explaining concepts, or generating new code for your projects.
                                </p>
                                <div class="flex justify-center">
                                    <Button
                                        onClick={handleCreateChat}
                                        className="bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] px-4 py-1.5"
                                    >
                                        <span class="i-carbon-chat h-4 w-4 mr-2"></span>
                                        Let's get started
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Chat list - Conversation bubble style */}
                {!isSessionsLoading && !sessionsError && Array.isArray(chatSessions) && sortedSessions.length > 0 && (
                    <div class="space-y-3">
                        {sortedSessions.map((session: ChatSession) => {
                            // Calculate relative time
                            const relativeTime = typeof session?.lastModified === 'number'
                                ? (() => {
                                    const now = new Date();
                                    const date = new Date(session.lastModified);
                                    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
                                    
                                    if (diffDays === 0) {
                                        // If today, show the time
                                        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                                    }
                                    if (diffDays === 1) return 'Yesterday';
                                    if (diffDays < 7) return `${diffDays} days ago`;
                                    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                                })()
                                : 'Unknown date';
                                
                            return (
                                <div
                                    key={session?.id || `invalid-${Math.random()}`}
                                    class="bg-[var(--vscode-editorWidget-background)] rounded-lg shadow-sm hover:shadow transition-all duration-150 overflow-hidden cursor-pointer"
                                    onClick={() => handleSelectChat(session.id)}
                                >
                                    <div class="p-3">
                                        <div class="flex justify-between items-start mb-2">
                                            <div class="flex items-center gap-2">
                                                <div class="w-8 h-8 rounded-full bg-[var(--vscode-button-background)] bg-opacity-10 flex-shrink-0 flex items-center justify-center">
                                                    <span class="i-carbon-chat-bot h-4 w-4 text-[var(--vscode-button-background)]"></span>
                                                </div>
                                                <div>
                                                    <h3 class="font-medium text-sm text-[var(--vscode-foreground)]" title={session?.name || 'Unnamed Chat'}>
                                                        {session?.name || `Chat ${typeof session?.id === 'string' ? session.id.substring(0, 6) : '???'}`}
                                                    </h3>
                                                    <div class="text-xs text-[var(--vscode-foreground)] opacity-60 mt-0.5">
                                                        {relativeTime}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (session?.id) {
                                                        handleDeleteClick(session.id);
                                                    }
                                                }}
                                                disabled={isActionLoading || !session?.id}
                                                class="opacity-0 hover:opacity-100 group-hover:opacity-100 p-1 rounded-full hover:bg-[var(--vscode-inputValidation-errorBackground)] transition-all duration-200"
                                                aria-label={`Delete chat ${session?.name || session?.id || 'invalid session'}`}
                                                title={`Delete chat ${session?.name || session?.id || 'invalid session'}`}
                                            >
                                                <span class="i-carbon-trash-can h-3.5 w-3.5 text-[var(--vscode-errorForeground)]"></span>
                                            </button>
                                        </div>
                                        
                                        <div class="pl-10">
                                            <div class="border-l-2 border-[var(--vscode-button-background)] border-opacity-20 pl-2 py-1 mb-2">
                                                <div class="text-xs text-[var(--vscode-foreground)] opacity-70 italic">
                                                    {/* Preview of the last message */}
                                                    Last discussed coding assistance and project structure
                                                </div>
                                            </div>
                                            
                                            {session?.config?.modelId && (
                                                <div class="flex justify-end">
                                                    <span class="text-xs px-2 py-0.5 rounded-full bg-[var(--vscode-button-background)] bg-opacity-10 text-[var(--vscode-foreground)] opacity-60">
                                                        {session.config.modelId}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            {/* CSS for 2-line truncation */}
            <style jsx>{`
                .truncate-2-lines {
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
            `}</style>
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
