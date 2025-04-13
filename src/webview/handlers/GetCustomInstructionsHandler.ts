import * as vscode from 'vscode';
import { MessageHandler, HandlerContext } from './MessageHandler';

export class GetCustomInstructionsHandler implements MessageHandler {
    public readonly messageType = 'settingsPageReady'; // Re-use settingsPageReady to send initial data

    public async handle(message: any, context: HandlerContext): Promise<void> {
        console.log('[GetCustomInstructionsHandler] Handling settingsPageReady, fetching instructions...');
        let globalInstructions = '';
        let projectInstructions = '';
        let projectPath: string | null = null;

        // 1. Get Global Instructions
        try {
            globalInstructions = vscode.workspace.getConfiguration('zencoder.customInstructions').get<string>('global', '');
        } catch (error) {
            console.error('[GetCustomInstructionsHandler] Error reading global instructions setting:', error);
        }

        // 2. Get Project Instructions
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const projectInstructionUri = vscode.Uri.joinPath(workspaceFolders[0].uri, '.zen', 'custom_instructions.md');
            projectPath = projectInstructionUri.fsPath; // Store path to display
            try {
                const fileContent = await vscode.workspace.fs.readFile(projectInstructionUri);
                projectInstructions = Buffer.from(fileContent).toString('utf8');
            } catch (error: any) {
                if (error.code !== 'FileNotFound') {
                    console.error(`[GetCustomInstructionsHandler] Error reading project instructions file ${projectPath}:`, error);
                    // Don't show error to user, just won't populate the field
                }
            }
        }

        // Send combined data back to the webview
        context.postMessage({
            type: 'updateCustomInstructions',
            payload: {
                global: globalInstructions,
                project: projectInstructions,
                projectPath: projectPath // Send the path too
            }
        });
        console.log('[GetCustomInstructionsHandler] Sent custom instructions to webview.');

        // --- Also trigger fetching tool status ---
        // This handler re-uses 'settingsPageReady', so we need to trigger the tool status fetch here as well.
        // Ideally, 'settingsPageReady' might be split or handled differently, but this works for now.
        try {
            const allToolsStatus = await this._getAllToolsStatus(context); // Use helper
            context.postMessage({ type: 'updateAllToolsStatus', payload: allToolsStatus });
            console.log("[GetCustomInstructionsHandler] Sent all tools status to webview:", Object.keys(allToolsStatus).length, "tools");
        } catch (error) {
            console.error("[GetCustomInstructionsHandler] Error getting or sending all tools status:", error);
            vscode.window.showErrorMessage("Failed to load tool information.");
        }
    }

    // Helper function copied from extension.ts to get tool status
    // TODO: Refactor this into a shared utility or service
    private async _getAllToolsStatus(context: HandlerContext): Promise<{ [toolIdentifier: string]: { description?: string, enabled: boolean, type: 'standard' | 'mcp', serverName?: string } }> {
        const allToolsStatus: { [toolIdentifier: string]: { description?: string, enabled: boolean, type: 'standard' | 'mcp', serverName?: string } } = {};
        const config = vscode.workspace.getConfiguration('zencoder.tools');
        const mcpOverrides = context.extensionContext.globalState.get<{ [toolId: string]: boolean }>(MCP_TOOL_OVERRIDES_KEY, {});

        // 1. Get Standard Tools Status
        const standardToolNames = Object.keys(allTools) as ToolName[];
        standardToolNames.forEach(toolName => {
            const toolDefinition = allTools[toolName] as Tool | undefined;
            if (toolDefinition) {
                const isEnabled = config.get<boolean>(`${toolName}.enabled`, true); // Get enabled status from config
                allToolsStatus[toolName] = {
                    description: toolDefinition.description,
                    enabled: isEnabled,
                    type: 'standard'
                };
            }
        });

        // 2. Get MCP Tools Status (from McpManager and overrides)
        // Need access to AiService/McpManager here. Assuming HandlerContext provides it.
        const mcpServersStatus = context.aiService.getMcpServerConfiguredStatus();
        for (const [serverName, serverStatus] of Object.entries(mcpServersStatus)) {
            if (serverStatus.isConnected && serverStatus.tools) {
                for (const [mcpToolName, mcpToolDefinition] of Object.entries(serverStatus.tools)) {
                    const toolIdentifier = `${serverName}/${mcpToolName}`;
                    const isEnabled = mcpOverrides[toolIdentifier] !== false;
                    allToolsStatus[toolIdentifier] = {
                        description: mcpToolDefinition.description,
                        enabled: isEnabled,
                        type: 'mcp',
                        serverName: serverName
                    };
                }
            }
        }
        return allToolsStatus;
    }
}

// Constants needed by the helper function (copy from extension.ts or import if refactored)
import { allTools, ToolName } from '../../tools'; // Corrected path
import { Tool } from 'ai';
const MCP_TOOL_OVERRIDES_KEY = 'mcpToolEnabledOverrides';