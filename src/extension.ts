import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CoreMessage } from 'ai'; // Keep CoreMessage if needed elsewhere, maybe not
import { AiService, ApiProviderKey } from './ai/aiService'; // Removed AiServiceResponse import
import { providerMap } from './ai/providers';
import { UiMessage } from './common/types'; // Import shared UI types
import { getWebviewContent } from './webview/webviewContent'; // Import webview content generator
import { HistoryManager } from './historyManager'; // Import History Manager
import { StreamProcessor } from './streamProcessor'; // Import Stream Processor
import { ProviderStatusManager } from './ai/providerStatusManager'; // Import Status Manager
import { ModelResolver } from './ai/modelResolver'; // Import Model Resolver
import { MessageHandler, HandlerContext } from './webview/handlers/MessageHandler'; // Import base handler interface
// Import specific handlers
import { WebviewReadyHandler } from './webview/handlers/WebviewReadyHandler';
import { SendMessageHandler } from './webview/handlers/SendMessageHandler';
import { GetAvailableModelsHandler } from './webview/handlers/GetAvailableModelsHandler';
import { GetProviderStatusHandler } from './webview/handlers/GetProviderStatusHandler';
import { SetProviderEnabledHandler } from './webview/handlers/SetProviderEnabledHandler';
import { SetApiKeyHandler } from './webview/handlers/SetApiKeyHandler';
import { DeleteApiKeyHandler } from './webview/handlers/DeleteApiKeyHandler';
import { ClearChatHistoryHandler } from './webview/handlers/ClearChatHistoryHandler';
import { ExecuteToolActionHandler } from './webview/handlers/ExecuteToolActionHandler'; // Import the new handler

let aiServiceInstance: AiService | undefined = undefined;

export async function activate(context: vscode.ExtensionContext) {
    console.log('--- Zen Coder Extension Activating ---');

    aiServiceInstance = new AiService(context);
    await aiServiceInstance.initialize();

    if (!aiServiceInstance) {
        console.error("AiService failed to initialize before registering view provider.");
        vscode.window.showErrorMessage("Zen Coder failed to initialize. Please check logs or restart VS Code.");
        return;
    }
    const provider = new ZenCoderChatViewProvider(context, aiServiceInstance);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ZenCoderChatViewProvider.viewType, provider)
    );
    console.log('Zen Coder Chat View Provider registered.');

    // Set callback for AiService to post messages back to webview
    aiServiceInstance.setPostMessageCallback((message: any) => {
        provider.postMessageToWebview(message);
    });
}

class ZenCoderChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'zencoder.views.chat';

    private _view?: vscode.WebviewView;
    private _aiService: AiService;
    private _context: vscode.ExtensionContext;
    private _extensionUri: vscode.Uri;
    private _extensionMode: vscode.ExtensionMode;
    private _historyManager: HistoryManager;
    private _streamProcessor?: StreamProcessor; // Instantiate later
    private _providerStatusManager: ProviderStatusManager; // Add Status Manager instance
    private _modelResolver: ModelResolver; // Add Model Resolver instance
    private _messageHandlers: Map<string, MessageHandler>; // Registry for handlers

    constructor(
        context: vscode.ExtensionContext,
        aiService: AiService
    ) {
        this._context = context;
        this._extensionUri = context.extensionUri;
        this._extensionMode = context.extensionMode;
        this._aiService = aiService;
        this._historyManager = new HistoryManager(context); // Instantiate HistoryManager
        this._providerStatusManager = new ProviderStatusManager(context); // Instantiate Status Manager
        this._modelResolver = new ModelResolver(context, this._providerStatusManager); // Instantiate Model Resolver
        this._messageHandlers = new Map(); // Initialize the map
        console.log("ZenCoderChatViewProvider constructed.");
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;
        console.log("Resolving webview view...");

        // History is now loaded by HistoryManager constructor
        // Instantiate StreamProcessor here, passing the necessary callbacks
        this._streamProcessor = new StreamProcessor(
            this._historyManager,
            this.postMessageToWebview.bind(this) // Ensure 'this' context is correct
        );
        this._registerHandlers(); // Call registration method *after* streamProcessor is set
        console.log("StreamProcessor instantiated.");

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview')]
        };

        // Use the imported function for HTML generation
        webviewView.webview.html = getWebviewContent(webviewView.webview, this._extensionUri, this._extensionMode);
        console.log("Webview HTML set.");

        webviewView.webview.onDidReceiveMessage(async (message: any) => {
            console.log("[Extension] Received message from webview:", message.type);
            // Delegate handling to private methods
            this._handleWebviewMessage(message);
        });

        console.log("Webview view resolved and message listener attached.");
    }

    // --- Handler Registration ---
    private _registerHandlers(): void {
        if (!this._streamProcessor) {
            // This should ideally not happen if called after resolveWebviewView instantiates it,
            // but adding a check for safety.
            console.error("Cannot register handlers: StreamProcessor not initialized.");
            vscode.window.showErrorMessage("Internal Error: Cannot initialize message handlers.");
            return;
        }
        const handlers: MessageHandler[] = [
            new WebviewReadyHandler(),
            new SendMessageHandler(this._streamProcessor), // Pass StreamProcessor instance
            new GetAvailableModelsHandler(),
            new GetProviderStatusHandler(),
            new SetProviderEnabledHandler(),
            new SetApiKeyHandler(),
            new DeleteApiKeyHandler(),
            new ClearChatHistoryHandler(),
            new ExecuteToolActionHandler(this._aiService), // Register the new handler
            // Add other handlers here
        ];

        handlers.forEach(handler => {
            this._messageHandlers.set(handler.messageType, handler);
            console.log(`Registered handler for message type: ${handler.messageType}`);
        });
    }

    // --- Message Handling Logic ---
    private async _handleWebviewMessage(message: any): Promise<void> {
        const handler = this._messageHandlers.get(message.type);
        if (handler) {
            // Create context for the handler, including the new managers
            const context: HandlerContext = {
                aiService: this._aiService,
                historyManager: this._historyManager,
                providerStatusManager: this._providerStatusManager, // Add status manager
                modelResolver: this._modelResolver, // Add model resolver
                postMessage: this.postMessageToWebview.bind(this),
                extensionContext: this._context
            };
            try {
                await handler.handle(message, context);
            } catch (error) {
                console.error(`Error executing handler for message type ${message.type}:`, error);
                vscode.window.showErrorMessage(`An internal error occurred while processing the request.`);
            }
        } else {
            // Handle simple cases directly or log unknown types
            if (message.type === 'setModel') {
                 if (typeof message.modelId === 'string') {
                     this._aiService.setModel(message.modelId);
                     console.log(`Model changed to: ${message.modelId}`);
                 } else { console.error('Invalid modelId received', message); }
            } else {
                 console.warn(`[Extension] No handler registered for message type: ${message.type}`);
            }
        }
    }

    // Removed individual _handle... methods as logic is now in separate handler classes

    // Removed the large switch statement, replaced by _handleWebviewMessage

    public postMessageToWebview(message: any) {
        if (this._view) {
            this._view.webview.postMessage(message);
        } else {
            console.warn("Attempted to post message to unresolved webview view:", message.type);
        }
    }

    // _getHtmlForWebview removed, using imported getWebviewContent directly
}

// Helper functions translateUiHistoryToCoreMessages, getWebviewContent, and getNonce
// have been moved to historyManager.ts and webview/webviewContent.ts respectively.

export function deactivate() {}
