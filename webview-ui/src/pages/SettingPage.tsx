// import { h } from 'preact'; // Removed unused import
import { useState, useMemo, useEffect, useCallback } from 'preact/hooks';
import { useAtom, useAtomValue, useSetAtom, atom } from 'jotai';
import { loadable } from 'jotai/utils'; // Import loadable
import { useLocation } from "wouter";
import { JSX } from 'preact/jsx-runtime'; // Import JSX namespace
import { postMessage } from '../app'; // Keep postMessage
import { McpServerStatus } from '../../../src/ai/mcpManager';
import { ModelSelector } from '../components/ModelSelector';
// Import types from common/types.ts
import {
    AvailableModel,
    DefaultChatConfig,
    ProviderInfoAndStatus,
    McpConfiguredStatusPayload,
    AllToolsStatusPayload,
    ToolInfo
} from '../../../src/common/types';
// Import atoms from store
import {
    providerStatusAtom,
    defaultConfigAtom,
    availableProvidersAtom,
} from '../store/atoms';

// Define props for the SettingPage
// Remove props interface, component will read from atoms
// interface SettingPageProps {
//   providerStatus: ProviderInfoAndStatus[];
//   onProviderToggle: (providerId: string, enabled: boolean) => void;
// }
// Removed local definitions - now imported from common/types
// interface McpConfiguredStatusPayload { ... }
// interface McpCombinedState { ... } // Keep this local state type if needed
// interface ToolInfo { ... }
// interface AllToolsStatusPayload { ... }

// Keep local state type if needed for component state
interface McpCombinedState {
   [serverName: string]: McpServerStatus;
}
// Removed stray closing brace

// --- Tool Categorization Logic ---
const categorizeTools = (tools: AllToolsStatusPayload): Record<string, AllToolsStatusPayload> => {
    const categories: Record<string, AllToolsStatusPayload> = {
        'Standard: Filesystem': {},
        'Standard: VS Code': {},
        'Standard: Utilities': {},
        // MCP categories will be added dynamically
    };

    for (const [id, info] of Object.entries(tools)) { // Remove assertion, add type in loop if needed
        if (info.type === 'standard') {
            // Basic categorization based on name patterns (can be refined)
            if (id.toLowerCase().includes('file') || id.toLowerCase().includes('dir') || id.toLowerCase().includes('path') || id.toLowerCase().includes('item')) {
                 categories['Standard: Filesystem'][id] = info;
            } else if (id.toLowerCase().includes('editor') || id.toLowerCase().includes('vscode') || id.toLowerCase().includes('tab') || id.toLowerCase().includes('terminal')) {
                 categories['Standard: VS Code'][id] = info;
            } else {
                 categories['Standard: Utilities'][id] = info;
            }
        } else if (info.type === 'mcp' && info.serverName) {
            const categoryName = `MCP: ${info.serverName}`;
            if (!categories[categoryName]) {
                categories[categoryName] = {};
            }
            categories[categoryName][id] = info;
        }
    }

    // Remove empty standard categories
    Object.keys(categories).forEach(catName => {
        if (catName.startsWith('Standard:') && Object.keys(categories[catName]).length === 0) {
            delete categories[catName];
        }
    });


    return categories;
};


// Removed local defaultConfigAtom declaration
export function SettingPage() { // Remove props
   // Read state from atoms
   // Use loadable to handle async atom states
   const providerStatusLoadable = useAtomValue(loadable(providerStatusAtom));
   const defaultConfigLoadable = useAtomValue(loadable(defaultConfigAtom));
   const availableProviders = useAtomValue(availableProvidersAtom);
   // Removed: const providerModelsMap = useAtomValue(providerModelsMapAtom); // Use atomFamily where needed (e.g., in ModelSelector)
   // State to hold the temporary API key input for each provider
   const [apiKeysInput, setApiKeysInput] = useState<{ [providerId: string]: string }>({});
   // State for the search query
   const [searchQuery, setSearchQuery] = useState('');
   // Combined state for MCP servers (still needed for server-level status)
   const [mcpServers, setMcpServers] = useState<McpCombinedState>({});
   // State for ALL tools (standard + MCP) with their status
   const [allToolsStatus, setAllToolsStatus] = useState<AllToolsStatusPayload>({});
   // State for custom instructions
   const [globalInstructions, setGlobalInstructions] = useState<string>('');
   const [projectInstructions, setProjectInstructions] = useState<string>('');
   const [projectInstructionsPath, setProjectInstructionsPath] = useState<string | null>(null); // To display the path
   // Hook for navigation
   const [, setLocation] = useLocation();
   // Removed local state for defaultConfig, availableProviders, providerModelsMap

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
  // Filter providers based on search query and loaded status
  const filteredProviders = useMemo(() => {
      if (providerStatusLoadable.state !== 'hasData' || !providerStatusLoadable.data) return [];
      const currentProviderStatus = providerStatusLoadable.data;
      if (!searchQuery) {
          return currentProviderStatus;
      }
      const lowerCaseQuery = searchQuery.toLowerCase();
      return currentProviderStatus.filter(provider =>
          provider.name.toLowerCase().includes(lowerCaseQuery) ||
          provider.id.toLowerCase().includes(lowerCaseQuery)
      );
  }, [searchQuery, providerStatusLoadable]);

   // Effect to fetch initial status and listen for updates
   useEffect(() => {
       // Request initial state
       postMessage({ type: 'settingsPageReady' });
       postMessage({ type: 'getMcpConfiguredStatus' });
       // Don't request all models here anymore. Request providers via settingsPageReady.
       // postMessage({ type: 'getAvailableModels' }); // Removed
       postMessage({ type: 'getDefaultConfig' }); // Request current default config
       console.log('SettingsPage mounted, requested initial data');

       // Add message listener for updates
       const handleMessage = (event: MessageEvent) => {
           const message = event.data;

           switch (message.type) {
               case 'updateMcpConfiguredStatus': // Keep this for server-level info like connection errors
                   console.log('[SettingsPage] Received updateMcpConfiguredStatus:', message.payload);
                   setMcpServers(message.payload as McpConfiguredStatusPayload);
                   break;

               case 'updateAllToolsStatus': // Handle the unified tools status message
                   console.log('[SettingsPage] Received updateAllToolsStatus:', message.payload);
                   setAllToolsStatus(message.payload as AllToolsStatusPayload);
                   break;

               case 'mcpConfigReloaded': // Listen for backend reload signal
                   console.log('[SettingsPage] Received mcpConfigReloaded, requesting new status...');
                   postMessage({ type: 'settingsPageReady' }); // Re-request all tools status
                   postMessage({ type: 'getMcpConfiguredStatus' }); // Re-fetch MCP server status
                   break;
               case 'updateCustomInstructions':
                   console.log('[SettingsPage] Received updateCustomInstructions:', message.payload);
                   setGlobalInstructions(message.payload.global || '');
                   setProjectInstructions(message.payload.project || '');
                   setProjectInstructionsPath(message.payload.projectPath || null);
                   break;
               // Removed handling for availableProviders, providerModelsLoaded, updateDefaultConfig
               // These should be handled by the MessageHandlerComponent updating atoms
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

    // Handler for the MCP server Retry button
    const handleRetryConnection = (serverName: string) => {
        console.log(`Requesting retry for MCP server: ${serverName}`);
        postMessage({ type: 'retryMcpConnection', payload: { serverName } });
        // Optimistic UI update for server status
        setMcpServers(prev => ({
            ...prev,
            [serverName]: {
                ...(prev[serverName] || { config: {}, enabled: false, isConnected: false }),
                lastError: 'Retrying...',
            }
        }));
    };

    // Handler for toggling ANY tool (standard or MCP)
    const handleToolToggle = (toolIdentifier: string, enabled: boolean) => {
        console.log(`Toggling tool ${toolIdentifier} to ${enabled}`);
        postMessage({
            type: 'setToolEnabled', // Use the unified handler type
            payload: { toolIdentifier, enabled }
        });
        // Optimistically update UI state for the specific tool
        setAllToolsStatus(prev => ({
            ...prev,
            [toolIdentifier]: { ...(prev[toolIdentifier] || { description: '', enabled: !enabled, type: 'standard' }), enabled }
        }));
    };

    // Handler for toggling all tools within a category
    const handleCategoryToggle = (categoryTools: AllToolsStatusPayload, newState: boolean) => {
        const updates: { toolIdentifier: string, enabled: boolean }[] = [];
        const optimisticUpdates: AllToolsStatusPayload = {};

        for (const [toolId, toolInfo] of Object.entries(categoryTools)) { // Remove assertion
            // Only toggle if the state is actually changing
            if (toolInfo.enabled !== newState) {
                 updates.push({ toolIdentifier: toolId, enabled: newState });
                 optimisticUpdates[toolId] = { ...toolInfo, enabled: newState };
            } else {
                 // Keep existing state if no change
                 optimisticUpdates[toolId] = toolInfo;
            }
        }

        if (updates.length > 0) {
            console.log(`Toggling ${updates.length} tools in category to ${newState}`);
            // Send updates to backend (could potentially batch these in a new message type later)
            updates.forEach(update => {
                postMessage({
                    type: 'setToolEnabled',
                    payload: update
                });
            });

            // Optimistically update UI state for the entire category
            setAllToolsStatus(prev => {
                const newState = { ...prev };
                for (const [toolId, updatedInfo] of Object.entries(optimisticUpdates)) {
                    newState[toolId] = updatedInfo;
                }
                return newState;
            });
        }
    };

    // Handler for the back button
    const handleBackClick = useCallback(() => {
        setLocation('/index.html'); // Navigate back to the chat page (using correct path)
    }, [setLocation]);

    // --- Custom Instructions Handlers ---
    const handleGlobalInstructionsChange = (e: Event) => {
        setGlobalInstructions((e.target as HTMLTextAreaElement).value);
    };

    const handleProjectInstructionsChange = (e: Event) => {
        setProjectInstructions((e.target as HTMLTextAreaElement).value);
    };

    const handleSaveGlobalInstructions = () => {
        console.log('Saving global custom instructions...');
        postMessage({ type: 'setGlobalCustomInstructions', payload: { instructions: globalInstructions } });
        // Optionally show feedback, e.g., a temporary "Saved!" message
    };

    const handleSaveProjectInstructions = () => {
        console.log('Saving project custom instructions...');
        postMessage({ type: 'setProjectCustomInstructions', payload: { instructions: projectInstructions } });
        // Optionally show feedback
    };

    const handleOpenProjectInstructionsFile = () => {
        console.log('Requesting to open project custom instructions file...');
        postMessage({ type: 'openOrCreateProjectInstructionsFile' });
    };

    // --- Default Model Handlers ---
    // Callback now receives separate provider and model IDs
    const handleDefaultChatModelChange = useCallback((newProviderId: string | null, newModelId: string | null) => {
        // Backend expects separate fields now (assuming DefaultChatConfig is updated or will be)
        // TODO: Verify/update DefaultChatConfig type and backend handler if needed
        console.log(`Setting default chat model: Provider=${newProviderId}, Model=${newModelId}`);
        postMessage({
            type: 'setDefaultConfig',
            payload: {
                config: {
                    // Send separate fields
                    defaultProviderId: newProviderId ?? undefined,
                    defaultModelId: newModelId ?? undefined
                }
            }
        });
    }, []);

  // Render logic for a single provider setting
  // Define onProviderToggle using atom setter
  // Removed direct setting of providerStatus atom
  const onProviderToggle = useCallback((providerId: string, enabled: boolean) => {
       console.log(`Requesting toggle provider ${providerId} to ${enabled}`);
       // Send message to backend to update the setting
       postMessage({ type: 'setProviderEnabled', payload: { provider: providerId, enabled: enabled } });
       // The providerStatusAtom will update via refetch or push update
   }, []); // No dependency on setProviderStatus needed

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
              {/* Model count display removed */}
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

  // Helper to render a single tool item with a toggle
  const renderToolItem = (toolIdentifier: string, toolInfo: ToolInfo) => {
      const displayName = toolInfo.type === 'mcp' ? `${toolIdentifier.split('/')[1]}` : toolIdentifier; // Simpler display name
      const isMcpTool = toolInfo.type === 'mcp';
      const serverName = toolInfo.serverName;
      const serverConnected = serverName ? mcpServers[serverName]?.isConnected : false;
      // MCP tool is only truly usable if its server is connected AND it's enabled via override
      const effectivelyEnabled = toolInfo.enabled && (!isMcpTool || serverConnected);
      const canToggle = true; // All tools can be toggled now

      return (
          <li key={toolIdentifier} class={`p-3 border rounded-lg shadow-sm flex items-center justify-between ${effectivelyEnabled ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700' : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 opacity-70'}`}>
              <div>
                  <p class={`font-semibold text-sm ${effectivelyEnabled ? 'text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}>
                      {displayName}
                      {isMcpTool && !serverConnected && <span class="text-xs text-yellow-600 dark:text-yellow-400 ml-2">(Server Disconnected)</span>}
                  </p>
                  {toolInfo.description && (
                      <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">{toolInfo.description}</p>
                  )}
              </div>
              <label class="flex items-center cursor-pointer">
                  <input
                      type="checkbox"
                      class="sr-only peer" // Hide default checkbox
                      checked={toolInfo.enabled} // Checkbox reflects the stored enabled state
                      disabled={!canToggle}
                      onChange={(e) => handleToolToggle(toolIdentifier, (e.target as HTMLInputElement).checked)}
                  />
                  {/* Custom toggle styling */}
                  <div class={`relative w-11 h-6 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 ${canToggle ? 'bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 peer-checked:bg-blue-600' : 'bg-gray-400 cursor-not-allowed'}`}></div>
              </label>
          </li>
      );
  };

  // Categorize tools for rendering
  const categorizedTools = useMemo(() => categorizeTools(allToolsStatus), [allToolsStatus]);
  const categoryOrder = useMemo(() => [
      'Standard: Filesystem',
      'Standard: VS Code',
      'Standard: Utilities',
      // MCP categories will be appended dynamically based on categorizedTools keys
      ...Object.keys(categorizedTools).filter(cat => cat.startsWith('MCP:'))
  ], [categorizedTools]);


  // Ensure the function explicitly returns JSX
  return (
    // Add relative positioning for the absolute back button
    <div class="p-6 relative">
        {/* Back Button */}
        <button
            onClick={handleBackClick}
            class="absolute top-4 left-4 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 z-10" // Added z-index
            title="Back to Chat"
        >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
        </button>

      <h1 class="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-200 text-center">Zen Coder 設定</h1>

      {/* --- Default Models Section --- */}
      <section class="mb-8">
          <h3 class="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Default Models</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Select the default AI models to be used for new chat sessions or when a chat is set to use defaults.
          </p>
          <div class="space-y-4">
              {/* Use the new ModelSelector component */}
              <div class="p-4 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
                   {/* Handle loading/error state for defaultConfig */}
                   {defaultConfigLoadable.state === 'loading' && <p class="text-sm text-gray-500">Loading default config...</p>}
                   {defaultConfigLoadable.state === 'hasError' && <p class="text-sm text-red-500">Error loading default config.</p>}
                   {defaultConfigLoadable.state === 'hasData' && (() => {
                       // Assume defaultConfigLoadable.data has separate fields now
                       // TODO: Update DefaultChatConfig type if needed
                       const defaultProviderId = defaultConfigLoadable.data?.defaultProviderId ?? null;
                       const defaultModelId = defaultConfigLoadable.data?.defaultModelId ?? null;

                       return (
                           <ModelSelector
                               labelPrefix="Default Chat"
                               selectedProviderId={defaultProviderId}
                               selectedModelId={defaultModelId}
                               onModelChange={handleDefaultChatModelChange}
                           />
                       );
                   })()}
              </div>
              {/* TODO: Add selectors for defaultImageModelId and defaultOptimizeModelId later */}
              {/* <p class="text-xs text-gray-500 dark:text-gray-400">Default Image Generation Model: (Coming Soon)</p> */}
              {/* <p class="text-xs text-gray-500 dark:text-gray-400">Default Instruction Optimization Model: (Coming Soon)</p> */}
          </div>
      </section>

      {/* --- Custom Instructions Section --- */}
      <section class="mb-8">
          <h3 class="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Custom Instructions</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Provide instructions to guide the AI's behavior and responses. Global instructions apply to all projects, while project instructions are specific to the current workspace and are appended after global ones. Use Markdown format.
          </p>

          {/* Global Instructions */}
          <div class="mb-6">
              <label for="global-instructions" class="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Global Instructions (VS Code Setting)</label>
              <textarea
                  id="global-instructions"
                  rows={8}
                  class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-mono"
                  value={globalInstructions}
                  onInput={handleGlobalInstructionsChange}
                  placeholder="Enter global instructions here..."
                  aria-label="Global Custom Instructions"
              />
              <button
                  onClick={handleSaveGlobalInstructions}
                  class="mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                  Save Global Instructions
              </button>
          </div>

          {/* Project Instructions */}
          <div>
              <label for="project-instructions" class="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Project Instructions</label>
              {projectInstructionsPath ? (
                 <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">Editing: <code>{projectInstructionsPath}</code></p>
              ) : (
                 <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">No project file found. Saving will create <code>.zen/custom_instructions.md</code>.</p>
              )}
              <textarea
                  id="project-instructions"
                  rows={12}
                  class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-mono"
                  value={projectInstructions}
                  onInput={handleProjectInstructionsChange}
                  placeholder="Enter project-specific instructions here..."
                  aria-label="Project Custom Instructions"
              />
               <div class="mt-2 flex space-x-2">
                   <button
                       onClick={handleSaveProjectInstructions}
                       class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                   >
                       Save Project Instructions
                   </button>
                   <button
                       onClick={handleOpenProjectInstructionsFile}
                       class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                   >
                       Open/Create Project File
                   </button>
               </div>
          </div>
      </section>

      {/* --- All Tools Section (Categorized) --- */}
      <section class="mb-8">
          <h3 class="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Available Tools</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Toggle individual tools or entire categories on/off for the AI to use. MCP tools require their server to be connected.
          </p>
          {Object.keys(categorizedTools).length > 0 ? (
              <div class="space-y-6">
                  {categoryOrder.map(categoryName => {
                      const toolsInCategory = categorizedTools[categoryName];
                      if (!toolsInCategory || Object.keys(toolsInCategory).length === 0) {
                          return null; // Skip empty categories
                      }

                      // Add type assertion for Object.values result
                      const allEnabled = Object.values(toolsInCategory as AllToolsStatusPayload).every((t: ToolInfo) => t.enabled);
                      const noneEnabled = Object.values(toolsInCategory as AllToolsStatusPayload).every((t: ToolInfo) => !t.enabled);
                      const isIndeterminate = !allEnabled && !noneEnabled;

                      return (
                          <div key={categoryName}>
                              <div class="flex items-center justify-between mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                                  <h4 class="text-lg font-medium text-gray-700 dark:text-gray-300">{categoryName}</h4>
                                  <label class="flex items-center cursor-pointer" title={allEnabled ? "Disable all in category" : "Enable all in category"}>
                                      <input
                                          type="checkbox"
                                          class="sr-only peer"
                                          checked={allEnabled}
                                          // Use ref for indeterminate state if needed, or rely on visual cue
                                          // ref={el => el && (el.indeterminate = isIndeterminate)}
                                          onChange={(e) => handleCategoryToggle(toolsInCategory, (e.target as HTMLInputElement).checked)}
                                      />
                                      <div class={`relative w-11 h-6 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 ${isIndeterminate ? 'bg-yellow-400' : 'bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 peer-checked:bg-blue-600'}`}></div>
                                      <span class="ml-2 text-xs text-gray-500 dark:text-gray-400">Toggle All</span>
                                  </label>
                              </div>
                              <ul class="space-y-2">
                                  {Object.entries(toolsInCategory).map(([toolId, toolInfo]) => renderToolItem(toolId, toolInfo as ToolInfo))} // Keep assertion here
                              </ul>
                          </div>
                        );
                     })}
              </div>
          ) : (
              <p class="text-gray-500 dark:text-gray-400 italic">Loading available tools...</p>
          )}
      </section>


      {/* --- AI Providers Section --- */}
      <section class="mb-8">
        <h3 class="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">AI Providers</h3>
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

        {/* Handle loading/error state for providerStatus */}
        {providerStatusLoadable.state === 'loading' && <p class="text-gray-500 dark:text-gray-400">正在載入 Provider 狀態...</p>}
        {providerStatusLoadable.state === 'hasError' && <p class="text-red-500 dark:text-red-400">載入 Provider 狀態時出錯。</p>}
        {providerStatusLoadable.state === 'hasData' && (
            providerStatusLoadable.data.length > 0 ? (
                <ul class="space-y-4">
                    {filteredProviders.length > 0 ? (
                        filteredProviders.map(providerInfo => renderProviderSetting(providerInfo))
                    ) : (
                        <li class="text-gray-500 dark:text-gray-400 italic">未找到匹配嘅 Provider。</li>
                    )}
                </ul>
            ) : (
                 <p class="text-gray-500 dark:text-gray-400 italic">未找到任何 Provider。</p>
            )
        )}
        <p class="text-xs text-gray-600 dark:text-gray-400 mt-6">啟用 Provider 並且設定對應嘅 API Key 先可以使用。</p>
      </section>

      {/* --- MCP Servers Section (Keep for Server-Level Status/Config) --- */}
      <section class="mt-8">
          <h3 class="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">MCP Servers (Connection Status)</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Configure connections via JSON files. Project settings override global settings. Use the toggles in the "Available Tools" section above to enable/disable individual MCP tools for AI use.
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
                       const toolCount = tools ? Object.keys(tools).length : 0; // Still useful info

                       if (!enabled) {
                           statusText = 'Disabled (in config)';
                           statusColor = 'text-gray-500 dark:text-gray-400';
                       } else if (isConnected) {
                           statusText = `Connected (${toolCount} tools available)`; // Clarify available vs enabled
                           statusColor = 'text-green-600 dark:text-green-400';
                           if (lastError && lastError !== 'Retrying...') { // Show tool fetch error if present
                               statusText += ' - Tool fetch failed';
                               statusColor = 'text-yellow-600 dark:text-yellow-400';
                               showRetryButton = true;
                           }
                       } else {
                           statusText = 'Connection Failed';
                           statusColor = 'text-red-600 dark:text-red-400';
                           showRetryButton = true;
                       }

                       // Handle the temporary "Retrying..." state
                       if (lastError === 'Retrying...') {
                           statusText = 'Retrying...';
                           statusColor = 'text-yellow-600 dark:text-yellow-400';
                           showRetryButton = false;
                       }

                       return (
                           <li key={serverName} class="p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm flex items-center justify-between space-x-4">
                               <div class="flex-grow overflow-hidden">
                                   <span class="font-semibold">{serverName}</span>
                                   <span class="text-xs text-gray-500 dark:text-gray-400 ml-2">({configType})</span>
                                   <p class={`text-sm ${statusColor} font-medium truncate`} title={lastError && lastError !== 'Retrying...' ? lastError : statusText}>{statusText}</p>
                                   {lastError && !isConnected && lastError !== 'Retrying...' && (
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
                           </li>
                       );
                   })}
               </ul>
           ) : (
               <p class="text-gray-500 dark:text-gray-400 italic">Loading MCP server configurations or none found...</p>
           )}
       </section>
    </div>
  ); // Closing parenthesis for the main return
} // Closing brace for SettingPage function
