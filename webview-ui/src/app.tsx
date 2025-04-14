import { useStore } from '@nanostores/preact';
import { ComponentChild } from 'preact'; // Import ComponentChild
import './app.css';
import { SettingPage } from './pages/SettingPage';
import { ChatListPage } from './pages/ChatListPage';
import { ChatView } from './components/ChatView';
import { router } from './stores/router'; // Import the Nanostores router

// Removed useLocationSync import

// --- App Component ---
export function App() {
    // Get the current page object from the router store
    const page = useStore(router);

    // TODO: Implement initial location fetching and setting for the nanostore router
    // This might involve a useEffect in App or main.tsx calling requestData('getLastLocation')
    // and then router.open(fetchedLocation). For now, it might default to '/' or be blank.
    // const { isLoading } = useSomeInitialLocationLoadingLogic(); // Placeholder
    // if (isLoading) { return <div class="flex justify-center items-center h-screen">Initializing Location...</div>; }


    // Determine which component to render based on the route name
    let CurrentPage: ComponentChild = null; // Use imported ComponentChild type
    if (page?.route === 'home') {
        CurrentPage = <ChatListPage />;
    } else if (page?.route === 'chat' && page.params && page.params.chatId) { // Add check for page.params
        // Pass chatId as a prop, key forces re-render on ID change
        CurrentPage = <ChatView key={page.params.chatId} chatIdFromRoute={page.params.chatId} />;
    } else if (page?.route === 'settings') {
        CurrentPage = <SettingPage />;
    } else {
        // Fallback for unknown routes or initial state before routing resolves
        CurrentPage = <div class="p-6 text-center text-red-500">404: Page Not Found or Initializing<br/>Path: {page?.path ?? 'Unknown'}</div>;
    }

    return (
        <div class="app-layout h-screen flex flex-col bg-gray-100 dark:bg-gray-850 text-gray-900 dark:text-gray-100">
            {/* Render the current page component */}
            {CurrentPage}
        </div>
    );
}
