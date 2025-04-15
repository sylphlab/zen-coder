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
    // WebviewRequestType, // Removed import
    ProviderInfoAndStatus,
    AllToolsStatusInfo
} from './common/types';
import { getWebviewContent } from './webview/webviewContent';
import { ChatSessionManager } from './session/chatSessionManager';
import { HistoryManager } from './historyManager';
import { StreamProcessor } from './streamProcessor';
import { ProviderStatusManager } from './ai/providerStatusManager';
import { ConfigResolver } from './ai/configResolver'; // Import ConfigResolver
import { ModelResolver } from './ai/modelResolver';
import { RequestHandler, HandlerContext } from './webview/handlers/RequestHandler';
// MessageHandler interface is no longer needed
import { McpManager } from './ai/mcpManager';
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
// Removed: import { GetChatStateHandler } from './webview/handlers/GetChatStateHandler';
import { GetChatSessionsHandler } from './webview/handlers/GetChatSessionsHandler'; // Added import for new handler
import { GetAvailableProvidersHandler } from './webview/handlers/GetAvailableProvidersHandler';
import { GetProviderStatusHandler } from './webview/handlers/GetProviderStatusHandler';
import { GetAllToolsStatusHandler } from './webview/handlers/GetAllToolsStatusHandler';
import { GetMcpStatusHandler } from './webview/handlers/GetMcpStatusHandler';
import { GetCustomInstructionsHandler } from './webview/handlers/GetCustomInstructionsHandler';
import { GetDefaultConfigHandler } from './webview/handlers/GetDefaultConfigHandler';
import { GetModelsForProviderHandler } from './webview/handlers/GetModelsForProviderHandler';
import { GetChatSessionHandler } from './webview/handlers/GetChatSessionHandler'; // Import the new handler
import { GetChatHistoryHandler } from './webview/handlers/GetChatHistoryHandler'; // Import the history handler
import { GetLastLocationHandler } from './webview/handlers/GetLastLocationHandler'; // Import new handler
import { SubscribeHandler } from './webview/handlers/SubscribeHandler';
import { UnsubscribeHandler } from './webview/handlers/UnsubscribeHandler';
import { OpenGlobalMcpConfigHandler } from './webview/handlers/OpenGlobalMcpConfigHandler'; // Import new handler
import { OpenProjectMcpConfigHandler } from './webview/handlers/OpenProjectMcpConfigHandler'; // Import new handler

let aiServiceInstance: AiService | undefined = undefined;

// --- Activation Function ---
export async function activate(context: vscode.ExtensionContext) {
    console.log('--- Zen Coder Extension Activating ---');

    try {
        // Instantiate managers in correct order of dependency
        const chatSessionManagerInstance = new ChatSessionManager(context); // Instantiate ChatSessionManager
        const historyManagerInstance = new HistoryManager(chatSessionManagerInstance); // Inject ChatSessionManager into HistoryManager
        const providerStatusManagerInstance = new ProviderStatusManager(context);

        // Pass required managers to AiService constructor
        aiServiceInstance = new AiService(context, historyManagerInstance, providerStatusManagerInstance, chatSessionManagerInstance); // Pass chatSessionManagerInstance
        await aiServiceInstance.initialize();

        if (!aiServiceInstance) {
            throw new Error("AiService failed to initialize.");
        }

        // Pass AiService and ChatSessionManager to the View Provider
        const provider = new ZenCoderChatViewProvider(context, aiServiceInstance, chatSessionManagerInstance);

        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(ZenCoderChatViewProvider.viewType, provider, {
                webviewOptions: { retainContextWhenHidden: true }
            })
        );
        console.log('Zen Coder Chat View Provider registered.');

        aiServiceInstance.setPostMessageCallback(provider.postMessageToWebview.bind(provider)); // Bind context

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
    private readonly _chatSessionManager: ChatSessionManager;
    private readonly _historyManager: HistoryManager;
    private readonly _configResolver: ConfigResolver; // Add ConfigResolver instance
    private readonly _modelResolver: ModelResolver;
    private _streamProcessor?: StreamProcessor;
    private readonly _mcpManager: McpManager;
    private readonly _handlers: Map<string, RequestHandler>; // Unified handler map

    constructor(
        context: vscode.ExtensionContext,
        aiService: AiService,
        chatSessionManager: ChatSessionManager // Accept ChatSessionManager
    ) {
        this._context = context;
        this._extensionUri = context.extensionUri;
        this._extensionMode = context.extensionMode;
        this._aiService = aiService;
        this._chatSessionManager = chatSessionManager; // Store ChatSessionManager
        // Instantiate HistoryManager and ConfigResolver internally
        this._historyManager = new HistoryManager(this._chatSessionManager);
        this._configResolver = new ConfigResolver(this._chatSessionManager); // Instantiate ConfigResolver
        this._modelResolver = new ModelResolver(context, aiService.providerStatusManager, aiService);
        this._handlers = new Map();
        this._mcpManager = new McpManager(context, this.postMessageToWebview.bind(this)); // Bind context
        console.log("ZenCoderChatViewProvider constructed.");
    }

    // --- Register Handlers ---
    private _registerHandlers(): void {
        if (!this._streamProcessor) {
            console.error("Cannot register handlers: StreamProcessor not initialized.");
            return;
        }
        // Register All Handlers (Unified)
        // Based on latest error feedback (8:35 AM) and logical dependencies
        const allHandlers: RequestHandler[] = [
            // Data Fetching
            new GetChatSessionsHandler(),
            new GetAvailableProvidersHandler(),
            new GetProviderStatusHandler(),
            new GetAllToolsStatusHandler(),
            new GetMcpStatusHandler(),
            new GetCustomInstructionsHandler(),
            new GetDefaultConfigHandler(),
            new GetModelsForProviderHandler(),
            new GetChatSessionHandler(),
            new GetChatHistoryHandler(this._historyManager), // Needs HistoryManager
            new GetLastLocationHandler(),
            // Actions
            new SetApiKeyHandler(), // Error 175 expected 0
            new DeleteApiKeyHandler(), // Error 176 expected 0
            new SetProviderEnabledHandler(),
            new SetDefaultConfigHandler(),
            new SetGlobalCustomInstructionsHandler(), // Error 179 expected 0
            new SetProjectCustomInstructionsHandler(),
            new SetToolAuthorizationHandler(),
            new RetryMcpConnectionHandler(this._mcpManager), // Error 182 expected 1
            new SetActiveChatHandler(), // Error 183 expected 0
            new CreateChatHandler(), // Error 184 expected 0
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
            // Core Actions
            new SendMessageHandler(this._streamProcessor), // Needs StreamProcessor
            new StopGenerationHandler(this._aiService), // Needs AiService
            new ExecuteToolActionHandler(),
            // MCP Config Handlers
            new OpenGlobalMcpConfigHandler(),
            new OpenProjectMcpConfigHandler(),
        ];

        allHandlers.forEach(handler => {
            // No need to check for requestType existence, TypeScript handles it via interface
            if (this._handlers.has(handler.requestType)) {
                console.warn(`Handler already registered for type: ${handler.requestType}. Overwriting.`);
            }
            this._handlers.set(handler.requestType, handler);
        });
        console.log(`Registered ${this._handlers.size} handlers.`);
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
        // --- Strict Unified Request Handling ---
        const requestId: string | undefined = message.requestId;
        let handler: RequestHandler | undefined;
        let handlerType: string | undefined;
        let handlerPayload: any = message.payload;
        let responsePayload: any = null;
        let responseError: string | undefined = undefined;

        // 1. Check if webview is available
        if (!this._view?.webview) {
            console.error("[Extension] Cannot handle message: Webview is not available.");
            return; // Cannot proceed or respond
        }

        // 2. Validate basic message structure and MANDATORY requestId
        if (!message || typeof message.type !== 'string') {
            console.error("[Extension] Received invalid message structure (missing type):", message);
            // Cannot respond without requestId
            return;
        }
        if (requestId === undefined) {
            console.error("[Extension] Received message without mandatory requestId. Discarding:", message);
            // Cannot respond without requestId
            return;
        }

        // 3. Determine the Handler Type
        if (message.type === 'requestData') {
            if (typeof message.requestType !== 'string') {
                responseError = "Invalid 'requestData' message: missing 'requestType'.";
                handlerType = undefined; // Mark as invalid
            } else {
                handlerType = message.requestType;
            }
        } else {
            // All other valid messages should have their type directly as the handler type
            handlerType = message.type;
        }

        // 4. Find the Handler (only if handlerType is valid)
        if (handlerType) {
            handler = this._handlers.get(handlerType);
            if (!handler) {
                responseError = `No handler found for message type: ${handlerType}`;
                console.warn(`[Extension] ${responseError}`);
            }
        } else if (!responseError) { // If handlerType was undefined and no previous error
             responseError = "Invalid message: Missing handler type.";
             console.error(`[Extension] ${responseError}`);
        }

        // 5. Execute the Handler (only if found and no error yet)
        if (handler && !responseError) {
            const context: HandlerContext = {
                webview: this._view.webview,
                aiService: this._aiService,
                historyManager: this._historyManager,
                chatSessionManager: this._chatSessionManager,
                configResolver: this._configResolver, // Add ConfigResolver to context
                providerStatusManager: this._aiService.providerStatusManager, // Keep for direct access if needed
                modelResolver: this._modelResolver,
                mcpManager: this._mcpManager,
                postMessage: this.postMessageToWebview.bind(this), // Bind context
                extensionContext: this._context
            };

            try {
                console.log(`[Extension] Handling request: ${handlerType}, ID: ${requestId}`); // handlerType is guaranteed string here
                responsePayload = await handler.handle(handlerPayload, context);
                console.log(`[Extension] Request successful: ${handlerType}, ID: ${requestId}`);
            } catch (error: any) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`[Extension] Error handling request ${handlerType} (ID: ${requestId}):`, errorMessage);
                responseError = errorMessage;
                responsePayload = null; // Ensure payload is null on error
            }
        }
        // If handler was not found or handlerType was invalid, responseError is already set.

        // 6. ALWAYS Send Response (since requestId is mandatory)
        const responseMessage: WebviewResponseMessage = {
            type: 'responseData',
            requestId: requestId, // requestId is guaranteed to be defined here
            payload: responsePayload,
            error: responseError,
        };
        this.postMessageToWebview(responseMessage);
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
                type: 'pushUpdate', // Changed to pushUpdate
                payload: { topic: 'providerStatus', data: status } // Added topic and data
            });
        });

        // Subscribe to Tool Status Changes from AiService
        this._aiService.eventEmitter.on('toolsStatusChanged', (statusInfo: AllToolsStatusInfo) => {
            console.log('[Extension] Received toolsStatusChanged event from AiService.');
            this.postMessageToWebview({
                type: 'pushUpdate', // Changed to pushUpdate
                payload: { topic: 'allToolsStatus', data: statusInfo } // Added topic and data
            });
        });

        // Subscribe to MCP Server Status Changes from McpManager
        // TODO: Reactivate or refine this listener if needed. For now, rely on AiService's toolsStatusChanged
        // this._mcpManager.on('serversStatusChanged', (status: McpConfiguredStatusPayload) => {
        //     this.postMessageToWebview({
        //         type: 'pushUpdate',
        //         payload: { topic: 'mcpStatus', data: status }
        //     });
        // });

        // TODO: Subscribe to Default Config Changes from AiService/ConfigWatcher
        // this._aiService.eventEmitter.on('defaultConfigChanged', (config: DefaultChatConfig) => { ... });

        // TODO: Subscribe to Custom Instructions Changes from AiService/ConfigWatcher
        // this._aiService.eventEmitter.on('customInstructionsChanged', (instructions: { global: string; project: string | null; projectPath: string | null }) => { ... });


        console.log('[Extension] Subscribed to backend service events.');
    }
} // End of ZenCoderChatViewProvider class

// --- Deactivation Function ---
export function deactivate() {}
