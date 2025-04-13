import * as vscode from 'vscode';
import { MessageHandler, HandlerContext } from './MessageHandler';
import { ToolName } from '../../tools'; // Assuming ToolName is exported from tools index

interface SetStandardToolEnabledPayload {
    toolName: ToolName;
    enabled: boolean;
}

export class SetStandardToolEnabledHandler implements MessageHandler {
    public readonly messageType = 'setStandardToolEnabled';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        const payload = message.payload as SetStandardToolEnabledPayload;
        if (!payload || typeof payload.toolName !== 'string' || typeof payload.enabled !== 'boolean') {
            console.error('Invalid payload for setStandardToolEnabled:', payload);
            vscode.window.showErrorMessage('Invalid request to update tool setting.');
            return;
        }

        const { toolName, enabled } = payload;
        const configKey = `zencoder.tools.${toolName}.enabled`;

        try {
            // Update the setting globally. Consider Workspace scope if needed later.
            await vscode.workspace.getConfiguration().update(configKey, enabled, vscode.ConfigurationTarget.Global);
            console.log(`Updated setting '${configKey}' to ${enabled}`);
            vscode.window.showInformationMessage(`Tool '${toolName}' ${enabled ? 'enabled' : 'disabled'}.`);

            // Optionally, re-send the updated tool list to the webview
            // This requires access to the logic currently in extension.ts's settingsPageReady handler
            // For simplicity now, we rely on the user potentially reloading the view or
            // triggering a refresh manually if immediate UI update is critical.
            // Or, we could add a method to ZenCoderChatViewProvider to trigger this update.

        } catch (error: any) {
            console.error(`Failed to update setting '${configKey}':`, error);
            vscode.window.showErrorMessage(`Failed to update setting for tool '${toolName}': ${error.message}`);
        }
    }
}