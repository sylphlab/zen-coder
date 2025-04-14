import * as vscode from 'vscode';
import { RequestHandler, HandlerContext } from './RequestHandler'; // Correct import path
import { ToolName } from '../../tools'; // Assuming ToolName is exported from tools index

interface SetStandardToolEnabledPayload {
    toolName: ToolName;
    enabled: boolean;
}

/**
 * WARNING: This handler modifies a potentially deprecated configuration setting.
 * Tool authorization is now primarily managed via the 'zencoder.toolAuthorization' setting
 * and the SetToolAuthorizationHandler. This handler might be removed in the future.
 */
export class SetStandardToolEnabledHandler implements RequestHandler { // Implement correct interface
    public readonly requestType = 'setStandardToolEnabled'; // Use correct property name

    public async handle(payload: any, context: HandlerContext): Promise<{ success: boolean }> { // Update signature and return type
        if (!payload || typeof payload.toolName !== 'string' || typeof payload.enabled !== 'boolean') {
            console.error('Invalid payload for setStandardToolEnabled:', payload);
             throw new Error('Invalid payload for setStandardToolEnabled'); // Throw error for request failure
        }

        const { toolName, enabled } = payload;
        // NOTE: This config key ('zencoder.tools.${toolName}.enabled') is likely deprecated.
        // The new system uses 'zencoder.toolAuthorization'.
        const configKey = `zencoder.tools.${toolName}.enabled`;

        try {
            // Update the deprecated setting globally.
            await vscode.workspace.getConfiguration().update(configKey, enabled, vscode.ConfigurationTarget.Global);
            console.warn(`Updated deprecated setting '${configKey}' to ${enabled}. Consider using 'zencoder.toolAuthorization'.`);

            // Notify the system that tool statuses might have changed, triggering a push update.
            context.aiService._notifyToolStatusChange();

            return { success: true }; // Return success object

        } catch (error: any) {
            console.error(`Failed to update deprecated setting '${configKey}':`, error);
             throw new Error(`Failed to update setting for tool '${toolName}': ${error.message}`); // Rethrow error
        }
    }
}
