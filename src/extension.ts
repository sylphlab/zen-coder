import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CoreMessage, Tool } from 'ai';
import { AiService } from './ai/aiService';
import {
    UiMessage,
    WebviewMessageType,
    ExtensionMessageType,
    ChatSession,
    DefaultChatConfig,
    WebviewRequestMessage,
    WebviewResponseMessage,
    WebviewRequestType,
    ProviderInfoAndStatus // Import missing type
} from './common/types';
import { getWebviewContent } from './webview/webviewContent';
import { HistoryManager } from './historyManager';
import { StreamProcessor } from './streamProcessor';
import { ProviderStatusManager } from './ai/providerStatusManager';
import { ModelResolver } from './ai/modelResolver';
import { MessageHandler, HandlerContext } from './webview/handlers/MessageHandler';
import { McpManager } from './ai/mcpManager'; // Import McpManager
// Import necessary handlers (excluding those replaced by requests)
import { WebviewReadyHandler } from './webview/handlers/WebviewReadyHandler';
import { SendMessageHandler } from './webview/handlers/SendMessageHandler';
import { SetProviderEnabledHandler } from './webview/handlers/SetProviderEnabledHandler';
import { SetApiKeyHandler } from './webview/handlers/SetApiKeyHandler';
import { DeleteApiKeyHandler } from './webview/handlers/DeleteApiKeyHandler';
import { ClearChatHistoryHandler } from './webview/handlers/ClearChatHistoryHandler';
import { ExecuteToolActionHandler } from './webview/handlers/ExecuteToolActionHandler';
import { SetToolEnabledHandler } from './webview/handlers/SetToolEnabledHandler';
import { GetMcpConfiguredStatusHandler } from './webview/handlers/GetMcpConfiguredStatusHandler'; // Keep for settings push updates? Or make request? Keep for now.
import { RetryMcpConnectionHandler } from './webview/handlers/RetryMcpConnectionHandler';
import { StopGenerationHandler } from './webview/handlers/StopGenerationHandler';
import { openOrCreateMcpConfigFile } from './utils/configUtils';
import { allTools, ToolName } from './tools';
import { SetGlobalCustomInstructionsHandler } from './webview/handlers/SetGlobalCustomInstructionsHandler';
import { SetProjectCustomInstructionsHandler } from './webview/handlers/SetProjectCustomInstructionsHandler';
import { OpenOrCreateProjectInstructionsFileHandler } from './webview/handlers/OpenOrCreateProjectInstructionsFileHandler';
import { SetActiveChatHandler } from './webview/handlers/SetActiveChatHandler';
import { CreateChatHandler } from './webview/handlers/CreateChatHandler';
import { DeleteChatHandler } from './webview/handlers/DeleteChatHandler';
import { UpdateChatConfigHandler } from './webview/handlers/UpdateChatConfigHandler';
import { UpdateLastLocationHandler } from './webview/handlers/UpdateLastLocationHandler';
import { SetDefaultConfigHandler } from './webview/handlers/SetDefaultConfigHandler';
import { DeleteMessageHandler } from './webview/handlers/DeleteMessageHandler';

let aiServiceInstance: AiService | undefined = undefined;

// --- Activation Function ---
export async function activate(context: vscode.ExtensionContext) {
    console.log('--- Zen Coder Extension Activating ---');

    try {
        const historyManagerInstance = new HistoryManager(context);
        // Instantiate ProviderStatusManager first
        const providerStatusManagerInstance = new ProviderStatusManager(context);
        // Pass ProviderStatusManager to AiService constructor
        aiServiceInstance = new AiService(context, historyManagerInstance, providerStatusManagerInstance);
        await aiServiceInstance.initialize();

        if (!aiServiceInstance) {
            throw new Error("AiService failed to initialize.");
        }

        const provider = new ZenCoderChatViewProvider(context, aiServiceInstance, historyManagerInstance);

        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(ZenCoderChatViewProvider.viewType, provider, {
                webviewOptions: { retainContextWhenHidden: true } // Keep context alive
            })
        );
        console.log('Zen Coder Chat View Provider registered.');

        // Set callback for AiService to post messages back to webview
        // Ensure provider instance is available when setting callback
        aiServiceInstance.setPostMessageCallback((message: any) => {
            provider.postMessageToWebview(message);
        });

        // --- Register Commands ---
        context.subscriptions.push(
            vscode.commands.registerCommand('zen-coder.openGlobalMcpConfig', async () => {
                await openOrCreateMcpConfigFile(context, true);
            })
        );
        context.subscriptions.push(
            vscode.commands.registerCommand('zen-coder.openProjectMcpConfig', async () => {
                await openOrCreateMcpConfigFile(context, false);
            })
        );
        console.log('MCP config commands registered.');

    } catch (error) {
        console.error("Zen Coder activation failed:", error);
        vscode.window.showErrorMessage(`Zen Coder failed to activate: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// --- Webview Provider Class ---
class ZenCoderChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'zencoder.views.chat';

    private _view?: vscode.WebviewView;
    private readonly _context: vscode.ExtensionContext;
    private readonly _extensionUri: vscode.Uri;
    private readonly _extensionMode: vscode.ExtensionMode;
    private readonly _aiService: AiService;
    private readonly _historyManager: HistoryManager;
    // private readonly _providerStatusManager: ProviderStatusManager; // Removed, accessed via AiService
    private readonly _modelResolver: ModelResolver;
    private _streamProcessor?: StreamProcessor;
    private readonly _mcpManager: McpManager; // Add McpManager instance
    private readonly _messageHandlers: Map<string, MessageHandler>;
    private readonly _requestHandlers: { [key in WebviewRequestType]?: (payload?: any, context?: HandlerContext) => Promise<any> };

    constructor(
        context: vscode.ExtensionContext,
        aiService: AiService,
        historyManager: HistoryManager
    ) {
        this._context = context;
        this._extensionUri = context.extensionUri;
        this._extensionMode = context.extensionMode;
        this._aiService = aiService;
        this._historyManager = historyManager;
        // ProviderStatusManager is now created in activate() and passed to AiService
        // We get it from AiService if needed, or pass it down if AiService doesn't hold it
        // Let's assume AiService holds it for now. If not, adjust later.
        // Remove direct instantiation here.
        // this._providerStatusManager = new ProviderStatusManager(context, aiService);
        this._modelResolver = new ModelResolver(context, aiService.providerStatusManager, aiService); // Get manager from AiService
        this._messageHandlers = new Map();
        this._requestHandlers = this._initializeRequestHandlers(); // Initialize request handlers map
        // Instantiate McpManager, passing context and the postMessage callback
        this._mcpManager = new McpManager(context, this.postMessageToWebview.bind(this));
        console.log("ZenCoderChatViewProvider constructed.");
    }

    // --- Initialize Request Handlers ---
    private _initializeRequestHandlers(): { [key in WebviewRequestType]?: (payload?: any, context?: HandlerContext) => Promise<any> } {
        // Context is created within _handleWebviewMessage when needed
        return {
            getProviderStatus: async () => this._aiService.providerStatusManager.getProviderStatus(this._aiService.allProviders, this._aiService.providerMap), // Pass args
            getAvailableProviders: async () => this._modelResolver.getAvailableProviders(),
            getModelsForProvider: async (payload) => this._modelResolver.fetchModelsForProvider(payload?.providerId),
            getDefaultConfig: async () => {
                const config = vscode.workspace.getConfiguration('zencoder');
                return {
                    defaultChatModelId: config.get<string>('defaults.chatModelId'),
                    // Add other defaults later
                };
            },
            // Correctly implement these handlers
            getMcpConfiguredStatus: async () => {
                // Use the McpManager instance
                return this._mcpManager.getMcpServerConfiguredStatus();
            },
            getAllToolsStatus: async () => {
                // Use the AiService instance
                return this._aiService.getAllToolsWithStatus();
            },
            getCustomInstructions: async () => {
                // Use the AiService instance to get combined instructions
                return this._aiService.getCombinedCustomInstructions();
            },
        };
    }

    // --- Register Standard Message Handlers ---
    private _registerHandlers(): void {
        if (!this._streamProcessor) {
            console.error("Cannot register handlers: StreamProcessor not initialized.");
            return;
        }
        const handlers: MessageHandler[] = [
            new WebviewReadyHandler(),
            new SendMessageHandler(this._streamProcessor),
            new SetProviderEnabledHandler(this._aiService),
            new SetApiKeyHandler(this._aiService),
            new DeleteApiKeyHandler(this._aiService),
            new ClearChatHistoryHandler(),
            new ExecuteToolActionHandler(this._aiService),
            new SetToolEnabledHandler(),
            new GetMcpConfiguredStatusHandler(), // Keep for push updates?
            new RetryMcpConnectionHandler(),
            new StopGenerationHandler(this._aiService),
            new SetGlobalCustomInstructionsHandler(),
            new SetProjectCustomInstructionsHandler(),
            new OpenOrCreateProjectInstructionsFileHandler(),
            new SetActiveChatHandler(),
            new CreateChatHandler(),
            new DeleteChatHandler(),
            new UpdateChatConfigHandler(this._historyManager),
            new UpdateLastLocationHandler(),
            new SetDefaultConfigHandler(),
            new DeleteMessageHandler(this._historyManager, this.postMessageToWebview.bind(this)),
        ];

        handlers.forEach(handler => {
            if (this._messageHandlers.has(handler.messageType)) {
                console.warn(`Handler already registered for message type: ${handler.messageType}. Overwriting.`);
            }
            this._messageHandlers.set(handler.messageType, handler);
        });
        console.log(`Registered ${this._messageHandlers.size} message handlers.`);
    }

    // --- Resolve Webview View ---
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;
        console.log("Resolving webview view...");

        this._streamProcessor = new StreamProcessor(
            this._historyManager,
            this.postMessageToWebview.bind(this)
        );
        this._registerHandlers(); // Register handlers AFTER stream processor is ready
        this._subscribeToServiceEvents(); // Subscribe to events from backend services
        console.log("StreamProcessor instantiated, handlers registered, and subscribed to service events.");

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview')]
        };

        webviewView.webview.html = getWebviewContent(webviewView.webview, this._extensionUri, this._extensionMode);
        console.log("Webview HTML set.");

        webviewView.webview.onDidReceiveMessage(
            (message: any) => { // Use 'any' here for flexibility, handle specific types inside
                console.log("[Extension] Received message from webview:", message?.type);
                this._handleWebviewMessage(message);
            },
            undefined,
            this._context.subscriptions
        );

        webviewView.onDidDispose(() => {
            console.log("Webview view disposed.");
            // Cleanup if needed
        }, null, this._context.subscriptions);

        console.log("Webview view resolved and message listener attached.");
    }

    // --- Message Handling Logic ---
    private async _handleWebviewMessage(message: any): Promise<void> {
        if (!message || !message.type) {
            console.warn("[Extension] Received invalid message structure:", message);
            return;
        }

        // --- Handle Request Messages ---
        if (message.type === 'requestData') {
            const requestMessage = message as WebviewRequestMessage;
            const handler = this._requestHandlers[requestMessage.requestType];
            let responsePayload: any = null;
            let responseError: string | undefined = undefined;

            // Create context lazily only if handler exists
            const context: HandlerContext = {
                 aiService: this._aiService,
                 historyManager: this._historyManager,
                 providerStatusManager: this._aiService.providerStatusManager, // Get from AiService
                 modelResolver: this._modelResolver,
                 mcpManager: this._mcpManager, // Add McpManager instance
                 postMessage: this.postMessageToWebview.bind(this),
                 extensionContext: this._context
            };

            if (handler) {
                try {
                    console.log(`[Extension] Handling request: ${requestMessage.requestType}, ID: ${requestMessage.requestId}`);
                    responsePayload = await handler(requestMessage.payload, context);
                    console.log(`[Extension] Request successful: ${requestMessage.requestType}, ID: ${requestMessage.requestId}`);
                } catch (error: any) {
                    console.error(`[Extension] Error handling request ${requestMessage.requestType} (ID: ${requestMessage.requestId}):`, error);
                    responseError = error.message || 'An unknown error occurred';
                }
            } else {
                console.error(`[Extension] No handler found for request type: ${requestMessage.requestType}`);
                responseError = `No handler found for request type: ${requestMessage.requestType}`;
            }

            const responseMessage: WebviewResponseMessage = {
                type: 'responseData',
                requestId: requestMessage.requestId,
                payload: responsePayload,
                error: responseError,
            };
            this.postMessageToWebview(responseMessage);
            return; // Stop processing after handling request
        }

        // --- Handle Standard Messages via Registered Handlers ---
        const handler = this._messageHandlers.get(message.type);
        if (handler) {
            const context: HandlerContext = {
                aiService: this._aiService,
                historyManager: this._historyManager,
                providerStatusManager: this._aiService.providerStatusManager, // Get from AiService
                modelResolver: this._modelResolver,
                mcpManager: this._mcpManager, // Add McpManager instance
                postMessage: this.postMessageToWebview.bind(this),
                extensionContext: this._context
            };
            try {
                await handler.handle(message, context);
            } catch (error: any) {
                console.error(`Error executing handler for message type ${message.type}:`, error);
                vscode.window.showErrorMessage(`An internal error occurred while processing the request: ${error.message}`);
            }
        } else {
            // Handle simple cases directly or log unknown types
             if (message.type === 'openGlobalMcpConfig') {
                 vscode.commands.executeCommand('zen-coder.openGlobalMcpConfig');
             } else if (message.type === 'openProjectMcpConfig') {
                 vscode.commands.executeCommand('zen-coder.openProjectMcpConfig');
             } else {
                 console.warn(`[Extension] No handler registered or direct handling for message type: ${message.type}`);
             }
        }
    }

    // --- Post Message Helper ---
    public postMessageToWebview(message: ExtensionMessageType) {
        console.log(`[Extension] Attempting to post message: ${message.type}. View exists: ${!!this._view}`); // DEBUG LOG
        if (this._view) {
            console.log(`[Extension] Posting message: ${message.type}`, message); // DEBUG LOG
            this._view.webview.postMessage(message);
        } else {
            console.warn(`[Extension] Failed to post message: Webview view is not resolved. Message type: ${message.type}`);
        }
    }
    // --- Subscribe to Backend Service Events ---
    private _subscribeToServiceEvents(): void {
        // Subscribe to Provider Status Changes
        this._aiService.eventEmitter.on('providerStatusChanged', (status: ProviderInfoAndStatus[]) => {
            console.log('[Extension] Received providerStatusChanged event from AiService.');
            this.postMessageToWebview({
                type: 'pushUpdateProviderStatus', // New message type for push update
                payload: status
            });
        });

        // TODO: Subscribe to Tool Status Changes from AiService/ToolManager
        // this._aiService.eventEmitter.on('toolsStatusChanged', (status: AllToolsStatusPayload) => { ... });

        // TODO: Subscribe to MCP Server Status Changes from McpManager
        // this._mcpManager.eventEmitter.on('serversStatusChanged', (status: McpConfiguredStatusPayload) => { ... });

        console.log('[Extension] Subscribed to backend service events.');
    }
} // End of ZenCoderChatViewProvider class

// --- Deactivation Function ---
export function deactivate() {}
