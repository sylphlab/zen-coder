import { h } from 'preact';
import { useState, useMemo } from 'preact/hooks'; // Import useMemo
import { ProviderInfoAndStatus, ApiProviderKey, postMessage } from '../app'; // Import updated types
// Removed incorrect backend import and duplicate preact imports

// Define props for the SettingPage - providerStatus is now an array
interface SettingPageProps {
  providerStatus: ProviderInfoAndStatus[]; // Changed from AllProviderStatus | null
  onProviderToggle: (providerId: string, enabled: boolean) => void; // Use string ID
}

// Remove local providerDetails - info now comes from providerStatus prop

export function SettingPage({ providerStatus, onProviderToggle }: SettingPageProps) {
  // State to hold the temporary API key input for each provider
  const [apiKeysInput, setApiKeysInput] = useState<{ [providerId: string]: string }>({}); // Use string key for providerId
  // State for the search query
  const [searchQuery, setSearchQuery] = useState('');

  // Handle input change for API key fields
  const handleApiKeyInputChange = (providerId: string, value: string) => {
    setApiKeysInput(prev => ({ ...prev, [providerId]: value }));
  };

  // Handle setting the API key
  const handleSetApiKey = (providerId: string) => {
    const apiKey = apiKeysInput[providerId];
    if (apiKey && apiKey.trim() !== '') {
      console.log(`Setting API Key for ${providerId}`);
      postMessage({
        type: 'setApiKey',
        payload: { provider: providerId, apiKey: apiKey.trim() } // Send string ID
      });
      // Clear the input field after sending
      setApiKeysInput(prev => ({ ...prev, [providerId]: '' }));
       // Optionally show a temporary success message or rely on providerStatus update
    } else {
        console.warn(`API Key input for ${providerId} is empty.`);
        // Optionally show a warning message
    }
  };

  // Handle deleting the API key
  const handleDeleteApiKey = (providerId: string) => {
      console.log(`Deleting API Key for ${providerId}`);
      postMessage({
          type: 'deleteApiKey',
          payload: { provider: providerId } // Send string ID
      });
      // Optionally show a temporary confirmation or rely on providerStatus update
  };

  // Handle search input change
  const handleSearchChange = (e: Event) => {
      setSearchQuery((e.target as HTMLInputElement).value);
  };

  // Filter providers based on search query using the providerStatus array
  const filteredProviders = useMemo(() => {
      if (!providerStatus) return []; // Return empty if status not loaded
      if (!searchQuery) {
          return providerStatus; // Return all if search is empty
      }
      const lowerCaseQuery = searchQuery.toLowerCase();
      return providerStatus.filter(provider =>
          provider.name.toLowerCase().includes(lowerCaseQuery) ||
          provider.id.toLowerCase().includes(lowerCaseQuery) // Search by ID now
      );
  }, [searchQuery, providerStatus]); // Add providerStatus dependency


  // Re-implement the rendering logic for a single provider setting
  // renderProviderSetting now takes ProviderInfoAndStatus directly
  const renderProviderSetting = (providerInfo: ProviderInfoAndStatus) => {
    const { id, name, apiKeyUrl, requiresApiKey, enabled, apiKeySet } = providerInfo; // Destructure directly
    // No need to check providerStatus null anymore, handled in the main return

    const apiKeyText = apiKeySet ? '(Key 已設定)' : '(Key 未設定)';
    const apiKeyColor = apiKeySet ? 'green' : 'red';

    return (
      <li key={id} class="provider-setting-item mb-4 p-3 border border-gray-300 rounded"> {/* Use id for key */}
        <div class="flex items-center justify-between mb-2">
            <label class="flex items-center font-semibold">
              <input
                type="checkbox"
                class="mr-2"
                checked={enabled}
                onChange={(e) => onProviderToggle(id, (e.target as HTMLInputElement).checked)}
              />
              {name}
            </label>
            <span class={`text-sm font-medium ${apiKeyColor === 'green' ? 'text-green-600' : 'text-red-600'}`}>{apiKeyText}</span>
        </div>
        {/* Only show API Key input if the provider requires one */}
        {requiresApiKey && (
            <div class="mt-2">
                <div class="flex items-center space-x-2">
                   <input
                     type="password" // Use password type for masking
                     class="flex-grow p-1 border border-gray-400 rounded text-sm"
                     placeholder={`輸入 ${name} API Key...`}
                     value={apiKeysInput[id] || ''}
                     onInput={(e) => handleApiKeyInputChange(id, (e.target as HTMLInputElement).value)}
                     aria-label={`${name} API Key Input`}
                   />
                   <button
                     class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm disabled:opacity-50"
                     onClick={() => handleSetApiKey(id)}
                     disabled={!apiKeysInput[id]?.trim()} // Disable if input is empty
                     aria-label={`Set ${name} API Key`}
                   >
                     設定
                   </button>
                   {/* Show Delete button only if key is set */}
                   {apiKeySet && ( // Use destructured apiKeySet
                       <button
                         class="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                         onClick={() => handleDeleteApiKey(id)}
                         aria-label={`Delete ${name} API Key`}
                       >
                         刪除
                       </button>
                   )}
                </div>
                {/* Display link to get API key */}
                {apiKeyUrl && (
                    <p class="text-xs text-gray-500 mt-1">
                        喺呢度攞 API Key: <a href={apiKeyUrl} target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">{apiKeyUrl}</a>
                    </p>
                )}
            </div>
        )}
      </li>
    );
  };

  return (
    <div class="p-4">
      <h1 class="text-xl font-bold mb-4">Zen Coder 設定</h1>
      <section>
        <h3 class="text-lg font-semibold mb-3">Providers</h3>
        {/* Search Input */}
        <div class="mb-4">
            <input
                type="text"
                placeholder="搜索 Provider..."
                value={searchQuery}
                onInput={handleSearchChange}
                class="w-full p-2 border border-gray-300 rounded"
                aria-label="Search Providers"
            />
        </div>

        {/* Check if providerStatus array has loaded */}
        {providerStatus && providerStatus.length > 0 ? (
          <ul class="space-y-2">
            {filteredProviders.length > 0 ? (
                 filteredProviders.map(providerInfo => renderProviderSetting(providerInfo)) // Iterate over filtered list
             ) : (
                 <li class="text-gray-500">未找到匹配嘅 Provider。</li>
             )}
          </ul>
        ) : (
          // Show loading message if providerStatus is null or empty array
          <p>正在載入 Provider 狀態...</p>
        )}
        <p class="text-xs text-gray-600 mt-4">啟用 Provider 並且設定對應嘅 API Key 先可以使用。</p>
        {/* Removed the Ctrl+Shift+P instruction as setting is now inline */}
      </section>
      {/* Add sections for Model Resolver later */}
    </div>
  );
}