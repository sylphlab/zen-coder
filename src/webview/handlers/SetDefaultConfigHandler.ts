import * as vscode from 'vscode';
import { RequestHandler, HandlerContext } from './RequestHandler'; // Change to RequestHandler
import { DefaultChatConfig } from '../../common/types'; // Import the type
import { AiService } from '../../ai/aiService'; // Import AiService

export class SetDefaultConfigHandler implements RequestHandler {
    public readonly requestType = 'setDefaultConfig'; // Change messageType to requestType

    // Return a simple success object or throw an error
    public async handle(payload: any, context: HandlerContext): Promise<{ success: boolean }> {
        // Validate payload structure
        if (!payload || typeof payload !== 'object') {
             console.warn('[SetDefaultConfigHandler] Received invalid payload structure:', payload);
             throw new Error('Invalid payload structure for setDefaultConfig request.');
        }

        // Validate the config part of the payload
        const configUpdate = payload as Partial<DefaultChatConfig>; // Use Partial for flexibility
        console.log('[SetDefaultConfigHandler] Received request to update default config:', configUpdate);

        try {
            // Target the correct configuration section 'zencoder.defaults'
            const config = vscode.workspace.getConfiguration('zencoder.defaults');
            const updates: Promise<void>[] = [];

            // Prepare updates based on the payload, wrapping in Promise.resolve
            if (configUpdate.defaultProviderId !== undefined) {
                updates.push(Promise.resolve(config.update('defaultProviderId', configUpdate.defaultProviderId, vscode.ConfigurationTarget.Global)));
            }
            if (configUpdate.defaultModelId !== undefined) {
                updates.push(Promise.resolve(config.update('defaultModelId', configUpdate.defaultModelId, vscode.ConfigurationTarget.Global)));
            }
            if (configUpdate.defaultImageModelId !== undefined) {
                updates.push(Promise.resolve(config.update('imageModelId', configUpdate.defaultImageModelId, vscode.ConfigurationTarget.Global)));
            }
            if (configUpdate.defaultOptimizeModelId !== undefined) {
                updates.push(Promise.resolve(config.update('optimizeModelId', configUpdate.defaultOptimizeModelId, vscode.ConfigurationTarget.Global)));
            }

            // Wait for all updates to complete
            await Promise.all(updates);
            console.log('[SetDefaultConfigHandler] Successfully updated default config settings in VS Code.');

            // --- Fetch the complete, updated config state ---
            // Re-read the configuration section after updates
            const updatedConfig = vscode.workspace.getConfiguration('zencoder.defaults');
            const finalConfig: DefaultChatConfig = {
                defaultProviderId: updatedConfig.get<string>('defaultProviderId'),
                defaultModelId: updatedConfig.get<string>('defaultModelId'),
                defaultImageModelId: updatedConfig.get<string>('imageModelId'),
                defaultOptimizeModelId: updatedConfig.get<string>('optimizeModelId'),
            };
            console.log('[SetDefaultConfigHandler] Final config state after update:', finalConfig);

            // Explicitly trigger the notification with the final state
            context.aiService.triggerDefaultConfigNotification(finalConfig); // Pass the final state

            return { success: true }; // Return success
        } catch (error: any) {
            console.error('[SetDefaultConfigHandler] Error updating default config settings:', error);
            vscode.window.showErrorMessage(`Failed to update default config settings: ${error.message}`);
            throw new Error(`Failed to update default config settings: ${error.message}`); // Throw error
        }
    }
}
