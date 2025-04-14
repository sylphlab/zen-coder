import * as vscode from 'vscode';
import { MessageHandler, HandlerContext } from './MessageHandler';
import { ToolAuthorizationConfig, SetToolAuthorizationRequest } from '../../common/types';

export class SetToolAuthorizationHandler implements MessageHandler {
    public readonly messageType = 'setToolAuthorization';

    public async handle(message: SetToolAuthorizationRequest, context: HandlerContext): Promise<void> {
        console.log(`[${this.messageType}] Handling request...`);
        const newConfigPart = message.payload.config;

        if (!newConfigPart) {
            console.warn(`[${this.messageType}] Received empty config payload. Ignoring.`);
            // Optionally send an error response back
            context.postMessage({
                type: 'responseData',
                requestId: message.requestId,
                error: 'Received empty configuration payload.',
            });
            return;
        }

        try {
            const config = vscode.workspace.getConfiguration('zencoder');
            const currentAuthConfig = config.get<ToolAuthorizationConfig>('toolAuthorization') ?? {};

            // Deep merge the new partial config into the current config
            const mergedConfig: ToolAuthorizationConfig = {
                categories: { ...(currentAuthConfig.categories ?? {}), ...(newConfigPart.categories ?? {}) },
                mcpServers: { ...(currentAuthConfig.mcpServers ?? {}), ...(newConfigPart.mcpServers ?? {}) },
                overrides: { ...(currentAuthConfig.overrides ?? {}), ...(newConfigPart.overrides ?? {}) },
            };

            // Clean up overrides: remove any set to 'inherited' as that's the default
            if (mergedConfig.overrides) {
                for (const toolId in mergedConfig.overrides) {
                    if (mergedConfig.overrides[toolId] === 'inherited') {
                        delete mergedConfig.overrides[toolId];
                    }
                }
                // If overrides object becomes empty, remove it entirely
                if (Object.keys(mergedConfig.overrides).length === 0) {
                    delete mergedConfig.overrides;
                }
            }
             // Clean up empty categories/mcpServers objects
            if (mergedConfig.categories && Object.keys(mergedConfig.categories).length === 0) {
                delete mergedConfig.categories;
            }
            if (mergedConfig.mcpServers && Object.keys(mergedConfig.mcpServers).length === 0) {
                delete mergedConfig.mcpServers;
            }


            // Update the configuration setting
            await config.update('toolAuthorization', mergedConfig, vscode.ConfigurationTarget.Global); // Use Global scope for now

            console.log(`[${this.messageType}] Updated toolAuthorization config.`);

            // Respond success
            context.postMessage({
                type: 'responseData',
                requestId: message.requestId,
                payload: { success: true },
            });

            // Trigger notification to update UI (if subscribed)
            // The config change itself should trigger the AiService listener if set up correctly,
            // but we can explicitly notify here too.
            await context.aiService._notifyToolStatusChange();

        } catch (error: any) {
            console.error(`[${this.messageType}] Error updating tool authorization config:`, error);
            // Send error response back to the webview
            context.postMessage({
                type: 'responseData',
                requestId: message.requestId,
                error: error.message || 'Failed to update tool authorization config',
            });
        }
    }
}