import * as vscode from 'vscode';
import { MessageHandler } from './MessageHandler';
import { DefaultChatConfig } from '../../common/types'; // Import the type
import { AiService } from '../../ai/aiService'; // Import AiService

export class SetDefaultConfigHandler implements MessageHandler {
    public readonly messageType = 'setDefaultConfig';

    // Add context parameter to access AiService
    public async handle(payload: any, context: { aiService: AiService }): Promise<void> {
        if (!payload || typeof payload.config !== 'object' || payload.config === null) {
            console.warn('[SetDefaultConfigHandler] Received invalid payload:', payload);
            vscode.window.showErrorMessage('Failed to set default config: Invalid data received.');
            return;
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
            // Optionally send a confirmation back to the webview, though the UI updates optimistically
            // Notify subscribed webviews about the change
            await context.aiService._notifyDefaultConfigChange();
            // Optionally send a confirmation back to the webview, though the UI updates optimistically
            // postMessage({ type: 'updateDefaultConfig', payload: newConfig }); // Example if needed
        } catch (error: any) {
            console.error('[SetDefaultConfigHandler] Error updating default config settings:', error);
            vscode.window.showErrorMessage(`Failed to update default config settings: ${error.message}`);
        }
    }
}