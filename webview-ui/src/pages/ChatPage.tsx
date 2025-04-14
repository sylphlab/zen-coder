import { FunctionalComponent } from 'preact';
import { useEffect } from 'preact/hooks'; // Import useEffect
import { useStore } from '@nanostores/react';
import { router } from '../stores/router'; // Import router to get params
import { $chatSessions } from '../stores/chatStores'; // Import chat sessions store
import { ChatView } from '../components/ChatView'; // Import the actual chat view component

// Define props if route params are passed as props (depends on router setup)
// Assuming params are accessed via router.params for now
interface ChatPageProps {
  // chatId?: string; // If passed as prop
}

export const ChatPage: FunctionalComponent<ChatPageProps> = (props) => {
  // Get chat ID from route parameters
  const page = useStore(router);
  const chatId = page?.route === 'chat' ? page.params.chatId : null;

  // Get chat sessions state
  const sessions = useStore($chatSessions);
  const isLoadingSessions = sessions === null;

  // Find the current chat session
  const currentChat = chatId && sessions ? sessions.find(s => s.id === chatId) : null;

  // Redirect logic (might be better placed higher up, e.g., in App.tsx effect)
  // This useEffect handles the case where the chatId becomes invalid AFTER initial load
  // Redirect logic: Check ONLY when sessions have loaded and chatId is present.
  useEffect(() => {
    // isLoadingSessions is true initially (sessions is null)
    // When sessions load (become an array), isLoadingSessions becomes false.
    if (!isLoadingSessions && chatId) {
      // Now we know sessions is an array (possibly empty)
      const chatExists = sessions.some(s => s.id === chatId);
      if (!chatExists) {
        console.warn(`[ChatPage] Chat ${chatId} not found in loaded sessions. Redirecting to list.`);
        router.open('/');
      } else {
           console.log(`[ChatPage] Chat ${chatId} found in loaded sessions.`);
      }
    }
    // Dependency array: only re-run when chatId or the loading state changes, or when the sessions array itself changes instance.
  }, [chatId, isLoadingSessions, sessions]); // Add sessions to dependency array


  if (!chatId) {
    // Should ideally not happen if routing is correct, but handle defensively
    console.error("[ChatPage] No chatId found in route params.");
    // Optionally redirect
    // router.open('/');
    return <div>Error: Chat ID missing.</div>;
  }

  if (isLoadingSessions) {
    return <div>Loading chat session...</div>; // Show loading state while sessions are fetched
  }

  if (!currentChat) {
     // This state might be brief if redirection is quick, or shown if redirect fails
     console.log(`[ChatPage] Chat ${chatId} not found, waiting for potential redirect...`);
     return <div>Chat not found. Redirecting...</div>;
  }

  // Render ChatView if session is found
  return <ChatView chatIdFromRoute={chatId} />; // Pass chatId as chatIdFromRoute
};
