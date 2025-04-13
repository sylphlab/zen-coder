import * as vscode from 'vscode';
import { MessageHandler, HandlerContext } from './MessageHandler';
import { ToolName, allTools } from '../../tools'; // Import standard tools map and type

// Key for storing MCP tool overrides in globalState
const MCP_TOOL_OVERRIDES_KEY = 'mcpToolEnabledOverrides';

interface SetToolEnabledPayload {
    toolIdentifier: string; // e.g., "readFile" or "brave-search/brave_web_search"
    enabled: boolean;
}

export class SetToolEnabledHandler implements MessageHandler {
    public readonly messageType = 'setToolEnabled';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        const payload = message.payload as SetToolEnabledPayload;
        if (!payload || typeof payload.toolIdentifier !== 'string' || typeof payload.enabled !== 'boolean') {
            console.error('Invalid payload for setToolEnabled:', payload);
            vscode.window.showErrorMessage('Invalid request to update tool setting.');
            return;
        }

        const { toolIdentifier, enabled } = payload;
        const isStandardTool = toolIdentifier in allTools;

        try {
            if (isStandardTool) {
                // Handle Standard Tool (Update VS Code Config)
                const configKey = `zencoder.tools.${toolIdentifier}.enabled`;
                await vscode.workspace.getConfiguration().update(configKey, enabled, vscode.ConfigurationTarget.Global);
                console.log(`Updated standard tool setting '${configKey}' to ${enabled}`);
                vscode.window.showInformationMessage(`Standard tool '${toolIdentifier}' ${enabled ? 'enabled' : 'disabled'}.`);
            } else {
                // Handle MCP Tool (Update Global State Override)
                const overrides = context.extensionContext.globalState.get<{ [toolId: string]: boolean }>(MCP_TOOL_OVERRIDES_KEY, {});
                overrides[toolIdentifier] = enabled;
                await context.extensionContext.globalState.update(MCP_TOOL_OVERRIDES_KEY, overrides);
                console.log(`Updated MCP tool override '${toolIdentifier}' to ${enabled}`);
                vscode.window.showInformationMessage(`MCP tool '${toolIdentifier}' ${enabled ? 'enabled' : 'disabled'} for AI use.`);
            }

            // Optional: Trigger a refresh of the tool list in the UI
            // This would involve calling a method (perhaps added to HandlerContext or AiService)
            // that re-runs the logic from 'settingsPageReady' to send the updated list.
            // For now, we rely on optimistic UI updates in the frontend.

        } catch (error: any) {
            console.error(`Failed to update setting for tool '${toolIdentifier}':`, error);
            vscode.window.showErrorMessage(`Failed to update setting for tool '${toolIdentifier}': ${error.message}`);
        }
    }
}