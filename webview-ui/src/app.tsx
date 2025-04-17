import { useStore } from '@nanostores/preact';
import { ComponentChild } from 'preact';
import './app.css';
// Restore original imports
import { SettingPage } from './pages/SettingPage';
import { ChatListPage } from './pages/ChatListPage';
import { ChatPage } from './pages/ChatPage'; // Updated import path and name
import { router, $location } from './stores/router'; // Import router and $location

// Removed useLocationSync import

// --- App Component ---
export function App() {
    // Get the current router page object and location state
    const page = useStore(router);
    // --- Page Routing (only after location is loaded AND router state is initialized) ---
    let CurrentPage: ComponentChild = null;

    // Wait for the router 'page' object to be defined after location loads
    if (!page) {
         // Router state not yet initialized after location load
         return (
            <div class="flex justify-center items-center h-screen text-gray-500 dark:text-gray-400">
                Initializing Router...
            </div>
        );
    }

    // Determine which component to render based on the route name
    // Restore original routing logic
    if (page.route === 'home') {
        CurrentPage = <ChatListPage />;
    } else if (page.route === 'chat' && page.params && page.params.chatId) {
        // ChatView gets chatId from the router store, no need to pass as prop
        // Use key to force re-render when chatId changes in the route
        CurrentPage = <ChatPage key={page.params.chatId} />; // Use the renamed ChatPage component
    } else if (page.route === 'settings') {
        CurrentPage = <SettingPage />;
    } else {
        // Fallback for unknown routes - now router state 'page' is guaranteed to be defined
        CurrentPage = <div class="p-6 text-center text-red-500">404: Page Not Found<br/>Path: {page.path}</div>;
    }

    return (
        // Restore original container class, removing bg-transparent
        <div class="flex w-screen h-screen text-gray-900 dark:text-gray-100 overflow-hidden">
            {/* Main Content */}
            <div class="flex-grow flex flex-col overflow-y-auto">
                {CurrentPage}
            </div>
        </div>
    );
}
