import { render } from 'preact';
import { Suspense } from 'preact/compat';
import { Provider, getDefaultStore } from 'jotai';
import 'virtual:uno.css';
import '@unocss/reset/tailwind.css';
import './index.css';
import { App } from './app.tsx';

const store = getDefaultStore();

console.log("[main.tsx] Initializing application...");

// --- Render App ---

render(
    <Provider store={store}>
        {/* Suspense is needed for atoms that depend on getCommunicationService */}
        <Suspense fallback={<div class="flex justify-center items-center h-screen">Loading...</div>}>
            <App />
        </Suspense>
    </Provider>,
    document.getElementById('root')!
);
