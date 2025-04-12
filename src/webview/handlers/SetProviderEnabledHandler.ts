import * as vscode from 'vscode';
import { MessageHandler, HandlerContext } from './MessageHandler';
import { providerMap } from '../../ai/providers'; // Need providerMap to validate key
import { ApiProviderKey } from '../../ai/aiService'; // Need ApiProviderKey type

export class SetProviderEnabledHandler implements MessageHandler {
    public readonly messageType = 'setProviderEnabled';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        console.log("[SetProviderEnabledHandler] Handling setProviderEnabled message...");
        if (message.payload && typeof message.payload.provider === 'string' && typeof message.payload.enabled === 'boolean') {
            const providerKeyInput = message.payload.provider;
            const enabled = message.payload.enabled;

            if (providerMap.has(providerKeyInput)) {
                const providerKey = providerKeyInput as ApiProviderKey;
                try {
                    // Update VS Code configuration setting
                    const config = vscode.workspace.getConfiguration('zencoder.provider');
                    await config.update(`${providerKey}.enabled`, enabled, vscode.ConfigurationTarget.Global);
                    console.log(`[SetProviderEnabledHandler] Provider ${String(providerKey)} enabled status updated to: ${enabled}`);

                    // Refresh and send updated provider status list back to webview using ProviderStatusManager
                    const updatedStatusList = await context.providerStatusManager.getProviderStatus();
                    context.postMessage({ type: 'providerStatus', payload: updatedStatusList });

                } catch (error: any) {
                    console.error(`[SetProviderEnabledHandler] Failed to update provider setting for ${String(providerKey)}:`, error);
                    vscode.window.showErrorMessage(`Failed to update setting for ${String(providerKey)}: ${error.message}`);
                }
            } else {
                console.error(`[SetProviderEnabledHandler] Invalid provider key received: ${providerKeyInput}`);
            }
        } else {
            console.error("[SetProviderEnabledHandler] Invalid payload:", message.payload);
        }
    }
}