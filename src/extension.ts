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
    ProviderInfoAndStatus, // Import missing type
    AllToolsStatusInfo // Import new type for event payload
} from './common/types';
import { getWebviewContent } from './webview/webviewContent';
import { HistoryManager } from './historyManager';
import { StreamProcessor } from './streamProcessor';
import { ProviderStatusManager } from './ai/providerStatusManager';
import { ModelResolver } from './ai/modelResolver';
import { RequestHandler, HandlerContext } from './webview/handlers/RequestHandler';
import { MessageHandler } from './webview/handlers/MessageHandler';
import { McpManager } from './ai/mcpManager'; // Import McpManager
// Import necessary handlers
import { SendMessageHandler } from './webview/handlers/SendMessageHandler';
import { SetProviderEnabledHandler } from './webview/handlers/SetProviderEnabledHandler';
import { SetApiKeyHandler } from './webview/handlers/SetApiKeyHandler';
import { DeleteApiKeyHandler } from './webview/handlers/DeleteApiKeyHandler';
import { ClearChatHistoryHandler } from './webview/handlers/ClearChatHistoryHandler';
import { ExecuteToolActionHandler } from './webview/handlers/ExecuteToolActionHandler';
import { SetToolAuthorizationHandler } from './webview/handlers/SetToolAuthorizationHandler';
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
import { GetChatStateHandler } from './webview/handlers/GetChatStateHandler';
import { GetAvailableProvidersHandler } from './webview/handlers/GetAvailableProvidersHandler';
import { GetProviderStatusHandler } from './webview/handlers/GetProviderStatusHandler';
import { GetAllToolsStatusHandler } from './webview/handlers/GetAllToolsStatusHandler';
import { GetMcpStatusHandler } from './webview/handlers/GetMcpStatusHandler';
import { GetCustomInstructionsHandler } from './webview/handlers/GetCustomInstructionsHandler';
import { GetDefaultConfigHandler } from './webview/handlers/GetDefaultConfigHandler';
import { GetModelsForProviderHandler } from './webview/handlers/GetModelsForProviderHandler';
import { SubscribeHandler } from './webview/handlers/SubscribeHandler';
import { UnsubscribeHandler } from './webview/handlers/UnsubscribeHandler';

let aiServiceInstance: AiService | undefined = undefined;

// --- Activation Function ---
export async function activate(context: vscode.ExtensionContext) {
    console.log('--- Zen Coder Extension Activating ---');

    try {
        const historyManagerInstance = new HistoryManager(context);
        const providerStatusManagerInstance = new ProviderStatusManager(context);
        aiServiceInstance = new AiService(context, historyManagerInstance, providerStatusManagerInstance);
        await aiServiceInstance.initialize();

        if (!aiServiceInstance) {
            throw new Error("AiService failed to initialize.");
        }

        const provider = new ZenCoderChatViewProvider(context, aiServiceInstance, historyManagerInstance);

        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(ZenCoderChatViewProvider.viewType, provider, {
                webviewOptions: { retainContextWhenHidden: true }
            })
        );
        console.log('Zen Coder Chat View Provider registered.');

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
    private readonly _modelResolver: ModelResolver;
    private _streamProcessor?: StreamProcessor;
    private readonly _mcpManager: McpManager;
    private readonly _messageHandlers: Map<string, MessageHandler>;
    private readonly _requestHandlers: Map<string, RequestHandler>;

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
        this._modelResolver = new ModelResolver(context, aiService.providerStatusManager, aiService);
        this._messageHandlers = new Map();
        this._requestHandlers = new Map();
        this._mcpManager = new McpManager(context, this.postMessageToWebview.bind(this));
        console.log("ZenCoderChatViewProvider constructed.");
    }

    // --- Register Handlers ---
    private _registerHandlers(): void {
        if (!this._streamProcessor) {
            console.error("Cannot register handlers: StreamProcessor not initialized.");
            return;
        }
        // Register Request Handlers
        const requestHandlers: RequestHandler[] = [
            // Data Fetching
            new GetChatStateHandler(),
            new GetAvailableProvidersHandler(),
            new GetProviderStatusHandler(),
            new GetAllToolsStatusHandler(),
            new GetMcpStatusHandler(),
            new GetCustomInstructionsHandler(),
            new GetDefaultConfigHandler(),
            new GetModelsForProviderHandler(),
            // Actions
            new SetApiKeyHandler(this._aiService),
            new DeleteApiKeyHandler(this._aiService),
            new SetProviderEnabledHandler(this._aiService),
            new SetDefaultConfigHandler(),
            new SetGlobalCustomInstructionsHandler(),
            new SetProjectCustomInstructionsHandler(),
            new SetToolAuthorizationHandler(),
            new RetryMcpConnectionHandler(),
            new SetActiveChatHandler(),
            new CreateChatHandler(),
            new DeleteChatHandler(),
            new UpdateChatConfigHandler(),
            new ClearChatHistoryHandler(),
            new DeleteMessageHandler(),
            // Pub/Sub Management
            new SubscribeHandler(),
            new UnsubscribeHandler(),
            // Other Actions
            new OpenOrCreateProjectInstructionsFileHandler(),
            new UpdateLastLocationHandler(),
        ];

        requestHandlers.forEach(handler => {
            if (this._requestHandlers.has(handler.requestType)) {
                console.warn(`RequestHandler already registered for type: ${handler.requestType}. Overwriting.`);
            }
            this._requestHandlers.set(handler.requestType, handler);
        });
        console.log(`Registered ${this._requestHandlers.size} request handlers.`);

        // Register Standard Message Handlers (Fire-and-forget)
        const messageHandlers: MessageHandler[] = [
            new SendMessageHandler(this._streamProcessor),
            new StopGenerationHandler(this._aiService), // Needs AiService injected
            new ExecuteToolActionHandler(),
            // Add any other purely fire-and-forget handlers here
        ];

        messageHandlers.forEach(handler => {
            if (this._messageHandlers.has(handler.messageType)) {
                console.warn(`MessageHandler already registered for type: ${handler.messageType}. Overwriting.`);
            }
            this._messageHandlers.set(handler.messageType, handler);
        });
        console.log(`Registered ${this._messageHandlers.size} standard message handlers.`);
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
            (message: any) => {
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

        // --- Handle Request Messages (requestData, subscribe, unsubscribe) ---
        if (message.type === 'requestData' || message.type === 'subscribe' || message.type === 'unsubscribe') {
            const requestMessage = message as WebviewRequestMessage;
            const handlerType = message.type === 'requestData' ? requestMessage.requestType : message.type;
            const handler = this._requestHandlers.get(handlerType);
            let responsePayload: any = null;
            let responseError: string | undefined = undefined;

            if (!this._view?.webview) { // Check webview availability first
                console.error("[Extension] Cannot handle request: Webview is not available.");
                responseError = "Webview is not available to handle the request.";
            } else if (handler) {
                const context: HandlerContext = {
                    webview: this._view.webview, // Safe to access after check
                    aiService: this._aiService,
                    historyManager: this._historyManager,
                    providerStatusManager: this._aiService.providerStatusManager,
                    modelResolver: this._modelResolver,
                    mcpManager: this._mcpManager,
                    postMessage: this.postMessageToWebview.bind(this),
                    extensionContext: this._context
                };
                try {
                    console.log(`[Extension] Handling request: ${handlerType}, ID: ${requestMessage.requestId}`);
                    responsePayload = await handler.handle(requestMessage.payload, context);
                    console.log(`[Extension] Request successful: ${handlerType}, ID: ${requestMessage.requestId}`);
                } catch (error: any) {
                    console.error(`[Extension] Error handling request ${handlerType} (ID: ${requestMessage.requestId}):`, error);
                    responseError = error.message || 'An unknown error occurred';
                }
            } else {
                console.error(`[Extension] No handler found for request type: ${handlerType}`);
                responseError = `No handler found for request type: ${handlerType}`;
            }

            // Send response back only if webview was available
            if (this._view?.webview) {
                 const responseMessage: WebviewResponseMessage = {
                     type: 'responseData',
                     requestId: requestMessage.requestId,
                     payload: responsePayload,
                     error: responseError,
                 };
                 this.postMessageToWebview(responseMessage);
            }
            return; // Stop processing after handling request
        }

        // --- Handle Standard Messages (Fire-and-forget) ---
        const messageHandler = this._messageHandlers.get(message.type);
        if (messageHandler) {
             if (!this._view?.webview) { // Check webview availability
                 console.error("[Extension] Cannot handle message: Webview is not available.");
                 return;
             }
             const context: HandlerContext = {
                 webview: this._view.webview, // Safe to access after check
                 aiService: this._aiService,
                 historyManager: this._historyManager,
                 providerStatusManager: this._aiService.providerStatusManager,
                 modelResolver: this._modelResolver,
                 mcpManager: this._mcpManager,
                 postMessage: this.postMessageToWebview.bind(this),
                 extensionContext: this._context
             };
             try {
                 await messageHandler.handle(message, context);
             } catch (error: any) {
                 console.error(`Error executing message handler for type ${message.type}:`, error);
                 vscode.window.showErrorMessage(`An internal error occurred: ${error.message}`);
             }
        } else {
             console.warn(`[Extension] No handler registered for message type: ${message.type}`);
        }
    }

    // --- Post Message Helper ---
    public postMessageToWebview(message: ExtensionMessageType) {
        console.log(`[Extension] Attempting to post message: ${message.type}. View exists: ${!!this._view}`);
        if (this._view) {
            console.log(`[Extension] Posting message: ${message.type}`, message);
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
                type: 'pushUpdateProviderStatus',
                payload: status
            });
        });

        // Subscribe to Tool Status Changes from AiService
        this._aiService.eventEmitter.on('toolsStatusChanged', (statusInfo: AllToolsStatusInfo) => {
            console.log('[Extension] Received toolsStatusChanged event from AiService.');
            this.postMessageToWebview({
                type: 'updateAllToolsStatus',
                payload: statusInfo
            });
        });

        // TODO: Subscribe to MCP Server Status Changes from McpManager
        // this._mcpManager.eventEmitter.on('serversStatusChanged', (status: McpConfiguredStatusPayload) => { ... });

        console.log('[Extension] Subscribed to backend service events.');
    }
} // End of ZenCoderChatViewProvider class

// --- Deactivation Function ---
export function deactivate() {}
