import { useStore } from '@nanostores/preact';
import { ComponentChild } from 'preact';
// Removed useEffect, useRef
// Removed import './app.css';
import { SettingPage } from './pages/SettingPage';
import { ChatPage } from './pages/ChatPage';
import { ChatListPage } from './pages/ChatListPage'; // Import ChatListPage
import { router } from './stores/router';

export function App() {
    const page = useStore(router);

    // Removed initial redirect logic

    // --- Page Routing ---
    let CurrentPage: ComponentChild = null;

    // Wait for the router 'page' object to be defined
    if (!page) {
         return (
            <div class="flex justify-center items-center h-screen text-gray-500 dark:text-gray-400">
                Initializing Router...
            </div>
        );
    }

    // Determine which component to render based on the route name
    // '/' and '/chat/:chatId' now both render ChatPage
    if (page.route === 'home' || page.route === 'chat') {
        // Pass potential chatId from params. ChatPage will handle if it's undefined.
        const chatId = (page.route === 'chat' && page.params && page.params.chatId) ? page.params.chatId : undefined;
        // Use key={chatId || 'new'} to ensure component remounts when navigating between '/' and '/chat/:id'
        // or between different chat IDs. 'new' key for the initial '/' load.
        CurrentPage = <ChatPage key={chatId || 'new'} chatIdFromRoute={chatId} />;
    } else if (page.route === 'settings') {
        CurrentPage = <SettingPage />;
    } else if (page.route === 'sessions') { // Add route for sessions
        CurrentPage = <ChatListPage />;
    } else {
        // Fallback for unknown routes
        CurrentPage = <div class="p-6 text-center text-red-500">404: Page Not Found</div>;
    }

    return (
        <div class="flex w-screen h-screen text-gray-900 dark:text-gray-100 overflow-hidden">
            <div class="flex-grow flex flex-col overflow-y-auto">
                {CurrentPage}
            </div>
        </div>
    );
}
