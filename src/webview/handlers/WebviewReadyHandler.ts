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
            const models = await context.modelResolver.resolveAvailableModels();
            context.postMessage({ type: 'availableModels', payload: models });
            console.log("[WebviewReadyHandler] Sent available models.");

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
            const statusList = await context.providerStatusManager.getProviderStatus();
           context.postMessage({ type: 'providerStatus', payload: statusList });
           console.log("[WebviewReadyHandler] Sent provider status list.");

           // --- Get and Send All Tools Status ---
           const allToolsStatus: AllToolsStatusPayload = {};
           const toolEnabledStatus = context.extensionContext.globalState.get<{ [toolId: string]: boolean }>(TOOL_ENABLED_STATUS_KEY, {});

           // Process Standard Tools
           const standardToolNames = Object.keys(allTools) as ToolName[];
           standardToolNames.forEach(toolName => {
               const toolDefinition = allTools[toolName];
               const isEnabled = toolEnabledStatus[toolName] !== false; // Default true
               allToolsStatus[toolName] = {
                   description: toolDefinition.description,
                   enabled: isEnabled,
                   type: 'standard'
               };
           });

           // Process MCP Tools
           const mcpToolsMap = context.aiService['mcpManager'].getMcpServerTools(); // Access McpManager via AiService
           for (const [serverName, tools] of mcpToolsMap.entries()) {
               for (const [mcpToolName, mcpToolDefinition] of Object.entries(tools)) {
                   const unifiedIdentifier = `mcp_${serverName}_${mcpToolName}`;
                   const isEnabled = toolEnabledStatus[unifiedIdentifier] !== false; // Default true
                   allToolsStatus[unifiedIdentifier] = {
                       description: mcpToolDefinition.description,
                       enabled: isEnabled,
                       type: 'mcp',
                       serverName: serverName
                   };
               }
           }
           context.postMessage({ type: 'updateAllToolsStatus', payload: allToolsStatus });
           console.log(`[WebviewReadyHandler] Sent status for ${Object.keys(allToolsStatus).length} tools.`);
           // --- End Tool Status Logic ---

       } catch (error: any) {
           console.error("[WebviewReadyHandler] Error fetching initial state:", error);
           vscode.window.showErrorMessage(`Error fetching initial state: ${error.message}`);
           // Send empty states on error to prevent UI hanging
           context.postMessage({ type: 'availableModels', payload: [] });
           context.postMessage({ type: 'providerStatus', payload: [] });
           context.postMessage({ type: 'loadChatState', payload: { chats: [], lastActiveChatId: null, lastLocation: '/index.html' } }); // Include default location on error
           context.postMessage({ type: 'updateAllToolsStatus', payload: {} }); // Send empty tools status on error
        }
    }
}