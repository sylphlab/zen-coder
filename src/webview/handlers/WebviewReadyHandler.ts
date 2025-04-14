import * as vscode from 'vscode';
import { MessageHandler, HandlerContext } from './MessageHandler';
import { ToolName, allTools } from '../../tools'; // Import standard tools
// Removed unused import: import { ToolInfo } from './SetToolEnabledHandler';

// Define ToolInfo locally if not imported
interface AllToolsStatusPayload {
    [toolIdentifier: string]: {
        description?: string;
        enabled: boolean;
        type: 'standard' | 'mcp';
        serverName?: string;
    };
}

// Unified key for storing enablement status of ALL tools
const TOOL_ENABLED_STATUS_KEY = 'toolEnabledStatus';
export class WebviewReadyHandler implements MessageHandler {
    public readonly messageType = 'webviewReady';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        console.log("[WebviewReadyHandler] Handling webviewReady message...");
        try {
            // Use ModelResolver
            // Fetch available *providers* (enabled and with key if needed)
            const providers = await context.modelResolver.getAvailableProviders();
            // Send this list immediately so the UI can show providers quickly
            context.postMessage({ type: 'availableProviders', payload: providers }); // Changed type to 'availableProviders'
            console.log("[WebviewReadyHandler] Sent available providers.");
            // Note: Fetching actual models for each provider will be triggered by the frontend separately.

            // Send chat sessions and last active ID from HistoryManager
            const allChats = context.historyManager.getAllChatSessions();
            const lastActiveId = context.historyManager.getLastActiveChatId();
            const lastLocation = context.historyManager.getLastLocation(); // Get last location
            context.postMessage({
                type: 'loadChatState',
                payload: {
                    chats: allChats,
                    lastActiveChatId: lastActiveId,
                    lastLocation: lastLocation // Include last location
                }
            });
            console.log(`[WebviewReadyHandler] Sent ${allChats.length} chats, last active ID (${lastActiveId}), last location (${lastLocation}).`);

            // Use ProviderStatusManager
            const statusList = await context.providerStatusManager.getProviderStatus(context.aiService.allProviders, context.aiService.providerMap);
           context.postMessage({ type: 'providerStatus', payload: statusList });
           console.log("[WebviewReadyHandler] Sent provider status list.");

           // --- Get and Send All Tools Status ---
           // Directly call the method on AiService to get combined status
           const allToolsStatus = await context.aiService.getAllToolsWithStatus();
           context.postMessage({ type: 'updateAllToolsStatus', payload: allToolsStatus });
           console.log(`[WebviewReadyHandler] Sent status for ${Object.keys(allToolsStatus).length} tools.`);

           // --- Get and Send MCP Status ---
           const mcpStatus = context.mcpManager.getMcpServerConfiguredStatus(); // Use correct method name
           context.postMessage({ type: 'updateMcpConfiguredStatus', payload: mcpStatus });
           console.log(`[WebviewReadyHandler] Sent status for ${Object.keys(mcpStatus).length} MCP servers.`);
           // --- End MCP Status Logic ---

       } catch (error: any) {
           console.error("[WebviewReadyHandler] Error fetching initial state:", error);
           vscode.window.showErrorMessage(`Error fetching initial state: ${error.message}`);
           // Send empty states on error to prevent UI hanging
           context.postMessage({ type: 'availableModels', payload: [] });
           context.postMessage({ type: 'providerStatus', payload: [] });
           context.postMessage({ type: 'loadChatState', payload: { chats: [], lastActiveChatId: null, lastLocation: '/index.html' } }); // Include default location on error
           context.postMessage({ type: 'updateAllToolsStatus', payload: {} });
        }
    }
}