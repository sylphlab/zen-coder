import { h } from 'preact';
import { useState, useMemo, useEffect, useCallback } from 'preact/hooks'; // Import useEffect, useCallback
import { ProviderInfoAndStatus, ApiProviderKey, postMessage } from '../app'; // Import updated types
import { McpServerTestResult } from '../../../src/ai/aiService'; // Import test result type
// Define props for the SettingPage - providerStatus is now an array
interface SettingPageProps {
  providerStatus: ProviderInfoAndStatus[]; // Changed from AllProviderStatus | null
  onProviderToggle: (providerId: string, enabled: boolean) => void; // Use string ID
  // Removed initialMcpServers prop
}

// Define structure for configured status received from backend (matches AiService output)
interface McpConfiguredStatusPayload {
   [serverName: string]: {
       config: any; // Keep config generic for now
       enabled: boolean;
       isConnected: boolean; // Added connection status from init
   };
}

// Remove McpTestResults type, no longer needed
// Remove local providerDetails - info now comes from providerStatus prop

// Updated state structure for MCP Servers
interface McpServerDisplayStatus {
   config: any; // Keep config generic
   configuredEnabled: boolean; // From JSON file (disabled: false)
   isConnected: boolean; // Status from initial connection attempt
}

interface McpCombinedState {
   [serverName: string]: McpServerDisplayStatus;
}


export function SettingPage({ providerStatus, onProviderToggle }: SettingPageProps) { // Removed initialMcpServers
   // State to hold the temporary API key input for each provider
   const [apiKeysInput, setApiKeysInput] = useState<{ [providerId: string]: string }>({}); // Use string key for providerId
   // State for the search query
   const [searchQuery, setSearchQuery] = useState('');
   // Combined state for MCP servers
   const [mcpServers, setMcpServers] = useState<McpCombinedState>({});
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

   // Removed triggerTest function as testing is no longer done from UI

   // Effect to fetch initial MCP status and listen for updates
   useEffect(() => {
       // Request initial state
       postMessage({ type: 'settingsPageReady' });
       postMessage({ type: 'getMcpConfiguredStatus' }); // Request MCP status on mount
       console.log('SettingsPage mounted, sent settingsPageReady and getMcpConfiguredStatus');

       // Add message listener for updates
       const handleMessage = (event: MessageEvent) => {
           const message = event.data;
           // console.log('[SettingsPage] Received message:', message.type, message.payload);

           switch (message.type) {
               case 'updateMcpConfiguredStatus':
                   console.log('[SettingsPage] Received updateMcpConfiguredStatus:', message.payload);
                   const newConfiguredStatus = message.payload as McpConfiguredStatusPayload; // Use updated type
                   const newCombinedState: McpCombinedState = {};

                   for (const serverName in newConfiguredStatus) {
                       const statusInfo = newConfiguredStatus[serverName];
                       newCombinedState[serverName] = {
                           config: statusInfo.config,
                           configuredEnabled: statusInfo.enabled,
                           isConnected: statusInfo.isConnected, // Use status from payload
                       };
                   }
                   setMcpServers(newCombinedState); // Set state directly from backend status
                   console.log('[SettingsPage] Updated mcpServers state:', newCombinedState);
                   break;
// Removed case 'updateMcpTestResult' as it's no longer sent
                   break;

               case 'mcpConfigReloaded': // Listen for backend reload signal
                   console.log('[SettingsPage] Received mcpConfigReloaded, requesting new status...');
                   postMessage({ type: 'getMcpConfiguredStatus' }); // Re-fetch status (will trigger tests again)
                   break;
               // Add other message handlers if needed
           }
       };

       window.addEventListener('message', handleMessage);

       // Cleanup listener on unmount
       return () => {
           window.removeEventListener('message', handleMessage);
       };
   }, []); // Removed triggerTest from dependency array

   // --- Removed all MCP Server Management functions ---

   // --- New handlers for opening config files ---
   const handleOpenGlobalMcpConfig = () => {
       console.log('Requesting to open global MCP config');
       postMessage({ type: 'openGlobalMcpConfig' });
   };

   const handleOpenProjectMcpConfig = () => {
       console.log('Requesting to open project MCP config');
       postMessage({ type: 'openProjectMcpConfig' });
   };

   // Removed handleRefreshStatus as testing is no longer triggered from UI


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

      {/* --- MCP Servers Section --- */}
      <section class="mt-8">
          <h3 class="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">MCP Servers</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Configure connections to external MCP servers providing additional tools. Settings are stored in JSON files. Project settings override global settings for servers with the same name.
          </p>
          <div class="flex space-x-4 mb-4">
              <button
                  onClick={handleOpenGlobalMcpConfig}
                  class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                  Configure Global Servers
              </button>
              <button
                  onClick={handleOpenProjectMcpConfig}
                  class="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
              >
                  Configure Project Servers
              </button>
          </div>

           {/* MCP Server List and Status - Use combined mcpServers state */}
           {Object.keys(mcpServers).length > 0 ? (
               <ul class="space-y-3">
                   {Object.entries(mcpServers).map(([serverName, serverState]) => {
                       const { config, configuredEnabled, isConnected } = serverState;
                       const configType = config.command ? 'Stdio' : (config.url ? 'SSE' : 'Unknown');
                       let statusText = '';
                       let statusColor = '';

                       if (!configuredEnabled) {
                           statusText = 'Disabled (in config)';
                           statusColor = 'text-gray-500 dark:text-gray-400';
                       } else if (isConnected) {
                           statusText = 'Connected';
                           statusColor = 'text-green-600 dark:text-green-400';
                       } else {
                           statusText = 'Connection Failed (at startup)';
                           statusColor = 'text-red-600 dark:text-red-400';
                       }


                       return (
                           <li key={serverName} class="p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm flex items-center justify-between space-x-4">
                               <div class="flex-grow overflow-hidden"> {/* Added overflow-hidden */}
                                   <span class="font-semibold">{serverName}</span>
                                   <span class="text-xs text-gray-500 dark:text-gray-400 ml-2">({configType})</span>
                                   <p class={`text-sm ${statusColor} font-medium truncate`}>{statusText}</p> {/* Display status */}
                                   {/* Removed error text display related to testing */}
                                   {/* Removed tool count display */}
                               </div>
                               {/* Removed Refresh/Test button */}
                           </li>
                       );
                   })}
               </ul>
           ) : (
               <p class="text-gray-500 dark:text-gray-400 italic">Loading MCP server configurations or none found...</p> // Updated loading/empty message
           )}
       </section>

    </div>
  );
}