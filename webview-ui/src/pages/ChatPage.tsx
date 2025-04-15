import { FunctionalComponent } from 'preact';
import { useEffect, useMemo } from 'preact/hooks';
import { useStore } from '@nanostores/react';
import { router } from '../stores/router';
import { $chatSessions } from '../stores/chatStores';
import { ChatView } from '../components/ChatView';
// Removed $activeChatHistory import as ChatView handles its own loading

export const ChatPage: FunctionalComponent = () => {
  // Get route params and store states
  const page = useStore(router);
  const sessions = useStore($chatSessions); // sessions can be: ChatSession[] | null | 'loading' | 'error'

  const chatId = page?.route === 'chat' ? page.params.chatId : null;
  const isLoadingSessions = sessions === 'loading'; // Correct loading check
  const sessionsError = sessions === 'error'; // Check for error state

  // Derived state: Find current chat session *only* if sessions is an array
  const currentChat = useMemo(() => {
      // Only try to find if sessions is an array and we have a chatId
      if (Array.isArray(sessions) && chatId) {
          console.log(`[ChatPage deriveChat] Finding chat ${chatId} in ${sessions.length} sessions.`);
          return sessions.find(s => s.id === chatId) ?? null;
      }
      // Return null if loading, error, or no chatId
      return null;
  }, [sessions, chatId]);

  // Redirect effect: Check after loading/error state is resolved.
  useEffect(() => {
    console.log(`[ChatPage Effect Redirect] Check Running. chatId=${chatId}, isLoading=${isLoadingSessions}, isError=${sessionsError}, currentChatFound=${!!currentChat}`);
    // Redirect if:
    // 1. Loading is complete AND there's no error.
    // 2. We have a valid chat ID from the route.
    // 3. The session for this ID was NOT found in the loaded sessions array.
    if (chatId && !isLoadingSessions && !sessionsError && currentChat === null && Array.isArray(sessions)) {
      console.log(`[ChatPage Effect Redirect] Sessions loaded without error, session ${chatId} not found. REDIRECTING.`);
      router.open('/');
    }
  }, [isLoadingSessions, currentChat, chatId]); // Depend on sessions loading and derived chat


  // Render Logic
  if (!chatId) {
    console.error("[ChatPage] Render: No chatId found in route params. This shouldn't normally happen.");
    return <div class="p-6 text-center text-red-500">Error: Invalid Chat Route - No Chat ID found.</div>;
  }

  // Show loading indicator
  if (isLoadingSessions) {
      console.log(`[ChatPage Render] Showing loading indicator.`);
      return <div class="p-6 text-center text-gray-500 dark:text-gray-400">Loading chat session...</div>;
  }

  // Show error message
  if (sessionsError) {
      console.error(`[ChatPage Render] Showing error message.`);
      return <div class="p-6 text-center text-red-500 dark:text-red-400">Error loading chat sessions. Please check console or try refreshing.</div>;
  }

  // Show message if sessions loaded but the specific chat wasn't found (before redirect kicks in)
  if (currentChat === null) {
       console.log(`[ChatPage Render] Chat session ${chatId} not found after loading. Waiting for redirect or state update.`);
       // Avoid showing an error immediately, wait for redirect effect
       return <div class="p-6 text-center text-gray-500 dark:text-gray-400">Loading chat...</div>;
   }

  // All clear: sessions loaded without error, chat found -> render ChatView
  console.log(`[ChatPage Render] Rendering ChatView for ${chatId}`);
  // Pass the validated chatId to ChatView
  return <ChatView chatIdFromRoute={chatId} />;
};
