import { useStore } from '@nanostores/preact';
import { ComponentChild } from 'preact';
import './app.css';
import { SettingPage } from './pages/SettingPage';
import { ChatListPage } from './pages/ChatListPage';
import { ChatView } from './components/ChatView';
import { router, $location } from './stores/router'; // Import router and $location

// Removed useLocationSync import

// --- App Component ---
export function App() {
    // Get the current router page object and location state
    const page = useStore(router);
    const locationValue = useStore($location); // Track location state

    // --- Loading and Error Handling ---
    // Show loading indicator while initial location is being fetched
    if (locationValue === 'loading') {
        return (
            <div class="flex justify-center items-center h-screen text-gray-500 dark:text-gray-400">
                Initializing...
            </div>
        );
    }

    // Show error if location fetch failed
    if (locationValue === 'error') {
         return (
             <div class="flex justify-center items-center h-screen text-red-500 dark:text-red-400">
                 Error loading initial application state. Please check console or reload.
             </div>
         );
    }

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
    if (page.route === 'home') {
        CurrentPage = <ChatListPage />;
    } else if (page.route === 'chat' && page.params && page.params.chatId) {
        // Pass chatId as a prop, key forces re-render on ID change
        CurrentPage = <ChatView key={page.params.chatId} chatIdFromRoute={page.params.chatId} />;
    } else if (page.route === 'settings') {
        CurrentPage = <SettingPage />;
    } else {
        // Fallback for unknown routes - now router state 'page' is guaranteed to be defined
        CurrentPage = <div class="p-6 text-center text-red-500">404: Page Not Found<br/>Path: {page.path}</div>;
    }

    return (
        <div class="app-layout h-screen flex flex-col bg-gray-100 dark:bg-gray-850 text-gray-900 dark:text-gray-100">
            {/* Render the current page component */}
            {CurrentPage}
        </div>
    );
}
