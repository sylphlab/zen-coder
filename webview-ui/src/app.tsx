import { useEffect } from 'preact/hooks';
import { useAtomValue } from 'jotai'; // Removed useSetAtom as updateLocation is no longer needed here
import { loadable } from 'jotai/utils';
import { Router, Route, useLocation, Switch } from "wouter"; // Removed Redirect, unused useParams
import './app.css';
import { SettingPage } from './pages/SettingPage';
import { ChatListPage } from './pages/ChatListPage';
import { ChatView } from './components/ChatView.tsx';
import {
    locationAtom // Only locationAtom is needed
} from './store/atoms';
// Removed updateLocationAtom import

// --- Type Definitions ---
// (Already removed)

// --- App Component ---
export function App() {
    // --- State ---
    const locationAtomLoadable = useAtomValue(loadable(locationAtom));
    const [location, setLocation] = useLocation(); // Wouter hook

    // Removed unused state/setters/hooks/effects comments

    // --- Effects ---

    // Combined Effect: Sync Wouter router TO match locationAtom (Source of Truth)
    useEffect(() => {
        const currentWouterLocation = location; // Capture current router location

        if (locationAtomLoadable.state === 'hasData') {
            const locationFromAtom = locationAtomLoadable.data;
            // Default to '/' (ChatListPage) if atom value is null or undefined.
            const targetLocation = locationFromAtom ? locationFromAtom : "/";

            // Sync router if atom's target location differs from current router location.
            if (targetLocation !== currentWouterLocation) {
                 console.log(`[App Sync Effect] Atom target (${targetLocation}) differs from router (${currentWouterLocation}). Syncing router.`);
                 // Use replace only if the target is the root path '/' to avoid extra history.
                 const shouldUseReplace = targetLocation === '/';
                 setLocation(targetLocation, { replace: shouldUseReplace });
            }
        }
        // Error handling removed.
    // Dependencies: Run when atom state or router location changes.
    }, [locationAtomLoadable, location, setLocation]);

    // Removed commented-out Event Handlers section

    // --- Main Render ---
    if (locationAtomLoadable.state === 'loading') {
         return <div class="flex justify-center items-center h-screen">Loading...</div>;
    }
    // Assuming location atom has loaded successfully ('hasData').
    // Removed commented-out resolvedLocationData access

    return (
        <Router hook={useLocation}> {/* Ensure Router uses the hook */}
            <div class="app-layout h-screen flex flex-col bg-gray-100 dark:bg-gray-850 text-gray-900 dark:text-gray-100">
                <main class="content-area flex-1 flex flex-col overflow-hidden">
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
                </main>
                {/* Removed commented-out ConfirmationDialog */}
            </div>
        </Router>
    );
}
