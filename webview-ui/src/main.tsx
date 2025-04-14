import { render } from 'preact';
import { Suspense } from 'preact/compat';
// Removed Jotai imports
import 'virtual:uno.css';
import '@unocss/reset/tailwind.css';
import './index.css';
import { App } from './app.tsx';
// Removed communication and router imports - logic moved to router.ts

console.log("[main.tsx] Rendering application...");

// --- Render App ---
// Router initialization and communication listener setup will happen within the router store's onMount
render(
    // Keep Suspense for potential future async components within App
    <Suspense fallback={<div class="flex justify-center items-center h-screen">Loading...</div>}>
        <App />
    </Suspense>,
    document.getElementById('root')!
);
