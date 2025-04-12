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
      <li key={id} class="provider-setting-item mb-4 p-4 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm"> {/* Use id for key, added padding, dark mode, shadow */}
        <div class="flex items-center justify-between mb-3"> {/* Increased margin bottom */}
            <label class="flex items-center font-semibold text-lg"> {/* Increased font size */}
              <input
                type="checkbox"
                class="mr-3 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" // Styled checkbox
                checked={enabled}
                onChange={(e) => onProviderToggle(id, (e.target as HTMLInputElement).checked)}
              />
              {name}
            </label>
            <span class={`text-sm font-medium ${apiKeyColor === 'green' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{apiKeyText}</span> {/* Added dark mode colors */}
        </div>
        {/* Only show API Key input if the provider requires one */}
        {requiresApiKey && (
            <div class="mt-3 space-y-2"> {/* Increased margin top, added vertical space */}
                <div class="flex items-center space-x-2"> {/* Kept flex for input row */}
                   <input
                     type="password" // Use password type for masking
                     class="flex-grow p-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none" // Enhanced input style
                     placeholder={`輸入 ${name} API Key...`}
                     value={apiKeysInput[id] || ''}
                     onInput={(e) => handleApiKeyInputChange(id, (e.target as HTMLInputElement).value)}
                     aria-label={`${name} API Key Input`}
                   />
                   <button
                     class="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500" // Enhanced button style
                     onClick={() => handleSetApiKey(id)}
                     disabled={!apiKeysInput[id]?.trim()} // Disable if input is empty
                     aria-label={`Set ${name} API Key`}
                   >
                     設定
                   </button>
                   {/* Show Delete button only if key is set */}
                   {apiKeySet && ( // Use destructured apiKeySet
                       <button
                         class="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500" // Enhanced button style
                         onClick={() => handleDeleteApiKey(id)}
                         aria-label={`Delete ${name} API Key`}
                       >
                         刪除
                       </button>
                   )}
                </div>
                {/* Display link to get API key */}
                {apiKeyUrl && (
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        喺呢度攞 API Key: <a href={apiKeyUrl} target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">{apiKeyUrl}</a> {/* Added dark mode link color */}
                    </p>
                )}
            </div>
        )}
      </li>
    );
  };

  return (
    <div class="p-6"> {/* Increased padding */}
      <h1 class="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-200">Zen Coder 設定</h1> {/* Larger heading, more margin */}
      <section>
        <h3 class="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Providers</h3> {/* Larger subheading */}
        {/* Search Input */}
        <div class="mb-4">
            <input
                type="text"
                placeholder="搜索 Provider..."
                value={searchQuery}
                onInput={handleSearchChange}
                class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none" // Enhanced search input style
                aria-label="Search Providers"
            />
        </div>

        {/* Check if providerStatus array has loaded */}
        {providerStatus && providerStatus.length > 0 ? (
          <ul class="space-y-4"> {/* Increased space between items */}
            {filteredProviders.length > 0 ? (
                 filteredProviders.map(providerInfo => renderProviderSetting(providerInfo)) // Iterate over filtered list
             ) : (
                 <li class="text-gray-500 dark:text-gray-400 italic">未找到匹配嘅 Provider。</li>
             )}
          </ul>
        ) : (
          // Show loading message if providerStatus is null or empty array
          <p class="text-gray-500 dark:text-gray-400">正在載入 Provider 狀態...</p>
        )}
        <p class="text-xs text-gray-600 dark:text-gray-400 mt-6">啟用 Provider 並且設定對應嘅 API Key 先可以使用。</p> {/* Added dark mode color, increased margin */}
        {/* Removed the Ctrl+Shift+P instruction as setting is now inline */}
      </section>
      {/* Add sections for Model Resolver later */}
    </div>
  );
}