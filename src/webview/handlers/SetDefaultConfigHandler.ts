import * as vscode from 'vscode';
import { RequestHandler, HandlerContext } from './RequestHandler'; // Change to RequestHandler
import { DefaultChatConfig } from '../../common/types'; // Import the type
import { AiService } from '../../ai/aiService'; // Import AiService

export class SetDefaultConfigHandler implements RequestHandler {
    public readonly requestType = 'setDefaultConfig'; // Change messageType to requestType

    // Return a simple success object or throw an error
    public async handle(payload: any, context: HandlerContext): Promise<{ success: boolean }> {
        if (!payload || typeof payload.config !== 'object' || payload.config === null) {
            console.warn('[SetDefaultConfigHandler] Received invalid payload:', payload);
            throw new Error('Invalid payload for setDefaultConfig request.'); // Throw error
        }

        const newConfig = payload.config as Partial<DefaultChatConfig>; // Use Partial for flexibility
        console.log('[SetDefaultConfigHandler] Received request to update default config:', newConfig);

        try {
            // Target the correct configuration section 'zencoder.defaults'
            const config = vscode.workspace.getConfiguration('zencoder.defaults');
            const updates: Promise<void>[] = [];

            // Update only the settings that are present in the payload
            // Use correct property names and setting IDs
            if (newConfig.defaultProviderId !== undefined) {
                updates.push(Promise.resolve(config.update('defaultProviderId', newConfig.defaultProviderId, vscode.ConfigurationTarget.Global)));
            }
            if (newConfig.defaultModelId !== undefined) {
                updates.push(Promise.resolve(config.update('defaultModelId', newConfig.defaultModelId, vscode.ConfigurationTarget.Global)));
            }
            if (newConfig.defaultImageModelId !== undefined) {
                updates.push(Promise.resolve(config.update('imageModelId', newConfig.defaultImageModelId, vscode.ConfigurationTarget.Global)));
            }
            if (newConfig.defaultOptimizeModelId !== undefined) {
                updates.push(Promise.resolve(config.update('optimizeModelId', newConfig.defaultOptimizeModelId, vscode.ConfigurationTarget.Global)));
            }

            await Promise.all(updates);
            console.log('[SetDefaultConfigHandler] Successfully updated default config settings.');
            // Pub/Sub handles notifying webview via AiService event emitter
            return { success: true }; // Return success
        } catch (error: any) {
            console.error('[SetDefaultConfigHandler] Error updating default config settings:', error);
            vscode.window.showErrorMessage(`Failed to update default config settings: ${error.message}`);
            throw new Error(`Failed to update default config settings: ${error.message}`); // Throw error
        }
    }
}