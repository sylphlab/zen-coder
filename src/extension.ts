import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CoreMessage, Tool } from 'ai';
import { SubscriptionManager } from './ai/subscriptionManager'; // Import SubscriptionManager
import { AiService } from './ai/aiService';
import {
    UiMessage,
    WebviewMessageType,
    ExtensionMessageType,
    ChatSession,
    DefaultChatConfig,
    WebviewRequestMessage,
    WebviewResponseMessage,
    ProviderInfoAndStatus,
    AllToolsStatusInfo
} from './common/types';
import { getWebviewContent } from './webview/webviewContent';
import { ChatSessionManager } from './session/chatSessionManager';
import { HistoryManager } from './historyManager';
import { AssistantManager } from './session/AssistantManager'; // Import AssistantManager
import { StreamProcessor } from './streamProcessor';
import { ProviderStatusManager } from './ai/providerStatusManager';
import { ConfigResolver } from './ai/configResolver'; // Import ConfigResolver
import { ModelResolver } from './ai/modelResolver';
import { RequestHandler, HandlerContext } from './webview/handlers/RequestHandler';
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
import { GetChatSessionsHandler } from './webview/handlers/GetChatSessionsHandler';
import { GetAvailableProvidersHandler } from './webview/handlers/GetAvailableProvidersHandler';
import { GetProviderStatusHandler } from './webview/handlers/GetProviderStatusHandler';
import { GetAllToolsStatusHandler } from './webview/handlers/GetAllToolsStatusHandler';
import { GetMcpStatusHandler } from './webview/handlers/GetMcpStatusHandler';
import { GetCustomInstructionsHandler } from './webview/handlers/GetCustomInstructionsHandler';
import { GetDefaultConfigHandler } from './webview/handlers/GetDefaultConfigHandler';
import { GetModelsForProviderHandler } from './webview/handlers/GetModelsForProviderHandler';
import { GetChatSessionHandler } from './webview/handlers/GetChatSessionHandler';
import { GetChatHistoryHandler } from './webview/handlers/GetChatHistoryHandler';
import { GetLastLocationHandler } from './webview/handlers/GetLastLocationHandler';
import { SubscribeHandler } from './webview/handlers/SubscribeHandler';
import { UnsubscribeHandler } from './webview/handlers/UnsubscribeHandler';
import { OpenGlobalMcpConfigHandler } from './webview/handlers/OpenGlobalMcpConfigHandler';
import { OpenProjectMcpConfigHandler } from './webview/handlers/OpenProjectMcpConfigHandler';
import { GetVertexStaticDataHandler } from './webview/handlers/GetVertexStaticDataHandler'; // Import the new handler
import { GetAssistantsHandler } from './webview/handlers/GetAssistantsHandler'; // Import GetAssistantsHandler
import { CreateAssistantHandler } from './webview/handlers/CreateAssistantHandler'; // Import CreateAssistantHandler
import { UpdateAssistantHandler } from './webview/handlers/UpdateAssistantHandler'; // Import UpdateAssistantHandler
import { DeleteAssistantHandler } from './webview/handlers/DeleteAssistantHandler'; // Import DeleteAssistantHandler
// Removed GetVertexProjectsHandler and GetVertexLocationsHandler imports

let aiServiceInstance: AiService | undefined = undefined;

// --- Activation Function ---
export async function activate(context: vscode.ExtensionContext) {
    console.log('--- Zen Coder Extension Activating ---');

try {
        // Instantiate managers in correct order of dependency
        const providerStatusManagerInstance = new ProviderStatusManager(context);
        const subscriptionManagerInstance = new SubscriptionManager(() => aiServiceInstance!);
        const chatSessionManagerInstance = new ChatSessionManager(context, subscriptionManagerInstance);
        // Corrected: Pass both chatSessionManagerInstance and subscriptionManagerInstance
        const historyManagerInstance = new HistoryManager(chatSessionManagerInstance, subscriptionManagerInstance);
        const assistantManagerInstance = new AssistantManager(context); // Instantiate AssistantManager here
        const configResolverInstance = new ConfigResolver(chatSessionManagerInstance, assistantManagerInstance); // Instantiate ConfigResolver here

        // AiService constructor now needs ConfigResolver
        aiServiceInstance = new AiService(context, historyManagerInstance, providerStatusManagerInstance, chatSessionManagerInstance, subscriptionManagerInstance, configResolverInstance); // Pass 6 args
        await aiServiceInstance.initialize();

        if (!aiServiceInstance) {
            throw new Error("AiService failed to initialize.");
        }

        // Pass AssistantManager and ConfigResolver to the View Provider
        const provider = new ZenCoderChatViewProvider(context, aiServiceInstance, chatSessionManagerInstance, historyManagerInstance, assistantManagerInstance, configResolverInstance); // Pass 6 args

        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(ZenCoderChatViewProvider.viewType, provider, {
                webviewOptions: { retainContextWhenHidden: true }
            })
        );
         console.log('Zen Coder Chat View Provider registered.');

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
    private readonly _historyManager: HistoryManager; // Store the passed instance
    private readonly _configResolver: ConfigResolver;
    private readonly _modelResolver: ModelResolver;
    // No _streamProcessor instance here
    private readonly _mcpManager: McpManager;
    private readonly _assistantManager: AssistantManager; // Add AssistantManager property
    private readonly _handlers: Map<string, RequestHandler>;

    constructor(
        context: vscode.ExtensionContext,
        aiService: AiService,
        chatSessionManager: ChatSessionManager,
        historyManager: HistoryManager, // Accept the single HistoryManager instance
        assistantManager: AssistantManager, // Accept AssistantManager
        configResolver: ConfigResolver // Accept ConfigResolver
    ) {
        this._context = context;
        this._extensionUri = context.extensionUri;
        this._extensionMode = context.extensionMode;
        this._aiService = aiService;
        this._chatSessionManager = chatSessionManager;
        this._historyManager = historyManager; // Store the passed instance
        this._assistantManager = assistantManager; // Store the passed AssistantManager instance
        this._configResolver = configResolver; // Store the passed ConfigResolver instance
        this._modelResolver = new ModelResolver(context, aiService.providerStatusManager, aiService);
        this._handlers = new Map();
        // Pass postMessageCallback directly to McpManager constructor
        this._mcpManager = new McpManager(context, this.postMessageToWebview.bind(this));
        console.log("ZenCoderChatViewProvider constructed.");
    }

    private _registerHandlers(): void {
        // No need to get streamProcessor here, SendMessageHandler will get it from context
        const allHandlers: RequestHandler[] = [
            new GetChatSessionsHandler(),
            new GetAvailableProvidersHandler(),
            new GetProviderStatusHandler(),
            new GetAllToolsStatusHandler(),
            new GetMcpStatusHandler(),
            new GetCustomInstructionsHandler(),
            new GetDefaultConfigHandler(),
            new GetModelsForProviderHandler(),
            new GetChatSessionHandler(),
            new GetChatHistoryHandler(this._historyManager),
            new GetLastLocationHandler(),
            new SetApiKeyHandler(),
            new DeleteApiKeyHandler(),
            new SetProviderEnabledHandler(),
            new SetDefaultConfigHandler(),
            new SetGlobalCustomInstructionsHandler(),
            new SetProjectCustomInstructionsHandler(),
            new SetToolAuthorizationHandler(),
            new RetryMcpConnectionHandler(this._mcpManager),
            new SetActiveChatHandler(),
            new CreateChatHandler(),
            new DeleteChatHandler(),
            new UpdateChatConfigHandler(),
            new ClearChatHistoryHandler(),
            new DeleteMessageHandler(),
            new SubscribeHandler(),
            new UnsubscribeHandler(),
            new OpenOrCreateProjectInstructionsFileHandler(),
            new UpdateLastLocationHandler(),
            new SendMessageHandler(), // Correct: Constructor takes no args
            new StopGenerationHandler(this._aiService),
            new ExecuteToolActionHandler(),
            new OpenGlobalMcpConfigHandler(),
            new OpenProjectMcpConfigHandler(),
            new GetVertexStaticDataHandler(), // Add the new handler instance
            new GetAssistantsHandler(), // Register GetAssistantsHandler
            new CreateAssistantHandler(), // Register CreateAssistantHandler
            new UpdateAssistantHandler(), // Register UpdateAssistantHandler
            new DeleteAssistantHandler(), // Register DeleteAssistantHandler
            // Removed GetVertexProjectsHandler and GetVertexLocationsHandler instances
        ];

        console.log(`[Extension] Registering ${allHandlers.length} handlers...`); // Add log before loop
        allHandlers.forEach(handler => {
            if (!handler || !handler.requestType) {
                console.error('[Extension] Invalid handler found during registration:', handler);
                return;
            }
            if (this._handlers.has(handler.requestType)) {
                console.warn(`[Extension] Handler already registered for type: ${handler.requestType}. Overwriting.`);
            }
            // console.log(`[Extension] Registering handler for type: ${handler.requestType}`); // Optional: Log each registration
            this._handlers.set(handler.requestType, handler);
        });
        // Log final map size and keys
        console.log(`[Extension] Finished registering handlers. Total registered: ${this._handlers.size}. Keys: ${Array.from(this._handlers.keys()).join(', ')}`);
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;
        console.log("Resolving webview view...");

        // Remove incorrect StreamProcessor instantiation
        // this._streamProcessor = ... // REMOVED

        this._registerHandlers(); // Register handlers (which get dependencies via context)
        this._subscribeToServiceEvents();
        // console.log("StreamProcessor instantiated..."); // REMOVED

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
         }, null, this._context.subscriptions);

         // Set the callback on the single AiService instance, which propagates it
         this._aiService.setPostMessageCallback(this.postMessageToWebview.bind(this));
         console.log("Webview view resolved, message listener attached, and postMessageCallback set for AiService.");
     }

    private async _handleWebviewMessage(message: any): Promise<void> {
        const requestId: string | undefined = message.requestId;
        let handler: RequestHandler | undefined;
        let handlerType: string | undefined;
        let handlerPayload: any = message.payload;
        let responsePayload: any = null;
        let responseError: string | undefined = undefined;

        if (!this._view?.webview) {
            console.error("[Extension] Cannot handle message: Webview is not available.");
            return;
        }
        if (!message || typeof message.type !== 'string' || requestId === undefined) {
             console.error("[Extension] Received invalid message structure or missing requestId:", message);
             if (requestId) {
                 this.postMessageToWebview({ type: 'responseData', requestId, error: "Invalid message structure." });
             }
            return;
        }

        handlerType = message.type === 'requestData' ? message.requestType : message.type;

        if (typeof handlerType !== 'string') {
             responseError = "Invalid message: Missing handler type.";
             console.error(`[Extension] ${responseError}`);
             handlerType = undefined; // Ensure it's undefined if invalid
         } else {
             console.log(`[Extension] Looking up handler for type: "${handlerType}"`); // Log the type being looked up
             handler = this._handlers.get(handlerType);
             if (!handler) {
                 responseError = `No handler found for message type: ${handlerType}`;
                console.warn(`[Extension] ${responseError}`);
            }
        }

        if (handler && !responseError) {
            // Pass the unified instances in the context
            const context: HandlerContext = {
                webview: this._view.webview,
                aiService: this._aiService,
                historyManager: this._historyManager, // Pass the unified instance
                chatSessionManager: this._chatSessionManager,
                configResolver: this._configResolver,
                providerStatusManager: this._aiService.providerStatusManager,
                modelResolver: this._modelResolver,
                mcpManager: this._mcpManager,
                subscriptionManager: this._aiService.getSubscriptionManager(), // Add subscriptionManager
                assistantManager: this._assistantManager, // Provide AssistantManager in context
                postMessage: this.postMessageToWebview.bind(this),
                extensionContext: this._context
            };

            try {
                console.log(`[Extension] Handling request: ${handlerType}, ID: ${requestId}`);
                responsePayload = await handler.handle(handlerPayload, context);
                console.log(`[Extension] Request successful: ${handlerType}, ID: ${requestId}`);
            } catch (error: any) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`[Extension] Error handling request ${handlerType} (ID: ${requestId}):`, errorMessage);
                responseError = errorMessage;
                responsePayload = null;
            }
        }

        const responseMessage: WebviewResponseMessage = {
            type: 'responseData',
            requestId: requestId,
            payload: responsePayload,
            error: responseError,
        };
        this.postMessageToWebview(responseMessage);
    }

    public postMessageToWebview(message: ExtensionMessageType) {
        console.log(`[Extension] Attempting to post message: ${message.type}. View exists: ${!!this._view}`);
        if (this._view) {
            console.log(`[Extension] Posting message: ${message.type}`, message);
            this._view.webview.postMessage(message);
        } else {
            console.warn(`[Extension] Failed to post message: Webview view is not resolved. Message type: ${message.type}`);
        }
    }

    private _subscribeToServiceEvents(): void {
        this._aiService.eventEmitter.on('providerStatusChanged', (status: ProviderInfoAndStatus[]) => {
            console.log('[Extension] Received providerStatusChanged event from AiService.');
            this.postMessageToWebview({
                type: 'pushUpdate',
                payload: { topic: 'providerStatusUpdate', data: status } // Corrected topic name
            });
        });

        this._aiService.eventEmitter.on('toolsStatusChanged', (statusInfo: AllToolsStatusInfo) => {
            console.log('[Extension] Received toolsStatusChanged event from AiService.');
            this.postMessageToWebview({
                type: 'pushUpdate',
                payload: { topic: 'allToolsStatusUpdate', data: statusInfo } // Corrected topic name
            });
        });

        console.log('[Extension] Subscribed to backend service events.');
    }
}

export function deactivate() {}
