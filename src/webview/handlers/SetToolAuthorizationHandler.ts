import * as vscode from 'vscode';
import { RequestHandler, HandlerContext } from './RequestHandler';
import { ToolAuthorizationConfig } from '../../common/types'; // Assuming this type exists

export class SetToolAuthorizationHandler implements RequestHandler {
    public readonly requestType = 'setToolAuthorization';

    public async handle(payload: any, context: HandlerContext): Promise<{ success: boolean }> {
        if (!payload || typeof payload.config !== 'object' || payload.config === null) {
            console.warn('[SetToolAuthorizationHandler] Received invalid payload:', payload);
            throw new Error('Invalid payload for setToolAuthorization request.');
        }

        const newAuthConfig = payload.config as Partial<ToolAuthorizationConfig>; // Use Partial for flexibility
        console.log('[SetToolAuthorizationHandler] Received request to update tool authorization:', newAuthConfig);

        try {
            const config = vscode.workspace.getConfiguration('zencoder');
            const currentAuthConfig = config.get<ToolAuthorizationConfig>('toolAuthorization') || {};

            // Merge the partial update with the current configuration
            // This needs careful merging logic depending on how categories/overrides are structured
            // Assuming a simple top-level merge for now, might need refinement
            const mergedConfig: ToolAuthorizationConfig = {
                categories: {
                    ...(currentAuthConfig.categories || {}),
                    ...(newAuthConfig.categories || {})
                },
                mcpServers: {
                     ...(currentAuthConfig.mcpServers || {}),
                     ...(newAuthConfig.mcpServers || {})
                },
                overrides: {
                    ...(currentAuthConfig.overrides || {}),
                    ...(newAuthConfig.overrides || {})
                }
            };

            await config.update('toolAuthorization', mergedConfig, vscode.ConfigurationTarget.Global);
            console.log('[SetToolAuthorizationHandler] Successfully updated tool authorization settings.');

            // Trigger notification via AiService method
            context.aiService.triggerToolStatusNotification(); // Use public trigger method

            return { success: true };
        } catch (error: any) {
            console.error('[SetToolAuthorizationHandler] Error updating tool authorization settings:', error);
            vscode.window.showErrorMessage(`Failed to update tool authorization settings: ${error.message}`);
            throw new Error(`Failed to update tool authorization settings: ${error.message}`);
        }
    }
}
