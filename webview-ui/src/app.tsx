// Removed unused imports: useEffect, useAtomValue, loadable
import { Router, Route, useLocation, Switch } from "wouter";
import './app.css';
import { SettingPage } from './pages/SettingPage';
import { ChatListPage } from './pages/ChatListPage';
import { ChatView } from './components/ChatView.tsx';
import { useLocationSync } from './hooks/useLocationSync.ts'; // Explicitly add .ts extension
// Removed locationAtom import

// --- App Component ---
export function App() {
    // Initialize location synchronization logic and get loading state
    const { isLoading } = useLocationSync();

    // Get the current location directly from wouter for routing
    const [location] = useLocation();

    // Display loading indicator while the hook is fetching initial location
    if (isLoading) {
        return <div class="flex justify-center items-center h-screen">Initializing...</div>;
    }

    // Once loading is complete, render the Router
    return (
        <Router hook={useLocation}> {/* Ensure Router uses the hook */}
            <div class="app-layout h-screen flex flex-col bg-gray-100 dark:bg-gray-850 text-gray-900 dark:text-gray-100">
                {/* No main wrapper needed if Switch handles layout */}
                {/* <main class="content-area flex-1 flex flex-col overflow-hidden"> */}
                <Switch>
                    {/* Chat View Route */}
                    <Route path="/chat/:chatId">
                            {(params) => <ChatView key={params.chatId} chatIdFromRoute={params.chatId} />}
                        </Route>

                        {/* Settings Route */}
                        <Route path="/settings">
                            <SettingPage />
                        </Route>

                    {/* Root Route (Chat List) */}
                    <Route path="/">
                        <ChatListPage />
                    </Route>

                    {/* Fallback Route (404) */}
                    <Route>
                        <div class="p-6 text-center text-red-500">404: Page Not Found<br/>Path: {location}</div>
                    </Route>
                </Switch>
                {/* </main> */}
            </div>
        </Router>
    );
}
