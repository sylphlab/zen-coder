import * as vscode from 'vscode';
import { AiService } from '../../ai/aiService';
import { HistoryManager } from '../../historyManager';
import { ProviderStatusManager } from '../../ai/providerStatusManager';
import { ModelResolver } from '../../ai/modelResolver';
import { McpManager } from '../../ai/mcpManager'; // Import McpManager

/**
 * Defines the context required by message handlers.
 * This allows passing necessary dependencies without coupling handlers directly to the ViewProvider.
 */
export interface HandlerContext {
    aiService: AiService; // Keep for core AI calls and API key management
    historyManager: HistoryManager;
    providerStatusManager: ProviderStatusManager; // For getting provider status
    modelResolver: ModelResolver; // For resolving available models
    mcpManager: McpManager; // Add McpManager
    postMessage: (message: any) => void; // Function to post messages back to the webview
    extensionContext: vscode.ExtensionContext; // Provide full context if needed by handlers
}

/**
 * Interface for all webview message handlers.
 */
export interface MessageHandler {
    /**
     * The type of message this handler processes.
     */
    readonly messageType: string;

    /**
     * Executes the handler logic.
     * @param message The message received from the webview.
     * @param context Provides access to necessary services and callbacks.
     */
    handle(message: any, context: HandlerContext): Promise<void>;
}