import { useState, useEffect, useCallback } from 'preact/hooks';
import './app.css';

// Define the structure for provider status
type ProviderStatus = {
    enabled: boolean;
    apiKeySet: boolean;
};

type AllProviderStatus = {
    ANTHROPIC: ProviderStatus;
    GOOGLE: ProviderStatus;
    OPENROUTER: ProviderStatus;
    DEEPSEEK: ProviderStatus;
};

// Helper to get the VS Code API instance
// @ts-ignore
const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;

// Function to post messages to the extension host
const postMessage = (message: any) => {
    if (vscode) {
        vscode.postMessage(message);
    } else {
        console.log("VS Code API not available, message not sent:", message);
        // Handle mock responses for development outside VS Code if needed
        if (message.type === 'getProviderStatus') {
             // Simulate receiving status after a delay
             setTimeout(() => {
                 window.dispatchEvent(new MessageEvent('message', {
                     data: {
                         type: 'providerStatus',
                         payload: {
                             ANTHROPIC: { enabled: true, apiKeySet: true },
                             GOOGLE: { enabled: false, apiKeySet: false },
                             OPENROUTER: { enabled: true, apiKeySet: true },
                             DEEPSEEK: { enabled: true, apiKeySet: false }
                         } // Example status
                     }
                 }));
             }, 500);
        } else if (message.type === 'setProviderEnabled') {
            console.log("Simulating provider enable change:", message.payload);
            // Optionally update mock state here if needed for dev outside VS Code
        }
    }
};


export function App() {
    const [providerStatus, setProviderStatus] = useState<AllProviderStatus | null>(null);

    useEffect(() => {
        // Signal that the webview is ready
        postMessage({ type: 'webviewReady' });

        // Request initial provider status
        postMessage({ type: 'getProviderStatus' }); // Changed from getApiKeyStatus

        // Listener for messages from the extension host
        const handleMessage = (event: MessageEvent) => {
            const message = event.data; // The message payload
            console.log("Settings UI received message:", message);
            switch (message.type) {
                case 'providerStatus': // Changed from apiKeyStatus
                    if (message.payload) {
                        setProviderStatus(message.payload);
                    }
                    break;
                // Add other message types as needed
            }
        };

        window.addEventListener('message', handleMessage);

        // Cleanup listener on component unmount
        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []); // Empty dependency array ensures this runs only once on mount

    const handleProviderToggle = useCallback((providerKey: keyof AllProviderStatus, enabled: boolean) => {
        // Optimistically update UI state
        setProviderStatus(prevStatus => {
            if (!prevStatus) return null;
            return {
                ...prevStatus,
                [providerKey]: { ...prevStatus[providerKey], enabled: enabled }
            };
        });
        // Send message to extension host to update the setting
        postMessage({
            type: 'setProviderEnabled',
            payload: { provider: providerKey, enabled: enabled }
        });
    }, []);

    const renderProvider = (key: keyof AllProviderStatus, name: string) => {
        if (!providerStatus) return <li>{name}: 載入中...</li>;

        const status = providerStatus[key];
        const apiKeyText = status.apiKeySet ? '(Key 已設定)' : '(Key 未設定)';
        const apiKeyColor = status.apiKeySet ? 'green' : 'red';

        return (
            <li>
                <label>
                    <input
                        type="checkbox"
                        checked={status.enabled}
                        onChange={(e) => handleProviderToggle(key, (e.target as HTMLInputElement).checked)}
                    />
                    {name} <span style={{ color: apiKeyColor, fontSize: '0.9em' }}>{apiKeyText}</span>
                </label>
            </li>
        );
    };


    return (
        <div class="settings-container">
            <h1>Zen Coder 設定</h1>

            <section>
                <h2>Providers</h2>
                {providerStatus ? (
                    <ul>
                        {renderProvider('ANTHROPIC', 'Anthropic (Claude)')}
                        {renderProvider('GOOGLE', 'Google (Gemini)')}
                        {renderProvider('OPENROUTER', 'OpenRouter')}
                        {renderProvider('DEEPSEEK', 'DeepSeek')}
                    </ul>
                ) : (
                    <p>正在載入 Provider 狀態...</p>
                )}
                 <p><small>啟用 Provider 並且設定對應嘅 API Key 先可以使用.</small></p>
                 <p><small>使用 Ctrl+Shift+P 並輸入 "Set [Provider] API Key" 去設定或更新 Key.</small></p>
            </section>

            {/* Add sections for Model Resolver later */}
        </div>
    );
}
