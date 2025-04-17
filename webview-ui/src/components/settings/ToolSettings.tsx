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
import { Button } from '../ui/Button'; // Import the Button component

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

    // Determine button text and styling based on configured status
    let buttonText = '';
    let buttonIcon = '';
    let buttonClass = '';
    
    switch (configuredStatus) {
        case ToolStatus.Inherited:
            buttonText = 'Inherit';
            buttonIcon = 'i-carbon-arrow-up';
            buttonClass = 'bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)]';
            break;
        case ToolStatus.AlwaysAvailable:
            buttonText = 'Always Allow';
            buttonIcon = 'i-carbon-checkmark-filled';
            buttonClass = 'bg-[var(--vscode-testing-iconPassed)] text-white';
            break;
        case ToolStatus.RequiresAuthorization:
            buttonText = 'Requires Auth';
            buttonIcon = 'i-carbon-warning-filled';
            buttonClass = 'bg-[var(--vscode-editorWarning-foreground)] text-white';
            break;
        case ToolStatus.Disabled:
            buttonText = 'Disabled';
            buttonIcon = 'i-carbon-close-filled';
            buttonClass = 'bg-[var(--vscode-editorError-foreground)] text-white';
            break;
    }

    let resolvedTooltip = `Resolved: ${resolvedStatus}`;
    if (configuredStatus === ToolStatus.Inherited) {
        resolvedTooltip += ` (Inherited from Category: ${categoryStatus})`;
    }

    return (
        <li key={toolId} class={`p-3 border-t border-[var(--vscode-panel-border)] border-opacity-30 flex items-center justify-between ${isEffectivelyEnabled ? 'bg-[var(--vscode-editorWidget-background)]' : 'bg-[var(--vscode-input-background)] opacity-70'}`}>
            {/* Text content area */}
            <div class="flex-grow mr-4 overflow-hidden min-w-0"> {/* min-w-0 prevents flex item from overflowing */}
                <p class={`font-semibold text-sm truncate ${isEffectivelyEnabled ? 'text-[var(--vscode-foreground)]' : 'text-[var(--vscode-foreground)] opacity-60'}`}>
                    {displayName}
                    {requiresAuth && <span class="text-xs text-[var(--vscode-notificationsWarningIcon)] ml-2 whitespace-nowrap">(Requires Auth)</span>}
                </p>
                {description && (
                    // Use whitespace-normal for wrapping
                    <p class="text-xs text-[var(--vscode-foreground)] opacity-70 mt-1 whitespace-normal">{description}</p>
                )}
            </div>
            {/* Custom styled button for better visibility */}
            <div
                className={`flex-shrink-0 px-3 py-1 rounded-md text-xs flex items-center space-x-1 transition-colors ${buttonClass} hover:opacity-90 cursor-pointer ${isSavingAuth ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => !isSavingAuth && handleToolToggle(toolId, configuredStatus)}
                title={resolvedTooltip}
            >
                <span class={`${buttonIcon} h-3 w-3`}></span>
                <span>{buttonText}</span>
            </div>
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
        let mcpStatusText = ''; let mcpStatusColor = 'text-[var(--vscode-foreground)] opacity-60'; let mcpShowRetryButton = false;
        const isThisServerRetrying = retryingServerName === serverIdentifier || serverStatus?.lastError === 'Retrying...';

        if (isMcpCategory) {
            if (!serverStatus) { mcpStatusText = 'Status Unknown'; }
            else {
                const { enabled, isConnected, lastError } = serverStatus;
                if (!enabled) { mcpStatusText = 'Disabled (config)'; mcpStatusColor = 'text-[var(--vscode-foreground)] opacity-60'; }
                else if (isConnected) {
                    mcpStatusText = `Connected`; mcpStatusColor = 'text-[var(--vscode-testing-iconPassed)]';
                    if (lastError && lastError !== 'Retrying...') { mcpStatusText += ' - Tools Failed'; mcpStatusColor = 'text-[var(--vscode-notificationsWarningIcon)]'; mcpShowRetryButton = true; }
                } else { mcpStatusText = 'Connection Failed'; mcpStatusColor = 'text-[var(--vscode-notificationsErrorIcon)]'; mcpShowRetryButton = true; }

                if (isThisServerRetrying) { mcpStatusText = 'Retrying...'; mcpStatusColor = 'text-[var(--vscode-notificationsWarningIcon)]'; mcpShowRetryButton = false; }
                else if (lastError && lastError !== 'Retrying...') { mcpShowRetryButton = true; } // Show retry on any persistent error when not retrying
            }
        }

        return (
            <div key={category.id} class="border border-[var(--vscode-panel-border)] rounded-lg overflow-hidden shadow-sm">
                {/* Clickable Category Header */}
                <div class="flex items-center justify-between p-3 bg-[var(--vscode-sideBar-background)] cursor-pointer hover:bg-[var(--vscode-list-hoverBackground)]" onClick={() => toggleCategoryCollapse(category.id)}>
                    {/* Left: Icon, Name, Status */}
                    <div class="flex items-center flex-grow overflow-hidden mr-2 min-w-0">
                        <span class="mr-2 text-[var(--vscode-foreground)] opacity-60 flex-shrink-0">{isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}</span>
                        <h5 class="text-md font-medium text-[var(--vscode-foreground)] inline truncate">{category.name}</h5>
                        {isMcpCategory && ( <span class={`text-xs ml-2 ${mcpStatusColor} whitespace-nowrap`} title={serverStatus?.lastError && serverStatus.lastError !== 'Retrying...' ? serverStatus.lastError : mcpStatusText}>({mcpStatusText})</span> )}
                    </div>
                    {/* Right: Buttons */}
                    <div class="flex items-center space-x-2 flex-shrink-0">
                        {/* Use Button component for Retry */}
                        {isMcpCategory && mcpShowRetryButton && serverIdentifier && (
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); handleRetryConnection(serverIdentifier); }}
                                className="!py-1 !px-2 text-xs" // Override padding/text size
                                disabled={retryingServerName !== null}
                                aria-label={`Retry connection for ${category.name}`}
                            >
                                Retry
                            </Button>
                        )}
                        {/* Status toggle with better visual indicators */}
                        <div
                            onClick={(e) => { e.stopPropagation(); handleCategoryStatusToggle(category.id, category.status); }}
                            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors flex items-center space-x-1.5 cursor-pointer ${
                                isSavingAuth ? 'opacity-50 cursor-wait' : ''
                            } ${
                                category.status === CategoryStatus.AlwaysAvailable
                                    ? 'bg-[var(--vscode-testing-passedBackground)] text-[var(--vscode-testing-iconPassed)]'
                                    : category.status === CategoryStatus.RequiresAuthorization
                                        ? 'bg-[var(--vscode-editorWarning-foreground)] bg-opacity-10 text-[var(--vscode-editorWarning-foreground)]'
                                        : 'bg-[var(--vscode-editorError-foreground)] bg-opacity-10 text-[var(--vscode-editorError-foreground)]'
                            }`}
                            title={`${isMcpCategory ? 'MCP Server' : 'Tool Category'} Status: ${category.status}`}
                        >
                            {category.status === CategoryStatus.AlwaysAvailable && (
                                <span class="i-carbon-checkmark-filled h-3 w-3"></span>
                            )}
                            {category.status === CategoryStatus.RequiresAuthorization && (
                                <span class="i-carbon-warning-filled h-3 w-3"></span>
                            )}
                            {category.status === CategoryStatus.Disabled && (
                                <span class="i-carbon-close-filled h-3 w-3"></span>
                            )}
                            <span>{category.status}</span>
                        </div>
                    </div>
                </div>
                {/* Collapsible Tool List */}
                {!isCollapsed && (
                    <div class="bg-[var(--vscode-editorWidget-background)]">
                        {category.tools.length > 0 ? (
                            <ul>
                                {category.tools.map((tool: ToolInfo) => renderToolItem(tool, category.status, isSavingAuth, handleToolToggle))}
                            </ul>
                        ) : (
                            <div class="p-3 text-sm text-[var(--vscode-foreground)] opacity-60 italic">
                                {isMcpCategory && serverStatus && !serverStatus.isConnected && serverStatus.lastError !== 'Retrying...' ? 'Connection failed or tools unavailable.' : 'No tools available.'}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // --- Main Render ---
    return (
        <section class="mb-8 w-full"> {/* Ensure section takes full width */}
            <h3 class="text-xl font-semibold mb-4 text-[var(--vscode-foreground)]">Available Tools & MCP Servers</h3>
            <p class="text-sm text-[var(--vscode-foreground)] opacity-70 mb-4">
                Control which tools and MCP servers your AI assistant can access. Configure permissions and integration settings below.
            </p>
            
            {/* Legend for status indicators */}
            <div class="mb-6 bg-[var(--vscode-editorWidget-background)] p-4 rounded-lg border border-[var(--vscode-panel-border)] border-opacity-30">
                <h4 class="text-sm font-medium text-[var(--vscode-foreground)] mb-2">Status Legend:</h4>
                <div class="grid grid-cols-3 gap-2">
                    <div class="flex items-center space-x-2">
                        <div class="w-3 h-3 rounded-full bg-[var(--vscode-testing-iconPassed)]"></div>
                        <span class="text-xs text-[var(--vscode-foreground)]">Always Available</span>
                    </div>
                    <div class="flex items-center space-x-2">
                        <div class="w-3 h-3 rounded-full bg-[var(--vscode-editorWarning-foreground)]"></div>
                        <span class="text-xs text-[var(--vscode-foreground)]">Requires Authorization</span>
                    </div>
                    <div class="flex items-center space-x-2">
                        <div class="w-3 h-3 rounded-full bg-[var(--vscode-editorError-foreground)]"></div>
                        <span class="text-xs text-[var(--vscode-foreground)]">Disabled</span>
                    </div>
                </div>
            </div>
            
            {/* MCP Config Buttons - Better styling */}
            <div class="flex flex-wrap gap-3 mb-6">
                <Button
                    variant="primary"
                    size="md"
                    onClick={handleOpenGlobalMcpConfig}
                    disabled={isOpeningGlobal}
                    loading={isOpeningGlobal}
                    className="flex items-center space-x-2"
                >
                    <span class="i-carbon-data-base h-4 w-4"></span> {/* Changed server to data-base */}
                    <span>Configure Global Servers</span>
                </Button>
                <Button
                    variant="primary"
                    size="md"
                    onClick={handleOpenProjectMcpConfig}
                    disabled={isOpeningProject}
                    loading={isOpeningProject}
                    className="flex items-center space-x-2"
                >
                    <span class="i-carbon-folder h-4 w-4"></span>
                    <span>Configure Project Servers</span>
                </Button>
            </div>

            {/* Loading Status */}
            {(isLoading || isMcpLoading) && <p class="text-[var(--vscode-foreground)] opacity-60 italic">Loading tools and server status...</p>}
            {(isToolsError || isMcpError) && <p class="text-[var(--vscode-notificationsErrorIcon)] italic">Error loading tools or server status.</p>}


            {/* Tool/Category List - Render only when BOTH tools and MCP data are loaded successfully */}
            {!isLoading && !isToolsError && !isMcpLoading && !isMcpError && Array.isArray(allToolsStatus) && (
                allToolsStatus.length > 0 ? (
                    <div class="space-y-6"> {/* Outer container for sections */}
                        {/* Standard Tools Section */}
                        {allToolsStatus.some(cat => !cat.id.startsWith('mcp_')) && (
                            <div>
                                <h4 class="text-lg font-semibold mb-3 text-[var(--vscode-foreground)] opacity-80">Standard Tools</h4>
                                <div class="space-y-4">
                                    {/* Ensure filtering and mapping only on array */}
                                    {allToolsStatus.filter(cat => !cat.id.startsWith('mcp_')).map(renderCategory)}
                                </div>
                            </div>
                        )}

                        {/* MCP Servers & Tools Section */}
                         {allToolsStatus.some(cat => cat.id.startsWith('mcp_')) && (
                            <div>
                                <h4 class="text-lg font-semibold mt-6 mb-3 text-[var(--vscode-foreground)] opacity-80">MCP Servers & Tools</h4>
                                <div class="space-y-4">
                                    {/* Ensure filtering and mapping only on array */}
                                    {allToolsStatus.filter(cat => cat.id.startsWith('mcp_')).map(renderCategory)}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <p class="text-[var(--vscode-foreground)] opacity-60 italic">No tools found.</p>
                )
            )}
        </section>
    );
}
