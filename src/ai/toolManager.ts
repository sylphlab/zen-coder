import * as vscode from 'vscode';
import { Tool, ToolSet } from 'ai';
import { ToolAuthorizationConfig, CategoryStatus, ToolStatus, AllToolsStatusInfo, ToolCategoryInfo, ToolInfo } from '../common/types';
import { allTools as standardToolsMap, ToolName as StandardToolName } from '../tools';
import { McpManager } from './mcpManager';

// Define standard tool categories using the correct exported tool names
const STANDARD_TOOL_CATEGORIES: { [key in StandardToolName]?: string } = {
    // Filesystem
    readFilesTool: 'filesystem',
    writeFilesTool: 'filesystem',
    listFilesTool: 'filesystem',
    createFolderTool: 'filesystem',
    statItemsTool: 'filesystem',
    deleteItemsTool: 'filesystem',
    moveRenameTool: 'filesystem',
    copyFileTool: 'filesystem',
    copyFolderTool: 'filesystem',
    editFileTool: 'filesystem',
    searchContentTool: 'filesystem',
    replaceContentTool: 'filesystem',
    // VS Code Interaction
    getOpenTabsTool: 'vscode',
    getActiveEditorContextTool: 'vscode',
    replaceInActiveEditorTool: 'vscode',
    formatDocumentTool: 'vscode',
    saveActiveFileTool: 'vscode',
    closeActiveFileTool: 'vscode',
    openFileTool: 'vscode',
    goToDefinitionTool: 'vscode',
    findReferencesTool: 'vscode',
    renameSymbolTool: 'vscode',
    getConfigurationTool: 'vscode',
    startDebuggingTool: 'vscode',
    stopDebuggingTool: 'vscode',
    debugStepOverTool: 'vscode',
    debugStepIntoTool: 'vscode',
    debugStepOutTool: 'vscode',
    addBreakpointsTool: 'vscode',
    removeBreakpointsTool: 'vscode',
    // Utils
    fetchUrlTool: 'utils',
    base64EncodeTool: 'utils',
    base64DecodeTool: 'utils',
    md5HashTool: 'utils',
    sha256HashTool: 'utils',
    uuidGenerateTool: 'utils',
    jsonParseTool: 'utils',
    jsonStringifyTool: 'utils',
    // System
    getOsInfoTool: 'system',
    getCurrentTimeTool: 'system',
    getTimezoneTool: 'system',
    getPublicIpTool: 'system',
    getActiveTerminalsTool: 'system',
    runCommandTool: 'system',
};

// Default status if not specified in config
const DEFAULT_CATEGORY_STATUS = CategoryStatus.AlwaysAvailable;
const DEFAULT_TOOL_STATUS = ToolStatus.Inherited;

export class ToolManager {
    private readonly _mcpManager: McpManager;
    private readonly _context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext, mcpManager: McpManager) {
        this._context = context;
        this._mcpManager = mcpManager;
    }

    /**
     * Prepares the final set of tools to be passed to the AI, considering authorization.
     */
    public prepareToolSet(): ToolSet {
        const finalTools: ToolSet = {};
        const authConfig = this._getToolAuthConfig();

        // 1. Process Standard Tools
        const standardToolNames = Object.keys(standardToolsMap) as StandardToolName[];
        standardToolNames.forEach(toolName => {
            const toolDefinition = standardToolsMap[toolName];
            if (!toolDefinition) { return; }
            const categoryId = this._getStandardToolCategory(toolName);
            const enabled = this._isToolEffectivelyEnabled(toolName, categoryId, null, authConfig);
            if (enabled) {
                finalTools[toolName] = toolDefinition;
            }
        });

        // 2. Process MCP Tools
        const mcpStatuses = this._mcpManager.getMcpServerConfiguredStatus();
        for (const [serverName, serverStatus] of Object.entries(mcpStatuses)) {
            if (serverStatus.isConnected && serverStatus.tools) {
                for (const [mcpToolName, mcpToolDefinition] of Object.entries(serverStatus.tools)) {
                    const toolId = `mcp_${serverName}_${mcpToolName}`;
                    const enabled = this._isToolEffectivelyEnabled(toolId, serverName, serverName, authConfig);
                    if (enabled) {
                        // Ensure the tool definition is compatible with ToolSet expectations
                        // Assuming McpTool definition fits the Tool interface
                        finalTools[toolId] = mcpToolDefinition as Tool;
                    }
                }
            }
        }
        console.log('[ToolManager] Prepared ToolSet with keys:', Object.keys(finalTools));
        return finalTools;
    }

    /**
     * Gets the authorization configuration from VS Code settings.
     */
    private _getToolAuthConfig(): ToolAuthorizationConfig {
        const config = vscode.workspace.getConfiguration('zencoder');
        return {
            categories: config.get<Record<string, CategoryStatus>>('toolAuthorization.categories') ?? {},
            mcpServers: config.get<Record<string, CategoryStatus>>('toolAuthorization.mcpServers') ?? {},
            overrides: config.get<Record<string, ToolStatus>>('toolAuthorization.overrides') ?? {}
        };
    }

    /**
     * Determines the category for a standard tool based on its name.
     */
    private _getStandardToolCategory(toolName: StandardToolName): string {
        // Simpler categorization based on the constant
        return STANDARD_TOOL_CATEGORIES[toolName] ?? 'utilities';
    }

    /**
     * Resolves the final status of a tool based on its override and its category's status.
     */
    private _resolveToolStatus(toolOverride: ToolStatus, categoryStatus: CategoryStatus): CategoryStatus {
        if (toolOverride === ToolStatus.Inherited) {
            return categoryStatus;
        }
        // Map specific tool override to final CategoryStatus
        switch (toolOverride) {
            case ToolStatus.AlwaysAvailable:
                return CategoryStatus.AlwaysAvailable;
            case ToolStatus.RequiresAuthorization:
                return CategoryStatus.RequiresAuthorization;
            case ToolStatus.Disabled:
                return CategoryStatus.Disabled;
            default: // Should not happen if types are correct
                return categoryStatus;
        }
    }

    /**
     * Determines if a tool is effectively enabled (not disabled) based on resolved status.
     * The AI should only receive tools that return true here.
     */
    private _isToolEffectivelyEnabled(toolIdentifier: string, categoryName: string, serverName: string | null, config: ToolAuthorizationConfig): boolean {
        const toolOverride = config.overrides?.[toolIdentifier];
        let resolvedStatus: CategoryStatus;

        if (toolOverride && toolOverride !== ToolStatus.Inherited) {
            // Resolve based on override - If override exists and isn't Inherit, its resolution takes precedence.
            // The category status doesn't matter in this specific calculation path, only the override matters.
            resolvedStatus = this._resolveToolStatus(toolOverride, CategoryStatus.AlwaysAvailable); // Pass dummy category status
        } else {
            // Resolve based on category if no specific override or override is Inherit
            const categoryStatus: CategoryStatus = (serverName
                ? config.mcpServers?.[serverName] // MCP server category
                : config.categories?.[categoryName]) // Standard tool category
                ?? DEFAULT_CATEGORY_STATUS; // Default if category not configured
            resolvedStatus = categoryStatus;
        }

        // A tool is considered enabled if its resolved status is not Disabled
        const isEnabled = resolvedStatus !== CategoryStatus.Disabled;
        // Debug logging:
        // if (!isEnabled) {
        //     console.log(`[ToolManager] Tool '${toolIdentifier}' is DISABLED. Resolved Status: ${resolvedStatus}`);
        // } else {
        //     console.log(`[ToolManager] Tool '${toolIdentifier}' is ENABLED. Resolved Status: ${resolvedStatus}`);
        // }
        return isEnabled;
    }


    /**
     * Computes the resolved status for all tools, categorized for the UI.
     */
    public async getResolvedToolStatusInfo(): Promise<AllToolsStatusInfo> {
        const authConfig = this._getToolAuthConfig();
        const categories: { [id: string]: ToolCategoryInfo } = {};

        // Helper to get or create a category
        const getOrCreateCategory = (id: string, name: string, defaultStatus: CategoryStatus): ToolCategoryInfo => {
             const isMcp = id.startsWith('mcp_');
             const serverOrCategoryName = isMcp ? id.substring(4) : id; // Extract server or category name
             const configuredStatus = (isMcp
                 ? authConfig.mcpServers?.[serverOrCategoryName]
                 : authConfig.categories?.[serverOrCategoryName]) ?? defaultStatus;

             if (!categories[id]) {
                 categories[id] = { id, name, status: configuredStatus, tools: [] };
             } else {
                 // Ensure the status reflects the current config, even if category existed
                 categories[id].status = configuredStatus;
             }
             return categories[id];
        };


        // 1. Process Standard Tools
        const standardToolNames = Object.keys(standardToolsMap) as StandardToolName[];
        for (const toolName of standardToolNames) {
            const toolDefinition = standardToolsMap[toolName];
            if (!toolDefinition) { continue; }

            const categoryId = this._getStandardToolCategory(toolName); // e.g., 'filesystem'
            const categoryName = categoryId.charAt(0).toUpperCase() + categoryId.slice(1); // e.g., 'Filesystem'
            const category = getOrCreateCategory(categoryId, categoryName, DEFAULT_CATEGORY_STATUS);

            const configuredStatus = authConfig.overrides?.[toolName] ?? DEFAULT_TOOL_STATUS;
            const resolvedStatus = this._resolveToolStatus(configuredStatus, category.status);

            category.tools.push({
                id: toolName,
                name: toolName, // Use the internal name for now
                description: toolDefinition.description,
                status: configuredStatus,
                resolvedStatus: resolvedStatus,
            });
        }

        // 2. Process MCP Tools
        const mcpStatuses = this._mcpManager.getMcpServerConfiguredStatus();
        for (const serverName in mcpStatuses) {
            const serverStatus = mcpStatuses[serverName];
            // Only add category if server is configured (even if not connected)
            if (serverStatus.config) {
                const categoryId = `mcp_${serverName}`;
                const categoryName = `${serverName} (MCP)`; // Display name for MCP category
                const category = getOrCreateCategory(categoryId, categoryName, DEFAULT_CATEGORY_STATUS);

                if (serverStatus.isConnected && serverStatus.tools) {
                    for (const mcpToolName in serverStatus.tools) {
                        const mcpToolDefinition: any = serverStatus.tools[mcpToolName]; // Use any as type not available
                        const toolId = `mcp_${serverName}_${mcpToolName}`;

                        const configuredStatus = authConfig.overrides?.[toolId] ?? DEFAULT_TOOL_STATUS;
                        const resolvedStatus = this._resolveToolStatus(configuredStatus, category.status);

                        category.tools.push({
                            id: toolId,
                            name: `${serverName}: ${mcpToolName}`, // Display name like github: create_issue
                            description: mcpToolDefinition.description,
                            status: configuredStatus,
                            resolvedStatus: resolvedStatus,
                        });
                    }
                }
                 // Sort tools within the MCP category alphabetically by name
                 category.tools.sort((a, b) => a.name.localeCompare(b.name));
            }
        }

        // Sort standard categories' tools
        Object.values(categories).forEach(cat => {
            if (!cat.id.startsWith('mcp_')) {
                cat.tools.sort((a, b) => a.name.localeCompare(b.name));
            }
        });


        // Convert categories map to array and sort categories
        const sortedCategories = Object.values(categories).sort((a, b) => {
            // Prioritize standard categories, then sort alphabetically
            const aIsMcp = a.id.startsWith('mcp_');
            const bIsMcp = b.id.startsWith('mcp_');
            if (aIsMcp && !bIsMcp) { return 1; }
            if (!aIsMcp && bIsMcp) { return -1; }
            return a.name.localeCompare(b.name);
        });

        return sortedCategories;
    }

    // Optional: Add methods to update tool configuration if needed later
    // async updateToolStatus(toolIdentifier: string, status: ToolStatus | null): Promise<void> { ... }
    // async updateCategoryStatus(categoryId: string, status: CategoryStatus | null): Promise<void> { ... }
}
