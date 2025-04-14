import { useCallback } from 'preact/hooks'; // Removed useEffect, useRef
// Removed Jotai imports
import { useStore } from '@nanostores/react'; // Use Nanostores hook
import { JSX } from 'preact/jsx-runtime';
// import { requestData } from '../../utils/communication'; // Removed requestData import
import {
    AllToolsStatusInfo,
    ToolInfo,
    ToolStatus,
    CategoryStatus,
    ToolCategoryInfo,
    ToolAuthorizationConfig // Added config type import
} from '../../../../src/common/types';
import { $allToolsStatus, $setToolAuthorization } from '../../stores/toolStores'; // Import mutation store

export function ToolSettings(): JSX.Element {
    const allToolsStatus = useStore($allToolsStatus);
    const { mutate: setAuthMutate, loading: isSavingAuth } = useStore($setToolAuthorization); // Use mutation store
    const isLoading = allToolsStatus === null;

    const handleToolToggle = useCallback((toolIdentifier: string, currentStatus: ToolStatus) => {
        const statusCycle: ToolStatus[] = [
            ToolStatus.Inherited,
            ToolStatus.AlwaysAvailable,
            ToolStatus.RequiresAuthorization,
            ToolStatus.Disabled,
        ];
        const currentIndex = statusCycle.indexOf(currentStatus);
        const nextIndex = (currentIndex + 1) % statusCycle.length;
        const newStatus = statusCycle[nextIndex];
        const payload: { config: Partial<ToolAuthorizationConfig> } = {
            config: { overrides: { [toolIdentifier]: newStatus } }
        };
        console.log(`Setting tool ${toolIdentifier} override status to ${newStatus} via mutation store.`);
        setAuthMutate(payload)
            .then(() => console.log(`Tool ${toolIdentifier} status update request sent.`))
            .catch(error => console.error(`Error setting tool ${toolIdentifier} status:`, error));
        // Update will happen via $allToolsStatus subscription
    }, [setAuthMutate]);

    const handleCategoryStatusToggle = useCallback((categoryId: string, currentStatus: CategoryStatus) => {
        const statusCycle: CategoryStatus[] = [
            CategoryStatus.AlwaysAvailable,
            CategoryStatus.RequiresAuthorization,
            CategoryStatus.Disabled,
        ];
        const currentIndex = statusCycle.indexOf(currentStatus);
        const nextIndex = (currentIndex + 1) % statusCycle.length;
        const newStatus = statusCycle[nextIndex];
        console.log(`Setting category/server ${categoryId} status to ${newStatus} via mutation store.`);

        const isMcp = categoryId.startsWith('mcp_');
        const configKey = isMcp ? 'mcpServers' : 'categories';
        const keyName = isMcp ? categoryId.substring(4) : categoryId;

        const payload: { config: Partial<ToolAuthorizationConfig> } = {
            config: { [configKey]: { [keyName]: newStatus } }
        };

        setAuthMutate(payload)
            .then(() => console.log(`Category ${categoryId} status update request sent.`))
            .catch(error => console.error(`Error setting category ${categoryId} status:`, error));
        // Update will happen via $allToolsStatus subscription
    }, [setAuthMutate]);

    const renderToolItem = (toolInfo: ToolInfo, categoryStatus: CategoryStatus) => {
        const { id: toolId, name: displayName, description, status: configuredStatus, resolvedStatus } = toolInfo;
        const isEffectivelyEnabled = resolvedStatus !== CategoryStatus.Disabled;
        const requiresAuth = resolvedStatus === CategoryStatus.RequiresAuthorization;

        let buttonText = '';
        let buttonClass = 'px-2 py-1 text-xs rounded focus:outline-none focus:ring-2 focus:ring-offset-1 ';
        switch (configuredStatus) {
            case ToolStatus.Inherited:
                buttonText = 'Inherit';
                buttonClass += 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500 focus:ring-gray-400';
                break;
            case ToolStatus.AlwaysAvailable:
                buttonText = 'Always Allow';
                buttonClass += 'bg-green-500 text-white hover:bg-green-600 focus:ring-green-400';
                break;
            case ToolStatus.RequiresAuthorization:
                buttonText = 'Requires Auth';
                buttonClass += 'bg-yellow-500 text-black hover:bg-yellow-600 focus:ring-yellow-400';
                break;
            case ToolStatus.Disabled:
                buttonText = 'Disabled';
                buttonClass += 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-400';
                break;
        }

        let resolvedTooltip = `Resolved: ${resolvedStatus}`;
        if (configuredStatus === ToolStatus.Inherited) {
            resolvedTooltip += ` (Inherited from Category: ${categoryStatus})`;
        }

        return (
            <li key={toolId} class={`p-3 border rounded-lg shadow-sm flex items-center justify-between ${isEffectivelyEnabled ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700' : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 opacity-70'}`}>
                <div class="flex-grow mr-4">
                    <p class={`font-semibold text-sm ${isEffectivelyEnabled ? 'text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}>
                        {displayName}
                        {requiresAuth && <span class="text-xs text-yellow-600 dark:text-yellow-400 ml-2">(Requires Auth)</span>}
                    </p>
                    {description && (
                        <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">{description}</p>
                    )}
                </div>
                <button
                    class={`${buttonClass} ${isSavingAuth ? 'opacity-50 cursor-not-allowed' : ''}`} // Add loading state styling
                    onClick={() => handleToolToggle(toolId, configuredStatus)}
                    disabled={isSavingAuth} // Disable button while saving
                    title={resolvedTooltip}
                >
                    {buttonText}
                </button>
            </li>
        );
    };

    return (
        <section class="mb-8">
            <h3 class="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Available Tools</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Toggle individual tools or entire categories on/off for the AI to use. MCP tools require their server to be connected.
            </p>
            {isLoading && <p class="text-gray-500 dark:text-gray-400 italic">Loading available tools...</p>}
            {/* TODO: Add better error display */}
            {!isLoading && allToolsStatus && ( // Check if not loading and data exists
                allToolsStatus.length > 0 ? (
                    <div class="space-y-6">
                        {allToolsStatus.map((category: ToolCategoryInfo) => (
                            <div key={category.id}>
                                <div class="flex items-center justify-between mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                                    <h4 class="text-lg font-medium text-gray-700 dark:text-gray-300">{category.name}</h4>
                                     <button
                                         onClick={() => handleCategoryStatusToggle(category.id, category.status)}
                                         class={`text-xs px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-offset-1 ${isSavingAuth ? 'opacity-50 cursor-not-allowed' : ''} ${ // Add loading state styling
                                            category.status === CategoryStatus.AlwaysAvailable ? 'bg-green-500 text-white hover:bg-green-600 focus:ring-green-400' :
                                            category.status === CategoryStatus.RequiresAuthorization ? 'bg-yellow-500 text-black hover:bg-yellow-600 focus:ring-yellow-400' :
                                            'bg-red-500 text-white hover:bg-red-600 focus:ring-red-400'
                                        }`}
                                        title={`Click to change category status (Current: ${category.status})`}
                                    >
                                        Category: {category.status}
                                    </button>
                                </div>
                                {category.tools.length > 0 ? (
                                    <ul class="space-y-2">
                                        {category.tools.map((tool: ToolInfo) => renderToolItem(tool, category.status))}
                                    </ul>
                                ) : (
                                    <p class="text-sm text-gray-500 dark:text-gray-400 italic">No tools in this category.</p>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p class="text-gray-500 dark:text-gray-400 italic">No tools found.</p>
                )
            )}
        </section>
    );
}
