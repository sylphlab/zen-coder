import * as vscode from 'vscode';
import { MessageHandler, HandlerContext } from './MessageHandler';
import { ToolName, allTools } from '../../tools'; // Import standard tools map and type

// Unified key for storing enablement status of ALL tools
const TOOL_ENABLED_STATUS_KEY = 'toolEnabledStatus';

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
       // Removed isStandardTool check

       try {
           // Unified logic: Update the status in the single globalState map
           const toolEnabledStatus = context.extensionContext.globalState.get<{ [toolId: string]: boolean }>(TOOL_ENABLED_STATUS_KEY, {});

           // Use the received toolIdentifier directly as the key (standard or mcp_server_tool)
           toolEnabledStatus[toolIdentifier] = enabled;

           await context.extensionContext.globalState.update(TOOL_ENABLED_STATUS_KEY, toolEnabledStatus);
           console.log(`[SetToolEnabledHandler] Updated tool '${toolIdentifier}' enabled status to ${enabled} in globalState.`);
           vscode.window.showInformationMessage(`Tool '${toolIdentifier}' ${enabled ? 'enabled' : 'disabled'}.`);

            // Notify AiService to potentially push updates if subscribed
            await context.aiService._notifyToolStatusChange();

        } catch (error: any) {
            console.error(`Failed to update setting for tool '${toolIdentifier}':`, error);
            vscode.window.showErrorMessage(`Failed to update setting for tool '${toolIdentifier}': ${error.message}`);
        }
    }
}