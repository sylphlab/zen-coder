import * as vscode from 'vscode';
import { MessageHandler } from './MessageHandler';
import { DefaultChatConfig } from '../../common/types'; // Import the type

export class SetDefaultConfigHandler implements MessageHandler {
    public readonly messageType = 'setDefaultConfig'; // Add missing property
    // public readonly command = 'setDefaultConfig'; // Remove redundant property if messageType is used

    public async handle(payload: any): Promise<void> {
        if (!payload || typeof payload.config !== 'object' || payload.config === null) {
            console.warn('[SetDefaultConfigHandler] Received invalid payload:', payload);
            vscode.window.showErrorMessage('Failed to set default config: Invalid data received.');
            return;
        }

        const newConfig = payload.config as Partial<DefaultChatConfig>; // Use Partial for flexibility
        console.log('[SetDefaultConfigHandler] Received request to update default config:', newConfig);

        try {
            const config = vscode.workspace.getConfiguration('zencoder.defaults');
            const updates: Promise<void>[] = [];

            // Update only the settings that are present in the payload
            if (newConfig.defaultChatModelId !== undefined) {
                updates.push(Promise.resolve(config.update('chatModelId', newConfig.defaultChatModelId, vscode.ConfigurationTarget.Global)));
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
            // postMessage({ type: 'updateDefaultConfig', payload: newConfig }); // Example if needed
        } catch (error: any) {
            console.error('[SetDefaultConfigHandler] Error updating default config settings:', error);
            vscode.window.showErrorMessage(`Failed to update default config settings: ${error.message}`);
        }
    }
}