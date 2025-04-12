import { h } from 'preact';
import { useState } from 'preact/hooks'; // Import useState
import { AllProviderStatus, ApiProviderKey } from '../app'; // Import types from app.tsx (adjust path if needed)
import { postMessage } from '../app'; // Import postMessage

// Define props for the SettingPage
interface SettingPageProps {
  providerStatus: AllProviderStatus | null;
  onProviderToggle: (providerKey: ApiProviderKey, enabled: boolean) => void;
}

export function SettingPage({ providerStatus, onProviderToggle }: SettingPageProps) {
  // State to hold the temporary API key input for each provider
  const [apiKeysInput, setApiKeysInput] = useState<{ [key in ApiProviderKey]?: string }>({});

  // Handle input change for API key fields
  const handleApiKeyInputChange = (providerKey: ApiProviderKey, value: string) => {
    setApiKeysInput(prev => ({ ...prev, [providerKey]: value }));
  };

  // Handle setting the API key
  const handleSetApiKey = (providerKey: ApiProviderKey) => {
    const apiKey = apiKeysInput[providerKey];
    if (apiKey && apiKey.trim() !== '') {
      console.log(`Setting API Key for ${providerKey}`);
      postMessage({
        type: 'setApiKey',
        payload: { provider: providerKey, apiKey: apiKey.trim() }
      });
      // Clear the input field after sending
      setApiKeysInput(prev => ({ ...prev, [providerKey]: '' }));
       // Optionally show a temporary success message or rely on providerStatus update
    } else {
        console.warn(`API Key input for ${providerKey} is empty.`);
        // Optionally show a warning message
    }
  };


  // Re-implement the rendering logic for a single provider setting
  const renderProviderSetting = (key: ApiProviderKey, name: string) => {
    if (!providerStatus) return <li key={key}>{name}: 載入中...</li>;

    const status = providerStatus[key];
    if (!status) return <li key={key}>{name}: 狀態不可用</li>; // Handle case where status might be missing

    const apiKeyText = status.apiKeySet ? '(Key 已設定)' : '(Key 未設定)';
    const apiKeyColor = status.apiKeySet ? 'green' : 'red';

    return (
      <li key={key} class="provider-setting-item mb-4 p-3 border border-gray-300 rounded">
        <div class="flex items-center justify-between mb-2">
            <label class="flex items-center font-semibold">
              <input
                type="checkbox"
                class="mr-2"
                checked={status.enabled}
                onChange={(e) => onProviderToggle(key, (e.target as HTMLInputElement).checked)}
              />
              {name}
            </label>
            <span class={`text-sm font-medium ${apiKeyColor === 'green' ? 'text-green-600' : 'text-red-600'}`}>{apiKeyText}</span>
        </div>
        <div class="flex items-center space-x-2">
           <input
             type="password" // Use password type for masking
             class="flex-grow p-1 border border-gray-400 rounded text-sm"
             placeholder={`輸入 ${name} API Key...`}
             value={apiKeysInput[key] || ''}
             onInput={(e) => handleApiKeyInputChange(key, (e.target as HTMLInputElement).value)}
             aria-label={`${name} API Key Input`}
           />
           <button
             class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm disabled:opacity-50"
             onClick={() => handleSetApiKey(key)}
             disabled={!apiKeysInput[key]?.trim()} // Disable if input is empty
             aria-label={`Set ${name} API Key`}
           >
             設定
           </button>
        </div>
      </li>
    );
  };

  return (
    <div class="p-4">
      <h1 class="text-xl font-bold mb-4">Zen Coder 設定</h1>
      <section>
        <h3 class="text-lg font-semibold mb-3">Providers</h3>
        {providerStatus ? (
          <ul class="space-y-2"> {/* Use space-y for vertical spacing */}
            {renderProviderSetting('ANTHROPIC', 'Anthropic (Claude)')}
            {renderProviderSetting('GOOGLE', 'Google (Gemini)')}
            {renderProviderSetting('OPENROUTER', 'OpenRouter')}
            {renderProviderSetting('DEEPSEEK', 'DeepSeek')}
          </ul>
        ) : (
          <p>正在載入 Provider 狀態...</p>
        )}
        <p class="text-xs text-gray-600 mt-4">啟用 Provider 並且設定對應嘅 API Key 先可以使用。</p>
        {/* Removed the Ctrl+Shift+P instruction as setting is now inline */}
      </section>
      {/* Add sections for Model Resolver later */}
    </div>
  );
}