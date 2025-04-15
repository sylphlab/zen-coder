import { useCallback, useState, useEffect } from 'preact/hooks';
import { useStore } from '@nanostores/react';
import { JSX } from 'preact/jsx-runtime';
// Assuming icons are in a sibling 'icons' folder or similar - create if needed
// import { ChevronDownIcon, ChevronRightIcon } from '../icons';
import {
    AllToolsStatusInfo,
    ToolInfo,
    ToolStatus,
    CategoryStatus,
    ToolCategoryInfo,
    ToolAuthorizationConfig,
    McpConfiguredStatusPayload
} from '../../../../src/common/types';
import { $allToolsStatus, $setToolAuthorization } from '../../stores/toolStores';
import {
    $mcpStatus,
    $openGlobalMcpConfig,
    $openProjectMcpConfig,
    $retryMcpConnection
} from '../../stores/mcpStores';
import { McpServerStatus } from '../../../../src/ai/mcpManager';

// --- Mock Icons (Ensure these are defined or replaced with actual imports) ---
const ChevronRightIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
    </svg>
);
const ChevronDownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
);
// --- End Mock Icons ---

// Helper function for rendering individual tool items
const renderToolItem = (
    toolInfo: ToolInfo,
    categoryStatus: CategoryStatus,
    isSavingAuth: boolean,
    handleToolToggle: (toolIdentifier: string, currentStatus: ToolStatus) => void
): JSX.Element => {
    const { id: toolId, name: displayName, description, status: configuredStatus, resolvedStatus } = toolInfo;
    const isEffectivelyEnabled = resolvedStatus !== CategoryStatus.Disabled;
    const requiresAuth = resolvedStatus === CategoryStatus.RequiresAuthorization;

    let buttonText = '';
    let buttonClass = 'px-2 py-1 text-xs rounded focus:outline-none focus:ring-2 focus:ring-offset-1 ';
    // Determine button style based on configured status
    switch (configuredStatus) {
        case ToolStatus.Inherited:
            buttonText = 'Inherit'; buttonClass += 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500 focus:ring-gray-400'; break;
        case ToolStatus.AlwaysAvailable:
            buttonText = 'Always Allow'; buttonClass += 'bg-green-500 text-white hover:bg-green-600 focus:ring-green-400'; break;
        case ToolStatus.RequiresAuthorization:
            buttonText = 'Requires Auth'; buttonClass += 'bg-yellow-500 text-black hover:bg-yellow-600 focus:ring-yellow-400'; break;
        case ToolStatus.Disabled:
            buttonText = 'Disabled'; buttonClass += 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-400'; break;
    }

    let resolvedTooltip = `Resolved: ${resolvedStatus}`;
    if (configuredStatus === ToolStatus.Inherited) {
        resolvedTooltip += ` (Inherited from Category: ${categoryStatus})`;
    }

    return (
        <li key={toolId} class={`p-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between ${isEffectivelyEnabled ? 'bg-gray-50 dark:bg-gray-800/50' : 'bg-gray-100 dark:bg-gray-700/50 opacity-70'}`}>
            {/* Text content area */}
            <div class="flex-grow mr-4 overflow-hidden min-w-0"> {/* min-w-0 prevents flex item from overflowing */}
                <p class={`font-semibold text-sm truncate ${isEffectivelyEnabled ? 'text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}>
                    {displayName}
                    {requiresAuth && <span class="text-xs text-yellow-600 dark:text-yellow-400 ml-2 whitespace-nowrap">(Requires Auth)</span>}
                </p>
                {description && (
                    // Use whitespace-normal for wrapping
                    <p class="text-xs text-gray-600 dark:text-gray-400 mt-1 whitespace-normal">{description}</p>
                )}
            </div>
            {/* Action Button */}
            <button
                class={`flex-shrink-0 ${buttonClass} ${isSavingAuth ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => handleToolToggle(toolId, configuredStatus)}
                disabled={isSavingAuth}
                title={resolvedTooltip}
            >
                {buttonText}
            </button>
        </li>
    );
};

// Main Component
export function ToolSettings(): JSX.Element {
    // Store hooks
    const allToolsStatus = useStore($allToolsStatus);
    const { mutate: setAuthMutate, loading: isSavingAuth } = useStore($setToolAuthorization);
    const mcpServersData = useStore($mcpStatus);
    const { mutate: openGlobalMutate, loading: isOpeningGlobal } = useStore($openGlobalMcpConfig);
    const { mutate: openProjectMutate, loading: isOpeningProject } = useStore($openProjectMcpConfig);
    const { mutate: retryMutate } = useStore($retryMcpConnection);

    // Local state
    const [retryingServerName, setRetryingServerName] = useState<string | null>(null);
    const [collapsedCategories, setCollapsedCategories] = useState<{ [key: string]: boolean }>({});

    // Loading and error states from stores
    const isLoading = allToolsStatus === 'loading';
    const isToolsError = allToolsStatus === 'error';
    const isMcpLoading = mcpServersData === 'loading';
    const isMcpError = mcpServersData === 'error';


    // Initialize collapsed state when data loads (and is an array)
    useEffect(() => {
        // Only initialize if allToolsStatus is an array and collapsed state is empty
        if (Array.isArray(allToolsStatus) && Object.keys(collapsedCategories).length === 0) {
            const initialCollapsedState = allToolsStatus.reduce((acc, category) => {
                acc[category.id] = true; // Default all to collapsed
                return acc;
            }, {} as { [key: string]: boolean });
            setCollapsedCategories(initialCollapsedState);
        }
    }, [allToolsStatus]);

    // Handlers
    const toggleCategoryCollapse = useCallback((categoryId: string) => {
        setCollapsedCategories(prev => ({ ...prev, [categoryId]: !prev[categoryId] }));
    }, []);

    const handleToolToggle = useCallback((toolIdentifier: string, currentStatus: ToolStatus) => {
        const statusCycle: ToolStatus[] = [ ToolStatus.Inherited, ToolStatus.AlwaysAvailable, ToolStatus.RequiresAuthorization, ToolStatus.Disabled ];
        const nextStatus = statusCycle[(statusCycle.indexOf(currentStatus) + 1) % statusCycle.length];
        setAuthMutate({ config: { overrides: { [toolIdentifier]: nextStatus } } })
            .catch(error => console.error(`Error setting tool ${toolIdentifier} status:`, error));
    }, [setAuthMutate]);

    const handleCategoryStatusToggle = useCallback((categoryId: string, currentStatus: CategoryStatus) => {
        const statusCycle: CategoryStatus[] = [ CategoryStatus.AlwaysAvailable, CategoryStatus.RequiresAuthorization, CategoryStatus.Disabled ];
        const nextStatus = statusCycle[(statusCycle.indexOf(currentStatus) + 1) % statusCycle.length];
        const isMcp = categoryId.startsWith('mcp_');
        const configKey = isMcp ? 'mcpServers' : 'categories';
        const keyName = isMcp ? categoryId.substring(4) : categoryId;
        setAuthMutate({ config: { [configKey]: { [keyName]: nextStatus } } })
             .catch(error => console.error(`Error setting category ${categoryId} status:`, error));
    }, [setAuthMutate]);

    const handleOpenGlobalMcpConfig = useCallback(async () => {
        try { await openGlobalMutate(); } catch (error) { console.error(`Error opening global MCP config:`, error); }
    }, [openGlobalMutate]);

    const handleOpenProjectMcpConfig = useCallback(async () => {
        try { await openProjectMutate(); } catch (error) { console.error(`Error opening project MCP config:`, error); }
    }, [openProjectMutate]);

    const handleRetryConnection = useCallback(async (serverIdentifier: string) => {
        setRetryingServerName(serverIdentifier);
        try { await retryMutate({ identifier: serverIdentifier }); }
        catch (error) { console.error(`Error requesting retry for ${serverIdentifier}:`, error); }
        finally { setRetryingServerName(null); }
    }, [retryMutate]);

    // --- Category Rendering Logic ---
    const renderCategory = (category: ToolCategoryInfo) => {
        const isMcpCategory = category.id.startsWith('mcp_');
        const serverIdentifier = isMcpCategory ? category.id.substring(4) : null;
        // Safely access serverStatus only if mcpServersData is a valid object (and not loading/error/null)
        const serverStatus: McpServerStatus | undefined = serverIdentifier && typeof mcpServersData === 'object' && mcpServersData !== null
            ? mcpServersData[serverIdentifier] as McpServerStatus // Access using identifier
            : undefined;
        const isCollapsed = collapsedCategories[category.id] ?? true;

        // Determine MCP status text and color (use safely accessed serverStatus)
        let mcpStatusText = ''; let mcpStatusColor = 'text-gray-500 dark:text-gray-400'; let mcpShowRetryButton = false;
        const isThisServerRetrying = retryingServerName === serverIdentifier || serverStatus?.lastError === 'Retrying...';

        if (isMcpCategory) {
            if (!serverStatus) { mcpStatusText = 'Status Unknown'; }
            else {
                const { enabled, isConnected, lastError } = serverStatus;
                if (!enabled) { mcpStatusText = 'Disabled (config)'; mcpStatusColor = 'text-gray-500 dark:text-gray-400'; }
                else if (isConnected) {
                    mcpStatusText = `Connected`; mcpStatusColor = 'text-green-600 dark:text-green-400';
                    if (lastError && lastError !== 'Retrying...') { mcpStatusText += ' - Tools Failed'; mcpStatusColor = 'text-yellow-600 dark:text-yellow-400'; mcpShowRetryButton = true; }
                } else { mcpStatusText = 'Connection Failed'; mcpStatusColor = 'text-red-600 dark:text-red-400'; mcpShowRetryButton = true; }

                if (isThisServerRetrying) { mcpStatusText = 'Retrying...'; mcpStatusColor = 'text-yellow-600 dark:text-yellow-400'; mcpShowRetryButton = false; }
                else if (lastError && lastError !== 'Retrying...') { mcpShowRetryButton = true; } // Show retry on any persistent error when not retrying
            }
        }

        return (
            <div key={category.id} class="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm">
                {/* Clickable Category Header */}
                <div class="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700" onClick={() => toggleCategoryCollapse(category.id)}>
                    {/* Left: Icon, Name, Status */}
                    <div class="flex items-center flex-grow overflow-hidden mr-2 min-w-0">
                        <span class="mr-2 text-gray-500 dark:text-gray-400 flex-shrink-0">{isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}</span>
                        <h5 class="text-md font-medium text-gray-700 dark:text-gray-300 inline truncate">{category.name}</h5>
                        {isMcpCategory && ( <span class={`text-xs ml-2 ${mcpStatusColor} whitespace-nowrap`} title={serverStatus?.lastError && serverStatus.lastError !== 'Retrying...' ? serverStatus.lastError : mcpStatusText}>({mcpStatusText})</span> )}
                    </div>
                    {/* Right: Buttons */}
                    <div class="flex items-center space-x-2 flex-shrink-0">
                        {isMcpCategory && mcpShowRetryButton && serverIdentifier && (
                            <button onClick={(e) => { e.stopPropagation(); handleRetryConnection(serverIdentifier); }} class={`px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`} disabled={retryingServerName !== null} aria-label={`Retry connection for ${category.name}`}>Retry</button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); handleCategoryStatusToggle(category.id, category.status); }} class={`text-xs px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-offset-1 ${isSavingAuth ? 'opacity-50 cursor-not-allowed' : ''} ${ category.status === CategoryStatus.AlwaysAvailable ? 'bg-green-500 text-white hover:bg-green-600 focus:ring-green-400' : category.status === CategoryStatus.RequiresAuthorization ? 'bg-yellow-500 text-black hover:bg-yellow-600 focus:ring-yellow-400' : 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-400' }`} title={`Click to change ${isMcpCategory ? 'server' : 'category'} status (Current: ${category.status})`} disabled={isSavingAuth}>
                            {isMcpCategory ? 'Server' : 'Category'}: {category.status}
                        </button>
                    </div>
                </div>
                {/* Collapsible Tool List */}
                {!isCollapsed && (
                    // Use list for tools, remove extra padding/borders from items
                    <ul class="bg-white dark:bg-gray-800/30">
                        {category.tools.length > 0 ? (
                             category.tools.map((tool: ToolInfo) => renderToolItem(tool, category.status, isSavingAuth, handleToolToggle))
                        ) : (
                            <li class="p-3 text-sm text-gray-500 dark:text-gray-400 italic">
                                {isMcpCategory && serverStatus && !serverStatus.isConnected && serverStatus.lastError !== 'Retrying...' ? 'Connection failed or tools unavailable.' : 'No tools available.'}
                            </li>
                        )}
                    </ul>
                )}
            </div>
        );
    };

    // --- Main Render ---
    return (
        <section class="mb-8 w-full"> {/* Ensure section takes full width */}
            <h3 class="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Available Tools & MCP Servers</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Toggle individual tools or entire categories/servers on/off for the AI to use. Configure MCP server connections via JSON files (Project settings override Global).
            </p>
            {/* MCP Config Buttons */}
            <div class="flex space-x-4 mb-4">
                <button onClick={handleOpenGlobalMcpConfig} class={`px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${isOpeningGlobal ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isOpeningGlobal}>
                    {isOpeningGlobal ? 'Opening...' : 'Configure Global Servers'}
                </button>
                <button onClick={handleOpenProjectMcpConfig} class={`px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 ${isOpeningProject ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isOpeningProject}>
                    {isOpeningProject ? 'Opening...' : 'Configure Project Servers'}
                </button>
            </div>

            {/* Loading Status */}
            {(isLoading || isMcpLoading) && <p class="text-gray-500 dark:text-gray-400 italic">Loading tools and server status...</p>}
            {(isToolsError || isMcpError) && <p class="text-red-500 dark:text-red-400 italic">Error loading tools or server status.</p>}


            {/* Tool/Category List - Render only when BOTH tools and MCP data are loaded successfully */}
            {!isLoading && !isToolsError && !isMcpLoading && !isMcpError && Array.isArray(allToolsStatus) && (
                allToolsStatus.length > 0 ? (
                    <div class="space-y-6"> {/* Outer container for sections */}
                        {/* Standard Tools Section */}
                        {allToolsStatus.some(cat => !cat.id.startsWith('mcp_')) && (
                            <div>
                                <h4 class="text-lg font-semibold mb-3 text-gray-600 dark:text-gray-400">Standard Tools</h4>
                                <div class="space-y-4">
                                    {/* Ensure filtering and mapping only on array */}
                                    {allToolsStatus.filter(cat => !cat.id.startsWith('mcp_')).map(renderCategory)}
                                </div>
                            </div>
                        )}

                        {/* MCP Servers & Tools Section */}
                         {allToolsStatus.some(cat => cat.id.startsWith('mcp_')) && (
                            <div>
                                <h4 class="text-lg font-semibold mt-6 mb-3 text-gray-600 dark:text-gray-400">MCP Servers & Tools</h4>
                                <div class="space-y-4">
                                    {/* Ensure filtering and mapping only on array */}
                                    {allToolsStatus.filter(cat => cat.id.startsWith('mcp_')).map(renderCategory)}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <p class="text-gray-500 dark:text-gray-400 italic">No tools found.</p>
                )
            )}
        </section>
    );
}
