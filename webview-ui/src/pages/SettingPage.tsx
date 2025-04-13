import { h } from 'preact';
import { useState, useMemo, useEffect, useCallback } from 'preact/hooks';
import { ProviderInfoAndStatus, ApiProviderKey, postMessage } from '../app';
// McpServerTestResult is no longer needed
import { McpServerStatus } from '../../../src/ai/mcpManager'; // Import the new status type
import { ToolSet } from 'ai'; // Import ToolSet for displaying tools

// Define props for the SettingPage
interface SettingPageProps {
  providerStatus: ProviderInfoAndStatus[];
  onProviderToggle: (providerId: string, enabled: boolean) => void;
}

// Update payload type to match the new McpServerStatus structure from backend
interface McpConfiguredStatusPayload {
   [serverName: string]: McpServerStatus;
}

// Update local state to hold the full McpServerStatus
interface McpCombinedState {
   [serverName: string]: McpServerStatus;
}


export function SettingPage({ providerStatus, onProviderToggle }: SettingPageProps) {
   // State to hold the temporary API key input for each provider
   const [apiKeysInput, setApiKeysInput] = useState<{ [providerId: string]: string }>({});
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
        payload: { provider: providerId, apiKey: apiKey.trim() }
      });
      setApiKeysInput(prev => ({ ...prev, [providerId]: '' }));
    } else {
        console.warn(`API Key input for ${providerId} is empty.`);
    }
  };

  // Handle deleting the API key
  const handleDeleteApiKey = (providerId: string) => {
      console.log(`Deleting API Key for ${providerId}`);
      postMessage({
          type: 'deleteApiKey',
          payload: { provider: providerId }
      });
  };

  // Handle search input change
  const handleSearchChange = (e: Event) => {
      setSearchQuery((e.target as HTMLInputElement).value);
  };

  // Filter providers based on search query
  const filteredProviders = useMemo(() => {
      if (!providerStatus) return [];
      if (!searchQuery) {
          return providerStatus;
      }
      const lowerCaseQuery = searchQuery.toLowerCase();
      return providerStatus.filter(provider =>
          provider.name.toLowerCase().includes(lowerCaseQuery) ||
          provider.id.toLowerCase().includes(lowerCaseQuery)
      );
  }, [searchQuery, providerStatus]);

   // Effect to fetch initial MCP status and listen for updates
   useEffect(() => {
       // Request initial state
       postMessage({ type: 'settingsPageReady' });
       postMessage({ type: 'getMcpConfiguredStatus' }); // Request MCP status on mount
       console.log('SettingsPage mounted, sent settingsPageReady and getMcpConfiguredStatus');

       // Add message listener for updates
       const handleMessage = (event: MessageEvent) => {
           const message = event.data;

           switch (message.type) {
               case 'updateMcpConfiguredStatus':
                   console.log('[SettingsPage] Received updateMcpConfiguredStatus:', message.payload);
                   const newConfiguredStatus = message.payload as McpConfiguredStatusPayload;
                   // Directly set the state with the received payload, as it now matches McpCombinedState
                   setMcpServers(newConfiguredStatus);
                   console.log('[SettingsPage] Updated mcpServers state:', newConfiguredStatus);
                   break;
               // Removed case 'updateMcpTestResult' as it's no longer sent

               case 'mcpConfigReloaded': // Listen for backend reload signal
                   console.log('[SettingsPage] Received mcpConfigReloaded, requesting new status...');
                   postMessage({ type: 'getMcpConfiguredStatus' }); // Re-fetch status
                   break;
               // Add other message handlers if needed
           }
       };

       window.addEventListener('message', handleMessage);

       // Cleanup listener on unmount
       return () => {
           window.removeEventListener('message', handleMessage);
       };
   }, []); // Empty dependency array

   // --- New handlers for opening config files ---
   const handleOpenGlobalMcpConfig = () => {
       console.log('Requesting to open global MCP config');
       postMessage({ type: 'openGlobalMcpConfig' });
   };

   const handleOpenProjectMcpConfig = () => {
       console.log('Requesting to open project MCP config');
       postMessage({ type: 'openProjectMcpConfig' });
   };

    // Handler for the new Retry button
    const handleRetryConnection = (serverName: string) => {
        console.log(`Requesting retry for MCP server: ${serverName}`);
        postMessage({ type: 'retryMcpConnection', payload: { serverName } });
        // Optionally set a temporary "Retrying..." state here,
        // but the main status update will come from the backend via 'updateMcpConfiguredStatus'
        // Example: Update local state immediately to show "Retrying..."
        setMcpServers(prev => ({
            ...prev,
            [serverName]: {
                ...(prev[serverName] || { config: {}, enabled: false, isConnected: false }), // Keep existing info or default
                lastError: 'Retrying...', // Indicate retry attempt
            }
        }));
    };


  // Render logic for a single provider setting
  const renderProviderSetting = (providerInfo: ProviderInfoAndStatus) => {
    const { id, name, apiKeyUrl, requiresApiKey, enabled, apiKeySet } = providerInfo;
    const apiKeyText = apiKeySet ? '(Key 已設定)' : '(Key 未設定)';
    const apiKeyColor = apiKeySet ? 'green' : 'red';

    return (
      <li key={id} class="provider-setting-item mb-4 p-4 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
        <div class="flex items-center justify-between mb-3">
            <label class="flex items-center font-semibold text-lg">
              <input
                type="checkbox"
                class="mr-3 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                checked={enabled}
                onChange={(e) => onProviderToggle(id, (e.target as HTMLInputElement).checked)}
              />
              {name}
            </label>
            <span class={`text-sm font-medium ${apiKeyColor === 'green' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{apiKeyText}</span>
        </div>
        {requiresApiKey && (
            <div class="mt-3 space-y-2">
                <div class="flex items-center space-x-2">
                   <input
                     type="password"
                     class="flex-grow p-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                     placeholder={`輸入 ${name} API Key...`}
                     value={apiKeysInput[id] || ''}
                     onInput={(e) => handleApiKeyInputChange(id, (e.target as HTMLInputElement).value)}
                     aria-label={`${name} API Key Input`}
                   />
                   <button
                     class="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                     onClick={() => handleSetApiKey(id)}
                     disabled={!apiKeysInput[id]?.trim()}
                     aria-label={`Set ${name} API Key`}
                   >
                     設定
                   </button>
                   {apiKeySet && (
                       <button
                         class="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                         onClick={() => handleDeleteApiKey(id)}
                         aria-label={`Delete ${name} API Key`}
                       >
                         刪除
                       </button>
                   )}
                </div>
                {apiKeyUrl && (
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        喺呢度攞 API Key: <a href={apiKeyUrl} target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">{apiKeyUrl}</a>
                    </p>
                )}
            </div>
        )}
      </li>
    );
  };

  return (
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-200">Zen Coder 設定</h1>
      <section>
        <h3 class="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Providers</h3>
        <div class="mb-4">
            <input
                type="text"
                placeholder="搜索 Provider..."
                value={searchQuery}
                onInput={handleSearchChange}
                class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                aria-label="Search Providers"
            />
        </div>

        {providerStatus && providerStatus.length > 0 ? (
          <ul class="space-y-4">
            {filteredProviders.length > 0 ? (
                 filteredProviders.map(providerInfo => renderProviderSetting(providerInfo))
             ) : (
                 <li class="text-gray-500 dark:text-gray-400 italic">未找到匹配嘅 Provider。</li>
             )}
          </ul>
        ) : (
          <p class="text-gray-500 dark:text-gray-400">正在載入 Provider 狀態...</p>
        )}
        <p class="text-xs text-gray-600 dark:text-gray-400 mt-6">啟用 Provider 並且設定對應嘅 API Key 先可以使用。</p>
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

           {/* MCP Server List and Status */}
           {Object.keys(mcpServers).length > 0 ? (
               <ul class="space-y-3">
                   {Object.entries(mcpServers).map(([serverName, serverState]) => {
                       const { config, enabled, isConnected, tools, lastError } = serverState; // Use full status
                       const configType = config.command ? 'Stdio' : (config.url ? 'SSE' : 'Unknown');
                       let statusText = '';
                       let statusColor = '';
                       let showRetryButton = false;
                       const toolCount = tools ? Object.keys(tools).length : 0;

                       if (!enabled) {
                           statusText = 'Disabled (in config)';
                           statusColor = 'text-gray-500 dark:text-gray-400';
                       } else if (isConnected) {
                           statusText = `Connected (${toolCount} tools)`;
                           statusColor = 'text-green-600 dark:text-green-400';
                           if (lastError) { // Connected but failed to fetch tools
                               statusText += ' - Tool fetch failed';
                               statusColor = 'text-yellow-600 dark:text-yellow-400'; // Indicate partial success/warning
                               showRetryButton = true; // Allow retry to fetch tools again
                           }
                       } else {
                           statusText = 'Connection Failed';
                           statusColor = 'text-red-600 dark:text-red-400';
                           showRetryButton = true; // Allow retry for failed connections
                       }

                       // Handle the temporary "Retrying..." state
                       if (lastError === 'Retrying...') {
                           statusText = 'Retrying...';
                           statusColor = 'text-yellow-600 dark:text-yellow-400';
                           showRetryButton = false; // Don't show retry while retrying
                       }

                       return (
                           <li key={serverName} class="p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm flex flex-col space-y-2">
                               <div class="flex items-center justify-between space-x-4"> {/* Top row */}
                                   <div class="flex-grow overflow-hidden">
                                       <span class="font-semibold">{serverName}</span>
                                       <span class="text-xs text-gray-500 dark:text-gray-400 ml-2">({configType})</span>
                                       <p class={`text-sm ${statusColor} font-medium truncate`} title={lastError && lastError !== 'Retrying...' ? lastError : statusText}>{statusText}</p>
                                       {lastError && !isConnected && lastError !== 'Retrying...' && ( // Show connection error only if not connected and not retrying
                                           <p class="text-xs text-red-600 dark:text-red-400 mt-1 truncate" title={lastError}>Error: {lastError}</p>
                                       )}
                                   </div>
                                   {showRetryButton && (
                                       <button
                                           onClick={() => handleRetryConnection(serverName)}
                                           class="flex-shrink-0 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                           aria-label={`Retry connection for ${serverName}`}
                                       >
                                           Retry
                                       </button>
                                    )}
                               </div>
                               {/* Conditionally render tool list */}
                               {isConnected && tools && toolCount > 0 && (
                                   <div class="mt-1 pt-2 border-t border-gray-200 dark:border-gray-700">
                                       <p class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Available Tools:</p>
                                       <ul class="list-disc list-inside space-y-0.5 max-h-20 overflow-y-auto"> {/* Limit height and scroll */}
                                           {Object.entries(tools).map(([toolName, toolDef]: [string, any]) => ( // Add type annotation for toolDef
                                               <li key={toolName} class="text-xs text-gray-700 dark:text-gray-300 truncate" title={toolDef.description || toolName}>
                                                   {toolName}
                                               </li>
                                           ))}
                                       </ul>
                                   </div>
                               )}
                           </li>
                       );
                   })}
               </ul>
           ) : (
               <p class="text-gray-500 dark:text-gray-400 italic">Loading MCP server configurations or none found...</p>
           )}
       </section>

    </div>
  );
}
