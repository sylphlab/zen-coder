import { useCallback } from 'preact/hooks';
import { useStore } from '@nanostores/react';
import { JSX } from 'preact/jsx-runtime';
import { McpServerStatus } from '../../../../src/ai/mcpManager';
import {
    $mcpStatus,
    $openGlobalMcpConfig,
    $openProjectMcpConfig,
    $retryMcpConnection
} from '../../stores/mcpStores';

export function McpServerSettings(): JSX.Element {
    // --- State from Nanostores ---
    const mcpServersData = useStore($mcpStatus);
    const { mutate: openGlobalMutate, loading: isOpeningGlobal } = useStore($openGlobalMcpConfig);
    const { mutate: openProjectMutate, loading: isOpeningProject } = useStore($openProjectMcpConfig);
    const { mutate: retryMutate, loading: isRetrying } = useStore($retryMcpConnection);

    const isLoading = mcpServersData === null;

    // --- Handlers with useCallback (kept due to try/catch logic) ---
    const handleOpenGlobalMcpConfig = useCallback(async () => {
        console.log('Requesting to open global MCP config via mutation store');
        try {
            await openGlobalMutate();
        } catch (error) {
            console.error(`Error opening global MCP config:`, error);
            // TODO: Display error
        }
    }, [openGlobalMutate]);

    const handleOpenProjectMcpConfig = useCallback(async () => {
        console.log('Requesting to open project MCP config via mutation store');
        try {
            await openProjectMutate();
        } catch (error) {
            console.error(`Error opening project MCP config:`, error);
            // TODO: Display error
        }
    }, [openProjectMutate]);

    const handleRetryConnection = useCallback(async (serverName: string) => {
        console.log(`Requesting retry for MCP server: ${serverName} via mutation store`);
        try {
            await retryMutate({ serverName });
            console.log(`Retry request sent for ${serverName}.`);
        } catch (error) {
             console.error(`Error requesting retry for ${serverName}:`, error);
             // TODO: Display error
        }
    }, [retryMutate]);

    return (
        <section class="mt-8">
            <h3 class="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">MCP Servers (Connection Status)</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Configure connections via JSON files. Project settings override global settings. Use the toggles in the "Available Tools" section above to enable/disable individual MCP tools for AI use.
            </p>
            <div class="flex space-x-4 mb-4">
                <button
                    onClick={handleOpenGlobalMcpConfig} // Use the useCallback handler
                    class={`px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${isOpeningGlobal ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={isOpeningGlobal}
                >
                    {isOpeningGlobal ? 'Opening...' : 'Configure Global Servers'}
                </button>
                <button
                    onClick={handleOpenProjectMcpConfig} // Use the useCallback handler
                    class={`px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 ${isOpeningProject ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={isOpeningProject}
                >
                    {isOpeningProject ? 'Opening...' : 'Configure Project Servers'}
                </button>
            </div>

            {isLoading && <p class="text-gray-500 dark:text-gray-400 italic">Loading MCP server configurations...</p>}
            {!isLoading && mcpServersData && (() => {
                return Object.keys(mcpServersData).length > 0 ? (
                    <ul class="space-y-3">
                        {Object.entries(mcpServersData).map(([serverName, serverState]) => {
                            const serverStatus = serverState as McpServerStatus;
                            const { config, enabled, isConnected, tools, lastError } = serverStatus;
                            const configType = config.command ? 'Stdio' : (config.url ? 'SSE' : 'Unknown');
                            let statusText = '';
                            let statusColor = '';
                            let showRetryButton = false;
                            const isCurrentlyRetrying = isRetrying; // Global loading state
                            const toolCount = tools ? Object.keys(tools).length : 0;

                            if (!enabled) {
                                statusText = 'Disabled (in config)';
                                statusColor = 'text-gray-500 dark:text-gray-400';
                            } else if (isConnected) {
                                statusText = `Connected (${toolCount} tools available)`;
                                statusColor = 'text-green-600 dark:text-green-400';
                                if (lastError && lastError !== 'Retrying...') {
                                    statusText += ' - Tool fetch failed';
                                    statusColor = 'text-yellow-600 dark:text-yellow-400';
                                    showRetryButton = true;
                                }
                            } else {
                                statusText = 'Connection Failed';
                                statusColor = 'text-red-600 dark:text-red-400';
                                showRetryButton = true;
                            }

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
                                             onClick={() => handleRetryConnection(serverName)} // Use arrow function wrapper for parameter
                                             class={`flex-shrink-0 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isCurrentlyRetrying ? 'animate-pulse' : ''}`}
                                             disabled={isCurrentlyRetrying}
                                             aria-label={`Retry connection for ${serverName}`}
                                         >
                                             {isCurrentlyRetrying ? 'Retrying...' : 'Retry'}
                                        </button>
                                     )}
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <p class="text-gray-500 dark:text-gray-400 italic">No MCP server configurations found.</p>
                );
            })()}
        </section>
    );
}
