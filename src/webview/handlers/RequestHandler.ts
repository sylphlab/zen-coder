import * as vscode from 'vscode';
import { AiService } from '../../ai/aiService';
import { HistoryManager } from '../../historyManager';
import { ModelResolver } from '../../ai/modelResolver';
import { ProviderStatusManager } from '../../ai/providerStatusManager';
import { McpManager } from '../../ai/mcpManager'; // Import McpManager

/**
 * Context object passed to request handlers.
 */
export interface HandlerContext {
    webview: vscode.Webview;
    aiService: AiService;
    historyManager: HistoryManager;
    modelResolver: ModelResolver;
    providerStatusManager: ProviderStatusManager;
    mcpManager: McpManager; // Add McpManager
    postMessage: (message: any) => void; // Function to post messages back to webview
    extensionContext: vscode.ExtensionContext; // Add extension context
}

/**
 * Interface for handling specific requests from the webview.
 */
export interface RequestHandler {
    /**
     * The specific request type this handler is responsible for.
     * Matches the `requestType` sent from the webview via `requestData`.
     */
    readonly requestType: string;

    /**
     * Handles an incoming request message.
     * @param payload The payload sent with the request.
     * @param context Context object containing shared resources.
     * @returns A promise that resolves with the result payload to send back, or rejects with an error.
     */
    handle(payload: any, context: HandlerContext): Promise<any>;
}