import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CoreMessage, Tool } from 'ai'; // Keep CoreMessage if needed elsewhere, maybe not. Import Tool.
import { AiService, ApiProviderKey } from './ai/aiService'; // Removed AiServiceResponse import
// import { providerMap } from './ai/providers'; // Removed - Map is now in AiService
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
// import { SetStandardToolEnabledHandler } from './webview/handlers/SetStandardToolEnabledHandler'; // Replaced
import { SetToolEnabledHandler } from './webview/handlers/SetToolEnabledHandler'; // Import the unified handler
// Removed import for UpdateMcpServersConfigHandler
// Import new MCP handlers (assuming they exist or will be created)
import { GetMcpConfiguredStatusHandler } from './webview/handlers/GetMcpConfiguredStatusHandler';
import { TestMcpConnectionHandler } from './webview/handlers/TestMcpConnectionHandler'; // This handler is now defunct
import { RetryMcpConnectionHandler } from './webview/handlers/RetryMcpConnectionHandler'; // Import the new retry handler
import { StopGenerationHandler } from './webview/handlers/StopGenerationHandler'; // Import the stop handler
import { openOrCreateMcpConfigFile } from './utils/configUtils'; // Import the helper function
import { allTools, ToolName } from './tools'; // Import allTools map
// Import new custom instruction handlers
import { GetCustomInstructionsHandler } from './webview/handlers/GetCustomInstructionsHandler';
import { SetGlobalCustomInstructionsHandler } from './webview/handlers/SetGlobalCustomInstructionsHandler';
import { SetProjectCustomInstructionsHandler } from './webview/handlers/SetProjectCustomInstructionsHandler';
import { OpenOrCreateProjectInstructionsFileHandler } from './webview/handlers/OpenOrCreateProjectInstructionsFileHandler';
// Import new chat management handlers
import { SetActiveChatHandler } from './webview/handlers/SetActiveChatHandler';
import { CreateChatHandler } from './webview/handlers/CreateChatHandler';
import { DeleteChatHandler } from './webview/handlers/DeleteChatHandler';
import { UpdateLastLocationHandler } from './webview/handlers/UpdateLastLocationHandler';
import { SetDefaultConfigHandler } from './webview/handlers/SetDefaultConfigHandler'; // Import the new handler
// Key for storing MCP tool overrides in globalState (consistent with handler)
const MCP_TOOL_OVERRIDES_KEY = 'mcpToolEnabledOverrides';

let aiServiceInstance: AiService | undefined = undefined;

export async function activate(context: vscode.ExtensionContext) {
    console.log('--- Zen Coder Extension Activating ---');

    // HistoryManager needs to be created first
    const historyManagerInstance = new HistoryManager(context);
    aiServiceInstance = new AiService(context, historyManagerInstance); // Pass historyManager
    await aiServiceInstance.initialize();

    if (!aiServiceInstance) {
        console.error("AiService failed to initialize before registering view provider.");
        vscode.window.showErrorMessage("Zen Coder failed to initialize. Please check logs or restart VS Code.");
        return;
    }
    // Pass historyManager to the provider as well
    const provider = new ZenCoderChatViewProvider(context, aiServiceInstance, historyManagerInstance);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ZenCoderChatViewProvider.viewType, provider)
    );
    console.log('Zen Coder Chat View Provider registered.');

    // Set callback for AiService to post messages back to webview
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
        aiService: AiService,
        historyManager: HistoryManager // Add historyManager parameter
    ) {
        this._context = context;
        this._extensionUri = context.extensionUri;
        this._extensionMode = context.extensionMode;
        this._aiService = aiService;
        this._historyManager = historyManager; // Use the passed instance
        // Pass AiService instance to managers
        this._providerStatusManager = new ProviderStatusManager(context, aiService);
        this._modelResolver = new ModelResolver(context, this._providerStatusManager, aiService);
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
            // Existing handlers...
            new WebviewReadyHandler(),
            new SendMessageHandler(this._streamProcessor),
            new GetAvailableModelsHandler(),
            new GetProviderStatusHandler(),
            new SetProviderEnabledHandler(this._aiService),
            new SetApiKeyHandler(this._aiService),
            new DeleteApiKeyHandler(this._aiService),
            new ClearChatHistoryHandler(),
            new ExecuteToolActionHandler(this._aiService),
            new SetToolEnabledHandler(),
            new GetMcpConfiguredStatusHandler(),
            new RetryMcpConnectionHandler(),
            new StopGenerationHandler(this._aiService),

            // New Custom Instruction Handlers
            new GetCustomInstructionsHandler(), // Handles 'settingsPageReady' to send instructions
            new SetGlobalCustomInstructionsHandler(),
            new SetProjectCustomInstructionsHandler(),
            new OpenOrCreateProjectInstructionsFileHandler(),

            // New Chat Management Handlers
            new SetActiveChatHandler(),
            new CreateChatHandler(),
            new DeleteChatHandler(),
            new UpdateLastLocationHandler(),
            new SetDefaultConfigHandler(), // Register the new handler
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
            // Handle simple cases directly or log unknown types for messages without dedicated handlers
            if (message.type === 'setModel') {
                 if (typeof message.modelId === 'string') {
                     // this._aiService.setModel(message.modelId); // setModel is deprecated
                     console.warn("Received deprecated 'setModel' message. Model selection is now per-chat.");
                     // TODO: Implement logic to update chat config via historyManager if needed
                     console.log(`Model changed to: ${message.modelId}`);
                 } else {
                     console.error('Invalid modelId received', message);
                 }
            } else if (message.type === 'openGlobalMcpConfig') { // Correctly placed else if
                console.log("Executing command: zen-coder.openGlobalMcpConfig");
                vscode.commands.executeCommand('zen-coder.openGlobalMcpConfig');
            } else if (message.type === 'openProjectMcpConfig') { // Correctly placed else if
                console.log("Executing command: zen-coder.openProjectMcpConfig");
                vscode.commands.executeCommand('zen-coder.openProjectMcpConfig');
            // } else if (message.type === 'settingsPageReady') { // This is now handled by GetCustomInstructionsHandler
            //     console.log("Settings page reported ready. Sending all tools status...");
            //     try {
            //         const allToolsStatus = await this._getAllToolsStatus(); // This helper is now inside GetCustomInstructionsHandler
            //         this.postMessageToWebview({ type: 'updateAllToolsStatus', payload: allToolsStatus });
            //         console.log("Sent all tools status to webview:", Object.keys(allToolsStatus).length, "tools");
            //     } catch (error) {
            //         console.error("Error getting or sending all tools status:", error);
            //         vscode.window.showErrorMessage("Failed to load tool information.");
            //     }
            } else {
                 // Log any other unhandled message types
                 console.warn(`[Extension] No handler registered or direct handling for message type: ${message.type}`);
            }
        }
    }

    // --- Helper to get status of all tools --- (Moved to GetCustomInstructionsHandler)
    // private async _getAllToolsStatus(): Promise<{ [toolIdentifier: string]: { description?: string, enabled: boolean, type: 'standard' | 'mcp', serverName?: string } }> {
    //     // ... implementation moved ...
    // }

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

// Helper function moved to src/utils/configUtils.ts


export function deactivate() {}
